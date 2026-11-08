/**
 * FILE: world.js (BẢN SIÊU CẤP ĐẠI TU CÔNG NGHỆ: OFFSCREEN CANVAS, SPATIAL HASH GRID & TIME RIFTS)
 * KẺ DU HÀNH THỜI KHÔNG
 * 
 * NÂNG CẤP KỸ THUẬT & TÍNH NĂNG:
 * 1. OFFSCREEN CANVAS CACHING: Render trước toàn bộ nền tĩnh (mặt đất, vực sâu, chi tiết gạch) ra Canvas phụ
 *    theo từng kỷ nguyên. Main loop chỉ gọi đúng 1 lệnh ctx.drawImage trích xuất khung nhìn Camera.
 * 2. SPATIAL HASH GRID (128x128): Cấu trúc chia ô không gian tối ưu va chạm cực nhanh giữa Đạn, Quái & Địa hình.
 * 3. KHE NỨT THỜI GIAN & TRỤ MÔI TRƯỜNG (TIME RIFTS & ENVIRONMENTAL TRAPS): Trụ năng lượng thời gian kích hoạt 
 *    sóng làm chậm (Slow Pulse AoE) hoặc gây nổ phản vật chất dọn quái diện rộng khi tương tác/nhận sát thương.
 * 4. BẢO TỒN NGUYÊN VẸN 100% CƠ CHẾ CŨ: Nhân quả thời gian, radar Minimap phân loại quái, la bàn thông minh,
 *    Đài Chiến Thần & Đài Tinh Không.
 */

window.Game = window.Game || {};

// ============================================================================
// MODULE 1: SPATIAL HASH GRID (128 x 128 px)
// ============================================================================
class SpatialHashGrid {
    constructor(cellSize = 128) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this._queryId = 0;
    }

    clear() {
        this.cells.clear();
    }

    _getKey(cx, cy) {
        return `${cx},${cy}`;
    }

    _getCellCoords(x, y) {
        return {
            cx: Math.floor(x / this.cellSize),
            cy: Math.floor(y / this.cellSize)
        };
    }

    insert(entity) {
        if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') return;
        const radius = entity.radius || entity.r || 16;
        const minX = Math.floor((entity.x - radius) / this.cellSize);
        const maxX = Math.floor((entity.x + radius) / this.cellSize);
        const minY = Math.floor((entity.y - radius) / this.cellSize);
        const maxY = Math.floor((entity.y + radius) / this.cellSize);

        entity._gridCells = [];

        for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
                const key = this._getKey(cx, cy);
                let cell = this.cells.get(key);
                if (!cell) {
                    cell = [];
                    this.cells.set(key, cell);
                }
                cell.push(entity);
                entity._gridCells.push(key);
            }
        }
    }

    remove(entity) {
        if (!entity || !entity._gridCells) return;
        for (let i = 0; i < entity._gridCells.length; i++) {
            const key = entity._gridCells[i];
            const cell = this.cells.get(key);
            if (cell) {
                const idx = cell.indexOf(entity);
                if (idx !== -1) {
                    cell.splice(idx, 1);
                }
                if (cell.length === 0) {
                    this.cells.delete(key);
                }
            }
        }
        entity._gridCells = null;
    }

    update(entity) {
        this.remove(entity);
        this.insert(entity);
    }

    query(x, y, w, h) {
        const minX = Math.floor(x / this.cellSize);
        const maxX = Math.floor((x + w) / this.cellSize);
        const minY = Math.floor(y / this.cellSize);
        const maxY = Math.floor((y + h) / this.cellSize);

        this._queryId = (this._queryId + 1) & 0x7fffffff;
        const currentQueryId = this._queryId;
        const results = [];

        for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
                const key = this._getKey(cx, cy);
                const cell = this.cells.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        const ent = cell[i];
                        if (ent._lastQueryId !== currentQueryId) {
                            ent._lastQueryId = currentQueryId;
                            results.push(ent);
                        }
                    }
                }
            }
        }
        return results;
    }

    queryRadius(x, y, radius) {
        return this.query(x - radius, y - radius, radius * 2, radius * 2);
    }
}

