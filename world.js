/**
 * ============================================================================
 * GAME ENGINE: KẺ DU HÀNH THỜI KHÔNG (TIME TRAVELER 2D ARPG)
 * FILE: world.js - BẢN ĐỒ, SPATIAL HASH GRID & 10 CƠ CHẾ THỜI KHÔNG
 * PHIÊN BẢN: ULTRA ENGINE UPDATE (PHẦN 1/2)
 * ============================================================================
 */

(function () {
    "use strict";

    window.Game = window.Game || {};
    window.Game.state = window.Game.state || {};

    /* ========================================================================== */
    /* I. HẰNG SỐ BẢN ĐỒ & CẤU TRÚC KỶ NGUYÊN                                     */
    /* ========================================================================== */
    const WORLD_CONSTANTS = {
        WIDTH: 4096,
        HEIGHT: 4096,
        TILE_SIZE: 64,
        GRID_CELL_SIZE: 128,

        ERAS: {
            PAST: "PAST",
            PRESENT: "PRESENT",
            FUTURE: "FUTURE"
        },

        TERRAIN_TYPES: {
            VOID: 0,
            GRASS: 1,
            STONE_PATH: 2,
            WATER: 3,
            ANCIENT_RUINS: 4,
            CURSED_SOIL: 5,
            CYBER_TILE: 6,
            LAVA: 7,
            HEALING_WATER: 8,
            ZERO_G_GROUND: 9
        },

        SHRINE_TYPES: {
            WAR: "SHRINE_WAR",
            IMMORTALITY: "SHRINE_IMMORTALITY",
            SPACE: "SHRINE_SPACE"
        },

        INTERACTION_RADIUS: 85,
        INTERACTION_CHANNEL_TIME: 1.5,
        SHRINE_COOLDOWN: 45.0,
        PORTAL_COOLDOWN: 6.0,
        TURRET_REPAIR_COST: 150
    };

    /* ========================================================================== */
    /* II. SPATIAL HASH GRID TỐI ƯU HÓA 120HZ (CHỐNG RÒ RỈ BỘ NHỚ & ZERO-GC)      */
    /* ========================================================================== */
    class SpatialHashGrid {
        constructor(width, height, cellSize = 128) {
            this.width = width;
            this.height = height;
            this.cellSize = cellSize;
            this.cols = Math.ceil(width / cellSize);
            this.rows = Math.ceil(height / cellSize);
            this.totalCells = this.cols * this.rows;

            // Bộ nhớ đệm tĩnh mảng ô cell tránh cấp phát Map liên tục
            this.cells = new Array(this.totalCells);
            for (let i = 0; i < this.totalCells; i++) {
                this.cells[i] = [];
            }

            // Bản đồ đối tượng -> chỉ số ô cell đã chiếm chỗ
            this.entityCellMap = new Map();
            this.idCounter = 1;
        }

        _hash(cellX, cellY) {
            return cellX + cellY * this.cols;
        }

        _getCellCoords(x, y) {
            const cx = Math.floor(x / this.cellSize);
            const cy = Math.floor(y / this.cellSize);
            return {
                cx: Math.max(0, Math.min(this.cols - 1, cx)),
                cy: Math.max(0, Math.min(this.rows - 1, cy))
            };
        }

        clear() {
            for (let i = 0; i < this.totalCells; i++) {
                this.cells[i].length = 0;
            }
            this.entityCellMap.clear();
        }

        insert(entity) {
            if (!entity || typeof entity.x !== "number" || typeof entity.y !== "number") return;
            const r = entity.radius || 18;
            const minC = this._getCellCoords(entity.x - r, entity.y - r);
            const maxC = this._getCellCoords(entity.x + r, entity.y + r);

            const occupiedIndices = [];

            for (let cy = minC.cy; cy <= maxC.cy; cy++) {
                for (let cx = minC.cx; cx <= maxC.cx; cx++) {
                    const idx = this._hash(cx, cy);
                    this.cells[idx].push(entity);
                    occupiedIndices.push(idx);
                }
            }

            this.entityCellMap.set(entity, occupiedIndices);
        }

        remove(entity) {
            const indices = this.entityCellMap.get(entity);
            if (!indices) return;

            for (let i = 0; i < indices.length; i++) {
                const cell = this.cells[indices[i]];
                const entIdx = cell.indexOf(entity);
                if (entIdx !== -1) {
                    // Fast swap and pop để đạt O(1) xóa phần tử mảng
                    const last = cell.pop();
                    if (entIdx < cell.length) {
                        cell[entIdx] = last;
                    }
                }
            }
            this.entityCellMap.delete(entity);
        }

        update(entity) {
            this.remove(entity);
            this.insert(entity);
        }

        queryBox(minX, minY, maxX, maxY, filterFn = null) {
            const results = [];
            const queryId = this.idCounter++;
            const minC = this._getCellCoords(minX, minY);
            const maxC = this._getCellCoords(maxX, maxY);

            for (let cy = minC.cy; cy <= maxC.cy; cy++) {
                for (let cx = minC.cx; cx <= maxC.cx; cx++) {
                    const cell = this.cells[this._hash(cx, cy)];
                    for (let i = 0; i < cell.length; i++) {
                        const ent = cell[i];
                        if (ent._shgLastQueryId === queryId) continue;
                        ent._shgLastQueryId = queryId;

                        const r = ent.radius || 0;
                        if (ent.x + r >= minX && ent.x - r <= maxX &&
                            ent.y + r >= minY && ent.y - r <= maxY) {
                            if (!filterFn || filterFn(ent)) {
                                results.push(ent);
                            }
                        }
                    }
                }
            }
            return results;
        }

        queryRadius(x, y, radius, filterFn = null) {
            const results = [];
            const queryId = this.idCounter++;
            const minC = this._getCellCoords(x - radius, y - radius);
            const maxC = this._getCellCoords(x + radius, y + radius);
            const r2 = radius * radius;

            for (let cy = minC.cy; cy <= maxC.cy; cy++) {
                for (let cx = minC.cx; cx <= maxC.cx; cx++) {
                    const cell = this.cells[this._hash(cx, cy)];
                    for (let i = 0; i < cell.length; i++) {
                        const ent = cell[i];
                        if (ent._shgLastQueryId === queryId) continue;
                        ent._shgLastQueryId = queryId;

                        const dx = ent.x - x;
                        const dy = ent.y - y;
                        if ((dx * dx + dy * dy) <= r2) {
                            if (!filterFn || filterFn(ent)) {
                                results.push(ent);
                            }
                        }
                    }
                }
            }
            return results;
        }
    }

    /* ========================================================================== */
    /* III. LỚP WORLD ENGINE CHÍNH                                                */
    /* ========================================================================== */
    class World {
        constructor() {
            this.width = WORLD_CONSTANTS.WIDTH;
            this.height = WORLD_CONSTANTS.HEIGHT;
            this.tileSize = WORLD_CONSTANTS.TILE_SIZE;
            this.cols = Math.floor(this.width / this.tileSize);
            this.rows = Math.floor(this.height / this.tileSize);

            this.spatialGrid = new SpatialHashGrid(this.width, this.height, WORLD_CONSTANTS.GRID_CELL_SIZE);
            this.staticColliders = [];

            // Dữ liệu Tile Maps cho 3 Kỷ nguyên
            this.tileMaps = {
                [WORLD_CONSTANTS.ERAS.PAST]: new Uint8Array(this.cols * this.rows),
                [WORLD_CONSTANTS.ERAS.PRESENT]: new Uint8Array(this.cols * this.rows),
                [WORLD_CONSTANTS.ERAS.FUTURE]: new Uint8Array(this.cols * this.rows)
            };

            this.collisionMap = new Uint8Array(this.cols * this.rows);

            this.currentEra = WORLD_CONSTANTS.ERAS.PRESENT;
            this.targetEra = WORLD_CONSTANTS.ERAS.PRESENT;

            // Offscreen Canvas Chunk Caching
            this.chunkSize = 1024;
            this.chunksCols = Math.ceil(this.width / this.chunkSize);
            this.chunksRows = Math.ceil(this.height / this.chunkSize);
            this.terrainChunks = new Map();

            // 10 Cơ chế Thời Không
            this.shrines = [];
            this.riftPortals = [];
            this.storms = [];
            this.stormTimer = 0;
            this.stormInterval = 18.0;
            this.eternityTree = null;
            this.healingSprings = [];
            this.autoTurrets = [];
            this.spikeTraps = [];
            this.paradoxVault = null;
            this.zeroGravityZones = [];
            this.cursedGrounds = [];

            // Hạt hiệu ứng & Rung chấn Camera
            this.weatherParticles = [];
            this.maxWeatherParticles = 100;
            this.floatingRocks = [];
            this.cameraShake = { x: 0, y: 0, intensity: 0, duration: 0 };
            this.minimapExpanded = false;
        }

        init(canvas, ctx) {
            this.mainCanvas = canvas || (window.Game.Main && window.Game.Main.canvas) || document.getElementById('gameCanvas');
            this.mainCtx = ctx || (this.mainCanvas ? this.mainCanvas.getContext('2d') : null);

            this._generateProceduralTerrain();
            this._initStaticColliders();
            this._initInteractiveSystems();
            this._initWeatherAndFloatingDebris();
            this._prebuildOffscreenTerrainChunks();

            if (window.Game.state) {
                window.Game.state.currentEra = this.currentEra;
                window.Game.state.timeline = window.Game.state.timeline || this.currentEra;
                window.Game.state.isTreePlanted = window.Game.state.isTreePlanted || false;
                window.Game.state.paradoxSeals = window.Game.state.paradoxSeals || {
                    PAST: false,
                    PRESENT: false,
                    FUTURE: false
                };
                window.Game.state.bonusMaxHp = window.Game.state.bonusMaxHp || 0;
            }
        }

        _generateProceduralTerrain() {
            const T = WORLD_CONSTANTS.TERRAIN_TYPES;

            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    const idx = y * this.cols + x;

                    if (x <= 1 || x >= this.cols - 2 || y <= 1 || y >= this.rows - 2) {
                        this.tileMaps.PAST[idx] = T.VOID;
                        this.tileMaps.PRESENT[idx] = T.VOID;
                        this.tileMaps.FUTURE[idx] = T.VOID;
                        this.collisionMap[idx] = 1;
                        continue;
                    }

                    const px = x * this.tileSize;
                    const py = y * this.tileSize;
                    const distCenter = Math.hypot(px - 2048, py - 2048);

                    // Trung tâm: Suối Sinh Mệnh ở Hiện Tại
                    if (distCenter < 220) {
                        this.tileMaps.PAST[idx] = T.WATER;
                        this.tileMaps.PRESENT[idx] = T.HEALING_WATER;
                        this.tileMaps.FUTURE[idx] = T.CYBER_TILE;
                        this.collisionMap[idx] = 0;
                        continue;
                    }

                    // Tây Bắc: Vùng Đất Quỷ Ám
                    if (px < 1350 && py < 1350 && distCenter > 420) {
                        this.tileMaps.PAST[idx] = T.STONE_PATH;
                        this.tileMaps.PRESENT[idx] = T.CURSED_SOIL;
                        this.tileMaps.FUTURE[idx] = T.LAVA;
                        this.collisionMap[idx] = 0;
                        continue;
                    }

                    // Đông Nam: Vực Không Trọng Lực
                    if (px > 2650 && py > 2650) {
                        this.tileMaps.PAST[idx] = T.ANCIENT_RUINS;
                        this.tileMaps.PRESENT[idx] = T.GRASS;
                        this.tileMaps.FUTURE[idx] = T.ZERO_G_GROUND;
                        this.collisionMap[idx] = 0;
                        continue;
                    }

                    // Trục lộ chính
                    if (Math.abs(py - 2048) < 96 || Math.abs(px - 2048) < 96) {
                        this.tileMaps.PAST[idx] = T.STONE_PATH;
                        this.tileMaps.PRESENT[idx] = T.STONE_PATH;
                        this.tileMaps.FUTURE[idx] = T.CYBER_TILE;
                        this.collisionMap[idx] = 0;
                        continue;
                    }

                    // Hồ nước cổ đại
                    const lakeNoise = Math.sin(x * 0.14) + Math.cos(y * 0.14);
                    if (lakeNoise > 1.3 && distCenter > 600) {
                        this.tileMaps.PAST[idx] = T.WATER;
                        this.tileMaps.PRESENT[idx] = T.WATER;
                        this.tileMaps.FUTURE[idx] = T.ANCIENT_RUINS;
                        this.collisionMap[idx] = 1;
                        continue;
                    }

                    // Địa hình cơ bản
                    this.tileMaps.PAST[idx] = T.ANCIENT_RUINS;
                    this.tileMaps.PRESENT[idx] = T.GRASS;
                    this.tileMaps.FUTURE[idx] = T.CYBER_TILE;
                    this.collisionMap[idx] = 0;
                }
            }
        }

        _initStaticColliders() {
            this.staticColliders = [];

            this.staticColliders.push({ x: this.width / 2, y: 32, width: this.width, height: 64, type: "WALL" });
            this.staticColliders.push({ x: this.width / 2, y: this.height - 32, width: this.width, height: 64, type: "WALL" });
            this.staticColliders.push({ x: 32, y: this.height / 2, width: 64, height: this.height, type: "WALL" });
            this.staticColliders.push({ x: this.width - 32, y: this.height / 2, width: 64, height: this.height, type: "WALL" });

            for (let y = 2; y < this.rows - 2; y++) {
                for (let x = 2; x < this.cols - 2; x++) {
                    const idx = y * this.cols + x;
                    if (this.collisionMap[idx] === 1) {
                        this.staticColliders.push({
                            x: x * this.tileSize + this.tileSize / 2,
                            y: y * this.tileSize + this.tileSize / 2,
                            width: this.tileSize,
                            height: this.tileSize,
                            type: "OBSTACLE"
                        });
                    }
                }
            }

            for (let i = 0; i < this.staticColliders.length; i++) {
                const c = this.staticColliders[i];
                c.radius = Math.max(c.width, c.height) / 2;
                this.spatialGrid.insert(c);
            }
        }

        _initInteractiveSystems() {
            // IV.1 ĐÀI CẦU NGUYỆN NHÂN QUẢ (TEMPORAL SHRINES)
            this.shrines = [
                {
                    id: "shrine_war",
                    type: WORLD_CONSTANTS.SHRINE_TYPES.WAR,
                    name: "Đài Chiến Binh Nhân Quả",
                    x: 1520,
                    y: 1820,
                    radius: 38,
                    cooldown: 0,
                    maxCooldown: WORLD_CONSTANTS.SHRINE_COOLDOWN,
                    activeBeamTimer: 0,
                    runeAngle: 0,
                    buffType: "DAMAGE_BOOST",
                    buffDuration: 10.0,
                    color: "#ff3b30",
                    glowColor: "rgba(255, 59, 48, 0.45)"
                },
                {
                    id: "shrine_immortality",
                    type: WORLD_CONSTANTS.SHRINE_TYPES.IMMORTALITY,
                    name: "Đài Bất Tử Quang Huy",
                    x: 2320,
                    y: 1820,
                    radius: 38,
                    cooldown: 0,
                    maxCooldown: WORLD_CONSTANTS.SHRINE_COOLDOWN,
                    activeBeamTimer: 0,
                    runeAngle: 0,
                    buffType: "INVULNERABILITY",
                    buffDuration: 10.0,
                    color: "#ffd60a",
                    glowColor: "rgba(255, 214, 10, 0.45)"
                },
                {
                    id: "shrine_space",
                    type: WORLD_CONSTANTS.SHRINE_TYPES.SPACE,
                    name: "Đài Thời Không Thần Vực",
                    x: 2048,
                    y: 1250,
                    radius: 38,
                    cooldown: 0,
                    maxCooldown: WORLD_CONSTANTS.SHRINE_COOLDOWN,
                    activeBeamTimer: 0,
                    runeAngle: 0,
                    buffType: "COOLDOWN_REDUCTION",
                    buffDuration: 12.0,
                    color: "#00f0ff",
                    glowColor: "rgba(0, 240, 255, 0.45)"
                }
            ];

            // IV.2 VẾT NỨT THỜI KHÔNG DI ĐỘNG (RIFT PORTALS)
            this.riftPortals = [
                {
                    id: "portal_pair_1_a",
                    pairId: "portal_pair_1_b",
                    name: "Cổng Hư Không Khởi Điểm",
                    x: 1024,
                    y: 2048,
                    targetX: 3072,
                    targetY: 2048,
                    radius: 42,
                    cooldown: 0,
                    maxCooldown: WORLD_CONSTANTS.PORTAL_COOLDOWN,
                    vortexRotation: 0,
                    pulsePhase: 0,
                    color: "#9d4edd"
                },
                {
                    id: "portal_pair_1_b",
                    pairId: "portal_pair_1_a",
                    name: "Cổng Hư Không Đích Đến",
                    x: 3072,
                    y: 2048,
                    targetX: 1024,
                    targetY: 2048,
                    radius: 42,
                    cooldown: 0,
                    maxCooldown: WORLD_CONSTANTS.PORTAL_COOLDOWN,
                    vortexRotation: 0,
                    pulsePhase: Math.PI,
                    color: "#9d4edd"
                },
                {
                    id: "portal_pair_2_a",
                    pairId: "portal_pair_2_b",
                    name: "Cổng Hư Thiên Nam",
                    x: 2048,
                    y: 3200,
                    targetX: 2048,
                    targetY: 896,
                    radius: 42,
                    cooldown: 0,
                    maxCooldown: WORLD_CONSTANTS.PORTAL_COOLDOWN,
                    vortexRotation: 0,
                    pulsePhase: 0,
                    color: "#06d6a0"
                },
                {
                    id: "portal_pair_2_b",
                    pairId: "portal_pair_2_a",
                    name: "Cổng Hư Thiên Bắc",
                    x: 2048,
                    y: 896,
                    targetX: 2048,
                    targetY: 3200,
                    radius: 42,
                    cooldown: 0,
                    maxCooldown: WORLD_CONSTANTS.PORTAL_COOLDOWN,
                    vortexRotation: 0,
                    pulsePhase: Math.PI,
                    color: "#06d6a0"
                }
            ];

            // IV.4 CÂY NHÂN QUẢ (ETERNITY TREE)
            this.eternityTree = {
                x: 1820,
                y: 2280,
                radius: 48,
                hasFruit: false,
                isPlanted: false,
                growthStage: 0,
                fruitHarvested: false,
                glowPulse: 0
            };

            // IV.5 SUỐI NƯỚC SINH MỆNH (HEALING SPRINGS)
            this.healingSprings = [
                {
                    id: "healing_spring_core",
                    name: "Suối Thánh Sinh Mệnh",
                    x: 2048,
                    y: 2048,
                    radius: 190,
                    healPerSecond: 25,
                    shieldPerSecond: 15,
                    era: WORLD_CONSTANTS.ERAS.PRESENT,
                    ripplePhase: 0,
                    bubbleParticles: []
                }
            ];

            // IV.6 TRỤ PHÁO TỰ ĐỘNG (AUTO-TURRETS)
            this.autoTurrets = [
                {
                    id: "turret_alpha",
                    name: "Trụ Laser Cổ Alpha",
                    x: 2560,
                    y: 1536,
                    radius: 36,
                    attackRange: 420,
                    damage: 65,
                    fireRate: 0.85,
                    fireTimer: 0,
                    isRepaired: false,
                    repairCost: WORLD_CONSTANTS.TURRET_REPAIR_COST,
                    target: null,
                    barrelAngle: 0,
                    laserBeamVisual: null,
                    era: WORLD_CONSTANTS.ERAS.FUTURE
                },
                {
                    id: "turret_beta",
                    name: "Trụ Laser Cổ Beta",
                    x: 1536,
                    y: 2560,
                    radius: 36,
                    attackRange: 420,
                    damage: 65,
                    fireRate: 0.85,
                    fireTimer: 0,
                    isRepaired: false,
                    repairCost: WORLD_CONSTANTS.TURRET_REPAIR_COST,
                    target: null,
                    barrelAngle: 0,
                    laserBeamVisual: null,
                    era: WORLD_CONSTANTS.ERAS.FUTURE
                }
            ];

            // IV.7 BẪY ĐINH PHẢN NGHỊCH (SPIKE TRAP REVERSAL)
            this.spikeTraps = [
                {
                    id: "trap_cluster_1",
                    x: 1720,
                    y: 1720,
                    width: 140,
                    height: 140,
                    spikeState: "UP",
                    isReversed: false,
                    damage: 40,
                    bleedDamage: 8,
                    cycleTimer: 0,
                    cycleInterval: 3.5,
                    lever: { x: 1620, y: 1720, radius: 26, isActivated: false }
                },
                {
                    id: "trap_cluster_2",
                    x: 2380,
                    y: 2380,
                    width: 140,
                    height: 140,
                    spikeState: "UP",
                    isReversed: false,
                    damage: 40,
                    bleedDamage: 8,
                    cycleTimer: 1.75,
                    cycleInterval: 3.5,
                    lever: { x: 2480, y: 2380, radius: 26, isActivated: false }
                }
            ];

            // IV.8 RƯƠNG NGHỊCH LÝ & 3 CỘT ẤN KÝ
            this.paradoxVault = {
                id: "vault_sanctum",
                name: "Rương Báu Nghịch Lý Tối Cao",
                x: 2048,
                y: 2560,
                radius: 46,
                isUnlocked: false,
                isOpened: false,
                pillarSeals: {
                    [WORLD_CONSTANTS.ERAS.PAST]: {
                        id: "seal_past",
                        name: "Cột Ấn Ký Thái Cổ",
                        x: 1200,
                        y: 1200,
                        radius: 34,
                        activated: false,
                        color: "#ff9f1c"
                    },
                    [WORLD_CONSTANTS.ERAS.PRESENT]: {
                        id: "seal_present",
                        name: "Cột Ấn Ký Thực Tại",
                        x: 2896,
                        y: 1200,
                        radius: 34,
                        activated: false,
                        color: "#2ec4b6"
                    },
                    [WORLD_CONSTANTS.ERAS.FUTURE]: {
                        id: "seal_future",
                        name: "Cột Ấn Ký Tận Thế",
                        x: 2048,
                        y: 3300,
                        radius: 34,
                        activated: false,
                        color: "#e71d36"
                    }
                },
                pulseAngle: 0
            };

            // IV.9 VỰC KHÔNG TRỌNG LỰC
            this.zeroGravityZones = [
                {
                    id: "zero_g_sector",
                    name: "Vực Không Trọng Lực",
                    x: 3100,
                    y: 3100,
                    radius: 360,
                    projectileSpeedBonus: 0.40,
                    attackRangeBonus: 0.40,
                    floatingDebrisCount: 20
                }
            ];

            // IV.10 VÙNG ĐẤT QUỶ ÁM
            this.cursedGrounds = [
                {
                    id: "cursed_abyss_sector",
                    name: "Vùng Đất Quỷ Ám",
                    x: 950,
                    y: 950,
                    radius: 420,
                    expMultiplier: 1.50,
                    spawnRateMultiplier: 2.0
                }
            ];
        }

        _initWeatherAndFloatingDebris() {
            this.weatherParticles = [];
            for (let i = 0; i < this.maxWeatherParticles; i++) {
                this.weatherParticles.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    vx: (Math.random() - 0.5) * 20,
                    vy: 30 + Math.random() * 45,
                    size: 1.5 + Math.random() * 2.5
                });
            }

            this.floatingRocks = [];
            const zg = this.zeroGravityZones[0];
            if (zg) {
                for (let i = 0; i < zg.floatingDebrisCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * (zg.radius * 0.85);
                    this.floatingRocks.push({
                        baseX: zg.x + Math.cos(angle) * dist,
                        baseY: zg.y + Math.sin(angle) * dist,
                        x: 0,
                        y: 0,
                        floatSpeed: 0.6 + Math.random() * 1.2,
                        amplitude: 8 + Math.random() * 16,
                        size: 10 + Math.random() * 22,
                        rotation: Math.random() * Math.PI * 2,
                        rotSpeed: (Math.random() - 0.5) * 0.8,
                        phase: Math.random() * Math.PI * 2
                    });
                }
            }
        }

        _prebuildOffscreenTerrainChunks() {
            const eras = [
                WORLD_CONSTANTS.ERAS.PAST,
                WORLD_CONSTANTS.ERAS.PRESENT,
                WORLD_CONSTANTS.ERAS.FUTURE
            ];

            for (let e = 0; e < eras.length; e++) {
                const era = eras[e];
                for (let cy = 0; cy < this.chunksRows; cy++) {
                    for (let cx = 0; cx < this.chunksCols; cx++) {
                        const chunkCanvas = document.createElement("canvas");
                        chunkCanvas.width = this.chunkSize;
                        chunkCanvas.height = this.chunkSize;
                        const chunkCtx = chunkCanvas.getContext("2d", { alpha: false });

                        this._renderTilesToChunkContext(chunkCtx, era, cx, cy);

                        const key = `${era}_${cx}_${cy}`;
                        this.terrainChunks.set(key, chunkCanvas);
                    }
                }
            }
        }

        _renderTilesToChunkContext(ctx, era, chunkX, chunkY) {
            const startPixelX = chunkX * this.chunkSize;
            const startPixelY = chunkY * this.chunkSize;
            const tileMap = this.tileMaps[era];

            const startTileX = Math.floor(startPixelX / this.tileSize);
            const startTileY = Math.floor(startPixelY / this.tileSize);
            const endTileX = Math.min(this.cols, Math.ceil((startPixelX + this.chunkSize) / this.tileSize));
            const endTileY = Math.min(this.rows, Math.ceil((startPixelY + this.chunkSize) / this.tileSize));

            ctx.fillStyle = era === WORLD_CONSTANTS.ERAS.PAST ? "#251e18" :
                            era === WORLD_CONSTANTS.ERAS.PRESENT ? "#122315" : "#0f1423";
            ctx.fillRect(0, 0, this.chunkSize, this.chunkSize);

            for (let ty = startTileY; ty < endTileY; ty++) {
                for (let tx = startTileX; tx < endTileX; tx++) {
                    const idx = ty * this.cols + tx;
                    const tileType = tileMap[idx];
                    const destX = tx * this.tileSize - startPixelX;
                    const destY = ty * this.tileSize - startPixelY;

                    this._drawTilePrimitive(ctx, tileType, destX, destY, era, tx, ty);
                }
            }
        }

        _drawTilePrimitive(ctx, type, x, y, era, tx, ty) {
            const S = this.tileSize;
            const T = WORLD_CONSTANTS.TERRAIN_TYPES;

            switch (type) {
                case T.VOID:
                    ctx.fillStyle = "#050508";
                    ctx.fillRect(x, y, S, S);
                    break;
                case T.GRASS:
                    ctx.fillStyle = "#2d5a27";
                    ctx.fillRect(x, y, S, S);
                    ctx.fillStyle = "#3a7332";
                    if ((tx + ty) % 2 === 0) {
                        ctx.fillRect(x + 12, y + 16, 6, 8);
                        ctx.fillRect(x + 36, y + 42, 5, 7);
                    }
                    break;
                case T.STONE_PATH:
                    ctx.fillStyle = "#4a4e51";
                    ctx.fillRect(x, y, S, S);
                    ctx.strokeStyle = "#35383a";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 2, y + 2, S - 4, S - 4);
                    break;
                case T.WATER:
                    ctx.fillStyle = "#1d3557";
                    ctx.fillRect(x, y, S, S);
                    ctx.fillStyle = "#457b9d";
                    ctx.fillRect(x + 8, y + 28, S - 16, 4);
                    break;
                case T.HEALING_WATER:
                    ctx.fillStyle = "#0077b6";
                    ctx.fillRect(x, y, S, S);
                    ctx.fillStyle = "rgba(72, 202, 228, 0.4)";
                    ctx.fillRect(x + 4, y + 4, S - 8, S - 8);
                    break;
                case T.ANCIENT_RUINS:
                    ctx.fillStyle = "#5c4d3c";
                    ctx.fillRect(x, y, S, S);
                    ctx.fillStyle = "#7f6a52";
                    ctx.fillRect(x + 10, y + 10, S - 20, S - 20);
                    break;
                case T.CURSED_SOIL:
                    ctx.fillStyle = "#240046";
                    ctx.fillRect(x, y, S, S);
                    ctx.fillStyle = "#3c096c";
                    if ((tx * 3 + ty) % 5 === 0) {
                        ctx.fillRect(x + 16, y + 20, 14, 14);
                    }
                    break;
                case T.CYBER_TILE:
                    ctx.fillStyle = "#111927";
                    ctx.fillRect(x, y, S, S);
                    ctx.strokeStyle = "#1f3a5f";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, S, S);
                    break;
                case T.ZERO_G_GROUND:
                    ctx.fillStyle = "#1b1938";
                    ctx.fillRect(x, y, S, S);
                    ctx.fillStyle = "#2d2459";
                    ctx.fillRect(x + 14, y + 14, S - 28, S - 28);
                    break;
                case T.LAVA:
                    ctx.fillStyle = "#9d0208";
                    ctx.fillRect(x, y, S, S);
                    ctx.fillStyle = "#dc2f02";
                    ctx.fillRect(x + 10, y + 10, S - 20, S - 20);
                    break;
                default:
                    ctx.fillStyle = "#1c1c1c";
                    ctx.fillRect(x, y, S, S);
                    break;
            }
        }

        setEra(targetEra) {
            if (!WORLD_CONSTANTS.ERAS[targetEra] || this.currentEra === targetEra) return;
            this.targetEra = targetEra;
            this.currentEra = targetEra;

            if (window.Game.state) {
                window.Game.state.currentEra = targetEra;
                window.Game.state.timeline = targetEra;
            }

            this.addCameraShake(7.5, 0.45);

            if (this.eternityTree) {
                if (this.currentEra === WORLD_CONSTANTS.ERAS.PAST) {
                    this.eternityTree.growthStage = 0;
                } else if (this.currentEra === WORLD_CONSTANTS.ERAS.PRESENT) {
                    this.eternityTree.growthStage = 1;
                } else if (this.currentEra === WORLD_CONSTANTS.ERAS.FUTURE) {
                    this.eternityTree.growthStage = 2;
                    if (this.eternityTree.isPlanted && !this.eternityTree.fruitHarvested) {
                        this.eternityTree.hasFruit = true;
                    }
                }
            }

            for (let i = 0; i < this.autoTurrets.length; i++) {
                const turret = this.autoTurrets[i];
                turret.target = null;
                turret.laserBeamVisual = null;
            }
        }

        onTimelineChanged(newTimeline) {
            this.setEra(newTimeline);
        }

        canMoveTo(x, y, radius = 18) {
            if (x - radius < 64 || x + radius > this.width - 64 ||
                y - radius < 64 || y + radius > this.height - 64) {
                return false;
            }

            const minTx = Math.floor((x - radius) / this.tileSize);
            const maxTx = Math.floor((x + radius) / this.tileSize);
            const minTy = Math.floor((y - radius) / this.tileSize);
            const maxTy = Math.floor((y + radius) / this.tileSize);

            for (let ty = minTy; ty <= maxTy; ty++) {
                for (let tx = minTx; tx <= maxTx; tx++) {
                    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return false;
                    const idx = ty * this.cols + tx;
                    if (this.collisionMap[idx] === 1) {
                        const tileLeft = tx * this.tileSize;
                        const tileRight = tileLeft + this.tileSize;
                        const tileTop = ty * this.tileSize;
                        const tileBottom = tileTop + this.tileSize;

                        const closestX = Math.max(tileLeft, Math.min(x, tileRight));
                        const closestY = Math.max(tileTop, Math.min(y, tileBottom));

                        const dx = x - closestX;
                        const dy = y - closestY;
                        if ((dx * dx + dy * dy) < (radius * radius)) {
                            return false;
                        }
                    }
                }
            }

            return true;
        }

        ensureSafePlayerPosition(player) {
            const p = player || window.Game.player;
            if (!p) return;
            if (this.canMoveTo(p.x, p.y, p.radius || 20)) return;

            let step = 32;
            for (let ring = 1; ring <= 10; ring++) {
                for (let i = -ring; i <= ring; i++) {
                    for (let j = -ring; j <= ring; j++) {
                        const testX = p.x + i * step;
                        const testY = p.y + j * step;
                        if (this.canMoveTo(testX, testY, p.radius || 20)) {
                            p.x = testX;
                            p.y = testY;
                            return;
                        }
                    }
                }
            }

            p.x = 2048;
            p.y = 2140;
        }

        getTerrainEffectAt(x, y) {
            const result = {
                inZeroGravity: false,
                inCursedGround: false,
                inHealingSpring: false,
                speedMultiplier: 1.0,
                damageMultiplier: 1.0,
                expMultiplier: 1.0,
                attackRangeMultiplier: 1.0,
                projectileSpeedMultiplier: 1.0
            };

            for (let i = 0; i < this.zeroGravityZones.length; i++) {
                const zg = this.zeroGravityZones[i];
                const distSq = (x - zg.x) * (x - zg.x) + (y - zg.y) * (y - zg.y);
                if (distSq <= zg.radius * zg.radius) {
                    result.inZeroGravity = true;
                    result.attackRangeMultiplier += zg.attackRangeBonus;
                    result.projectileSpeedMultiplier += zg.projectileSpeedBonus;
                    result.speedMultiplier *= 1.15;
                    break;
                }
            }

            for (let i = 0; i < this.cursedGrounds.length; i++) {
                const cg = this.cursedGrounds[i];
                const distSq = (x - cg.x) * (x - cg.x) + (y - cg.y) * (y - cg.y);
                if (distSq <= cg.radius * cg.radius) {
                    result.inCursedGround = true;
                    result.expMultiplier *= cg.expMultiplier;
                    break;
                }
            }

            if (this.currentEra === WORLD_CONSTANTS.ERAS.PRESENT) {
                for (let i = 0; i < this.healingSprings.length; i++) {
                    const hs = this.healingSprings[i];
                    const distSq = (x - hs.x) * (x - hs.x) + (y - hs.y) * (y - hs.y);
                    if (distSq <= hs.radius * hs.radius) {
                        result.inHealingSpring = true;
                        result.healPerSecond = hs.healPerSecond;
                        result.shieldPerSecond = hs.shieldPerSecond;
                        break;
                    }
                }
            }

            return result;
        }

        isPlayerInCursedGround(player) {
            const p = player || window.Game.player;
            if (!p || typeof p.x !== 'number') return false;
            for (let i = 0; i < this.cursedGrounds.length; i++) {
                const cg = this.cursedGrounds[i];
                const dx = p.x - cg.x;
                const dy = p.y - cg.y;
                if (dx * dx + dy * dy <= cg.radius * cg.radius) return true;
            }
            return false;
        }

        getNearbyInteractable(x, y, radius = WORLD_CONSTANTS.INTERACTION_RADIUS) {
            let closest = null;
            let minDistSq = radius * radius;

            for (let i = 0; i < this.shrines.length; i++) {
                const s = this.shrines[i];
                const dSq = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closest = { type: "SHRINE", data: s, distance: Math.sqrt(dSq) };
                }
            }

            for (let i = 0; i < this.riftPortals.length; i++) {
                const p = this.riftPortals[i];
                const dSq = (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y);
                if (dSq < minDistSq && p.cooldown <= 0) {
                    minDistSq = dSq;
                    closest = { type: "PORTAL", data: p, distance: Math.sqrt(dSq) };
                }
            }

            if (this.eternityTree) {
                const et = this.eternityTree;
                const dSq = (x - et.x) * (x - et.x) + (y - et.y) * (y - et.y);
                if (dSq < minDistSq) {
                    if (this.currentEra === WORLD_CONSTANTS.ERAS.PAST && !et.isPlanted) {
                        minDistSq = dSq;
                        closest = { type: "TREE_PLANT", data: et, distance: Math.sqrt(dSq) };
                    } else if (this.currentEra === WORLD_CONSTANTS.ERAS.FUTURE && et.hasFruit) {
                        minDistSq = dSq;
                        closest = { type: "FRUIT_HARVEST", data: et, distance: Math.sqrt(dSq) };
                    }
                }
            }

            if (this.currentEra === WORLD_CONSTANTS.ERAS.FUTURE) {
                for (let i = 0; i < this.autoTurrets.length; i++) {
                    const turret = this.autoTurrets[i];
                    if (!turret.isRepaired) {
                        const dSq = (x - turret.x) * (x - turret.x) + (y - turret.y) * (y - turret.y);
                        if (dSq < minDistSq) {
                            minDistSq = dSq;
                            closest = { type: "TURRET_REPAIR", data: turret, distance: Math.sqrt(dSq) };
                        }
                    }
                }
            }

            for (let i = 0; i < this.spikeTraps.length; i++) {
                const trap = this.spikeTraps[i];
                const lever = trap.lever;
                const dSq = (x - lever.x) * (x - lever.x) + (y - lever.y) * (y - lever.y);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closest = { type: "TRAP_LEVER", data: trap, distance: Math.sqrt(dSq) };
                }
            }

            if (this.paradoxVault) {
                const seal = this.paradoxVault.pillarSeals[this.currentEra];
                if (seal && !seal.activated) {
                    const dSq = (x - seal.x) * (x - seal.x) + (y - seal.y) * (y - seal.y);
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        closest = { type: "PARADOX_SEAL", data: seal, distance: Math.sqrt(dSq) };
                    }
                }

                const pv = this.paradoxVault;
                const dSqVault = (x - pv.x) * (x - pv.x) + (y - pv.y) * (y - pv.y);
                if (dSqVault < minDistSq && pv.isUnlocked && !pv.isOpened) {
                    minDistSq = dSqVault;
                    closest = { type: "PARADOX_VAULT", data: pv, distance: Math.sqrt(dSqVault) };
                }
            }

            return closest;
        }

        interact(player) {
            const p = player || window.Game.player;
            if (!p) return false;
            const interactable = this.getNearbyInteractable(p.x, p.y);
            if (!interactable) return false;

            switch (interactable.type) {
                case "SHRINE":
                    return this._activateShrine(interactable.data, p);
                case "PORTAL":
                    return this._useRiftPortal(interactable.data, p);
                case "TREE_PLANT":
                    return this._plantEternityTree(interactable.data, p);
                case "FRUIT_HARVEST":
                    return this._harvestFruitOfEternity(interactable.data, p);
                case "TURRET_REPAIR":
                    return this._repairAutoTurret(interactable.data, p);
                case "TRAP_LEVER":
                    return this._toggleSpikeTrapReversal(interactable.data, p);
                case "PARADOX_SEAL":
                    return this._activateParadoxSeal(interactable.data, p);
                case "PARADOX_VAULT":
                    return this._openParadoxVault(interactable.data, p);
                default:
                    return false;
            }
        }

        _activateShrine(shrine, player) {
            if (shrine.cooldown > 0) {
                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(shrine.x, shrine.y - 40, `Đang hồi (${Math.ceil(shrine.cooldown)}s)`, "#aaaaaa");
                }
                return false;
            }

            shrine.cooldown = shrine.maxCooldown;
            shrine.activeBeamTimer = 2.2;

            if (shrine.buffType === "DAMAGE_BOOST") {
                if (typeof player.addBuff === "function") {
                    player.addBuff({
                        id: "shrine_war_boost",
                        name: "Thần Lực Nhân Quả (+50% ST)",
                        duration: shrine.buffDuration,
                        statModifiers: { damageMultiplier: 1.50 },
                        color: "#ff3b30"
                    });
                }
            } else if (shrine.buffType === "INVULNERABILITY") {
                if (typeof player.addBuff === "function") {
                    player.addBuff({
                        id: "shrine_immortal_boost",
                        name: "Kim Thân Bất Hoại (10s)",
                        duration: shrine.buffDuration,
                        statModifiers: { isInvulnerable: true },
                        color: "#ffd60a"
                    });
                }
            } else if (shrine.buffType === "COOLDOWN_REDUCTION") {
                if (typeof player.addBuff === "function") {
                    player.addBuff({
                        id: "shrine_space_boost",
                        name: "Gia Tốc Hư Không (-30% Hồi Chiêu)",
                        duration: shrine.buffDuration,
                        statModifiers: { cooldownReduction: 0.30 },
                        color: "#00f0ff"
                    });
                }
                player.shield = Math.min(player.maxShield || 100, (player.shield || 0) + 50);
            }

            this.addCameraShake(4.0, 0.3);

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 50, `KÍCH HOẠT: ${shrine.name.toUpperCase()}!`, shrine.color);
            }

            return true;
        }

        _useRiftPortal(portal, player) {
            if (portal.cooldown > 0) return false;

            player.x = portal.targetX;
            player.y = portal.targetY;

            portal.cooldown = portal.maxCooldown;
            const targetPortal = this.riftPortals.find(p => p.id === portal.pairId);
            if (targetPortal) {
                targetPortal.cooldown = targetPortal.maxCooldown;
            }

            this.addCameraShake(5.0, 0.25);

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 45, "🌀 DỊCH CHUYỂN TỨC THỜI!", portal.color);
            }

            return true;
        }

        _plantEternityTree(tree, player) {
            if (this.currentEra !== WORLD_CONSTANTS.ERAS.PAST) return false;

            tree.isPlanted = true;
            if (window.Game.state) {
                window.Game.state.isTreePlanted = true;
            }

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(tree.x, tree.y - 50, "🌱 ĐÃ GIEO MẦM CÂY NHÂN QUẢ!", "#70e000");
            }

            return true;
        }

        _harvestFruitOfEternity(tree, player) {
            if (this.currentEra !== WORLD_CONSTANTS.ERAS.FUTURE || !tree.hasFruit) return false;

            tree.hasFruit = false;
            tree.fruitHarvested = true;

            if (window.Game.state) {
                window.Game.state.bonusMaxHp = (window.Game.state.bonusMaxHp || 0) + 10;
            }
            player.maxHp = (player.baseMaxHp || 100) + (window.Game.state ? window.Game.state.bonusMaxHp : 10);
            player.hp = Math.min(player.maxHp, player.hp + 50);

            this.addCameraShake(4.5, 0.35);

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 50, "🍎 QUẢ VĨNH HẰNG: +10 MAX HP VĨNH VIỄN!", "#ff4d6d");
            }

            return true;
        }

        _repairAutoTurret(turret, player) {
            if (turret.isRepaired) return false;

            const playerGold = player.gold || (window.Game.state ? window.Game.state.gold : 0) || 0;
            if (playerGold < turret.repairCost) {
                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(turret.x, turret.y - 40, `Cần ${turret.repairCost} Vàng để sửa!`, "#ff4444");
                }
                return false;
            }

            if (typeof player.spendGold === "function") {
                player.spendGold(turret.repairCost);
            } else if (window.Game.state) {
                window.Game.state.gold = Math.max(0, playerGold - turret.repairCost);
                player.gold = window.Game.state.gold;
            }

            turret.isRepaired = true;
            this.addCameraShake(3.0, 0.2);

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(turret.x, turret.y - 50, "⚡ ĐÃ SỬA CHỮA TRỤ LASER TỰ ĐỘNG!", "#00f0ff");
            }

            return true;
        }

        _toggleSpikeTrapReversal(trap, player) {
            trap.isReversed = !trap.isReversed;
            trap.lever.isActivated = trap.isReversed;

            const statusText = trap.isReversed ? "🛡️ BẪY ĐINH: ĐẢO CHIỀU DIỆT QUÁI!" : "⚠️ BẪY ĐINH: CHẾ ĐỘ THƯỜNG!";
            const statusColor = trap.isReversed ? "#00ff88" : "#ff3333";

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(trap.lever.x, trap.lever.y - 40, statusText, statusColor);
            }

            return true;
        }

        _activateParadoxSeal(seal, player) {
            if (seal.activated) return false;

            seal.activated = true;
            if (window.Game.state) {
                window.Game.state.paradoxSeals = window.Game.state.paradoxSeals || {};
                window.Game.state.paradoxSeals[this.currentEra] = true;
            }

            this.addCameraShake(5.0, 0.3);

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(seal.x, seal.y - 45, `✨ ĐÃ GIẢI ẤN KÝ: ${seal.name.toUpperCase()}!`, seal.color);
            }

            const seals = this.paradoxVault.pillarSeals;
            if (seals.PAST.activated && seals.PRESENT.activated && seals.FUTURE.activated) {
                this.paradoxVault.isUnlocked = true;
                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(this.paradoxVault.x, this.paradoxVault.y - 60, "🔓 RƯƠNG NGHỊCH LÝ ĐÃ MỞ KHÓA TẠI KHU TRUNG TÂM!", "#ffd700");
                }
            }

            return true;
        }

        _openParadoxVault(vault, player) {
            if (!vault.isUnlocked || vault.isOpened) return false;

            vault.isOpened = true;

            const bonusGold = 1000;
            if (typeof player.addGold === "function") {
                player.addGold(bonusGold);
            } else if (window.Game.state) {
                window.Game.state.gold = (window.Game.state.gold || 0) + bonusGold;
                player.gold = window.Game.state.gold;
            }

            if (window.Game.state && Array.isArray(window.Game.state.ownedWeapons)) {
                if (!window.Game.state.ownedWeapons.includes('void_scythe')) {
                    window.Game.state.ownedWeapons.push('void_scythe');
                }
            }

            this.addCameraShake(10.0, 0.7);

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(vault.x, vault.y - 70, "👑 MỞ RƯƠNG NGHỊCH LÝ: NHẬN VŨ KHÍ THẦN THOẠI & 1000 VÀNG!", "#ffd700");
            }

            return true;
        }

        addCameraShake(intensity, duration) {
            this.cameraShake.intensity = Math.max(this.cameraShake.intensity, intensity);
            this.cameraShake.duration = Math.max(this.cameraShake.duration, duration);
        }
/* ========================================================================== */
        /* IV. VÒNG LẶP UPDATE THẾ GIỚI & CƠ CHẾ THỜI GIAN THEO DELTA TIME           */
        /* ========================================================================== */
        update(dt, player, enemies = [], projectiles = []) {
            const p = player || window.Game.player;
            const ens = (Array.isArray(enemies) && enemies.length > 0)
                ? enemies
                : ((window.Game.Enemies && window.Game.Enemies.list) || []);

            // 1. Cập nhật Rung chấn Camera (Screen Shake)
            if (this.cameraShake.duration > 0) {
                this.cameraShake.duration -= dt;
                const progress = Math.max(0, this.cameraShake.duration);
                this.cameraShake.x = (Math.random() - 0.5) * 2 * this.cameraShake.intensity * progress;
                this.cameraShake.y = (Math.random() - 0.5) * 2 * this.cameraShake.intensity * progress;
                if (this.cameraShake.duration <= 0) {
                    this.cameraShake.x = 0;
                    this.cameraShake.y = 0;
                }
            }

            // 2. Đồng bộ trạng thái toàn cục Game.state.timeline
            if (window.Game.state && window.Game.state.timeline && this.currentEra !== window.Game.state.timeline) {
                this.setEra(window.Game.state.timeline);
            }

            // 3. Đồng bộ trạng thái Cây Nhân Quả & Rương Nghịch Lý từ Game.state
            if (window.Game.state && window.Game.state.isTreePlanted && this.eternityTree) {
                this.eternityTree.isPlanted = true;
            }

            if (window.Game.state && window.Game.state.paradoxSeals && this.paradoxVault) {
                if (window.Game.state.paradoxSeals.PAST) this.paradoxVault.pillarSeals.PAST.activated = true;
                if (window.Game.state.paradoxSeals.PRESENT) this.paradoxVault.pillarSeals.PRESENT.activated = true;
                if (window.Game.state.paradoxSeals.FUTURE) this.paradoxVault.pillarSeals.FUTURE.activated = true;

                if (this.paradoxVault.pillarSeals.PAST.activated &&
                    this.paradoxVault.pillarSeals.PRESENT.activated &&
                    this.paradoxVault.pillarSeals.FUTURE.activated) {
                    this.paradoxVault.isUnlocked = true;
                }
            }

            // 4. Update các hệ thống tương tác và môi trường
            this._updateTemporalShrines(dt);
            this._updateRiftPortals(dt, p);
            this._updateTemporalStorms(dt, p, ens);
            this._updateHealingSprings(dt, p);
            this._updateAutoTurrets(dt, ens, projectiles);
            this._updateSpikeTraps(dt, p, ens);
            this._updateParadoxVault(dt);
            this._updateWeatherAndFloatingRocks(dt);
        }

        /* ---------------------------------------------------------------------- */
        /* CẬP NHẬT IV.1: ĐÀI CẦU NGUYỆN NHÂN QUẢ                                 */
        /* ---------------------------------------------------------------------- */
        _updateTemporalShrines(dt) {
            for (let i = 0; i < this.shrines.length; i++) {
                const s = this.shrines[i];
                if (s.cooldown > 0) {
                    s.cooldown = Math.max(0, s.cooldown - dt);
                }
                if (s.activeBeamTimer > 0) {
                    s.activeBeamTimer = Math.max(0, s.activeBeamTimer - dt);
                }
                s.runeAngle = (s.runeAngle + dt * 1.2) % (Math.PI * 2);
            }
        }

        /* ---------------------------------------------------------------------- */
        /* CẬP NHẬT IV.2: CỔNG DỊCH CHUYỂN TỨC THỜI (HẠN CHẾ KẸT DỊCH CHUYỂN)     */
        /* ---------------------------------------------------------------------- */
        _updateRiftPortals(dt, player) {
            for (let i = 0; i < this.riftPortals.length; i++) {
                const p = this.riftPortals[i];
                if (p.cooldown > 0) {
                    p.cooldown = Math.max(0, p.cooldown - dt);
                }
                p.vortexRotation = (p.vortexRotation + dt * 2.8) % (Math.PI * 2);
                p.pulsePhase = (p.pulsePhase + dt * 3.5) % (Math.PI * 2);

                // Chỉ tự động dịch chuyển khi bước sâu vào tâm (<22px) và cổng đã sẵn sàng
                if (player && p.cooldown <= 0) {
                    const dx = player.x - p.x;
                    const dy = player.y - p.y;
                    if (dx * dx + dy * dy <= 22 * 22) {
                        this._useRiftPortal(p, player);
                    }
                }
            }
        }

        /* ---------------------------------------------------------------------- */
        /* CẬP NHẬT IV.3: BÃO SÉT DỊ BIẾN (STORM WARNING & LIGHTNING STRIKE)       */
        /* ---------------------------------------------------------------------- */
        _updateTemporalStorms(dt, player, enemies) {
            this.stormTimer += dt;
            if (this.stormTimer >= this.stormInterval) {
                this.stormTimer = 0;
                this._spawnTemporalStormCluster(player);
            }

            for (let i = this.storms.length - 1; i >= 0; i--) {
                const storm = this.storms[i];
                storm.timer += dt;

                if (storm.state === "WARNING") {
                    storm.warningProgress = Math.min(1.0, storm.timer / storm.warningDuration);
                    if (storm.timer >= storm.warningDuration) {
                        storm.state = "STRIKE";
                        storm.timer = 0;
                        this._executeStormStrike(storm, player, enemies);
                    }
                } else if (storm.state === "STRIKE") {
                    storm.strikeProgress = Math.min(1.0, storm.timer / storm.strikeDuration);
                    if (storm.timer >= storm.strikeDuration) {
                        this.storms.splice(i, 1);
                    }
                }
            }
        }

        _spawnTemporalStormCluster(player) {
            const stormCount = 3 + Math.floor(Math.random() * 3);
            const anchorX = player ? player.x : 2048;
            const anchorY = player ? player.y : 2048;

            for (let i = 0; i < stormCount; i++) {
                const offsetAngle = Math.random() * Math.PI * 2;
                const offsetDist = 120 + Math.random() * 480;
                const stormX = Math.max(128, Math.min(this.width - 128, anchorX + Math.cos(offsetAngle) * offsetDist));
                const stormY = Math.max(128, Math.min(this.height - 128, anchorY + Math.sin(offsetAngle) * offsetDist));

                this.storms.push({
                    x: stormX,
                    y: stormY,
                    radius: 80 + Math.random() * 40,
                    state: "WARNING",
                    timer: 0,
                    warningDuration: 1.2,
                    strikeDuration: 0.45,
                    warningProgress: 0,
                    strikeProgress: 0,
                    damage: 85,
                    color: "#00f0ff",
                    arcs: this._generateLightningBranchPoints(stormX, stormY)
                });
            }
        }

        _generateLightningBranchPoints(targetX, targetY) {
            const points = [];
            let currentX = targetX + (Math.random() - 0.5) * 80;
            let currentY = targetY - 450;
            points.push({ x: currentX, y: currentY });

            const segments = 8;
            const stepY = 450 / segments;

            for (let i = 1; i < segments; i++) {
                currentY += stepY;
                currentX += (Math.random() - 0.5) * 60;
                points.push({ x: currentX, y: currentY });
            }
            points.push({ x: targetX, y: targetY });
            return points;
        }

        _executeStormStrike(storm, player, enemies) {
            this.addCameraShake(6.5, 0.35);

            if (player) {
                const dx = player.x - storm.x;
                const dy = player.y - storm.y;
                if (dx * dx + dy * dy <= storm.radius * storm.radius) {
                    if (typeof player.takeDamage === "function") {
                        player.takeDamage(storm.damage, "LIGHTNING_STORM");
                    } else if (!player.isInvulnerable) {
                        player.hp = Math.max(0, (player.hp || 100) - storm.damage);
                    }
                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(player.x, player.y - 30, `-${storm.damage} SẤM SÉT!`, "#ff0055");
                    }
                }
            }

            const r2 = storm.radius * storm.radius;
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (!enemy || enemy.dead || enemy.isDead) continue;
                const edx = enemy.x - storm.x;
                const edy = enemy.y - storm.y;
                if (edx * edx + edy * edy <= r2) {
                    if (window.Game.Enemies && typeof window.Game.Enemies.damageEnemy === 'function') {
                        window.Game.Enemies.damageEnemy(enemy, Math.round(storm.damage * 1.5), true, false, true);
                    } else if (typeof enemy.takeDamage === "function") {
                        enemy.takeDamage(storm.damage * 1.5, true);
                    } else {
                        enemy.hp = Math.max(0, (enemy.hp || 50) - storm.damage * 1.5);
                    }
                }
            }
        }

        /* ---------------------------------------------------------------------- */
        /* CẬP NHẬT IV.5: SUỐI NƯỚC SINH MỆNH (CHỈ KÍCH HOẠT Ở HIỆN TẠI)         */
        /* ---------------------------------------------------------------------- */
        _updateHealingSprings(dt, player) {
            if (this.currentEra !== WORLD_CONSTANTS.ERAS.PRESENT) return;

            for (let i = 0; i < this.healingSprings.length; i++) {
                const spring = this.healingSprings[i];
                spring.ripplePhase = (spring.ripplePhase + dt * 2.2) % (Math.PI * 2);

                if (player) {
                    const dx = player.x - spring.x;
                    const dy = player.y - spring.y;
                    if (dx * dx + dy * dy <= spring.radius * spring.radius) {
                        if (player.hp < player.maxHp) {
                            player.hp = Math.min(player.maxHp, player.hp + spring.healPerSecond * dt);
                        }
                        if (player.shield !== undefined && player.maxShield !== undefined && player.shield < player.maxShield) {
                            player.shield = Math.min(player.maxShield, player.shield + spring.shieldPerSecond * dt);
                        }

                        if (!this._isUltraPerformance() && Math.random() < 0.25) {
                            spring.bubbleParticles.push({
                                x: player.x + (Math.random() - 0.5) * 40,
                                y: player.y + (Math.random() - 0.5) * 40,
                                vy: -35 - Math.random() * 25,
                                life: 0.8,
                                maxLife: 0.8,
                                size: 2 + Math.random() * 3
                            });
                        }
                    }
                }

                for (let b = spring.bubbleParticles.length - 1; b >= 0; b--) {
                    const p = spring.bubbleParticles[b];
                    p.life -= dt;
                    p.y += p.vy * dt;
                    if (p.life <= 0) {
                        spring.bubbleParticles.splice(b, 1);
                    }
                }
            }
        }

        /* ---------------------------------------------------------------------- */
        /* CẬP NHẬT IV.6: TRỤ PHÁO LASER TỰ ĐỘNG (CHỈ KÍCH HOẠT Ở TƯƠNG LAI)     */
        /* ---------------------------------------------------------------------- */
        _updateAutoTurrets(dt, enemies, projectiles) {
            if (this.currentEra !== WORLD_CONSTANTS.ERAS.FUTURE) return;

            for (let i = 0; i < this.autoTurrets.length; i++) {
                const turret = this.autoTurrets[i];
                if (!turret.isRepaired) continue;

                if (turret.laserBeamVisual) {
                    turret.laserBeamVisual.timer -= dt;
                    if (turret.laserBeamVisual.timer <= 0) {
                        turret.laserBeamVisual = null;
                    }
                }

                turret.fireTimer += dt;

                let target = null;
                let minDistSq = turret.attackRange * turret.attackRange;

                for (let e = 0; e < enemies.length; e++) {
                    const enemy = enemies[e];
                    if (!enemy || enemy.dead || enemy.isDead) continue;
                    const dx = enemy.x - turret.x;
                    const dy = enemy.y - turret.y;
                    const dSq = dx * dx + dy * dy;
                    if (dSq <= minDistSq) {
                        minDistSq = dSq;
                        target = enemy;
                    }
                }

                turret.target = target;

                if (target) {
                    const targetAngle = Math.atan2(target.y - turret.y, target.x - turret.x);
                    let diff = targetAngle - turret.barrelAngle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    turret.barrelAngle += diff * Math.min(1.0, dt * 8.0);

                    if (turret.fireTimer >= turret.fireRate) {
                        turret.fireTimer = 0;
                        turret.laserBeamVisual = {
                            startX: turret.x + Math.cos(turret.barrelAngle) * 24,
                            startY: turret.y + Math.sin(turret.barrelAngle) * 24,
                            targetX: target.x,
                            targetY: target.y,
                            timer: 0.16
                        };

                        if (window.Game.Enemies && typeof window.Game.Enemies.damageEnemy === 'function') {
                            window.Game.Enemies.damageEnemy(target, turret.damage, false);
                        } else if (typeof target.takeDamage === "function") {
                            target.takeDamage(turret.damage, false);
                        } else {
                            target.hp = Math.max(0, (target.hp || 30) - turret.damage);
                        }

                        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                            window.Game.Combat.spawnFloatingText(target.x, target.y - 30, `-${turret.damage}`, "#00f0ff");
                        }
                    }
                }
            }
        }

        /* ---------------------------------------------------------------------- */
        /* CẬP NHẬT IV.7: BẪY ĐINH PHẢN NGHỊCH (ĐẢO CHIỀU SÁT THƯƠNG QUÁI)        */
        /* ---------------------------------------------------------------------- */
        _updateSpikeTraps(dt, player, enemies) {
            for (let i = 0; i < this.spikeTraps.length; i++) {
                const trap = this.spikeTraps[i];
                trap.cycleTimer += dt;

                const modTime = trap.cycleTimer % trap.cycleInterval;
                if (modTime < 2.0) {
                    trap.spikeState = "UP";
                } else if (modTime < 2.4) {
                    trap.spikeState = "RETRACTING";
                } else {
                    trap.spikeState = "DOWN";
                }

                if (trap.spikeState !== "UP") continue;

                const left = trap.x - trap.width / 2;
                const right = trap.x + trap.width / 2;
                const top = trap.y - trap.height / 2;
                const bottom = trap.y + trap.height / 2;

                if (!trap.isReversed && player) {
                    if (player.x >= left && player.x <= right && player.y >= top && player.y <= bottom) {
                        if (!player.isInvulnerable) {
                            const dmg = trap.damage * dt;
                            if (typeof player.takeDamage === "function") {
                                player.takeDamage(dmg, "SPIKE_TRAP");
                            } else {
                                player.hp = Math.max(0, (player.hp || 100) - dmg);
                            }
                        }
                    }
                } else if (trap.isReversed) {
                    for (let e = 0; e < enemies.length; e++) {
                        const enemy = enemies[e];
                        if (!enemy || enemy.dead || enemy.isDead) continue;
                        if (enemy.x >= left && enemy.x <= right && enemy.y >= top && enemy.y <= bottom) {
                            const totalDamage = (trap.damage * 1.8 + trap.bleedDamage) * dt;
                            if (window.Game.Enemies && typeof window.Game.Enemies.damageEnemy === 'function') {
                                window.Game.Enemies.damageEnemy(enemy, totalDamage, false);
                            } else if (typeof enemy.takeDamage === "function") {
                                enemy.takeDamage(totalDamage, false);
                            } else {
                                enemy.hp = Math.max(0, (enemy.hp || 40) - totalDamage);
                            }
                        }
                    }
                }
            }
        }

        /* ---------------------------------------------------------------------- */
        /* CẬP NHẬT IV.8: RƯƠNG BÁU NGHỊCH LÝ                                      */
        /* ---------------------------------------------------------------------- */
        _updateParadoxVault(dt) {
            if (!this.paradoxVault) return;
            this.paradoxVault.pulseAngle = (this.paradoxVault.pulseAngle + dt * 2.5) % (Math.PI * 2);
        }

        /* ---------------------------------------------------------------------- */
        /* CẬP NHẬT HẠT THỜI TIẾT VÀ ĐÁ NỔI                                       */
        /* ---------------------------------------------------------------------- */
        _updateWeatherAndFloatingRocks(dt) {
            if (!this._isUltraPerformance()) {
                for (let i = 0; i < this.weatherParticles.length; i++) {
                    const p = this.weatherParticles[i];
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (p.y > this.height) {
                        p.y = 0;
                        p.x = Math.random() * this.width;
                    }
                    if (p.x < 0) p.x = this.width;
                    if (p.x > this.width) p.x = 0;
                }
            }

            for (let i = 0; i < this.floatingRocks.length; i++) {
                const rock = this.floatingRocks[i];
                rock.phase = (rock.phase + dt * rock.floatSpeed) % (Math.PI * 2);
                rock.rotation = (rock.rotation + dt * rock.rotSpeed) % (Math.PI * 2);
                rock.x = rock.baseX + Math.cos(rock.phase) * (rock.amplitude * 0.4);
                rock.y = rock.baseY + Math.sin(rock.phase) * rock.amplitude;
            }
        }

        _isUltraPerformance() {
            return !!(window.Game.state && (window.Game.state.ultraPerformance || window.Game.state.lowGraphics || window.Game.state.is120HzOptimized));
        }

        /* ========================================================================== */
        /* V. HỆ THỐNG RENDER VỚI VIEWPORT CULLING (+150PX ĐỆM CHO MOBILE 120 FPS)     */
        /* ========================================================================== */
        draw(ctx, camera) {
            if (!ctx || !camera) return;

            if (window.Game.state && window.Game.state.timeline && this.currentEra !== window.Game.state.timeline) {
                this.setEra(window.Game.state.timeline);
            }

            if (!this.terrainChunks || this.terrainChunks.size === 0) {
                this._prebuildOffscreenTerrainChunks();
            }

            ctx.save();
            ctx.translate(this.cameraShake.x, this.cameraShake.y);

            // Bounding box camera mở rộng +150px đệm nhằm triệt tiêu khuyết tật vẽ ở rìa màn hình
            const cullBox = {
                minX: camera.x - 150,
                minY: camera.y - 150,
                maxX: camera.x + camera.width + 150,
                maxY: camera.y + camera.height + 150
            };

            this._drawCachedTerrainChunks(ctx, camera);
            this._drawZonalFloors(ctx, camera, cullBox);
            this._drawSpikeTraps(ctx, camera, cullBox);
            this._drawRiftPortals(ctx, camera, cullBox);
            this._drawEternityTree(ctx, camera, cullBox);
            this._drawTemporalShrines(ctx, camera, cullBox);
            this._drawParadoxVaultAndSeals(ctx, camera, cullBox);
            this._drawAutoTurrets(ctx, camera, cullBox);
            this._drawTemporalStorms(ctx, camera, cullBox);
            this._drawFloatingRocks(ctx, camera, cullBox);
            this._drawWeatherParticles(ctx, camera);

            ctx.restore();
        }

        _drawCachedTerrainChunks(ctx, camera) {
            const startCx = Math.max(0, Math.floor(camera.x / this.chunkSize));
            const endCx = Math.min(this.chunksCols - 1, Math.floor((camera.x + camera.width) / this.chunkSize));
            const startCy = Math.max(0, Math.floor(camera.y / this.chunkSize));
            const endCy = Math.min(this.chunksRows - 1, Math.floor((camera.y + camera.height) / this.chunkSize));

            for (let cy = startCy; cy <= endCy; cy++) {
                for (let cx = startCx; cx <= endCx; cx++) {
                    const key = `${this.currentEra}_${cx}_${cy}`;
                    const chunkCanvas = this.terrainChunks.get(key);
                    if (chunkCanvas) {
                        const drawX = cx * this.chunkSize - camera.x;
                        const drawY = cy * this.chunkSize - camera.y;
                        ctx.drawImage(chunkCanvas, drawX, drawY);
                    }
                }
            }
        }

        _drawZonalFloors(ctx, camera, cull) {
            const isLow = this._isUltraPerformance();

            if (this.currentEra === WORLD_CONSTANTS.ERAS.PRESENT) {
                for (let i = 0; i < this.healingSprings.length; i++) {
                    const s = this.healingSprings[i];
                    if (s.x + s.radius < cull.minX || s.x - s.radius > cull.maxX ||
                        s.y + s.radius < cull.minY || s.y - s.radius > cull.maxY) continue;

                    const sx = s.x - camera.x;
                    const sy = s.y - camera.y;

                    ctx.save();
                    const grad = ctx.createRadialGradient(sx, sy, s.radius * 0.2, sx, sy, s.radius);
                    grad.addColorStop(0, "rgba(72, 202, 228, 0.45)");
                    grad.addColorStop(0.7, "rgba(0, 119, 182, 0.35)");
                    grad.addColorStop(1, "rgba(3, 4, 94, 0.1)");
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
                    ctx.fill();

                    if (!isLow) {
                        ctx.strokeStyle = "rgba(144, 224, 239, 0.6)";
                        ctx.lineWidth = 2.5;
                        ctx.beginPath();
                        const rWave = (s.radius * 0.3) + Math.sin(s.ripplePhase) * (s.radius * 0.5);
                        ctx.arc(sx, sy, Math.max(10, rWave), 0, Math.PI * 2);
                        ctx.stroke();

                        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
                        for (let b = 0; b < s.bubbleParticles.length; b++) {
                            const bp = s.bubbleParticles[b];
                            ctx.beginPath();
                            ctx.arc(bp.x - camera.x, bp.y - camera.y, bp.size, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    ctx.restore();
                }
            }

            for (let i = 0; i < this.cursedGrounds.length; i++) {
                const cg = this.cursedGrounds[i];
                if (cg.x + cg.radius < cull.minX || cg.x - cg.radius > cull.maxX ||
                    cg.y + cg.radius < cull.minY || cg.y - cg.radius > cull.maxY) continue;

                const cx = cg.x - camera.x;
                const cy = cg.y - camera.y;

                ctx.save();
                const cGrad = ctx.createRadialGradient(cx, cy, cg.radius * 0.15, cx, cy, cg.radius);
                cGrad.addColorStop(0, "rgba(114, 9, 183, 0.35)");
                cGrad.addColorStop(0.8, "rgba(58, 12, 163, 0.2)");
                cGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
                ctx.fillStyle = cGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, cg.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "rgba(247, 37, 133, 0.4)";
                ctx.setLineDash([8, 8]);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, cg.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            for (let i = 0; i < this.zeroGravityZones.length; i++) {
                const zg = this.zeroGravityZones[i];
                if (zg.x + zg.radius < cull.minX || zg.x - zg.radius > cull.maxX ||
                    zg.y + zg.radius < cull.minY || zg.y - zg.radius > cull.maxY) continue;

                const zx = zg.x - camera.x;
                const zy = zg.y - camera.y;

                ctx.save();
                const zGrad = ctx.createRadialGradient(zx, zy, zg.radius * 0.2, zx, zy, zg.radius);
                zGrad.addColorStop(0, "rgba(76, 201, 240, 0.25)");
                zGrad.addColorStop(0.8, "rgba(67, 97, 238, 0.15)");
                zGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
                ctx.fillStyle = zGrad;
                ctx.beginPath();
                ctx.arc(zx, zy, zg.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "rgba(76, 201, 240, 0.5)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 6]);
                ctx.beginPath();
                ctx.arc(zx, zy, zg.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        _drawSpikeTraps(ctx, camera, cull) {
            for (let i = 0; i < this.spikeTraps.length; i++) {
                const t = this.spikeTraps[i];
                if (t.x + t.width / 2 < cull.minX || t.x - t.width / 2 > cull.maxX ||
                    t.y + t.height / 2 < cull.minY || t.y - t.height / 2 > cull.maxY) continue;

                const tx = t.x - camera.x;
                const ty = t.y - camera.y;

                ctx.save();
                ctx.fillStyle = "#1e1e24";
                ctx.fillRect(tx - t.width / 2, ty - t.height / 2, t.width, t.height);
                ctx.strokeStyle = t.isReversed ? "#00ff88" : "#8d99ae";
                ctx.lineWidth = 2.5;
                ctx.strokeRect(tx - t.width / 2, ty - t.height / 2, t.width, t.height);

                const cols = 4;
                const rows = 4;
                const cellW = t.width / cols;
                const cellH = t.height / rows;

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const px = tx - t.width / 2 + c * cellW + cellW / 2;
                        const py = ty - t.height / 2 + r * cellH + cellH / 2;

                        if (t.spikeState === "UP") {
                            ctx.fillStyle = t.isReversed ? "#00ff88" : "#ef233c";
                            ctx.beginPath();
                            ctx.arc(px, py, 6, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.strokeStyle = "#ffffff";
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        } else if (t.spikeState === "RETRACTING") {
                            ctx.fillStyle = "#4a4e69";
                            ctx.beginPath();
                            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
                            ctx.fill();
                        } else {
                            ctx.fillStyle = "#111116";
                            ctx.beginPath();
                            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }

                // Cần gạt bẫy
                const lx = t.lever.x - camera.x;
                const ly = t.lever.y - camera.y;
                ctx.fillStyle = "#333333";
                ctx.beginPath();
                ctx.arc(lx, ly, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = t.lever.isActivated ? "#00ff88" : "#ffaa00";
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                const leverAngle = t.lever.isActivated ? Math.PI * 0.25 : -Math.PI * 0.25;
                ctx.lineTo(lx + Math.cos(leverAngle) * 18, ly + Math.sin(leverAngle) * 18);
                ctx.stroke();
                ctx.restore();
            }
        }

        _drawRiftPortals(ctx, camera, cull) {
            for (let i = 0; i < this.riftPortals.length; i++) {
                const p = this.riftPortals[i];
                if (p.x + p.radius < cull.minX || p.x - p.radius > cull.maxX ||
                    p.y + p.radius < cull.minY || p.y - p.radius > cull.maxY) continue;

                const px = p.x - camera.x;
                const py = p.y - camera.y;
                const ready = p.cooldown <= 0;
                const pulseR = p.radius + Math.sin(p.pulsePhase) * 6;

                ctx.save();
                const grad = ctx.createRadialGradient(px, py, 6, px, py, pulseR);
                grad.addColorStop(0, "#ffffff");
                grad.addColorStop(0.35, p.color);
                grad.addColorStop(0.85, "rgba(20, 10, 40, 0.7)");
                grad.addColorStop(1, "rgba(0, 0, 0, 0)");

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(px, py, pulseR, 0, Math.PI * 2);
                ctx.fill();

                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(p.vortexRotation);
                ctx.strokeStyle = ready ? "#ffffff" : "#666666";
                ctx.lineWidth = 2.5;

                for (let arm = 0; arm < 3; arm++) {
                    ctx.rotate((Math.PI * 2) / 3);
                    ctx.beginPath();
                    ctx.arc(12, 0, p.radius * 0.6, 0, Math.PI * 0.9);
                    ctx.stroke();
                }
                ctx.restore();

                if (!ready) {
                    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                    ctx.beginPath();
                    ctx.arc(px, py, p.radius * 0.7, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = "#ffffff";
                    ctx.font = "bold 13px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(`${Math.ceil(p.cooldown)}s`, px, py);
                }
                ctx.restore();
            }
        }

        _drawEternityTree(ctx, camera, cull) {
            const tree = this.eternityTree;
            if (!tree) return;
            if (tree.x + 120 < cull.minX || tree.x - 120 > cull.maxX ||
                tree.y + 140 < cull.minY || tree.y - 140 > cull.maxY) return;

            const tx = tree.x - camera.x;
            const ty = tree.y - camera.y;

            ctx.save();
            if (this.currentEra === WORLD_CONSTANTS.ERAS.PAST) {
                if (!tree.isPlanted) {
                    ctx.strokeStyle = "rgba(112, 224, 0, 0.75)";
                    ctx.setLineDash([6, 6]);
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(tx, ty, 30, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = "#70e000";
                    ctx.font = "12px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("ĐIỂM GIEO MẦM", tx, ty - 38);
                } else {
                    ctx.fillStyle = "#38b000";
                    ctx.beginPath();
                    ctx.arc(tx, ty, 14, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = "#5a3d28";
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(tx, ty - 16);
                    ctx.stroke();
                }
            } else if (this.currentEra === WORLD_CONSTANTS.ERAS.PRESENT) {
                if (tree.isPlanted) {
                    ctx.fillStyle = "#4a3319";
                    ctx.fillRect(tx - 10, ty - 38, 20, 48);

                    ctx.fillStyle = "#2d6a4f";
                    ctx.beginPath();
                    ctx.arc(tx, ty - 45, 42, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = "#52b788";
                    ctx.beginPath();
                    ctx.arc(tx - 14, ty - 52, 24, 0, Math.PI * 2);
                    ctx.arc(tx + 14, ty - 50, 26, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (this.currentEra === WORLD_CONSTANTS.ERAS.FUTURE) {
                if (tree.isPlanted) {
                    ctx.fillStyle = "#2f1b0c";
                    ctx.fillRect(tx - 16, ty - 65, 32, 75);

                    const gradFoliage = ctx.createRadialGradient(tx, ty - 75, 10, tx, ty - 75, 68);
                    gradFoliage.addColorStop(0, "#ffd166");
                    gradFoliage.addColorStop(0.5, "#06d6a0");
                    gradFoliage.addColorStop(1, "#118ab2");

                    ctx.fillStyle = gradFoliage;
                    ctx.beginPath();
                    ctx.arc(tx, ty - 75, 68, 0, Math.PI * 2);
                    ctx.fill();

                    if (tree.hasFruit) {
                        ctx.fillStyle = "#ff0054";
                        ctx.beginPath();
                        ctx.arc(tx - 18, ty - 85, 9, 0, Math.PI * 2);
                        ctx.arc(tx + 22, ty - 70, 9, 0, Math.PI * 2);
                        ctx.arc(tx, ty - 50, 9, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
        }

        _drawTemporalShrines(ctx, camera, cull) {
            for (let i = 0; i < this.shrines.length; i++) {
                const s = this.shrines[i];
                if (s.x + s.radius + 40 < cull.minX || s.x - s.radius - 40 > cull.maxX ||
                    s.y + s.radius + 40 < cull.minY || s.y - s.radius - 40 > cull.maxY) continue;

                const sx = s.x - camera.x;
                const sy = s.y - camera.y;

                ctx.save();
                ctx.fillStyle = "#2b2d42";
                ctx.beginPath();
                ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = s.color;
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(s.runeAngle);
                ctx.strokeStyle = s.glowColor;
                ctx.lineWidth = 2;
                ctx.strokeRect(-s.radius * 0.55, -s.radius * 0.55, s.radius * 1.1, s.radius * 1.1);
                ctx.restore();

                if (s.activeBeamTimer > 0) {
                    ctx.fillStyle = s.glowColor;
                    ctx.fillRect(sx - 16, sy - 400, 32, 400);
                }

                if (s.cooldown > 0) {
                    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                    ctx.beginPath();
                    ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = "#ffffff";
                    ctx.font = "bold 13px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(`${Math.ceil(s.cooldown)}s`, sx, sy);
                }
                ctx.restore();
            }
        }

        _drawParadoxVaultAndSeals(ctx, camera, cull) {
            if (!this.paradoxVault) return;
            const pv = this.paradoxVault;

            // Cột ấn ký tương ứng kỷ nguyên hiện tại
            const currentSeal = pv.pillarSeals[this.currentEra];
            if (currentSeal) {
                if (currentSeal.x + 50 >= cull.minX && currentSeal.x - 50 <= cull.maxX &&
                    currentSeal.y + 50 >= cull.minY && currentSeal.y - 50 <= cull.maxY) {
                    const cx = currentSeal.x - camera.x;
                    const cy = currentSeal.y - camera.y;

                    ctx.save();
                    ctx.fillStyle = currentSeal.activated ? currentSeal.color : "#3a3a40";
                    ctx.beginPath();
                    ctx.arc(cx, cy, currentSeal.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = currentSeal.color;
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    ctx.fillStyle = "#ffffff";
                    ctx.font = "11px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(currentSeal.activated ? "ĐÃ GIẢI ẤN" : "ẤN KÝ", cx, cy + 4);
                    ctx.restore();
                }
            }

            // Rương kho báu trung tâm
            if (pv.x + 60 >= cull.minX && pv.x - 60 <= cull.maxX &&
                pv.y + 60 >= cull.minY && pv.y - 60 <= cull.maxY) {
                const vx = pv.x - camera.x;
                const vy = pv.y - camera.y;

                ctx.save();
                ctx.fillStyle = pv.isOpened ? "#343a40" : (pv.isUnlocked ? "#d4af37" : "#495057");
                ctx.fillRect(vx - 24, vy - 18, 48, 36);

                ctx.strokeStyle = pv.isUnlocked ? "#fff3b0" : "#212529";
                ctx.lineWidth = 3;
                ctx.strokeRect(vx - 24, vy - 18, 48, 36);

                ctx.fillStyle = pv.isOpened ? "#212529" : (pv.isUnlocked ? "#ffffff" : "#adb5bd");
                ctx.beginPath();
                ctx.arc(vx, vy, 5, 0, Math.PI * 2);
                ctx.fill();

                if (!pv.isUnlocked) {
                    ctx.fillStyle = "#ff4d4d";
                    ctx.font = "bold 11px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("KHÓA (CẦN 3 ẤN)", vx, vy - 26);
                } else if (!pv.isOpened) {
                    ctx.fillStyle = "#ffd700";
                    ctx.font = "bold 11px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("MỞ KHÓA!", vx, vy - 26);
                }
                ctx.restore();
            }
        }

        _drawAutoTurrets(ctx, camera, cull) {
            if (this.currentEra !== WORLD_CONSTANTS.ERAS.FUTURE) return;

            for (let i = 0; i < this.autoTurrets.length; i++) {
                const turret = this.autoTurrets[i];
                if (turret.x + turret.radius + 30 < cull.minX || turret.x - turret.radius - 30 > cull.maxX ||
                    turret.y + turret.radius + 30 < cull.minY || turret.y - turret.radius - 30 > cull.maxY) continue;

                const tx = turret.x - camera.x;
                const ty = turret.y - camera.y;

                ctx.save();
                ctx.fillStyle = "#1e293b";
                ctx.beginPath();
                ctx.arc(tx, ty, turret.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = turret.isRepaired ? "#00f0ff" : "#ef4444";
                ctx.lineWidth = 3;
                ctx.stroke();

                if (turret.isRepaired) {
                    ctx.save();
                    ctx.translate(tx, ty);
                    ctx.rotate(turret.barrelAngle);
                    ctx.fillStyle = "#38bdf8";
                    ctx.fillRect(0, -5, 26, 10);
                    ctx.restore();

                    if (turret.laserBeamVisual) {
                        const b = turret.laserBeamVisual;
                        ctx.strokeStyle = "#00f0ff";
                        ctx.lineWidth = 3.5;
                        ctx.beginPath();
                        ctx.moveTo(b.startX - camera.x, b.startY - camera.y);
                        ctx.lineTo(b.targetX - camera.x, b.targetY - camera.y);
                        ctx.stroke();
                    }
                } else {
                    ctx.fillStyle = "#f87171";
                    ctx.font = "bold 11px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("HỎNG", tx, ty + 4);
                }
                ctx.restore();
            }
        }

        _drawTemporalStorms(ctx, camera, cull) {
            for (let i = 0; i < this.storms.length; i++) {
                const storm = this.storms[i];
                if (storm.x + storm.radius < cull.minX || storm.x - storm.radius > cull.maxX ||
                    storm.y + storm.radius < cull.minY || storm.y - storm.radius > cull.maxY) continue;

                const sx = storm.x - camera.x;
                const sy = storm.y - camera.y;

                ctx.save();
                if (storm.state === "WARNING") {
                    ctx.strokeStyle = "rgba(0, 240, 255, 0.7)";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(sx, sy, storm.radius, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = `rgba(0, 240, 255, ${0.15 * storm.warningProgress})`;
                    ctx.beginPath();
                    ctx.arc(sx, sy, storm.radius * storm.warningProgress, 0, Math.PI * 2);
                    ctx.fill();
                } else if (storm.state === "STRIKE") {
                    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
                    ctx.beginPath();
                    ctx.arc(sx, sy, storm.radius, 0, Math.PI * 2);
                    ctx.fill();

                    if (storm.arcs && storm.arcs.length > 1) {
                        ctx.strokeStyle = "#ffffff";
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.moveTo(storm.arcs[0].x - camera.x, storm.arcs[0].y - camera.y);
                        for (let a = 1; a < storm.arcs.length; a++) {
                            ctx.lineTo(storm.arcs[a].x - camera.x, storm.arcs[a].y - camera.y);
                        }
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }
        }

        _drawFloatingRocks(ctx, camera, cull) {
            if (this.currentEra !== WORLD_CONSTANTS.ERAS.FUTURE) return;

            for (let i = 0; i < this.floatingRocks.length; i++) {
                const r = this.floatingRocks[i];
                if (r.x + r.size < cull.minX || r.x - r.size > cull.maxX ||
                    r.y + r.size < cull.minY || r.y - r.size > cull.maxY) continue;

                const rx = r.x - camera.x;
                const ry = r.y - camera.y;

                ctx.save();
                ctx.translate(rx, ry);
                ctx.rotate(r.rotation);
                ctx.fillStyle = "#3a405a";
                ctx.strokeStyle = "#68507b";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.rect(-r.size / 2, -r.size / 2, r.size, r.size);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        }

        _drawWeatherParticles(ctx, camera) {
            if (this._isUltraPerformance()) return;

            ctx.save();
            ctx.fillStyle = "rgba(200, 240, 255, 0.35)";
            for (let i = 0; i < this.weatherParticles.length; i++) {
                const p = this.weatherParticles[i];
                const px = p.x - camera.x;
                const py = p.y - camera.y;
                if (px < 0 || px > camera.width || py < 0 || py > camera.height) continue;
                ctx.fillRect(px, py, p.size, p.size * 2);
            }
            ctx.restore();
        }

        /* ========================================================================== */
        /* VI. VẼ MINIMAP HUD (TƯƠNG THÍCH ĐA CHỮ KÝ: MAIN.JS & WORLD.JS)            */
        /* ========================================================================== */
        drawMinimap(ctx, arg1, arg2) {
            if (!ctx) return;

            // Tự động phân tích chữ ký hàm:
            // Kiểu A (main.js): drawMinimap(ctx, screenWidth, screenHeight) -> arg1 là số (number)
            // Kiểu B (internal): drawMinimap(ctx, player, enemies) -> arg1 là object player
            let p = null;
            let ens = [];
            let sWidth = 0;
            let sHeight = 0;

            if (typeof arg1 === 'number') {
                sWidth = arg1;
                sHeight = typeof arg2 === 'number' ? arg2 : ctx.canvas.height;
                p = window.Game.player;
                ens = (window.Game.Enemies && window.Game.Enemies.list) || [];
            } else {
                p = (arg1 && typeof arg1.x === 'number') ? arg1 : window.Game.player;
                ens = Array.isArray(arg2) ? arg2 : ((window.Game.Enemies && window.Game.Enemies.list) || []);
                sWidth = ctx.canvas.width;
                sHeight = ctx.canvas.height;
            }

            const mapSize = this.minimapExpanded ? 240 : 130;
            const margin = 18;
            const mmX = sWidth - mapSize - margin;
            const mmY = margin;
            const scale = mapSize / this.width;

            ctx.save();
            ctx.fillStyle = "rgba(10, 15, 25, 0.85)";
            ctx.fillRect(mmX, mmY, mapSize, mapSize);
            ctx.strokeStyle = "#00f0ff";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(mmX, mmY, mapSize, mapSize);

            // 1. Đài Cầu Nguyện
            for (let i = 0; i < this.shrines.length; i++) {
                const s = this.shrines[i];
                ctx.fillStyle = s.color;
                ctx.fillRect(mmX + s.x * scale - 2, mmY + s.y * scale - 2, 4, 4);
            }

            // 2. Rương Nghịch Lý
            if (this.paradoxVault) {
                ctx.fillStyle = "#ffd700";
                ctx.fillRect(mmX + this.paradoxVault.x * scale - 2.5, mmY + this.paradoxVault.y * scale - 2.5, 5, 5);
            }

            // 3. Quái vật / Boss
            for (let i = 0; i < ens.length; i++) {
                const e = ens[i];
                if (!e || e.dead || e.isDead || e.hp <= 0) continue;
                if (!e.isBoss && e.timeline && e.timeline !== this.currentEra) continue;

                if (e.isBoss) {
                    ctx.fillStyle = "#ff0055";
                    ctx.fillRect(mmX + e.x * scale - 3, mmY + e.y * scale - 3, 6, 6);
                } else if (e.isMiniBoss) {
                    ctx.fillStyle = "#ff5500";
                    ctx.fillRect(mmX + e.x * scale - 2, mmY + e.y * scale - 2, 4, 4);
                } else {
                    ctx.fillStyle = "#ff2244";
                    ctx.fillRect(mmX + e.x * scale - 1, mmY + e.y * scale - 1, 2, 2);
                }
            }

            // 4. Người chơi
            if (p && typeof p.x === 'number') {
                ctx.fillStyle = "#00ff66";
                ctx.beginPath();
                ctx.arc(mmX + p.x * scale, mmY + p.y * scale, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    /* ========================================================================== */
    /* VII. KHỞI TẠO SINGLETON & XUẤT MODULE LINH HOẠT                            */
    /* ========================================================================== */
    window.Game.WORLD_CONSTANTS = WORLD_CONSTANTS;
    window.Game.SpatialHashGrid = SpatialHashGrid;

    // Chuẩn hóa Singleton instance: Đảm bảo cả Game.World và Game.world đều trỏ đến 1 thực thể
    const worldInstance = new World();
    window.Game.World = worldInstance;
    window.Game.world = worldInstance;

})();