// ============================================================================
// MODULE 2: HỆ THỐNG THẾ GIỚI CHÍNH
// ============================================================================
window.Game.World = {
    tileSize: 64,
    cols: 60,
    rows: 60,
    width: 60 * 64,  // 3840 px
    height: 60 * 64, // 3840 px

    ABYSS_ROW: 25,
    BRIDGE_TILE: { x: 30, y: 25 },
    SOIL_TILE: { x: 26, y: 26 },
    TREE_BRIDGE_TILE: { x: 26, y: 25 },
    SEED_TILE: { x: 32, y: 28 },
    CHEST_TILE: { x: 34, y: 26 },

    // Cờ phát hiện giao tranh cung cấp cho HUD
    isPlayerInCombat: false,

    // SPATIAL HASH GRID CHO TOÀN BỘ ENTITIES
    spatialGrid: null,

    // OFFSCREEN PRE-RENDER CANVASES
    _cachedBackgrounds: {
        PAST: null,
        PRESENT: null,
        FUTURE: null
    },
    _lastTreePlantedState: false,

    // KHE NỨT THỜI GIAN & TRỤ BẪY NĂNG LƯỢNG MÔI TRƯỜNG
    timeRifts: [
        {
            id: 'RIFT_SOUTH_SLOW',
            name: 'Khe Nứt Trì Hoãn Nam Thành',
            type: 'TIME_SLOW',
            x: 1820,
            y: 2020,
            radius: 130,
            activeTimer: 0,
            activeDuration: 6.0,
            cooldown: 18.0,
            currentCooldown: 0,
            isTriggered: false,
            shockwaveR: 0,
            hp: 60,
            maxHp: 60
        },
        {
            id: 'RIFT_NORTH_VORTEX',
            name: 'Trụ Năng Lượng Nghịch Đảo',
            type: 'VORTEX_EXPLODE',
            x: 2050,
            y: 1380,
            radius: 140,
            activeTimer: 0,
            activeDuration: 1.2,
            cooldown: 22.0,
            currentCooldown: 0,
            isTriggered: false,
            shockwaveR: 0,
            hp: 80,
            maxHp: 80
        },
        {
            id: 'RIFT_WEST_CHEST',
            name: 'Vòng Xoáy Lượng Tử Hộ Vệ',
            type: 'TIME_SLOW',
            x: 2250,
            y: 1650,
            radius: 120,
            activeTimer: 0,
            activeDuration: 5.5,
            cooldown: 16.0,
            currentCooldown: 0,
            isTriggered: false,
            shockwaveR: 0,
            hp: 50,
            maxHp: 50
        }
    ],

    // ĐÀI TẾ CHIẾN THUẬT & TRẠM NĂNG LƯỢNG
    shrines: [
        {
            id: 'SHRINE_WAR',
            type: 'WAR',
            name: 'Đài Chiến Thần',
            x: 1520,
            y: 1820,
            radius: 85,
            cooldown: 45.0,
            currentCooldown: 0,
            stayTimer: 0,
            requiredTime: 1.5,
            color: '#f59e0b',
            runeColor: '#ef4444'
        },
        {
            id: 'SHRINE_ASTRAL',
            type: 'ASTRAL',
            name: 'Đài Tinh Không',
            x: 2320,
            y: 1820,
            radius: 85,
            cooldown: 45.0,
            currentCooldown: 0,
            stayTimer: 0,
            requiredTime: 1.5,
            color: '#00f5ff',
            runeColor: '#3b82f6'
        }
    ],

    waypoints: [
        {
            index: 0,
            id: 'WAYPOINT_0',
            name: 'Khu Xuất Phát',
            tileX: 30,
            tileY: 30,
            x: 1920,
            y: 1980
        },
        {
            index: 1,
            id: 'WAYPOINT_1',
            name: 'Bờ Nam Vực Sâu',
            tileX: 28,
            tileY: 26,
            x: 1792,
            y: 1690
        },
        {
            index: 2,
            id: 'WAYPOINT_2',
            name: 'Tiền Đồn Đấu Trường Boss',
            tileX: 30,
            tileY: 21,
            x: 1920,
            y: 1340
        }
    ],

    anomalies: [
        {
            id: 'ANOMALY_SPEED_SOUTH',
            type: 'SPEED',
            name: 'Dị Điểm Gia Tốc Không Gian',
            x: 1600,
            y: 2080,
            radius: 105,
            speedMultiplier: 1.75,
            cdrMultiplier: 1.0,
            color: '#00f5ff'
        },
        {
            id: 'ANOMALY_CDR_SOUTH',
            type: 'CDR',
            name: 'Dị Điểm Co Giãn Thời Gian',
            x: 2272,
            y: 1952,
            radius: 105,
            speedMultiplier: 1.0,
            cdrMultiplier: 2.0,
            color: '#c850ff'
        },
        {
            id: 'ANOMALY_SPEED_NORTH',
            type: 'SPEED',
            name: 'Dị Điểm Gia Tốc Bắc Vực',
            x: 1568,
            y: 1184,
            radius: 110,
            speedMultiplier: 1.75,
            cdrMultiplier: 1.0,
            color: '#00f5ff'
        },
        {
            id: 'ANOMALY_CDR_NORTH',
            type: 'CDR',
            name: 'Dị Điểm Co Giãn Bắc Vực',
            x: 2272,
            y: 1184,
            radius: 110,
            speedMultiplier: 1.0,
            cdrMultiplier: 2.0,
            color: '#c850ff'
        }
    ],

    traps: [],
    weatherParticles: [],
    _lastWeatherTime: 0,
    grid: [],
    decorGrid: [],
    _initialized: false,

    init: function () {
        this.grid = [];
        this.decorGrid = [];
        this.isPlayerInCombat = false;

        // Khởi tạo Lưới Không Gian (Spatial Hash Grid)
        this.spatialGrid = new SpatialHashGrid(128);

        // Reset bộ đếm đài tế & khe nứt
        for (let i = 0; i < this.shrines.length; i++) {
            this.shrines[i].currentCooldown = 0;
            this.shrines[i].stayTimer = 0;
        }

        for (let i = 0; i < this.timeRifts.length; i++) {
            this.timeRifts[i].currentCooldown = 0;
            this.timeRifts[i].activeTimer = 0;
            this.timeRifts[i].isTriggered = false;
            this.timeRifts[i].shockwaveR = 0;
            this.timeRifts[i].hp = this.timeRifts[i].maxHp;
        }

        if (window.Game && window.Game.state) {
            if (!Array.isArray(window.Game.state.unlockedWaypoints)) {
                window.Game.state.unlockedWaypoints = [true, false, false];
            } else if (window.Game.state.unlockedWaypoints.length < 3) {
                window.Game.state.unlockedWaypoints[0] = true;
                window.Game.state.unlockedWaypoints[1] = !!window.Game.state.unlockedWaypoints[1];
                window.Game.state.unlockedWaypoints[2] = !!window.Game.state.unlockedWaypoints[2];
            }
            if (typeof window.Game.state.chestOiled !== 'boolean') {
                window.Game.state.chestOiled = false;
            }
            if (typeof window.Game.state.chestOpened !== 'boolean') {
                window.Game.state.chestOpened = false;
            }
        }

        const hash = (x, y) => {
            const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
            return n - Math.floor(n);
        };

        for (let y = 0; y < this.rows; y++) {
            const row = [];
            const decorRow = [];
            for (let x = 0; x < this.cols; x++) {
                const r = hash(x, y);
                decorRow.push(r);

                if (x === 0 || x === this.cols - 1 || y === 0 || y === this.rows - 1) {
                    row.push(1);
                    continue;
                }

                if (y === this.ABYSS_ROW) {
                    row.push(3);
                    continue;
                }

                const isSpawnOrCenter = x >= 24 && x <= 36 && y >= 23 && y <= 35;
                const isBossArena = x >= 20 && x <= 40 && y >= 10 && y <= 24;
                const isMainRoad = x >= 28 && x <= 32 && y >= 8 && y <= 50;

                if (isSpawnOrCenter || isBossArena || isMainRoad) {
                    row.push(0);
                    continue;
                }

                const wx = x * this.tileSize + this.tileSize / 2;
                const wy = y * this.tileSize + this.tileSize / 2;
                let nearAnomalyOrShrine = false;

                // Tránh tạo vật cản đè lên Dị Điểm
                for (let i = 0; i < this.anomalies.length; i++) {
                    const anom = this.anomalies[i];
                    if (Math.hypot(wx - anom.x, wy - anom.y) < anom.radius + 80) {
                        nearAnomalyOrShrine = true;
                        break;
                    }
                }
                // Tránh tạo vật cản đè lên Đài Năng Lượng & Khe Nứt
                if (!nearAnomalyOrShrine) {
                    for (let s = 0; s < this.shrines.length; s++) {
                        const sh = this.shrines[s];
                        if (Math.hypot(wx - sh.x, wy - sh.y) < sh.radius + 60) {
                            nearAnomalyOrShrine = true;
                            break;
                        }
                    }
                }
                if (!nearAnomalyOrShrine) {
                    for (let rf = 0; rf < this.timeRifts.length; rf++) {
                        const rift = this.timeRifts[rf];
                        if (Math.hypot(wx - rift.x, wy - rift.y) < rift.radius + 60) {
                            nearAnomalyOrShrine = true;
                            break;
                        }
                    }
                }

                if (nearAnomalyOrShrine) {
                    row.push(0);
                    continue;
                }

                if (r < 0.045) {
                    row.push(1);
                } else if (r > 0.92) {
                    row.push(2);
                } else {
                    row.push(0);
                }
            }
            this.grid.push(row);
            this.decorGrid.push(decorRow);
        }

        this._initTraps();
        this._initWeatherParticles();
        this._buildSpatialObstacles();
        this.rebuildAllBackgroundCaches();
        this._initialized = true;
    },

    // ========================================================================
    // TÍNH NĂNG 1: NÂNG CẤP OFFSCREEN CANVAS CACHING CHO NỀN BẢN ĐỒ
    // ========================================================================
    rebuildAllBackgroundCaches: function () {
        const timelines = ['PAST', 'PRESENT', 'FUTURE'];
        for (let i = 0; i < timelines.length; i++) {
            this.rebuildBackgroundCache(timelines[i]);
        }
        if (window.Game.state) {
            this._lastTreePlantedState = !!window.Game.state.isTreePlanted;
        }
    },

    rebuildBackgroundCache: function (timeline) {
        let offCanvas = this._cachedBackgrounds[timeline];
        if (!offCanvas) {
            offCanvas = document.createElement('canvas');
            offCanvas.width = this.width;
            offCanvas.height = this.height;
            this._cachedBackgrounds[timeline] = offCanvas;
        }

        const offCtx = offCanvas.getContext('2d', { alpha: false });
        if (!offCtx) return;

        const ts = this.tileSize;

        // Vẽ toàn bộ các ô nền đất tĩnh
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const wx = c * ts;
                const wy = r * ts;
                const decor = this.decorGrid[r][c];
                const isNorthBossZone = r < this.ABYSS_ROW;

                if (r === this.ABYSS_ROW) {
                    // Vẽ lớp đáy tĩnh của vực thẳm
                    offCtx.fillStyle = timeline === 'FUTURE' ? '#030408' : '#0c0a10';
                    offCtx.fillRect(wx, wy, ts, ts);

                    offCtx.fillStyle =
                        timeline === 'PAST'
                            ? '#4a321a'
                            : timeline === 'PRESENT'
                            ? '#264730'
                            : '#00d9ff';
                    offCtx.fillRect(wx, wy, ts, 6);
                    offCtx.fillRect(wx, wy + ts - 6, ts, 6);
                } else {
                    this._drawGroundTile(offCtx, wx, wy, c, r, decor, timeline, isNorthBossZone);
                }
            }
        }
    },

    // ========================================================================
    // TÍNH NĂNG 2: SPATIAL HASH GRID DÀNH CHO VẬT CẢN & ENTITY
    // ========================================================================
    _buildSpatialObstacles: function () {
        if (!this.spatialGrid) return;
        this.spatialGrid.clear();

        const ts = this.tileSize;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                if (cell === 1 || cell === 2) {
                    this.spatialGrid.insert({
                        id: `OBS_${c}_${r}`,
                        type: 'OBSTACLE',
                        obstacleType: cell,
                        x: c * ts + ts / 2,
                        y: r * ts + ts / 2,
                        radius: 24,
                        isStatic: true
                    });
                }
            }
        }
    },

    // Cập nhật động toàn bộ Quái vật, Đạn và Khe nứt vào Lưới Không Gian mỗi Frame
    updateSpatialEntities: function (projectiles, enemies) {
        if (!this.spatialGrid) return;

        // Xóa sạch và tái lập từ các vật cản tĩnh
        this._buildSpatialObstacles();

        // 1. Thêm các khe nứt và trụ thời gian
        for (let i = 0; i < this.timeRifts.length; i++) {
            const rift = this.timeRifts[i];
            this.spatialGrid.insert({
                id: rift.id,
                type: 'TIME_RIFT',
                raw: rift,
                x: rift.x,
                y: rift.y,
                radius: 28
            });
        }

        // 2. Thêm Quái vật
        const enemyList = enemies || this._getActiveEnemiesList();
        for (let i = 0; i < enemyList.length; i++) {
            const e = enemyList[i];
            if (!e || e.dead || e.isDead || (typeof e.hp === 'number' && e.hp <= 0)) continue;
            this.spatialGrid.insert({
                id: e.id || `ENEMY_${i}`,
                type: 'ENEMY',
                raw: e,
                x: e.x,
                y: e.y,
                radius: e.radius || e.size || 22
            });
        }

        // 3. Thêm Đạn người chơi / quái
        if (Array.isArray(projectiles)) {
            for (let i = 0; i < projectiles.length; i++) {
                const p = projectiles[i];
                if (!p || p.dead) continue;
                this.spatialGrid.insert({
                    id: p.id || `PROJ_${i}`,
                    type: 'PROJECTILE',
                    raw: p,
                    x: p.x,
                    y: p.y,
                    radius: p.radius || 6
                });
            }
        }
    },

    // Truy vấn nhanh các thực thể va chạm bằng Spatial Hash
    getNearbyEntities: function (x, y, radius) {
        if (!this.spatialGrid) return [];
        return this.spatialGrid.queryRadius(x, y, radius);
    },

    _initTraps: function () {
        this.traps = [
            { timeline: 'PAST', type: 'SWAMP', name: 'Đầm Lầy Cổ Đại', x: 1720, y: 1860, radius: 115, speedMultiplier: 0.55, damagePerSec: 0 },
            { timeline: 'PAST', type: 'SWAMP', name: 'Đầm Lầy Cổ Đại', x: 2140, y: 2120, radius: 125, speedMultiplier: 0.55, damagePerSec: 0 },
            { timeline: 'PAST', type: 'SWAMP', name: 'Đầm Lầy Cổ Đại', x: 1920, y: 1520, radius: 95, speedMultiplier: 0.55, damagePerSec: 0 },
            { timeline: 'PAST', type: 'SWAMP', name: 'Đầm Lầy Cổ Đại', x: 1680, y: 1080, radius: 120, speedMultiplier: 0.55, damagePerSec: 0 },
            { timeline: 'PAST', type: 'SWAMP', name: 'Đầm Lầy Cổ Đại', x: 2180, y: 1050, radius: 120, speedMultiplier: 0.55, damagePerSec: 0 },
            { timeline: 'PAST', type: 'SWAMP', name: 'Đầm Lầy Cổ Đại', x: 1450, y: 2350, radius: 135, speedMultiplier: 0.55, damagePerSec: 0 },

            { timeline: 'PRESENT', type: 'THORNS', name: 'Bụi Gai Độc Đột Biến', x: 2010, y: 1840, radius: 78, speedMultiplier: 0.85, damagePerSec: 8 },
            { timeline: 'PRESENT', type: 'THORNS', name: 'Bụi Gai Độc Đột Biến', x: 1760, y: 1960, radius: 82, speedMultiplier: 0.85, damagePerSec: 8 },
            { timeline: 'PRESENT', type: 'THORNS', name: 'Bụi Gai Độc Đột Biến', x: 2140, y: 1740, radius: 75, speedMultiplier: 0.85, damagePerSec: 8 },
            { timeline: 'PRESENT', type: 'THORNS', name: 'Bụi Gai Độc Đột Biến', x: 1760, y: 1240, radius: 85, speedMultiplier: 0.85, damagePerSec: 8 },
            { timeline: 'PRESENT', type: 'THORNS', name: 'Bụi Gai Độc Đột Biến', x: 2090, y: 1220, radius: 85, speedMultiplier: 0.85, damagePerSec: 8 },
            { timeline: 'PRESENT', type: 'THORNS', name: 'Bụi Gai Độc Đột Biến', x: 1920, y: 960, radius: 90, speedMultiplier: 0.85, damagePerSec: 8 },

            { timeline: 'FUTURE', type: 'LASER', name: 'Lưới Điện Laser An Ninh', x: 1760, y: 1820, width: 240, height: 54, cyclePeriod: 2.5, phaseOffset: 0.0, damagePerSec: 20 },
            { timeline: 'FUTURE', type: 'LASER', name: 'Lưới Điện Laser An Ninh', x: 2020, y: 1740, width: 220, height: 54, cyclePeriod: 2.5, phaseOffset: 1.25, damagePerSec: 20 },
            { timeline: 'FUTURE', type: 'LASER', name: 'Lưới Điện Laser An Ninh', x: 1660, y: 1440, width: 250, height: 54, cyclePeriod: 2.5, phaseOffset: 0.6, damagePerSec: 20 },
            { timeline: 'FUTURE', type: 'LASER', name: 'Lưới Điện Laser An Ninh', x: 1800, y: 1120, width: 260, height: 56, cyclePeriod: 2.5, phaseOffset: 0.0, damagePerSec: 20 },
            { timeline: 'FUTURE', type: 'LASER', name: 'Lưới Điện Laser An Ninh', x: 1620, y: 940, width: 220, height: 56, cyclePeriod: 2.5, phaseOffset: 1.25, damagePerSec: 20 },
            { timeline: 'FUTURE', type: 'LASER', name: 'Lưới Điện Laser An Ninh', x: 2020, y: 940, width: 220, height: 56, cyclePeriod: 2.5, phaseOffset: 1.25, damagePerSec: 20 }
        ];
    },

    _initWeatherParticles: function () {
        this.weatherParticles = [];
        const count = 75;
        const glyphs = ['0', '1', '7', '9', '∆', '◊', 'λ', 'Ω', 'Ψ', 'Ξ'];

        for (let i = 0; i < count; i++) {
            this.weatherParticles.push({
                x: Math.random() * 1920,
                y: Math.random() * 1080,
                vx: (Math.random() - 0.5) * 40,
                vy: 20 + Math.random() * 60,
                size: 2 + Math.random() * 4,
                alpha: 0.35 + Math.random() * 0.6,
                phase: Math.random() * Math.PI * 2,
                spinSpeed: (Math.random() - 0.5) * 3,
                glyph: glyphs[i % glyphs.length]
            });
        }
        this._lastWeatherTime = performance.now() * 0.001;
    },

    _isTileWalkable: function (tx, ty) {
        if (!this._initialized) this.init();

        if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) {
            return false;
        }

        const timeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
        const isTreePlanted = !!(window.Game.state && window.Game.state.isTreePlanted);

        if (ty === this.ABYSS_ROW) {
            if (tx === this.BRIDGE_TILE.x && timeline === 'PAST') {
                return true;
            }
            if (
                tx === this.TREE_BRIDGE_TILE.x &&
                isTreePlanted &&
                (timeline === 'PRESENT' || timeline === 'FUTURE')
            ) {
                return true;
            }
            return false;
        }

        const cell = this.grid[ty][tx];
        return cell === 0;
    },

    canMoveTo: function (px, py) {
        if (!this._initialized) this.init();

        const playerRadius = (window.Game.player && window.Game.player.radius) || 20;

        if (
            px - playerRadius < 0 ||
            px + playerRadius >= this.width ||
            py - playerRadius < 0 ||
            py + playerRadius >= this.height
        ) {
            return false;
        }

        const footMargin = Math.min(12, playerRadius * 0.55);
        const checkPoints = [
            { x: px, y: py },
            { x: px - footMargin, y: py - footMargin },
            { x: px + footMargin, y: py - footMargin },
            { x: px - footMargin, y: py + footMargin },
            { x: px + footMargin, y: py + footMargin }
        ];

        for (let i = 0; i < checkPoints.length; i++) {
            const pt = checkPoints[i];
            const tx = Math.floor(pt.x / this.tileSize);
            const ty = Math.floor(pt.y / this.tileSize);
            if (!this._isTileWalkable(tx, ty)) {
                return false;
            }
        }

        return true;
    },

    ensureSafePlayerPosition: function () {
        if (!this._initialized) this.init();

        const player = window.Game.player;
        if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') {
            return false;
        }

        if (this.canMoveTo(player.x, player.y)) {
            return true;
        }

        const startX = player.x;
        const startY = player.y;
        const ts = this.tileSize;
        const currentTileY = Math.floor(startY / ts);

        if (currentTileY === this.ABYSS_ROW) {
            const southY = (this.ABYSS_ROW + 1) * ts + ts / 2;
            const northY = (this.ABYSS_ROW - 1) * ts + ts / 2;
            const preferNorth = startY - this.ABYSS_ROW * ts < ts / 2;
            const primaryY = preferNorth ? northY : southY;
            const secondaryY = preferNorth ? southY : northY;

            if (this.canMoveTo(startX, primaryY)) {
                this._relocatePlayerSafely(player, startX, primaryY);
                return true;
            }
            if (this.canMoveTo(startX, secondaryY)) {
                this._relocatePlayerSafely(player, startX, secondaryY);
                return true;
            }
        }

        const maxRadius = ts * 8;
        const radiusStep = 8;
        const angleSteps = 24;

        for (let r = radiusStep; r <= maxRadius; r += radiusStep) {
            for (let i = 0; i < angleSteps; i++) {
                const angle = (i / angleSteps) * Math.PI * 2 + r * 0.05;
                const testX = startX + Math.cos(angle) * r;
                const testY = startY + Math.sin(angle) * r;

                if (this.canMoveTo(testX, testY)) {
                    this._relocatePlayerSafely(player, testX, testY);
                    return true;
                }
            }
        }

        const startTileX = Math.floor(startX / ts);
        for (let dist = 1; dist <= 12; dist++) {
            for (let dy = -dist; dy <= dist; dy++) {
                for (let dx = -dist; dx <= dist; dx++) {
                    if (Math.abs(dx) !== dist && Math.abs(dy) !== dist) continue;
                    const tx = startTileX + dx;
                    const ty = currentTileY + dy;
                    if (this._isTileWalkable(tx, ty)) {
                        const centerX = tx * ts + ts / 2;
                        const centerY = ty * ts + ts / 2;
                        if (this.canMoveTo(centerX, centerY)) {
                            this._relocatePlayerSafely(player, centerX, centerY);
                            return true;
                        }
                    }
                }
            }
        }

        this._relocatePlayerSafely(player, this.waypoints[0].x, this.waypoints[0].y);
        return true;
    },

    _relocatePlayerSafely: function (player, safeX, safeY) {
        player.x = safeX;
        player.y = safeY;

        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
            window.Game.Combat.spawnFloatingText(safeX, safeY - 28, 'Dịch chuyển về bờ an toàn!', '#00f5ff');
        } else if (window.Game.Systems && typeof window.Game.Systems.notify === 'function') {
            window.Game.Systems.notify('Dịch chuyển về bờ an toàn!', '#00f5ff');
        }
    },

    _checkAutoUnlockWaypoints: function (px, py) {
        const state = window.Game.state;
        if (!state) return;

        if (!Array.isArray(state.unlockedWaypoints)) {
            state.unlockedWaypoints = [true, false, false];
        }

        const unlockRadius = 120;
        for (let i = 0; i < this.waypoints.length; i++) {
            const wp = this.waypoints[i];
            if (!state.unlockedWaypoints[wp.index]) {
                const dist = Math.hypot(px - wp.x, py - wp.y);
                if (dist <= unlockRadius) {
                    state.unlockedWaypoints[wp.index] = true;
                    if (window.Game.Systems && typeof window.Game.Systems.notify === 'function') {
                        window.Game.Systems.notify(
                            'Đã mở khóa Cổng Dịch Chuyển: ' + wp.name + '!',
                            '#00ffcc'
                        );
                    }
                }
            }
        }
    },

    // ========================================================================
    // TÍNH NĂNG 3: TƯƠNG TÁC & KÍCH HOẠT KHE NỨT THỜI GIAN / BẪY MÔI TRƯỜNG
    // ========================================================================
    triggerTimeRift: function (riftId) {
        const rift = this.timeRifts.find(r => r.id === riftId);
        if (!rift || rift.currentCooldown > 0 || rift.isTriggered) return false;

        rift.isTriggered = true;
        rift.activeTimer = rift.activeDuration;
        rift.currentCooldown = rift.cooldown;
        rift.shockwaveR = 10;

        const enemies = this._getActiveEnemiesList();

        if (rift.type === 'TIME_SLOW') {
            // Làm chậm diện rộng 70% tốc độ quái vật xung quanh
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e || e.dead || e.isDead || (typeof e.hp === 'number' && e.hp <= 0)) continue;
                if (Math.hypot(e.x - rift.x, e.y - rift.y) <= rift.radius) {
                    e.slowTimer = 5.0;
                    e.speedDebuff = 0.3; // Chậm 70%
                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(e.x, e.y - 20, '⏳ LÀM CHẬM 70%!', '#38bdf8');
                    }
                }
            }
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(rift.x, rift.y - 40, '⚡ TRƯỜNG LỰC TRÌ HOÃN KÍCH HOẠT!', '#00f5ff');
            }
        } else if (rift.type === 'VORTEX_EXPLODE') {
            // Nổ tung diện rộng gây sát thương hủy diệt lên quái
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e || e.dead || e.isDead || (typeof e.hp === 'number' && e.hp <= 0)) continue;
                const dist = Math.hypot(e.x - rift.x, e.y - rift.y);
                if (dist <= rift.radius) {
                    const dmg = Math.round(180 * (1 - dist / (rift.radius * 1.5)));
                    if (typeof e.takeDamage === 'function') {
                        e.takeDamage(dmg, true);
                    } else if (typeof e.hp === 'number') {
                        e.hp -= dmg;
                    }
                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(e.x, e.y - 25, `💥 BÙNG NỔ -${dmg}!`, '#f43f5e');
                    }
                }
            }
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(rift.x, rift.y - 40, '💥 NỔ NĂNG LƯỢNG LƯỢNG TỬ!', '#ff0055');
            }
        }

        if (window.Game.Audio && typeof window.Game.Audio.playExplosion === 'function') {
            window.Game.Audio.playExplosion();
        }

        return true;
    },

    // Kiểm tra tương tác với phím E hoặc nút tương tác Clean HUD
    getNearbyInteractable: function (px, py) {
        if (!this._initialized) this.init();

        const state = window.Game.state || {
            timeline: 'PRESENT',
            hasSeed: false,
            isTreePlanted: false,
            chestOiled: false,
            chestOpened: false,
            unlockedWaypoints: [true, false, false]
        };
        const timeline = state.timeline || 'PRESENT';
        const interactRange = 85;

        this._checkAutoUnlockWaypoints(px, py);

        // 1. Kiểm tra tương tác Khe nứt / Trụ thời gian sẵn sàng
        for (let i = 0; i < this.timeRifts.length; i++) {
            const rift = this.timeRifts[i];
            const dist = Math.hypot(px - rift.x, py - rift.y);
            if (dist <= interactRange) {
                if (rift.currentCooldown <= 0) {
                    return `TIME_RIFT_${rift.id}`;
                }
            }
        }

        if (timeline === 'PRESENT' && !state.hasSeed) {
            const seedX = this.SEED_TILE.x * this.tileSize + this.tileSize / 2;
            const seedY = this.SEED_TILE.y * this.tileSize + this.tileSize / 2;
            const distToCenter = Math.hypot(px - seedX, py - seedY);
            if (distToCenter <= interactRange) {
                return 'SEED';
            }
        }

        if (timeline === 'PAST' && !state.isTreePlanted) {
            const soilX = this.SOIL_TILE.x * this.tileSize + this.tileSize / 2;
            const soilY = this.SOIL_TILE.y * this.tileSize + this.tileSize / 2;
            const distToSoil = Math.hypot(px - soilX, py - soilY);
            if (distToSoil <= interactRange) {
                return 'SOIL';
            }
        }

        const chestX = this.CHEST_TILE.x * this.tileSize + this.tileSize / 2;
        const chestY = this.CHEST_TILE.y * this.tileSize + this.tileSize / 2;
        const distToChest = Math.hypot(px - chestX, py - chestY);

        if (distToChest <= interactRange) {
            if (timeline === 'PAST') return 'CHEST_PAST';
            if (timeline === 'PRESENT') return 'CHEST_PRESENT';
            if (timeline === 'FUTURE') return 'CHEST_FUTURE';
        }

        for (let i = 0; i < this.waypoints.length; i++) {
            const wp = this.waypoints[i];
            const distToWp = Math.hypot(px - wp.x, py - wp.y);
            if (distToWp <= interactRange) {
                return wp.id;
            }
        }

        return null;
    },

    _isLaserTrapActive: function (trap, nowSec) {
        const period = trap.cyclePeriod || 2.5;
        const phase = trap.phaseOffset || 0;
        const cyclePos = Math.floor((nowSec + phase) / period);
        return cyclePos % 2 === 0;
    },

    getTerrainEffectAt: function (px, py, dt) {
        if (!this._initialized) this.init();

        const effect = {
            speedMultiplier: 1.0,
            cdrMultiplier: 1.0,
            damagePerSec: 0,
            zoneName: null
        };

        if (typeof px !== 'number' || typeof py !== 'number') {
            return effect;
        }

        this._checkAutoUnlockWaypoints(px, py);

        const timeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
        const nowSec = performance.now() * 0.001;
        const safeDt = dt || 0.016;

        // Cập nhật Trụ Bẫy Môi Trường & Khe Nứt
        for (let i = 0; i < this.timeRifts.length; i++) {
            const rift = this.timeRifts[i];
            if (rift.currentCooldown > 0) {
                rift.currentCooldown = Math.max(0, rift.currentCooldown - safeDt);
            }
            if (rift.isTriggered) {
                rift.activeTimer -= safeDt;
                rift.shockwaveR += safeDt * 180;
                if (rift.activeTimer <= 0) {
                    rift.isTriggered = false;
                    rift.shockwaveR = 0;
                }
            }

            const dist = Math.hypot(px - rift.x, py - rift.y);
            if (dist <= 65) {
                if (rift.currentCooldown <= 0) {
                    effect.zoneName = `[E] Kích hoạt ${rift.name}`;
                } else {
                    effect.zoneName = `${rift.name} (Hồi: ${Math.ceil(rift.currentCooldown)}s)`;
                }
            }
        }

        // Cập nhật Đài Tế Shrines
        for (let s = 0; s < this.shrines.length; s++) {
            const sh = this.shrines[s];
            if (sh.currentCooldown > 0) {
                sh.currentCooldown = Math.max(0, sh.currentCooldown - safeDt);
            }

            const dist = Math.hypot(px - sh.x, py - sh.y);
            if (dist <= sh.radius) {
                if (sh.currentCooldown <= 0) {
                    sh.stayTimer = (sh.stayTimer || 0) + safeDt;
                    effect.zoneName = `${sh.name} (Kích hoạt: ${Math.round((sh.stayTimer / sh.requiredTime) * 100)}%)`;

                    if (sh.stayTimer >= sh.requiredTime) {
                        sh.stayTimer = 0;
                        sh.currentCooldown = sh.cooldown;

                        if (sh.type === 'WAR') {
                            if (window.Game.player) {
                                window.Game.player.shield = window.Game.player.maxShield || 60;
                            }
                            if (window.Game.Combat) {
                                window.Game.Combat.warShrineTimer = 20.0;
                                window.Game.Combat.meleeDmgBuff = 1.25;
                            }
                            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                                window.Game.Combat.spawnFloatingText(sh.x, sh.y - 45, '⚡ CHIẾN THẦN: +25% CẬN CHIẾN & ĐẦY KHIÊN!', '#fbbf24');
                            }
                        } else if (sh.type === 'ASTRAL') {
                            if (window.Game.Combat) {
                                window.Game.Combat.astralShrineTimer = 12.0;
                            }
                            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                                window.Game.Combat.spawnFloatingText(sh.x, sh.y - 45, '⏳ TINH KHÔNG: -30% HỒI CHIÊU (12s)!', '#00f5ff');
                            }
                        }

                        if (window.Game.Audio && typeof window.Game.Audio.playPowerup === 'function') {
                            window.Game.Audio.playPowerup();
                        }
                    }
                } else {
                    sh.stayTimer = 0;
                    effect.zoneName = `${sh.name} (Hồi: ${Math.ceil(sh.currentCooldown)}s)`;
                }
            } else {
                sh.stayTimer = 0;
            }
        }

        if (window.Game.Combat && window.Game.Combat.astralShrineTimer > 0) {
            window.Game.Combat.astralShrineTimer = Math.max(0, window.Game.Combat.astralShrineTimer - safeDt);
            effect.cdrMultiplier = Math.max(effect.cdrMultiplier, 1.43);
        }

        // Dị Điểm Không-Thời Gian
        for (let i = 0; i < this.anomalies.length; i++) {
            const anom = this.anomalies[i];
            const dist = Math.hypot(px - anom.x, py - anom.y);
            if (dist <= anom.radius) {
                if (anom.speedMultiplier > effect.speedMultiplier) {
                    effect.speedMultiplier = anom.speedMultiplier;
                }
                if (anom.cdrMultiplier > effect.cdrMultiplier) {
                    effect.cdrMultiplier = anom.cdrMultiplier;
                }
                effect.zoneName = anom.name;
            }
        }

        // Cạm bẫy địa hình
        for (let i = 0; i < this.traps.length; i++) {
            const trap = this.traps[i];
            if (trap.timeline !== timeline) continue;

            if (trap.type === 'SWAMP') {
                const dist = Math.hypot(px - trap.x, py - trap.y);
                if (dist <= trap.radius) {
                    effect.speedMultiplier *= trap.speedMultiplier;
                    effect.zoneName = trap.name;
                }
            } else if (trap.type === 'THORNS') {
                const dist = Math.hypot(px - trap.x, py - trap.y);
                if (dist <= trap.radius) {
                    effect.speedMultiplier *= trap.speedMultiplier || 0.85;
                    effect.damagePerSec += trap.damagePerSec;
                    effect.zoneName = trap.name;
                }
            } else if (trap.type === 'LASER') {
                const halfW = trap.width / 2;
                const halfH = trap.height / 2;
                const insideBox =
                    px >= trap.x - halfW &&
                    px <= trap.x + halfW &&
                    py >= trap.y - halfH &&
                    py <= trap.y + halfH;

                if (insideBox) {
                    const isActive = this._isLaserTrapActive(trap, nowSec);
                    if (isActive) {
                        effect.damagePerSec += trap.damagePerSec;
                        effect.zoneName = trap.name + ' (ĐANG BẬT)';
                    } else if (!effect.zoneName) {
                        effect.zoneName = trap.name + ' (Tạm ngắt)';
                    }
                }
            }
        }

        return effect;
    },

    _getObjectiveTarget: function (player, state) {
        const ts = this.tileSize;
        const timeline = (state && state.timeline) || 'PRESENT';
        const hasSeed = !!(state && state.hasSeed);
        const isTreePlanted = !!(state && state.isTreePlanted);

        if (!hasSeed && !isTreePlanted) {
            return {
                x: this.SEED_TILE.x * ts + ts / 2,
                y: this.SEED_TILE.y * ts + ts / 2,
                name: timeline === 'PRESENT' ? 'Hạt Giống Cổ Đại' : 'Hạt Giống (Hiện Tại)',
                shortName: timeline === 'PRESENT' ? '🌱 Hạt Giống' : '🌱 Về Hiện Tại',
                color: '#facc15'
            };
        }

        if (hasSeed && !isTreePlanted) {
            return {
                x: this.SOIL_TILE.x * ts + ts / 2,
                y: this.SOIL_TILE.y * ts + ts / 2,
                name: timeline === 'PAST' ? 'Ô Đất Gieo Mầm' : 'Gieo Mầm (Quá Khứ)',
                shortName: timeline === 'PAST' ? '🌳 Ô Đất Trồng' : '🌳 Về Quá Khứ',
                color: '#4ade80'
            };
        }

        const abyssSouthBoundary = (this.ABYSS_ROW + 0.8) * ts;
        if (player.y > abyssSouthBoundary) {
            return {
                x: this.TREE_BRIDGE_TILE.x * ts + ts / 2,
                y: this.TREE_BRIDGE_TILE.y * ts + ts / 2,
                name: 'Cầu Cây Cổ Thụ',
                shortName: timeline === 'PAST' ? '🌉 Qua Hiện Tại' : '🌉 Cầu Cổ Thụ',
                color: '#38bdf8'
            };
        }

        const enemies = this._getActiveEnemiesList();

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.dead || e.isDead || (typeof e.hp === 'number' && e.hp <= 0)) continue;
            if (e.isMiniBoss && (e.timeline === 'ALL' || e.timeline === timeline)) {
                return {
                    x: e.x,
                    y: e.y,
                    name: e.name || 'Boss Phụ Kỷ Nguyên',
                    shortName: '⭐ ' + (e.name ? e.name.slice(0, 12) : 'Boss Phụ'),
                    color: '#e879f9'
                };
            }
        }

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.dead || e.isDead || (typeof e.hp === 'number' && e.hp <= 0)) continue;
            if (e.isBoss || e.type === 'boss' || e.rank === 'BOSS' || (e.maxHp && e.maxHp >= 1000)) {
                return {
                    x: e.x,
                    y: e.y,
                    name: e.name || 'Chúa Tể Thời Không',
                    shortName: '💀 Chúa Tể',
                    color: '#f43f5e'
                };
            }
        }

        return {
            x: 30 * ts,
            y: 17 * ts,
            name: 'Đấu Trường Boss',
            shortName: '⚔️ Đấu Trường Boss',
            color: '#f43f5e'
        };
    },

    _drawObjectiveCompass: function (ctx, player, state, now) {
        if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') return;

        const target = this._getObjectiveTarget(player, state);
        if (!target) return;

        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const distPx = Math.hypot(dx, dy);

        if (distPx < 65) return;

        const distMeters = Math.max(1, Math.round(distPx / 16));
        const angle = Math.atan2(dy, dx);
        const orbitR = 38 + Math.sin(now * 5) * 3;

        const arrowBaseX = player.x + Math.cos(angle) * orbitR;
        const arrowBaseY = player.y + Math.sin(angle) * orbitR;

        ctx.save();

        ctx.beginPath();
        ctx.arc(player.x, player.y, orbitR, angle - 0.55, angle + 0.55);
        ctx.strokeStyle = target.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        ctx.save();
        ctx.translate(arrowBaseX, arrowBaseY);
        ctx.rotate(angle);

        ctx.fillStyle = target.color;
        ctx.shadowColor = target.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-6, -6.5);
        ctx.lineTo(-2.5, 0);
        ctx.lineTo(-6, 6.5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();

        const labelText = `${target.shortName || target.name} • ${distMeters}m`;
        ctx.font = 'bold 10px sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const pillW = Math.ceil(textMetrics.width) + 14;
        const pillH = 17;
        const pillX = player.x - pillW / 2;
        const pillY = player.y + 30;

        ctx.fillStyle = 'rgba(8, 12, 24, 0.82)';
        ctx.strokeStyle = target.color;
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(pillX, pillY, pillW, pillH, 8);
        } else {
            ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, player.x, pillY + pillH / 2 + 0.5);

        ctx.restore();
    },

    _drawShrines: function (ctx, camX, camY, camW, camH, now) {
        for (let i = 0; i < this.shrines.length; i++) {
            const sh = this.shrines[i];
            const r = sh.radius;

            if (
                sh.x + r < camX ||
                sh.x - r > camX + camW ||
                sh.y + r < camY ||
                sh.y - r > camY + camH
            ) {
                continue;
            }

            const isReady = sh.currentCooldown <= 0;
            const mainColor = isReady ? sh.color : '#64748b';

            ctx.save();
            ctx.translate(sh.x, sh.y);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 38, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.save();
            ctx.rotate(now * 1.8);
            ctx.strokeStyle = isReady ? sh.runeColor : '#475569';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([12, 8]);
            ctx.beginPath();
            ctx.arc(0, 0, 48, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            if (isReady) {
                const beamGrad = ctx.createLinearGradient(0, 0, 0, -90);
                beamGrad.addColorStop(0, mainColor);
                beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.fillStyle = beamGrad;
                ctx.globalAlpha = 0.35 + Math.sin(now * 4) * 0.15;
                ctx.beginPath();
                ctx.moveTo(-24, 0);
                ctx.lineTo(24, 0);
                ctx.lineTo(14, -85);
                ctx.lineTo(-14, -85);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }

            if (sh.stayTimer > 0) {
                const pct = sh.stayTimer / sh.requiredTime;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, 52, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * pct);
                ctx.stroke();
            }

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sh.name, 0, 58);

            ctx.restore();
        }
    },

    // VẼ KHE NỨT THỜI GIAN & TRỤ NĂNG LƯỢNG MÔI TRƯỜNG
    _drawTimeRifts: function (ctx, camX, camY, camW, camH, now) {
        for (let i = 0; i < this.timeRifts.length; i++) {
            const rift = this.timeRifts[i];
            const r = rift.radius;

            if (
                rift.x + r < camX ||
                rift.x - r > camX + camW ||
                rift.y + r < camY ||
                rift.y - r > camY + camH
            ) {
                continue;
            }

            const isSlow = rift.type === 'TIME_SLOW';
            const themeColor = isSlow ? '#38bdf8' : '#f43f5e';
            const isReady = rift.currentCooldown <= 0;

            ctx.save();
            ctx.translate(rift.x, rift.y);

            // Bán kính vùng tác dụng
            ctx.beginPath();
            ctx.arc(0, 0, rift.radius, 0, Math.PI * 2);
            ctx.fillStyle = isSlow ? 'rgba(56, 189, 248, 0.06)' : 'rgba(244, 63, 94, 0.06)';
            ctx.fill();
            ctx.strokeStyle = isReady ? themeColor : '#475569';
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Sóng kích hoạt (Shockwave) nếu đang nổ/làm chậm
            if (rift.isTriggered && rift.shockwaveR > 0) {
                ctx.beginPath();
                ctx.arc(0, 0, rift.shockwaveR % rift.radius, 0, Math.PI * 2);
                ctx.strokeStyle = isSlow ? '#00f5ff' : '#ff0055';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Trụ trung tâm
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = isReady ? themeColor : '#64748b';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Lõi xoay năng lượng
            ctx.save();
            ctx.rotate(now * (isSlow ? -2.5 : 3.5));
            ctx.strokeStyle = isReady ? '#ffffff' : '#64748b';
            ctx.lineWidth = 2;
            ctx.strokeRect(-10, -10, 20, 20);
            ctx.restore();

            // Hiển thị tên & nút tương tác
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            const statusText = isReady ? `[E] ${rift.name}` : `Đang nạp (${Math.ceil(rift.currentCooldown)}s)`;
            ctx.fillText(statusText, 0, 36);

            ctx.restore();
        }
    },

    // ========================================================================
    // MAIN DRAW FUNCTION (ÁP DỤNG OFFSCREEN CANVAS CHỈ 1 LỆNH DRAWIMAGE)
    // ========================================================================
    draw: function (ctx, camera) {
        if (!this._initialized) this.init();

        const state = window.Game.state || {
            timeline: 'PRESENT',
            hasSeed: false,
            isTreePlanted: false,
            chestOiled: false,
            chestOpened: false,
            unlockedWaypoints: [true, false, false]
        };
        const timeline = state.timeline || 'PRESENT';
        const ts = this.tileSize;
        const now = performance.now() * 0.001;

        // Tự động xây dựng lại cache nếu có sự thay đổi cây cầu nhân quả
        if (state.isTreePlanted !== this._lastTreePlantedState) {
            this.rebuildAllBackgroundCaches();
        }

        if (window.Game.player) {
            this._checkAutoUnlockWaypoints(window.Game.player.x, window.Game.player.y);
        }

        const canvasW = (ctx.canvas && ctx.canvas.width) || window.innerWidth || 1280;
        const canvasH = (ctx.canvas && ctx.canvas.height) || window.innerHeight || 720;
        const camW = (camera && (camera.width || camera.w)) || canvasW;
        const camH = (camera && (camera.height || camera.h)) || canvasH;

        let camX = 0;
        let camY = 0;
        if (camera && typeof camera.x === 'number' && typeof camera.y === 'number') {
            camX = camera.x;
            camY = camera.y;
        } else if (window.Game.player) {
            camX = window.Game.player.x - camW / 2;
            camY = window.Game.player.y - camH / 2;
        }

        let needInternalTranslate = false;
        if (typeof ctx.getTransform === 'function') {
            const m = ctx.getTransform();
            const isTranslated = Math.abs(m.e) > 0.5 || Math.abs(m.f) > 0.5;
            if (!isTranslated && (Math.abs(camX) > 0.5 || Math.abs(camY) > 0.5)) {
                needInternalTranslate = true;
            }
        }

        if (needInternalTranslate) {
            ctx.save();
            ctx.translate(-camX, -camY);
        }

        // ====================================================================
        // 1. TỐI ƯU SIÊU CẤP: DÙNG ĐÚNG 1 LỆNH DRAWIMAGE TỪ OFFSCREEN CANVAS
        // ====================================================================
        const cachedBg = this._cachedBackgrounds[timeline];
        if (cachedBg) {
            const sx = Math.max(0, Math.min(this.width - camW, camX));
            const sy = Math.max(0, Math.min(this.height - camH, camY));
            const sw = Math.min(this.width - sx, camW);
            const sh = Math.min(this.height - sy, camH);

            ctx.drawImage(
                cachedBg,
                sx, sy, sw, sh,
                sx, sy, sw, sh
            );
        }

        const startCol = Math.max(0, Math.floor(camX / ts) - 2);
        const endCol = Math.min(this.cols - 1, Math.ceil((camX + camW) / ts) + 2);
        const startRow = Math.max(0, Math.floor(camY / ts) - 2);
        const endRow = Math.min(this.rows - 1, Math.ceil((camY + camH) / ts) + 2);

        // Vẽ hiệu ứng động của vực thẳm
        if (this.ABYSS_ROW >= startRow && this.ABYSS_ROW <= endRow) {
            for (let c = startCol; c <= endCol; c++) {
                this._drawAbyssDynamicEffect(ctx, c * ts, this.ABYSS_ROW * ts, c, timeline, now);
            }
        }

        this._drawTraps(ctx, camX, camY, camW, camH, timeline, now);
        this._drawAnomalies(ctx, camX, camY, camW, camH, now);
        this._drawShrines(ctx, camX, camY, camW, camH, now);
        this._drawTimeRifts(ctx, camX, camY, camW, camH, now);

        if (
            this.BRIDGE_TILE.x >= startCol &&
            this.BRIDGE_TILE.x <= endCol &&
            this.BRIDGE_TILE.y >= startRow &&
            this.BRIDGE_TILE.y <= endRow
        ) {
            this._drawWoodenBridge(ctx, this.BRIDGE_TILE.x * ts, this.BRIDGE_TILE.y * ts, timeline);
        }

        if (
            this.SOIL_TILE.x >= startCol - 1 &&
            this.SOIL_TILE.x <= endCol + 1 &&
            this.SOIL_TILE.y >= startRow - 2 &&
            this.SOIL_TILE.y <= endRow + 1
        ) {
            this._drawCausalSoilAndTree(
                ctx,
                this.SOIL_TILE.x * ts,
                this.SOIL_TILE.y * ts,
                timeline,
                !!state.isTreePlanted,
                now
            );
        }

        if (
            timeline === 'PRESENT' &&
            !state.hasSeed &&
            this.SEED_TILE.x >= startCol &&
            this.SEED_TILE.x <= endCol &&
            this.SEED_TILE.y >= startRow &&
            this.SEED_TILE.y <= endRow
        ) {
            this._drawAncientSeed(ctx, this.SEED_TILE.x * ts, this.SEED_TILE.y * ts, now);
        }

        if (
            this.CHEST_TILE.x >= startCol - 1 &&
            this.CHEST_TILE.x <= endCol + 1 &&
            this.CHEST_TILE.y >= startRow - 1 &&
            this.CHEST_TILE.y <= endRow + 1
        ) {
            this._drawTimeChest(
                ctx,
                this.CHEST_TILE.x * ts,
                this.CHEST_TILE.y * ts,
                timeline,
                !!state.chestOiled,
                !!state.chestOpened,
                now
            );
        }

        this._drawWaypoints(ctx, camX, camY, camW, camH, timeline, state, now);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const cell = this.grid[r][c];
                if (cell === 1 || cell === 2) {
                    const wx = c * ts;
                    const wy = r * ts;
                    this._drawObstacle(ctx, wx, wy, cell, timeline, this.decorGrid[r][c], now);
                }
            }
        }

        if (window.Game.player) {
            this._drawObjectiveCompass(ctx, window.Game.player, state, now);
        }

        this._drawWeatherParticles(ctx, camX, camY, camW, camH, timeline, now);

        if (needInternalTranslate) {
            ctx.restore();
        }
    },

    _drawGroundTile: function (ctx, x, y, col, row, decor, timeline, isBossZone) {
        const ts = this.tileSize;
        const isRoad = col === 30 && row > 25 && row < 36;

        if (timeline === 'PAST') {
            if (isBossZone) {
                ctx.fillStyle = (col + row) % 2 === 0 ? '#5c3c24' : '#52341e';
            } else if (isRoad) {
                ctx.fillStyle = '#8b6946';
            } else {
                ctx.fillStyle = (col + row) % 2 === 0 ? '#785832' : '#6e4f2c';
            }
            ctx.fillRect(x, y, ts, ts);

            if (decor > 0.35 && decor < 0.75) {
                ctx.fillStyle = '#9c783e';
                ctx.fillRect(x + 12, y + 18, 6, 3);
                ctx.fillRect(x + 42, y + 44, 8, 3);
            }
        } else if (timeline === 'PRESENT') {
            if (isBossZone) {
                ctx.fillStyle = (col + row) % 2 === 0 ? '#2b4c3f' : '#254236';
            } else if (isRoad) {
                ctx.fillStyle = '#9e8560';
            } else {
                ctx.fillStyle = (col + row) % 2 === 0 ? '#3f8f4e' : '#388246';
            }
            ctx.fillRect(x, y, ts, ts);

            if (decor > 0.3 && decor < 0.7 && !isRoad) {
                ctx.fillStyle = '#52ad62';
                ctx.fillRect(x + 16, y + 20, 4, 8);
                ctx.fillRect(x + 20, y + 23, 3, 5);
                if (decor > 0.6) {
                    ctx.fillStyle = '#fff380';
                    ctx.fillRect(x + 44, y + 36, 4, 4);
                }
            }
        } else {
            ctx.fillStyle = isBossZone ? '#12091c' : '#090d18';
            ctx.fillRect(x, y, ts, ts);

            ctx.strokeStyle = isBossZone ? 'rgba(255, 0, 128, 0.28)' : 'rgba(0, 240, 255, 0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);

            if (decor > 0.5 && decor < 0.65) {
                ctx.fillStyle = isBossZone ? 'rgba(255, 0, 128, 0.35)' : 'rgba(0, 240, 255, 0.3)';
                ctx.fillRect(x + 14, y + 14, 10, 3);
                ctx.fillRect(x + 24, y + 14, 3, 14);
            }
        }
    },

    _drawAbyssDynamicEffect: function (ctx, x, y, col, timeline, now) {
        const ts = this.tileSize;
        if (timeline === 'FUTURE') {
            const pulse = 0.4 + 0.3 * Math.sin(now * 3 + col * 0.7);
            ctx.fillStyle = `rgba(0, 229, 255, ${pulse})`;
            ctx.fillRect(x, y + 28, ts, 8);
        } else {
            const mist = 0.12 + 0.08 * Math.sin(now * 2 + col);
            ctx.fillStyle =
                timeline === 'PAST'
                    ? `rgba(210, 140, 70, ${mist})`
                    : `rgba(110, 180, 220, ${mist})`;
            ctx.fillRect(x, y + 18, ts, 28);
        }
    },

    _drawTraps: function (ctx, camX, camY, camW, camH, timeline, now) {
        for (let i = 0; i < this.traps.length; i++) {
            const trap = this.traps[i];
            if (trap.timeline !== timeline) continue;

            const bound = trap.radius || Math.max(trap.width || 120, trap.height || 120);
            if (
                trap.x + bound < camX ||
                trap.x - bound > camX + camW ||
                trap.y + bound < camY ||
                trap.y - bound > camY + camH
            ) {
                continue;
            }

            ctx.save();

            if (trap.type === 'SWAMP') {
                const r = trap.radius;
                const grad = ctx.createRadialGradient(trap.x, trap.y, r * 0.15, trap.x, trap.y, r);
                grad.addColorStop(0, 'rgba(42, 28, 14, 0.92)');
                grad.addColorStop(0.7, 'rgba(58, 40, 20, 0.82)');
                grad.addColorStop(1, 'rgba(58, 40, 20, 0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(trap.x, trap.y, r, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(35, 22, 10, 0.65)';
                ctx.beginPath();
                ctx.ellipse(trap.x, trap.y, r * 0.72, r * 0.58, 0.2, 0, Math.PI * 2);
                ctx.fill();

                for (let b = 0; b < 6; b++) {
                    const bPhase = now * 1.8 + b * 1.1 + i;
                    const progress = bPhase - Math.floor(bPhase);
                    const angle = b * 1.05 + i;
                    const dist = (0.2 + (b % 3) * 0.22) * r;
                    const bx = trap.x + Math.cos(angle) * dist;
                    const by = trap.y + Math.sin(angle) * dist * 0.8;
                    const br = 3 + progress * 7;

                    ctx.fillStyle = `rgba(130, 105, 55, ${1 - progress})`;
                    ctx.beginPath();
                    ctx.arc(bx, by, br, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = `rgba(190, 160, 95, ${1 - progress})`;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }
            } else if (trap.type === 'THORNS') {
                const r = trap.radius;
                const grad = ctx.createRadialGradient(trap.x, trap.y, r * 0.1, trap.x, trap.y, r);
                grad.addColorStop(0, 'rgba(75, 25, 95, 0.75)');
                grad.addColorStop(0.65, 'rgba(35, 85, 45, 0.65)');
                grad.addColorStop(1, 'rgba(35, 85, 45, 0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(trap.x, trap.y, r, 0, Math.PI * 2);
                ctx.fill();

                const spikeCount = 14;
                for (let s = 0; s < spikeCount; s++) {
                    const ang = (s / spikeCount) * Math.PI * 2 + Math.sin(now * 1.5 + s) * 0.05;
                    const innerR = (s % 2 === 0 ? 0.2 : 0.45) * r;
                    const outerR = (s % 2 === 0 ? 0.88 : 0.72) * r;
                    const sx = trap.x + Math.cos(ang) * innerR;
                    const sy = trap.y + Math.sin(ang) * innerR;
                    const tx = trap.x + Math.cos(ang) * outerR;
                    const ty = trap.y + Math.sin(ang) * outerR;

                    ctx.fillStyle = s % 2 === 0 ? '#8e2de2' : '#2ecc71';
                    ctx.beginPath();
                    ctx.moveTo(sx - Math.sin(ang) * 5, sy + Math.cos(ang) * 5);
                    ctx.lineTo(tx, ty);
                    ctx.lineTo(sx + Math.sin(ang) * 5, sy - Math.cos(ang) * 5);
                    ctx.closePath();
                    ctx.fill();
                }

                const pulse = 0.5 + 0.4 * Math.sin(now * 4 + i);
                ctx.strokeStyle = `rgba(195, 60, 255, ${pulse})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(trap.x, trap.y, r * 0.82, 0, Math.PI * 2);
                ctx.stroke();
            } else if (trap.type === 'LASER') {
                const halfW = trap.width / 2;
                const halfH = trap.height / 2;
                const leftX = trap.x - halfW;
                const rightX = trap.x + halfW;
                const isActive = this._isLaserTrapActive(trap, now);

                const period = trap.cyclePeriod || 2.5;
                const elapsedInCycle = (now + (trap.phaseOffset || 0)) % period;
                const isAboutToSwitch = elapsedInCycle > period - 0.45;

                ctx.fillStyle = isActive ? 'rgba(255, 20, 60, 0.22)' : 'rgba(0, 240, 255, 0.08)';
                ctx.fillRect(leftX, trap.y - halfH, trap.width, trap.height);

                ctx.fillStyle = '#1b2436';
                ctx.strokeStyle = isActive ? '#ff1744' : '#00e5ff';
                ctx.lineWidth = 2;
                ctx.fillRect(leftX - 8, trap.y - halfH, 16, trap.height);
                ctx.strokeRect(leftX - 8, trap.y - halfH, 16, trap.height);
                ctx.fillRect(rightX - 8, trap.y - halfH, 16, trap.height);
                ctx.strokeRect(rightX - 8, trap.y - halfH, 16, trap.height);

                const lampColor = isActive ? '#ff1744' : isAboutToSwitch ? '#ffea00' : '#00e676';
                ctx.fillStyle = lampColor;
                ctx.beginPath();
                ctx.arc(leftX, trap.y, 5, 0, Math.PI * 2);
                ctx.arc(rightX, trap.y, 5, 0, Math.PI * 2);
                ctx.fill();

                if (isActive) {
                    for (let beam = -1; beam <= 1; beam++) {
                        const by = trap.y + beam * 14;
                        const jitter = Math.sin(now * 45 + beam * 2) * 1.5;

                        ctx.strokeStyle = 'rgba(255, 20, 60, 0.65)';
                        ctx.lineWidth = 6;
                        ctx.beginPath();
                        ctx.moveTo(leftX + 6, by);
                        ctx.lineTo(rightX - 6, by + jitter);
                        ctx.stroke();

                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(leftX + 6, by);
                        ctx.lineTo(rightX - 6, by + jitter);
                        ctx.stroke();
                    }
                } else if (isAboutToSwitch) {
                    ctx.strokeStyle = 'rgba(255, 210, 0, 0.55)';
                    ctx.setLineDash([8, 8]);
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(leftX + 6, trap.y);
                    ctx.lineTo(rightX - 6, trap.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }

            ctx.restore();
        }
    },

    _drawAnomalies: function (ctx, camX, camY, camW, camH, now) {
        for (let i = 0; i < this.anomalies.length; i++) {
            const anom = this.anomalies[i];
            const r = anom.radius;

            if (
                anom.x + r < camX ||
                anom.x - r > camX + camW ||
                anom.y + r < camY ||
                anom.y - r > camY + camH
            ) {
                continue;
            }

            const isSpeed = anom.type === 'SPEED';
            const primaryRGB = isSpeed ? '0, 245, 255' : '200, 80, 255';

            ctx.save();
            ctx.translate(anom.x, anom.y);

            const grad = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
            grad.addColorStop(0, `rgba(${primaryRGB}, 0.45)`);
            grad.addColorStop(0.6, `rgba(${primaryRGB}, 0.18)`);
            grad.addColorStop(1, `rgba(${primaryRGB}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.rotate(now * 1.4);
            ctx.strokeStyle = `rgba(${primaryRGB}, 0.75)`;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([18, 12]);
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.rotate(-now * 2.2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 16]);
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
            ctx.stroke();

            for (let arm = 0; arm < 4; arm++) {
                ctx.save();
                ctx.rotate((arm * Math.PI) / 2);
                ctx.strokeStyle = `rgba(${primaryRGB}, 0.85)`;
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.arc(r * 0.25, 0, r * 0.35, 0, Math.PI * 0.85);
                ctx.stroke();
                ctx.restore();
            }
            ctx.restore();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(isSpeed ? '⚡ TỐC ĐỘ x1.75' : '⏳ HỒI CHIÊU x2.0', 0, 4);

            ctx.restore();
        }
    },

    _drawWoodenBridge: function (ctx, x, y, timeline) {
        const ts = this.tileSize;

        if (timeline === 'PAST') {
            ctx.fillStyle = '#593718';
            ctx.fillRect(x + 6, y, 8, ts);
            ctx.fillRect(x + ts - 14, y, 8, ts);

            for (let i = 2; i < ts; i += 10) {
                ctx.fillStyle = i % 20 === 2 ? '#8f5d2e' : '#7a4d24';
                ctx.fillRect(x + 4, y + i, ts - 8, 7);
            }

            ctx.fillStyle = '#c49a5c';
            ctx.fillRect(x + 3, y, 3, ts);
            ctx.fillRect(x + ts - 6, y, 3, ts);
        } else {
            const plankColor = timeline === 'PRESENT' ? '#634326' : '#2c3545';
            ctx.fillStyle = plankColor;

            ctx.fillRect(x + 6, y, ts - 12, 12);
            ctx.fillRect(x + 10, y + 12, 12, 6);
            ctx.fillRect(x + ts - 22, y + 12, 10, 5);

            ctx.fillRect(x + 6, y + ts - 12, ts - 12, 12);
            ctx.fillRect(x + 8, y + ts - 18, 14, 6);
            ctx.fillRect(x + ts - 24, y + ts - 17, 12, 5);

            if (timeline === 'FUTURE') {
                ctx.strokeStyle = 'rgba(255, 50, 80, 0.75)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + 20, y + 20);
                ctx.lineTo(x + ts - 20, y + ts - 20);
                ctx.moveTo(x + ts - 20, y + 20);
                ctx.lineTo(x + 20, y + ts - 20);
                ctx.stroke();
            }
        }
    },

    _drawCausalSoilAndTree: function (ctx, soilX, soilY, timeline, isTreePlanted, now) {
        const ts = this.tileSize;
        const centerX = soilX + ts / 2;
        const centerY = soilY + ts / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 22, 0, Math.PI * 2);
        ctx.fillStyle = timeline === 'FUTURE' ? '#1c2b38' : '#4a2f18';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle =
            timeline === 'PAST'
                ? '#ffcf5c'
                : timeline === 'PRESENT'
                ? '#76d96a'
                : '#00f2ff';
        ctx.stroke();

        if (timeline === 'PAST' && !isTreePlanted) {
            const pulse = 18 + Math.sin(now * 4) * 4;
            ctx.beginPath();
            ctx.arc(centerX, centerY, pulse, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 220, 100, 0.85)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (isTreePlanted) {
            if (timeline === 'PAST') {
                ctx.fillStyle = '#47d147';
                ctx.fillRect(centerX - 3, centerY - 16, 6, 16);
                ctx.beginPath();
                ctx.ellipse(centerX - 7, centerY - 14, 7, 4, -0.4, 0, Math.PI * 2);
                ctx.ellipse(centerX + 7, centerY - 16, 7, 4, 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const bridgeY = this.TREE_BRIDGE_TILE.y * ts;

                ctx.fillStyle = timeline === 'PRESENT' ? '#5e3a1a' : '#2a1f4a';
                ctx.beginPath();
                ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = timeline === 'PRESENT' ? '#6e4520' : '#35275c';
                ctx.fillRect(soilX + 12, bridgeY - 12, ts - 24, ts + 42);

                ctx.strokeStyle = timeline === 'PRESENT' ? '#8c5a2b' : '#00f7ff';
                ctx.lineWidth = 2;
                ctx.strokeRect(soilX + 14, bridgeY - 10, ts - 28, ts + 38);

                ctx.fillStyle = timeline === 'PRESENT' ? '#2e8b46' : '#00e5ff';
                ctx.beginPath();
                ctx.arc(soilX + 12, bridgeY + 16, 10, 0, Math.PI * 2);
                ctx.arc(soilX + ts - 12, bridgeY + 42, 11, 0, Math.PI * 2);
                ctx.arc(centerX, bridgeY - 10, 18, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    },

    _drawAncientSeed: function (ctx, x, y, now) {
        const ts = this.tileSize;
        const cx = x + ts / 2;
        const cy = y + ts / 2;
        const floatOffset = Math.sin(now * 3.5) * 4;

        ctx.save();

        const glowRadius = 22 + Math.sin(now * 5) * 5;
        const grad = ctx.createRadialGradient(
            cx,
            cy + floatOffset,
            2,
            cx,
            cy + floatOffset,
            glowRadius
        );
        grad.addColorStop(0, 'rgba(255, 250, 160, 0.95)');
        grad.addColorStop(0.5, 'rgba(80, 255, 120, 0.55)');
        grad.addColorStop(1, 'rgba(80, 255, 120, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy + floatOffset, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffe966';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy + floatOffset, 9, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    },

    _drawTimeChest: function (ctx, x, y, timeline, chestOiled, chestOpened, now) {
        const ts = this.tileSize;
        const cx = x + ts / 2;
        const cy = y + ts / 2;

        ctx.save();

        ctx.fillStyle = timeline === 'FUTURE' ? '#162030' : '#4a4642';
        ctx.fillRect(x + 8, y + 14, ts - 16, ts - 20);
        ctx.strokeStyle = timeline === 'FUTURE' ? '#00e5ff' : '#2b2825';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 8, y + 14, ts - 16, ts - 20);

        if (timeline === 'PAST') {
            ctx.fillStyle = '#8c5223';
            ctx.fillRect(x + 14, y + 20, ts - 28, 28);

            ctx.fillStyle = '#a8642c';
            ctx.fillRect(x + 14, y + 16, ts - 28, 10);
            ctx.strokeStyle = chestOiled ? '#ffd700' : '#d4af37';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x + 14, y + 16, ts - 28, 32);

            ctx.fillStyle = '#ffd700';
            ctx.fillRect(cx - 4, cy - 2, 8, 10);

            if (chestOiled) {
                const glowR = 28 + Math.sin(now * 5) * 4;
                const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, glowR);
                grad.addColorStop(0, 'rgba(255, 235, 120, 0.65)');
                grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
                ctx.fill();

                for (let s = 0; s < 4; s++) {
                    const ang = now * 2.5 + (s * Math.PI) / 2;
                    const sx = cx + Math.cos(ang) * 20;
                    const sy = cy + Math.sin(ang) * 14;
                    ctx.fillStyle = '#fff9c4';
                    ctx.fillRect(sx - 2, sy - 2, 4, 4);
                }
            }
        } else if (timeline === 'PRESENT') {
            ctx.fillStyle = chestOiled ? '#5c4938' : '#4a3528';
            ctx.fillRect(x + 14, y + 18, ts - 28, 30);

            ctx.strokeStyle = chestOiled ? '#b89758' : '#6e3b1e';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 14, y + 18, ts - 28, 30);

            ctx.fillStyle = '#38753b';
            ctx.beginPath();
            ctx.arc(x + 18, y + 24, 6, 0, Math.PI * 2);
            ctx.arc(x + ts - 20, y + 42, 7, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#8a7f78';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(x + 14, y + 22);
            ctx.lineTo(x + ts - 14, y + 44);
            ctx.moveTo(x + ts - 14, y + 22);
            ctx.lineTo(x + 14, y + 44);
            ctx.stroke();
        } else {
            if (chestOiled) {
                if (!chestOpened) {
                    const pulseR = 34 + Math.sin(now * 6) * 6;
                    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, pulseR);
                    grad.addColorStop(0, 'rgba(255, 240, 120, 0.95)');
                    grad.addColorStop(0.55, 'rgba(255, 190, 0, 0.45)');
                    grad.addColorStop(1, 'rgba(255, 190, 0, 0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = chestOpened ? '#332b1a' : '#d49b16';
                ctx.fillRect(x + 14, y + 18, ts - 28, 30);

                ctx.strokeStyle = '#ffea00';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(x + 14, y + 18, ts - 28, 30);

                if (chestOpened) {
                    ctx.fillStyle = '#120e07';
                    ctx.fillRect(x + 16, y + 20, ts - 32, 10);
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(cx, cy + 2, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                ctx.fillStyle = '#3b2820';
                ctx.beginPath();
                ctx.moveTo(x + 12, y + 46);
                ctx.lineTo(x + 22, y + 32);
                ctx.lineTo(x + 36, y + 38);
                ctx.lineTo(x + 48, y + 30);
                ctx.lineTo(x + 52, y + 48);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#6e4230';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + 16, y + 44);
                ctx.lineTo(x + 30, y + 34);
                ctx.moveTo(x + 34, y + 45);
                ctx.lineTo(x + 46, y + 36);
                ctx.stroke();
            }
        }

        ctx.restore();
    },

    _drawWaypoints: function (ctx, camX, camY, camW, camH, timeline, state, now) {
        const unlockedList = (state && state.unlockedWaypoints) || [true, false, false];

        for (let i = 0; i < this.waypoints.length; i++) {
            const wp = this.waypoints[i];
            if (
                wp.x + 80 < camX ||
                wp.x - 80 > camX + camW ||
                wp.y + 80 < camY ||
                wp.y - 80 > camY + camH
            ) {
                continue;
            }

            const isUnlocked = !!unlockedList[wp.index];
            const mainColor = isUnlocked ? '#00ffcc' : '#7f8c8d';

            ctx.save();
            ctx.translate(wp.x, wp.y);

            if (isUnlocked) {
                const glowR = 44 + Math.sin(now * 4 + i) * 5;
                const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, glowR);
                grad.addColorStop(0, 'rgba(0, 255, 204, 0.55)');
                grad.addColorStop(0.6, 'rgba(0, 200, 255, 0.22)');
                grad.addColorStop(1, 'rgba(0, 200, 255, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, glowR, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.save();
            ctx.rotate(isUnlocked ? now * 1.2 : 0);
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = timeline === 'FUTURE' ? '#152238' : '#3d4849';
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            const floatY = isUnlocked ? Math.sin(now * 3.5 + i) * 4 : 0;
            ctx.fillStyle = isUnlocked ? '#00f5ff' : '#556066';
            ctx.beginPath();
            ctx.moveTo(0, -24 + floatY);
            ctx.lineTo(11, -6 + floatY);
            ctx.lineTo(0, 8 + floatY);
            ctx.lineTo(-11, -6 + floatY);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = isUnlocked ? '#b8fff2' : '#95a5a6';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(wp.name, 0, -32);

            ctx.restore();
        }
    },

    _drawObstacle: function (ctx, x, y, type, timeline, decor, now) {
        const ts = this.tileSize;
        const cx = x + ts / 2;
        const cy = y + ts / 2;

        if (type === 1) {
            if (timeline === 'FUTURE') {
                ctx.fillStyle = '#1b263b';
                ctx.fillRect(x + 6, y + 6, ts - 12, ts - 12);
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 8, y + 8, ts - 16, ts - 16);
            } else {
                ctx.fillStyle = timeline === 'PAST' ? '#5e4b3c' : '#64706c';
                ctx.beginPath();
                ctx.arc(cx, cy, 24, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = timeline === 'PAST' ? '#786250' : '#808f8a';
                ctx.beginPath();
                ctx.arc(cx - 5, cy - 6, 15, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (type === 2) {
            if (timeline === 'FUTURE') {
                ctx.fillStyle = '#12192b';
                ctx.beginPath();
                ctx.arc(cx, cy, 22, 0, Math.PI * 2);
                ctx.fill();

                const pulse = 0.6 + 0.4 * Math.sin(now * 4 + decor * 10);
                ctx.strokeStyle = `rgba(255, 0, 170, ${pulse})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cx, cy, 16, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#00f7ff';
                ctx.beginPath();
                ctx.arc(cx, cy, 7, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#4d3018';
                ctx.fillRect(cx - 8, cy + 2, 16, 20);

                ctx.fillStyle =
                    timeline === 'PAST'
                        ? decor > 0.96
                            ? '#d47a2c'
                            : '#b88628'
                        : '#256636';
                ctx.beginPath();
                ctx.arc(cx, cy - 6, 25, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = timeline === 'PAST' ? '#eb9e38' : '#338549';
                ctx.beginPath();
                ctx.arc(cx - 6, cy - 12, 16, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    _drawWeatherParticles: function (ctx, camX, camY, camW, camH, timeline, now) {
        if (!this.weatherParticles || this.weatherParticles.length === 0) {
            this._initWeatherParticles();
        }

        const dt = Math.min(0.05, Math.max(0.001, now - (this._lastWeatherTime || now)));
        this._lastWeatherTime = now;

        ctx.save();

        for (let i = 0; i < this.weatherParticles.length; i++) {
            const p = this.weatherParticles[i];

            if (timeline === 'PAST') {
                p.x += (45 + Math.sin(now + p.phase) * 18) * dt;
                p.y += (28 + (i % 5) * 6) * dt;
            } else if (timeline === 'PRESENT') {
                p.x += Math.cos(now * 1.4 + p.phase) * 22 * dt;
                p.y += Math.sin(now * 1.1 + p.phase) * 18 * dt;
            } else {
                p.y += (165 + (i % 7) * 28) * dt;
            }

            if (p.x < 0) p.x += camW;
            if (p.x > camW) p.x -= camW;
            if (p.y < 0) p.y += camH;
            if (p.y > camH) p.y -= camH;

            const wx = camX + p.x;
            const wy = camY + p.y;

            if (timeline === 'PAST') {
                if (i % 3 === 0) {
                    ctx.save();
                    ctx.translate(wx, wy);
                    ctx.rotate(now * p.spinSpeed + p.phase);
                    ctx.fillStyle = i % 6 === 0 ? 'rgba(218, 105, 42, 0.8)' : 'rgba(235, 175, 55, 0.8)';
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.75, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                } else {
                    ctx.fillStyle = `rgba(240, 200, 140, ${p.alpha * 0.65})`;
                    ctx.beginPath();
                    ctx.arc(wx, wy, p.size * 0.65, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (timeline === 'PRESENT') {
                if (i % 2 === 0) {
                    const glow = 0.35 + 0.65 * Math.abs(Math.sin(now * 3 + p.phase));
                    ctx.fillStyle = `rgba(140, 255, 100, ${glow})`;
                    ctx.beginPath();
                    ctx.arc(wx, wy, p.size * 0.85, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.save();
                    ctx.translate(wx, wy);
                    ctx.rotate(now + p.phase);
                    ctx.fillStyle = 'rgba(255, 195, 215, 0.78)';
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.size * 1.2, p.size * 0.65, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            } else {
                if (i % 4 === 0) {
                    ctx.fillStyle = 'rgba(0, 255, 180, 0.72)';
                    ctx.font = '11px monospace';
                    ctx.fillText(p.glyph, wx, wy);
                } else {
                    ctx.strokeStyle =
                        i % 5 === 0 ? 'rgba(255, 0, 170, 0.75)' : 'rgba(0, 240, 255, 0.65)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(wx, wy - 10);
                    ctx.lineTo(wx, wy + 4);
                    ctx.stroke();
                }
            }
        }

        ctx.restore();
    },

    // ========================================================================
    // MINIMAP: HIỂN THỊ QUÁI, BOSS, ĐÀI TẾ & KHE NỨT THỜI GIAN
    // ========================================================================
    drawMinimap: function (ctx, canvasWidth, canvasHeight) {
        if (!this._initialized) this.init();

        const cw = canvasWidth || (ctx.canvas && ctx.canvas.width) || window.innerWidth || 1280;
        const ch = canvasHeight || (ctx.canvas && ctx.canvas.height) || window.innerHeight || 720;

        const state = window.Game.state || {
            timeline: 'PRESENT',
            isTreePlanted: false,
            chestOiled: false,
            chestOpened: false,
            unlockedWaypoints: [true, false, false]
        };
        const timeline = state.timeline || 'PRESENT';
        const now = performance.now() * 0.001;
        const player = window.Game.player;

        const isMobile = cw <= 900 || ch <= 550;
        const mapSize = isMobile ? 104 : 148;
        const mapX = 12;
        const mapY = 12;
        const cornerRadius = isMobile ? 8 : 11;

        const scaleX = mapSize / this.width;
        const scaleY = mapSize / this.height;
        const centerX = mapX + mapSize / 2;
        const centerY = mapY + mapSize / 2;

        let combatDetected = false;
        const enemyList = this._getActiveEnemiesList();

        if (player && typeof player.x === 'number' && typeof player.y === 'number') {
            for (let i = 0; i < enemyList.length; i++) {
                const e = enemyList[i];
                if (!e || e.dead || e.isDead || (typeof e.hp === 'number' && e.hp <= 0)) continue;
                if (e.timeline && e.timeline !== 'ALL' && e.timeline !== timeline) continue;

                const dist = Math.hypot(e.x - player.x, e.y - player.y);
                if (dist <= 350) {
                    const recentlyHit = (now - (e.lastHitTime || 0)) <= 3.0;
                    const isAttacking = (e.attackCd && e.attackCd > 0) || e.kamikazeActive || e.isDashing;

                    if (recentlyHit || isAttacking || dist <= 160) {
                        combatDetected = true;
                        break;
                    }
                }
            }
        }
        this.isPlayerInCombat = combatDetected;

        const themeColor =
            timeline === 'PAST'
                ? '#f59e0b'
                : timeline === 'PRESENT'
                ? '#10b981'
                : '#00f5ff';

        const bgFill =
            timeline === 'PAST'
                ? 'rgba(24, 16, 8, 0.88)'
                : timeline === 'PRESENT'
                ? 'rgba(8, 22, 16, 0.88)'
                : 'rgba(5, 10, 24, 0.90)';

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(mapX, mapY, mapSize, mapSize, cornerRadius);
        } else {
            ctx.rect(mapX, mapY, mapSize, mapSize);
        }
        ctx.fillStyle = bgFill;
        ctx.fill();
        ctx.clip();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 1;
        for (let g = 1; g < 4; g++) {
            const offset = (mapSize / 4) * g;
            ctx.beginPath();
            ctx.moveTo(mapX + offset, mapY);
            ctx.lineTo(mapX + offset, mapY + mapSize);
            ctx.moveTo(mapX, mapY + offset);
            ctx.lineTo(mapX + mapSize, mapY + offset);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, mapSize * 0.24, 0, Math.PI * 2);
        ctx.arc(centerX, centerY, mapSize * 0.44, 0, Math.PI * 2);
        ctx.stroke();

        const abyssY = mapY + (this.ABYSS_ROW * this.tileSize + 32) * scaleY;
        ctx.strokeStyle = timeline === 'FUTURE' ? 'rgba(0, 229, 255, 0.7)' : 'rgba(255, 65, 65, 0.7)';
        ctx.lineWidth = isMobile ? 2 : 3;
        ctx.beginPath();
        ctx.moveTo(mapX, abyssY);
        ctx.lineTo(mapX + mapSize, abyssY);
        ctx.stroke();

        const bridgeX = mapX + (this.BRIDGE_TILE.x * this.tileSize + 32) * scaleX;
        ctx.fillStyle = timeline === 'PAST' ? '#ffb74d' : '#64748b';
        ctx.fillRect(bridgeX - 3, abyssY - 3, 6, 6);

        const treeBridgeX = mapX + (this.TREE_BRIDGE_TILE.x * this.tileSize + 32) * scaleX;
        if (state.isTreePlanted) {
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(treeBridgeX - 3, abyssY - 3, 6, 6);
        } else {
            ctx.fillStyle = '#a1887f';
            ctx.fillRect(treeBridgeX - 2, abyssY + 1, 4, 3);
        }

        for (let i = 0; i < this.anomalies.length; i++) {
            const anom = this.anomalies[i];
            const ax = mapX + anom.x * scaleX;
            const ay = mapY + anom.y * scaleY;
            ctx.strokeStyle = anom.type === 'SPEED' ? 'rgba(0, 245, 255, 0.72)' : 'rgba(200, 80, 255, 0.72)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ax, ay, isMobile ? 3 : 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        // ĐÀI NĂNG LƯỢNG (SHRINES)
        for (let s = 0; s < this.shrines.length; s++) {
            const sh = this.shrines[s];
            const sx = mapX + sh.x * scaleX;
            const sy = mapY + sh.y * scaleY;

            ctx.fillStyle = sh.type === 'WAR' ? '#f59e0b' : '#00f5ff';
            ctx.beginPath();
            ctx.arc(sx, sy, isMobile ? 3.2 : 4.0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.0;
            ctx.stroke();
        }

        // KHE NỨT THỜI GIAN TRÊN RADAR
        for (let rf = 0; rf < this.timeRifts.length; rf++) {
            const rift = this.timeRifts[rf];
            const rx = mapX + rift.x * scaleX;
            const ry = mapY + rift.y * scaleY;

            ctx.fillStyle = rift.type === 'TIME_SLOW' ? '#38bdf8' : '#f43f5e';
            ctx.beginPath();
            ctx.arc(rx, ry, isMobile ? 2.8 : 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        const chestMX = mapX + (this.CHEST_TILE.x * this.tileSize + 32) * scaleX;
        const chestMY = mapY + (this.CHEST_TILE.y * this.tileSize + 32) * scaleY;
        ctx.fillStyle = state.chestOpened ? '#64748b' : state.chestOiled ? '#fde047' : '#f97316';
        ctx.fillRect(chestMX - 2.5, chestMY - 2.5, 5, 5);
        if (!state.chestOpened) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(chestMX - 2.5, chestMY - 2.5, 5, 5);
        }

        const unlockedList = state.unlockedWaypoints || [true, false, false];
        for (let i = 0; i < this.waypoints.length; i++) {
            const wp = this.waypoints[i];
            const wx = mapX + wp.x * scaleX;
            const wy = mapY + wp.y * scaleY;
            const isUnlocked = !!unlockedList[wp.index];

            ctx.fillStyle = isUnlocked ? '#00ffcc' : '#94a3b8';
            ctx.beginPath();
            ctx.moveTo(wx, wy - 3.5);
            ctx.lineTo(wx + 3.5, wy);
            ctx.lineTo(wx, wy + 3.5);
            ctx.lineTo(wx - 3.5, wy);
            ctx.closePath();
            ctx.fill();
        }

        // BIỂU TƯỢNG PHÂN HÓA QUÁI VẬT
        for (let i = 0; i < enemyList.length; i++) {
            const e = enemyList[i];
            if (!e || e.dead || e.isDead || (typeof e.hp === 'number' && e.hp <= 0)) continue;
            if (e.timeline && e.timeline !== 'ALL' && e.timeline !== timeline) continue;

            const ex = mapX + Math.max(4, Math.min(mapSize - 4, e.x * scaleX));
            const ey = mapY + Math.max(4, Math.min(mapSize - 4, e.y * scaleY));

            const isBoss = !!(e.isBoss || e.type === 'boss' || e.rank === 'BOSS' || (e.maxHp && e.maxHp >= 1000));
            const isMiniBoss = !!e.isMiniBoss;
            const isElite = !isBoss && !isMiniBoss && !!(e.isElite || e.type === 'ELITE' || e.rank === 'ELITE' || (e.maxHp && e.maxHp >= 260));

            if (isBoss) {
                const bossPulse = (isMobile ? 3.8 : 4.8) + Math.sin(now * 8) * 1.4;
                ctx.fillStyle = Math.floor(now * 6) % 2 === 0 ? '#ff1744' : '#d500f9';
                ctx.beginPath();
                ctx.arc(ex, ey, bossPulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.2;
                ctx.stroke();
            } else if (isMiniBoss) {
                ctx.save();
                ctx.translate(ex, ey);
                ctx.rotate(now * 2.5);

                const starSize = isMobile ? 4.5 : 5.8;
                ctx.fillStyle = '#c084fc';
                ctx.strokeStyle = '#fde047';
                ctx.lineWidth = 1.2;

                ctx.beginPath();
                ctx.moveTo(0, -starSize);
                ctx.lineTo(starSize * 0.35, -starSize * 0.35);
                ctx.lineTo(starSize, 0);
                ctx.lineTo(starSize * 0.35, starSize * 0.35);
                ctx.lineTo(0, starSize);
                ctx.lineTo(-starSize * 0.35, starSize * 0.35);
                ctx.lineTo(-starSize, 0);
                ctx.lineTo(-starSize * 0.35, -starSize * 0.35);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            } else if (e.isTanker || e.role === 'tanker' || e.subType === 'golem' || e.subType === 'shield_robot') {
                const sw = isMobile ? 3.2 : 4.0;
                const sh = isMobile ? 4.0 : 5.0;

                ctx.save();
                ctx.translate(ex, ey);
                ctx.fillStyle = '#ea580c';
                ctx.strokeStyle = '#fde047';
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.moveTo(-sw, -sh * 0.7);
                ctx.lineTo(sw, -sh * 0.7);
                ctx.lineTo(sw, 0);
                ctx.lineTo(0, sh);
                ctx.lineTo(-sw, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            } else if (e.isKiter || e.role === 'kiter' || e.subType === 'shaman' || e.subType === 'sniper_robot') {
                const arrowAngle = typeof e.facingAngle === 'number' ? e.facingAngle : 0;
                const arrowSize = isMobile ? 3.5 : 4.5;

                ctx.save();
                ctx.translate(ex, ey);
                ctx.rotate(arrowAngle);
                ctx.fillStyle = isElite ? '#facc15' : '#ef4444';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.8;

                ctx.beginPath();
                ctx.moveTo(arrowSize, 0);
                ctx.lineTo(-arrowSize * 0.8, -arrowSize * 0.7);
                ctx.lineTo(-arrowSize * 0.3, 0);
                ctx.lineTo(-arrowSize * 0.8, arrowSize * 0.7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            } else if (isElite) {
                ctx.fillStyle = '#ff9100';
                ctx.beginPath();
                ctx.arc(ex, ey, isMobile ? 2.8 : 3.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#ff3b30';
                ctx.beginPath();
                ctx.arc(ex, ey, isMobile ? 1.9 : 2.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Kim cương chỉ mục tiêu Nhiệm vụ
        if (player) {
            const target = this._getObjectiveTarget(player, state);
            if (target) {
                const tox = mapX + Math.max(5, Math.min(mapSize - 5, target.x * scaleX));
                const toy = mapY + Math.max(5, Math.min(mapSize - 5, target.y * scaleY));

                const tPulse = (isMobile ? 3.0 : 3.8) + Math.sin(now * 6) * 1.3;
                ctx.strokeStyle = target.color;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(tox, toy, tPulse + 2.2, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = target.color;
                ctx.beginPath();
                ctx.moveTo(tox, toy - tPulse);
                ctx.lineTo(tox + tPulse, toy);
                ctx.lineTo(tox, toy + tPulse);
                ctx.lineTo(tox - tPulse, toy);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Người chơi
        let playerTileX = 30;
        let playerTileY = 30;
        if (player) {
            playerTileX = Math.max(0, Math.min(this.cols - 1, Math.floor(player.x / this.tileSize)));
            playerTileY = Math.max(0, Math.min(this.rows - 1, Math.floor(player.y / this.tileSize)));

            const px = mapX + Math.max(4, Math.min(mapSize - 4, player.x * scaleX));
            const py = mapY + Math.max(4, Math.min(mapSize - 4, player.y * scaleY));

            let facingAngle = typeof player.angle === 'number' ? player.angle : 0;
            if (Math.hypot(player.vx || 0, player.vy || 0) > 5) {
                facingAngle = Math.atan2(player.vy, player.vx);
            }

            const coneLen = isMobile ? 16 : 22;
            const coneSpread = 0.48;
            const coneGrad = ctx.createRadialGradient(px, py, 1, px, py, coneLen);
            coneGrad.addColorStop(0, 'rgba(0, 245, 255, 0.50)');
            coneGrad.addColorStop(1, 'rgba(0, 245, 255, 0.0)');

            ctx.fillStyle = coneGrad;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.arc(px, py, coneLen, facingAngle - coneSpread, facingAngle + coneSpread);
            ctx.closePath();
            ctx.fill();

            const radarRing = 3 + ((now * 8) % 6);
            ctx.strokeStyle = `rgba(0, 245, 255, ${1 - (radarRing - 3) / 6})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, radarRing, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#00f5ff';
            ctx.shadowColor = '#00f5ff';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(px, py, isMobile ? 3.0 : 3.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Quét Radar Quân Sự
        const sweepAngle = (now * 1.65) % (Math.PI * 2);
        const sweepRadius = mapSize * 0.72;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(sweepAngle);

        const sectorGrad = ctx.createLinearGradient(0, 0, sweepRadius, 0);
        if (timeline === 'PAST') {
            sectorGrad.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
            sectorGrad.addColorStop(1, 'rgba(245, 158, 11, 0.02)');
        } else if (timeline === 'PRESENT') {
            sectorGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
            sectorGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
        } else {
            sectorGrad.addColorStop(0, 'rgba(0, 245, 255, 0.25)');
            sectorGrad.addColorStop(1, 'rgba(0, 245, 255, 0.02)');
        }

        ctx.fillStyle = sectorGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, sweepRadius, -0.38, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sweepRadius, 0);
        ctx.stroke();
        ctx.restore();

        // Thanh thông số
        const barH = isMobile ? 16 : 20;
        const barY = mapY + mapSize - barH;
        ctx.fillStyle = 'rgba(4, 8, 18, 0.82)';
        ctx.fillRect(mapX, barY, mapSize, barH);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mapX, barY);
        ctx.lineTo(mapX + mapSize, barY);
        ctx.stroke();

        const eraLabel =
            timeline === 'PAST'
                ? 'QUÁ KHỨ'
                : timeline === 'PRESENT'
                ? 'HIỆN TẠI'
                : 'TƯƠNG LAI';
        const coordLabel = `X:${playerTileX} Y:${playerTileY}`;

        ctx.font = isMobile ? 'bold 8px sans-serif' : 'bold 9.5px sans-serif';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = themeColor;
        ctx.textAlign = 'left';
        ctx.fillText(eraLabel, mapX + 5, barY + barH / 2 + 0.5);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(coordLabel, mapX + mapSize - 5, barY + barH / 2 + 0.5);

        ctx.restore();

        // Viền radar
        ctx.save();
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = isMobile ? 1.8 : 2.2;
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = isMobile ? 6 : 10;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(mapX, mapY, mapSize, mapSize, cornerRadius);
        } else {
            ctx.rect(mapX, mapY, mapSize, mapSize);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        const bracketLen = isMobile ? 8 : 11;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mapX, mapY + bracketLen);
        ctx.lineTo(mapX, mapY + 2);
        ctx.lineTo(mapX + bracketLen, mapY);
        ctx.moveTo(mapX + mapSize - bracketLen, mapY);
        ctx.lineTo(mapX + mapSize, mapY + 2);
        ctx.lineTo(mapX + mapSize, mapY + bracketLen);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    },

    _getActiveEnemiesList: function () {
        const g = window.Game || {};
        let list = [];

        if (g.Enemies) {
            if (Array.isArray(g.Enemies.list)) {
                list = list.concat(g.Enemies.list);
            } else if (Array.isArray(g.Enemies.enemies)) {
                list = list.concat(g.Enemies.enemies);
            } else if (Array.isArray(g.Enemies)) {
                list = list.concat(g.Enemies);
            }
            if (g.Enemies.boss && typeof g.Enemies.boss === 'object') {
                list.push(g.Enemies.boss);
            }
        }

        if (Array.isArray(g.enemies)) {
            list = list.concat(g.enemies);
        }

        if (g.boss && typeof g.boss === 'object') {
            list.push(g.boss);
        }

        return list;
    
},
// ========================================================================
    // TÍNH NĂNG 4: HỆ THỐNG TIỆN ÍCH KIỂM TRA VA CHẠM DỰA TRÊN SPATIAL GRID
    // ========================================================================

    /**
     * Kiểm tra va chạm tia/đoạn thẳng từ (x1, y1) đến (x2, y2) với các chướng ngại vật tĩnh
     * Trả về true nếu đường đi bị chặn bởi tường/đá
     */
    checkRaycastBlocked: function (x1, y1, x2, y2, stepSize = 16) {
        if (!this._initialized) this.init();

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return false;

        const steps = Math.ceil(dist / stepSize);
        const stepX = dx / steps;
        const stepY = dy / steps;

        for (let i = 1; i <= steps; i++) {
            const cx = x1 + stepX * i;
            const cy = y1 + stepY * i;
            const tx = Math.floor(cx / this.tileSize);
            const ty = Math.floor(cy / this.tileSize);

            if (!this._isTileWalkable(tx, ty)) {
                return true;
            }
        }
        return false;
    },

    /**
     * Quét nhanh các va chạm giữa đạn người chơi và quái vật thông qua Lưới Không Gian
     * Gọi trong Combat/Projectile update loop để loại bỏ O(N*M)
     */
    resolveProjectileCollisions: function (projectiles, onHitCallback) {
        if (!this.spatialGrid || !Array.isArray(projectiles)) return;

        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!p || p.dead) continue;

            const pRadius = p.radius || 6;
            // Chỉ truy vấn ô chứa viên đạn
            const neighbors = this.spatialGrid.queryRadius(p.x, p.y, pRadius + 20);

            for (let j = 0; j < neighbors.length; j++) {
                const neighbor = neighbors[j];

                // 1. Va chạm đạn với vật cản tĩnh
                if (neighbor.type === 'OBSTACLE') {
                    const distSq = (p.x - neighbor.x) ** 2 + (p.y - neighbor.y) ** 2;
                    const combinedR = pRadius + neighbor.radius;
                    if (distSq <= combinedR * combinedR) {
                        p.dead = true;
                        if (typeof onHitCallback === 'function') {
                            onHitCallback(p, neighbor, 'OBSTACLE');
                        }
                        break;
                    }
                }

                // 2. Va chạm đạn với Quái vật
                if (neighbor.type === 'ENEMY' && p.isPlayerBullet) {
                    const enemy = neighbor.raw;
                    if (!enemy || enemy.dead || enemy.isDead) continue;

                    const enemyR = neighbor.radius || 20;
                    const distSq = (p.x - neighbor.x) ** 2 + (p.y - neighbor.y) ** 2;
                    const combinedR = pRadius + enemyR;

                    if (distSq <= combinedR * combinedR) {
                        p.dead = true;
                        if (typeof onHitCallback === 'function') {
                            onHitCallback(p, enemy, 'ENEMY');
                        }
                        break;
                    }
                }

                // 3. Đạn bắn trúng Khe nứt/Trụ năng lượng thời gian để kích hoạt từ xa
                if (neighbor.type === 'TIME_RIFT') {
                    const rift = neighbor.raw;
                    const distSq = (p.x - rift.x) ** 2 + (p.y - rift.y) ** 2;
                    const combinedR = pRadius + 28;

                    if (distSq <= combinedR * combinedR) {
                        p.dead = true;
                        this.triggerTimeRift(rift.id);
                        if (typeof onHitCallback === 'function') {
                            onHitCallback(p, rift, 'TIME_RIFT');
                        }
                        break;
                    }
                }
            }
        }
    },

    /**
     * Kích hoạt đài tế thủ công từ phím bấm hoặc tương tác UI
     */
    activateShrine: function (shrineId) {
        const sh = this.shrines.find(s => s.id === shrineId);
        if (!sh || sh.currentCooldown > 0) return false;

        sh.stayTimer = sh.requiredTime;
        return true;
    },

    /**
     * Dọn dẹp bộ nhớ đệm canvas khi thoát game hoặc khởi động lại
     */
    destroy: function () {
        this._cachedBackgrounds.PAST = null;
        this._cachedBackgrounds.PRESENT = null;
        this._cachedBackgrounds.FUTURE = null;
        if (this.spatialGrid) {
            this.spatialGrid.clear();
        }
        this.traps = [];
        this.weatherParticles = [];
        this.grid = [];
        this.decorGrid = [];
        this._initialized = false;
    }
};