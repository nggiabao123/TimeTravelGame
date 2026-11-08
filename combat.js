/**
 * ============================================================================
 * TỰA GAME: KẺ DU HÀNH THỜI KHÔNG (TIME TRAVELER)
 * FILE: combat.js - BẢN NÂNG CẤP SIÊU HIỆU NĂNG CHO MOBILE & DESKTOP
 * ============================================================================
 * CÁC NÂNG CẤP LÕI ĐƯỢC TÍCH HỢP TOÀN DIỆN:
 * 1. Object Pooling tối đa:
 *    - Khởi tạo sẵn mảng cố định: 200 đạn/projectiles, 300 hạt particles, 40 nhát chém,
 *      50 floating text, 30 tia laser/sét, 25 sóng chấn động, 20 tàn dư thời không.
 *    - Quản lý trạng thái bằng cờ active = true/false; loại bỏ hoàn toàn việc tạo object
 *      mới liên tục trong vòng lặp game và tuyệt đối không dùng .splice() gây giật GC.
 * 2. Triệt tiêu ctx.shadowBlur:
 *    - Thay toàn bộ hiệu ứng phát sáng bằng kỹ thuật vẽ chồng nhiều lớp bán kính với
 *      ctx.globalAlpha hoặc tận dụng SpriteSheet với chế độ blend 'screen'.
 * 3. Làm tròn tọa độ vẽ:
 *    - Ép kiểu số nguyên bitwise (x | 0), (y | 0), (w | 0), (h | 0), (r | 0) cho mọi lệnh
 *      drawImage, arc, fillRect để GPU không phải khử răng cưa sub-pixel.
 * 4. Nâng cấp Gameplay:
 *    - Combo 3-hit cận chiến: Đòn 1 chém thuận, Đòn 2 đảo góc chém tốc độ, Đòn 3 Trọng kích
 *      kết liễu phóng Kiếm khí Bán nguyệt / Hố đen.
 *    - Tàn dư Thời Không: Khi Lướt chém (Dash) để lại bóng ma thời gian lặp lại đòn chém
 *      tại tọa độ đó sau đúng 1.5 giây.
 *    - Phản đòn (Parry / Bullet Deflect): Chém trúng đạn tầm xa của quái sẽ đảo ngược góc bay,
 *      tăng tốc đạn bay ngược lại kẻ địch và gây sát thương phản đòn.
 *    - Tương thích 100% cấu trúc 12 frame (4 cột x 3 hàng) của chem_2.jpg & luot_chem_2.jpg.
 * ============================================================================
 */

window.Game = window.Game || {};

window.Game.Combat = {
    // ------------------------------------------------------------------------
    // QUẢN LÝ SPRITE SHEET (12 frames: 4 cột x 3 hàng)
    // ------------------------------------------------------------------------
    spriteSheets: {
        slash: { img: null, loaded: false, cols: 4, rows: 3, sources: ['chem_2.jpg', 'chem.jpg'] },
        dashSlash: { img: null, loaded: false, cols: 4, rows: 3, sources: ['luot_chem_2.jpg', 'luot_chem.jpg'] }
    },
    _spritesInitialized: false,

    _initSpriteSheets: function () {
        if (this._spritesInitialized) return;
        this._spritesInitialized = true;

        const loadSheetWithFallback = (key) => {
            const cfg = this.spriteSheets[key];
            if (!cfg || !cfg.sources || cfg.sources.length === 0) return;

            let srcIndex = 0;
            const img = new Image();

            img.onload = () => {
                cfg.img = img;
                cfg.loaded = true;
            };

            img.onerror = () => {
                srcIndex++;
                if (srcIndex < cfg.sources.length) {
                    img.src = cfg.sources[srcIndex];
                }
            };

            img.src = cfg.sources[0];
        };

        loadSheetWithFallback('slash');
        loadSheetWithFallback('dashSlash');
    },

    // ------------------------------------------------------------------------
    // ĐỊNH NGHĨA KỸ NĂNG NHÂN VẬT & BẢNG VŨ KHÍ
    // ------------------------------------------------------------------------
    characterSkillsets: {
        time_traveler: [
            { id: 'attack', name: 'Trảm Thời Không', cd: 0, maxCd: 0.42, color: '#f39c12', type: 'WEAPON_DRIVEN' },
            { id: 'dash', name: 'Tốc Biến Thời Không', cd: 0, maxCd: 4.5, color: '#00f2fe', type: 'RECT_DASH', range: 240 },
            { id: 'storm', name: 'Vòng Xoáy Hỗn Độn', cd: 0, maxCd: 10.0, color: '#ff0844', type: 'AOE_SELF', aoeRadius: 250 },
            { id: 'freeze', name: 'Ngưng Đọng Thời Gian', cd: 0, maxCd: 20.0, color: '#a855f7', type: 'FULL_SCREEN' }
        ],
        shadow_assassin: [
            { id: 'attack', name: 'Chém Quang Ảnh', cd: 0, maxCd: 0.30, color: '#00f2fe', type: 'WEAPON_DRIVEN' },
            { id: 'blink', name: 'Bộ Pháp Vô Ảnh', cd: 0, maxCd: 3.5, color: '#ec4899', type: 'RECT_DASH', range: 280 },
            { id: 'shuriken', name: 'Phi Đao Ma Quái', cd: 0, maxCd: 7.0, color: '#f59e0b', type: 'SECTOR', range: 410, arc: Math.PI * 0.65 },
            { id: 'overdrive', name: 'Án Tử Hư Vô', cd: 0, maxCd: 18.0, color: '#f43f5e', type: 'FULL_SCREEN' }
        ],
        iron_juggernaut: [
            { id: 'attack', name: 'Búa Chấn Động', cd: 0, maxCd: 0.46, color: '#f59e0b', type: 'WEAPON_DRIVEN' },
            { id: 'warp', name: 'Khiên Đột Kích', cd: 0, maxCd: 5.0, color: '#eab308', type: 'RECT_DASH', range: 230 },
            { id: 'singularity', name: 'Địa Chấn Hủy Diệt', cd: 0, maxCd: 9.5, color: '#ea580c', type: 'AOE_SELF', aoeRadius: 260 },
            { id: 'abyss', name: 'Pháo Đài Bất Diệt', cd: 0, maxCd: 22.0, color: '#3b82f6', type: 'FULL_SCREEN' }
        ],
        chrono_traveler: [
            { id: 'attack', name: 'Đánh', cd: 0, maxCd: 0.42, color: '#f39c12', type: 'WEAPON_DRIVEN' },
            { id: 'dash', name: 'Lướt Chém', cd: 0, maxCd: 4.5, color: '#00f2fe', type: 'RECT_DASH', range: 240 },
            { id: 'storm', name: 'Siêu Bão', cd: 0, maxCd: 10.0, color: '#ff0844', type: 'AOE_SELF', aoeRadius: 250 },
            { id: 'freeze', name: 'Ngưng Đọng', cd: 0, maxCd: 20.0, color: '#a855f7', type: 'FULL_SCREEN' }
        ],
        cyber_ninja: [
            { id: 'attack', name: 'Chém Quang', cd: 0, maxCd: 0.30, color: '#00f2fe', type: 'WEAPON_DRIVEN' },
            { id: 'blink', name: 'Ảnh Bước', cd: 0, maxCd: 3.5, color: '#ec4899', type: 'RECT_DASH', range: 280 },
            { id: 'shuriken', name: 'Phi Tiêu', cd: 0, maxCd: 7.0, color: '#f59e0b', type: 'SECTOR', range: 410, arc: Math.PI * 0.65 },
            { id: 'overdrive', name: 'Quá Tải', cd: 0, maxCd: 18.0, color: '#f43f5e', type: 'FULL_SCREEN' }
        ],
        void_mage: [
            { id: 'attack', name: 'Búa Chấn Động', cd: 0, maxCd: 0.46, color: '#f59e0b', type: 'WEAPON_DRIVEN' },
            { id: 'warp', name: 'Khiên Đột Kích', cd: 0, maxCd: 5.0, color: '#eab308', type: 'RECT_DASH', range: 230 },
            { id: 'singularity', name: 'Địa Chấn', cd: 0, maxCd: 9.5, color: '#ea580c', type: 'AOE_SELF', aoeRadius: 260 },
            { id: 'abyss', name: 'Pháo Đài', cd: 0, maxCd: 22.0, color: '#3b82f6', type: 'FULL_SCREEN' }
        ]
    },

    skills: [
        { id: 'attack', name: 'Đánh', cd: 0, maxCd: 0.42, color: '#f39c12' },
        { id: 'dash', name: 'Lướt Chém', cd: 0, maxCd: 4.5, color: '#00f2fe' },
        { id: 'storm', name: 'Siêu Bão', cd: 0, maxCd: 10.0, color: '#ff0844' },
        { id: 'freeze', name: 'Ngưng Đọng', cd: 0, maxCd: 20.0, color: '#a855f7' }
    ],

    weapons: {
        iron_sword: { name: 'Kiếm Sắt', damage: 25, range: 95, arc: Math.PI * 0.75, color: '#f8fafc', glow: '#f39c12', type: 'melee' },
        cyber_sword: { name: 'Kiếm Điện Tử', damage: 80, range: 135, arc: Math.PI * 1.15, color: '#00f2fe', glow: '#06b6d4', type: 'cyber_melee' },
        laser_gun: { name: 'Súng Laser', damage: 88, range: 410, beamWidth: 16, color: '#ff0844', glow: '#fb7185', type: 'laser' },
        void_scythe: { name: 'Lưỡi Hái Hư Không', damage: 210, range: 165, arc: Math.PI * 2, color: '#a855f7', glow: '#6b21a8', type: 'scythe', lifesteal: 0.04 },
        chrono_cannon: { name: 'Pháo Năng Lượng Thời Không', damage: 185, range: 430, aoeRadius: 92, speed: 580, color: '#00f2fe', glow: '#fbbf24', type: 'cannon' }
    },

    // ------------------------------------------------------------------------
    // CÁC MẢNG OBJECT POOL ĐƯỢC CẤP PHÁT TĨNH (ZERO GARBAGE COLLECTION)
    // ------------------------------------------------------------------------
    bullets: [],            // Pool 200 đạn (Pháo, phi tiêu, kiếm khí, đạn phản đòn)
    particles: [],          // Pool 300 hạt hiệu ứng
    slashes: [],            // Pool 40 nhát chém (SpriteSheet / Arc)
    floatingTexts: [],      // Pool 50 chữ số bay
    laserBeams: [],         // Pool 30 tia laser / tia sét
    shockwaves: [],         // Pool 25 vòng sóng chấn động
    afterimages: [],        // Pool 30 bóng mờ nhân vật
    crossFlashes: [],       // Pool 20 tia chớp chữ X chí mạng
    spacetimeEchoes: [],    // Pool 20 tàn dư thời không (lặp lại chém sau 1.5s)
    magmaZones: [],         // Pool 10 vùng dung nham địa chấn
    blackHoles: [],         // Pool 8 hố đen hư không
    bleedEffects: [],       // Pool 30 hiệu ứng chảy máu

    dashState: null,
    weaponHeat: 0,
    maxWeaponHeat: 100,
    overdriveTimer: 0,
    fortressTimer: 0,
    fortressPulseTimer: 0,
    terrainCdrMultiplier: 1.0,

    comboStep: 0,
    comboResetTimer: 0,
    comboHits: 0,
    comboTimer: 0,
    comboMaxTimer: 3.5,
    _lastLeechTime: 0,

    killStreakCount: 0,
    killStreakTimer: 0,
    killStreakBanner: null,
    speedBuffTimer: 0,
    _appliedSpeedBonus: 0,
    cdHasteTimer: 0,

    _poolsInitialized: false,

    _initObjectPools: function () {
        if (this._poolsInitialized) return;
        this._poolsInitialized = true;

        // 1. Khởi tạo 200 Projectiles / Bullets
        this.bullets = new Array(200);
        for (let i = 0; i < 200; i++) {
            this.bullets[i] = {
                active: false,
                subType: '', // 'cannon', 'crescent', 'shuriken', 'deflected'
                x: 0, y: 0, vx: 0, vy: 0,
                targetX: 0, targetY: 0,
                angle: 0, speed: 0, radius: 0, aoeRadius: 0,
                damage: 0, bleedDamage: 0,
                traveled: 0, maxDistance: 0,
                color: '#ffffff', glow: '#ffffff',
                weaponKey: 'iron_sword',
                isThirdHit: false, isAscendedFinisher: false,
                returning: false, returnSpeed: 820,
                rotation: 0,
                hitIds: new Set(), returnHitIds: new Set(),
                life: 0, maxLife: 0
            };
        }

        // 2. Khởi tạo 300 Particles
        this.particles = new Array(300);
        for (let i = 0; i < 300; i++) {
            this.particles[i] = {
                active: false,
                x: 0, y: 0, vx: 0, vy: 0,
                size: 2, color: '#ffffff',
                life: 0, maxLife: 1
            };
        }

        // 3. Khởi tạo 40 Slashes
        this.slashes = new Array(40);
        for (let i = 0; i < 40; i++) {
            this.slashes[i] = {
                active: false,
                x: 0, y: 0, angle: 0, radius: 0, arc: 0,
                color: '#ffffff', glow: '#ffffff',
                isCyber: false, isScythe: false, isAscendedFinisher: false,
                isDashSprite: false, comboStep: 0, swingDir: 1,
                life: 0, maxLife: 0.3
            };
        }

        // 4. Khởi tạo 50 Floating Texts
        this.floatingTexts = new Array(50);
        for (let i = 0; i < 50; i++) {
            this.floatingTexts[i] = {
                active: false,
                x: 0, y: 0, vx: 0, vy: 0,
                text: '', color: '#ffffff', isCrit: false,
                life: 0, maxLife: 1
            };
        }

        // 5. Khởi tạo 30 Laser Beams & Lightning
        this.laserBeams = new Array(30);
        for (let i = 0; i < 30; i++) {
            this.laserBeams[i] = {
                active: false,
                x1: 0, y1: 0, x2: 0, y2: 0,
                color: '#ffffff', coreColor: '#ffffff',
                width: 4, isLightning: false,
                life: 0, maxLife: 0.25
            };
        }

        // 6. Khởi tạo 25 Shockwaves
        this.shockwaves = new Array(25);
        for (let i = 0; i < 25; i++) {
            this.shockwaves[i] = {
                active: false,
                x: 0, y: 0, radius: 0, maxRadius: 100,
                color: '#ffffff', life: 0, maxLife: 0.35
            };
        }

        // 7. Khởi tạo 30 Afterimages
        this.afterimages = new Array(30);
        for (let i = 0; i < 30; i++) {
            this.afterimages[i] = {
                active: false,
                x: 0, y: 0, angle: 0, radius: 20,
                color: '#00f2fe', weapon: 'iron_sword',
                life: 0, maxLife: 0.38
            };
        }

        // 8. Khởi tạo 20 Cross Flashes (Tia chớp chữ X khi chí mạng)
        this.crossFlashes = new Array(20);
        for (let i = 0; i < 20; i++) {
            this.crossFlashes[i] = {
                active: false,
                x: 0, y: 0, size: 20, color: '#fde047',
                life: 0, maxLife: 0.22
            };
        }

        // 9. Khởi tạo 20 Tàn dư Thời Không (Spacetime Echoes)
        this.spacetimeEchoes = new Array(20);
        for (let i = 0; i < 20; i++) {
            this.spacetimeEchoes[i] = {
                active: false,
                x: 0, y: 0, angle: 0,
                delay: 1.5, radius: 140, damage: 0,
                color: '#00f2fe', weaponKey: 'iron_sword',
                triggered: false, life: 1.85, maxLife: 1.85
            };
        }

        // 10. Khởi tạo 10 Vùng Dung Nham (Magma Zones)
        this.magmaZones = new Array(10);
        for (let i = 0; i < 10; i++) {
            this.magmaZones[i] = {
                active: false,
                x: 0, y: 0, radius: 260,
                life: 0, maxLife: 4.0,
                tickTimer: 0.45, tickDamage: 0,
                weaponKey: 'iron_sword'
            };
        }

        // 11. Khởi tạo 8 Hố Đen (Black Holes)
        this.blackHoles = new Array(8);
        for (let i = 0; i < 8; i++) {
            this.blackHoles[i] = {
                active: false,
                x: 0, y: 0, radius: 190,
                pullSpeed: 185, life: 0, maxLife: 1.25,
                tickTimer: 0.22, damage: 0,
                color: '#a855f7', glow: '#6b21a8',
                isAscendedFinisher: false
            };
        }

        // 12. Khởi tạo 30 Bleed Effects
        this.bleedEffects = new Array(30);
        for (let i = 0; i < 30; i++) {
            this.bleedEffects[i] = {
                active: false,
                enemy: null,
                ticksLeft: 0,
                tickTimer: 0.45,
                damage: 0,
                weaponKey: 'iron_sword'
            };
        }
    },

    init: function () {
        this._initSpriteSheets();
        this._initObjectPools();

        // Đặt lại toàn bộ cờ active của pools
        for (let i = 0; i < this.bullets.length; i++) this.bullets[i].active = false;
        for (let i = 0; i < this.particles.length; i++) this.particles[i].active = false;
        for (let i = 0; i < this.slashes.length; i++) this.slashes[i].active = false;
        for (let i = 0; i < this.floatingTexts.length; i++) this.floatingTexts[i].active = false;
        for (let i = 0; i < this.laserBeams.length; i++) this.laserBeams[i].active = false;
        for (let i = 0; i < this.shockwaves.length; i++) this.shockwaves[i].active = false;
        for (let i = 0; i < this.afterimages.length; i++) this.afterimages[i].active = false;
        for (let i = 0; i < this.crossFlashes.length; i++) this.crossFlashes[i].active = false;
        for (let i = 0; i < this.spacetimeEchoes.length; i++) this.spacetimeEchoes[i].active = false;
        for (let i = 0; i < this.magmaZones.length; i++) this.magmaZones[i].active = false;
        for (let i = 0; i < this.blackHoles.length; i++) this.blackHoles[i].active = false;
        for (let i = 0; i < this.bleedEffects.length; i++) this.bleedEffects[i].active = false;

        this.dashState = null;
        if (window.Game.player) {
            window.Game.player.dashTime = 0;
        }

        this.weaponHeat = 0;
        this.overdriveTimer = 0;
        this.fortressTimer = 0;
        this.fortressPulseTimer = 0;
        this.terrainCdrMultiplier = 1.0;

        this.comboStep = 0;
        this.comboResetTimer = 0;
        this.comboHits = 0;
        this.comboTimer = 0;
        this._lastLeechTime = 0;
        this.killStreakCount = 0;
        this.killStreakTimer = 0;
        this.killStreakBanner = null;
        this._clearSpeedBuff();
        this.cdHasteTimer = 0;

        const activeSkills = this.getActiveSkills();
        for (let i = 0; i < activeSkills.length; i++) {
            activeSkills[i].cd = 0;
        }
    },

    // ------------------------------------------------------------------------
    // CÁC HÀM CẤP PHÁT ĐỐI TƯỢNG TỪ POOL (TÁI SỬ DỤNG - ZERO ALLOCATION)
    // ------------------------------------------------------------------------
    _getFreeBullet: function () {
        for (let i = 0; i < this.bullets.length; i++) {
            if (!this.bullets[i].active) {
                const b = this.bullets[i];
                b.active = true;
                b.hitIds.clear();
                b.returnHitIds.clear();
                return b;
            }
        }
        return null;
    },

    _getFreeSlash: function () {
        for (let i = 0; i < this.slashes.length; i++) {
            if (!this.slashes[i].active) {
                this.slashes[i].active = true;
                return this.slashes[i];
            }
        }
        return null;
    },

    _getFreeLaserBeam: function () {
        for (let i = 0; i < this.laserBeams.length; i++) {
            if (!this.laserBeams[i].active) {
                this.laserBeams[i].active = true;
                return this.laserBeams[i];
            }
        }
        return null;
    },

    _getFreeShockwave: function () {
        for (let i = 0; i < this.shockwaves.length; i++) {
            if (!this.shockwaves[i].active) {
                this.shockwaves[i].active = true;
                return this.shockwaves[i];
            }
        }
        return null;
    },

    _getFreeAfterimage: function () {
        for (let i = 0; i < this.afterimages.length; i++) {
            if (!this.afterimages[i].active) {
                this.afterimages[i].active = true;
                return this.afterimages[i];
            }
        }
        return null;
    },

    _getFreeCrossFlash: function () {
        for (let i = 0; i < this.crossFlashes.length; i++) {
            if (!this.crossFlashes[i].active) {
                this.crossFlashes[i].active = true;
                return this.crossFlashes[i];
            }
        }
        return null;
    },

    _getFreeSpacetimeEcho: function () {
        for (let i = 0; i < this.spacetimeEchoes.length; i++) {
            if (!this.spacetimeEchoes[i].active) {
                this.spacetimeEchoes[i].active = true;
                return this.spacetimeEchoes[i];
            }
        }
        return null;
    },

    _getFreeMagmaZone: function () {
        for (let i = 0; i < this.magmaZones.length; i++) {
            if (!this.magmaZones[i].active) {
                this.magmaZones[i].active = true;
                return this.magmaZones[i];
            }
        }
        return null;
    },

    _getFreeBlackHole: function () {
        for (let i = 0; i < this.blackHoles.length; i++) {
            if (!this.blackHoles[i].active) {
                this.blackHoles[i].active = true;
                return this.blackHoles[i];
            }
        }
        return null;
    },

    _getFreeBleedEffect: function () {
        for (let i = 0; i < this.bleedEffects.length; i++) {
            if (!this.bleedEffects[i].active) {
                this.bleedEffects[i].active = true;
                return this.bleedEffects[i];
            }
        }
        return null;
    },

    spawnFloatingText: function (x, y, text, color, isCrit) {
        let ft = null;
        for (let i = 0; i < this.floatingTexts.length; i++) {
            if (!this.floatingTexts[i].active) {
                ft = this.floatingTexts[i];
                break;
            }
        }
        if (!ft) return;

        const offsetX = (Math.random() - 0.5) * 24;
        ft.active = true;
        ft.x = x + offsetX;
        ft.y = y;
        ft.vx = offsetX * 0.85;
        ft.vy = isCrit ? -85 : -65;
        ft.text = String(text);
        ft.color = color || '#ffffff';
        ft.isCrit = Boolean(isCrit);
        ft.life = isCrit ? 1.15 : 0.95;
        ft.maxLife = ft.life;
    },

    _spawnParticles: function (x, y, color, count, maxSpeed) {
        const speed = maxSpeed || 120;
        let spawned = 0;

        for (let i = 0; i < this.particles.length && spawned < count; i++) {
            if (!this.particles[i].active) {
                const p = this.particles[i];
                const angle = Math.random() * Math.PI * 2;
                const spd = (0.25 + Math.random() * 0.75) * speed;
                const life = 0.25 + Math.random() * 0.35;

                p.active = true;
                p.x = x;
                p.y = y;
                p.vx = Math.cos(angle) * spd;
                p.vy = Math.sin(angle) * spd;
                p.size = 2.5 + Math.random() * 3.5;
                p.color = color || '#ffffff';
                p.life = life;
                p.maxLife = life;
                spawned++;
            }
        }
    },

    activateCooldownHaste: function (duration) {
        this.cdHasteTimer = Math.max(this.cdHasteTimer || 0, duration || 3.0);
    },

    _getCurrentCharacterId: function () {
        const state = window.Game.state;
        if (state) {
            if (state.selectedCharacter) return state.selectedCharacter;
            if (state.selectedCharacterData && state.selectedCharacterData.id) return state.selectedCharacterData.id;
            if (state.currentCharacter) return state.currentCharacter;
        }
        if (window.Game.player && window.Game.player.characterId) {
            return window.Game.player.characterId;
        }
        return 'time_traveler';
    },

    getActiveSkills: function () {
        const charId = this._getCurrentCharacterId();
        const set = this.characterSkillsets[charId] || this.characterSkillsets.time_traveler;
        this.skills = set;
        return set;
    },

    getSkillAimConfig: function (skillIndex) {
        const weaponKey = (window.Game.state && window.Game.state.currentWeapon) || 'iron_sword';
        const weapon = this.weapons[weaponKey] || this.weapons.iron_sword;
        const skills = this.getActiveSkills();
        const skill = skills[skillIndex];

        if (skillIndex === 0) {
            if (weaponKey === 'laser_gun') {
                return { type: 'LASER', range: weapon.range, beamWidth: weapon.beamWidth, color: weapon.color, glow: weapon.glow };
            }
            if (weaponKey === 'chrono_cannon') {
                return { type: 'CANNON_AOE', range: weapon.range, aoeRadius: weapon.aoeRadius, color: weapon.color, glow: weapon.glow };
            }
            return { type: 'SECTOR', range: weapon.range, arc: weapon.arc, color: weapon.color, glow: weapon.glow };
        }

        if (skill) {
            if (skill.type === 'RECT_DASH') {
                return { type: 'LINE', range: skill.range || 240, color: skill.color, glow: '#ffffff' };
            }
            if (skill.type === 'SECTOR') {
                return { type: 'SECTOR', range: skill.range || 410, arc: skill.arc || Math.PI * 0.65, color: skill.color, glow: '#ffffff' };
            }
            if (skill.type === 'CANNON_AOE') {
                return { type: 'CANNON_AOE', range: skill.range || 480, aoeRadius: skill.aoeRadius || 140, color: skill.color, glow: '#ffffff' };
            }
            if (skill.type === 'AOE_SELF') {
                return { type: 'CANNON_AOE', range: 0, aoeRadius: skill.aoeRadius || 250, color: skill.color, glow: '#ffffff' };
            }
        }

        return { type: 'LINE', range: 350, color: (skill && skill.color) || '#38bdf8' };
    },

    _getCurrentWeaponConfig: function () {
        const key = (window.Game.state && window.Game.state.currentWeapon) || 'iron_sword';
        return this.weapons[key] || this.weapons.iron_sword;
    },

    _getWeaponLevel: function (weaponKey) {
        if (window.Game.state && window.Game.state.weaponLevels) {
            return window.Game.state.weaponLevels[weaponKey] || 0;
        }
        return 0;
    },

    _calculateBaseDamage: function (weaponKey, weapon) {
        const player = window.Game.player;
        const bonus = (player && player.baseDamageBonus) ? player.baseDamageBonus : 0;
        const level = this._getWeaponLevel(weaponKey);
        const fortressBonus = this.fortressTimer > 0 ? 1.25 : 1.0;
        const overdriveBonus = this.overdriveTimer > 0 ? 1.20 : 1.0;
        return (weapon.damage + bonus) * (1 + level * 0.12) * fortressBonus * overdriveBonus;
    },

    _getEnhancedColors: function (weaponKey, weapon) {
        const level = this._getWeaponLevel(weaponKey);

        if (level >= 30) {
            const now = performance.now() * 0.004;
            const hue1 = Math.floor((now * 90) % 360);
            return {
                color: `hsl(${hue1}, 100%, 62%)`,
                glow: `hsl(${(hue1 + 120) % 360}, 100%, 55%)`,
                particle: `hsl(${(hue1 + 240) % 360}, 100%, 70%)`,
                isAscended: true,
                tier: 'VOID_RAINBOW'
            };
        } else if (level >= 15) {
            return { color: '#ff0844', glow: '#7f1d1d', particle: '#fda4af', isAscended: true, tier: 'CRIMSON_SPACE' };
        } else if (level >= 10) {
            return { color: '#e879f9', glow: '#00f2fe', particle: '#fde047', isAscended: true, tier: 'ASCENDED_10' };
        } else if (level >= 8) {
            return { color: '#d946ef', glow: '#f59e0b', particle: '#fde047', isAscended: true, tier: 'MYTHIC' };
        } else if (level >= 5) {
            return { color: '#fbbf24', glow: '#a855f7', particle: '#f59e0b', isAscended: true, tier: 'GOLDEN' };
        }

        return { color: weapon.color, glow: weapon.glow, particle: weapon.color, isAscended: false, tier: 'NORMAL' };
    },

    // ------------------------------------------------------------------------
    // 1. SMART CONE AUTO-AIM (KHÓA MỤC TIÊU HÌNH NÓN HẸP PHÍA TRƯỚC)
    // ------------------------------------------------------------------------
    _applyMicroAutoAim: function (player, maxRange, fullCircleSearch, weaponKey) {
        const currentFacingAngle = player.angle || 0;
        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        const isGun = weaponKey === 'laser_gun' || weaponKey === 'chrono_cannon';
        const isMelee = weaponKey === 'iron_sword' || weaponKey === 'cyber_sword' || weaponKey === 'void_scythe';

        let searchRadius = 200;
        let maxAllowedAngle = (30 * Math.PI) / 180;

        if (isGun) {
            searchRadius = Math.min(230, maxRange || 230);
            maxAllowedAngle = (15 * Math.PI) / 180; // Súng: Nón hẹp ±15 độ
        } else if (isMelee) {
            searchRadius = Math.min(165, maxRange || 165);
            maxAllowedAngle = (38 * Math.PI) / 180; // Cận chiến: Nón ±38 độ
        } else {
            searchRadius = Math.min(220, maxRange || 220);
            maxAllowedAngle = (25 * Math.PI) / 180;
        }

        let bestTarget = null;
        let bestScore = -Infinity;

        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;

            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > searchRadius + (enemy.radius || 20)) continue;

            const angleToEnemy = Math.atan2(dy, dx);
            const diffAngle = Math.abs(this._normalizeAngle(angleToEnemy - currentFacingAngle));

            if (diffAngle > maxAllowedAngle) continue;

            const hpRatio = Math.max(0.01, enemy.hp / Math.max(1, enemy.maxHp));
            let score = (searchRadius - dist) * 2.5 - diffAngle * 80;

            if (enemy.isBoss) score += 500;
            else if (enemy.isElite) score += 280;
            if (hpRatio <= 0.3) score += 250;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = enemy;
            }
        }

        if (bestTarget) {
            player.angle = Math.atan2(bestTarget.y - player.y, bestTarget.x - player.x);
            return player.angle;
        }

        return currentFacingAngle;
    },

    // ------------------------------------------------------------------------
    // 3. ĐẠI TU CẬN CHIẾN: CHÉM TAN & PHẢN ĐÒN ĐẠN QUÁI (PARRY / BULLET DEFLECT)
    // Đạn quái trúng nhát chém sẽ bị đảo hướng bay ngược lại phản sát thương!
    // ------------------------------------------------------------------------
    _checkMeleeBulletDeflect: function (player, slashAngle, slashRadius, slashArc, isThirdHit, weaponKey) {
        const enemiesModule = window.Game.Enemies;
        if (!enemiesModule || !Array.isArray(enemiesModule.projectiles) || enemiesModule.projectiles.length === 0) return;

        const projectiles = enemiesModule.projectiles;
        const currentTimeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
        const baseDmg = this._calculateBaseDamage(weaponKey, this._getCurrentWeaponConfig());
        let deflectedCount = 0;

        for (let i = 0; i < projectiles.length; i++) {
            const proj = projectiles[i];
            if (!proj || proj.dead || proj.hp <= 0) continue;
            if (proj.timeline !== 'ALL' && proj.timeline !== currentTimeline) continue;

            const dx = proj.x - player.x;
            const dy = proj.y - player.y;
            const dist = Math.hypot(dx, dy);

            if (dist <= slashRadius + (proj.radius || 8)) {
                const angleToProj = Math.atan2(dy, dx);
                const diffAngle = Math.abs(this._normalizeAngle(angleToProj - slashAngle));

                if (diffAngle <= slashArc * 0.55 || dist <= (player.radius || 20) + (proj.radius || 8) + 18) {
                    const px = proj.x;
                    const py = proj.y;
                    deflectedCount++;

                    const state = window.Game.state || {};

                    if (isThirdHit || weaponKey === 'cyber_sword') {
                        // ĐÒN 3 HOẶC CYBER SWORD: PHẢN ĐẠN BAY NGƯỢC LẠI KẺ ĐỊCH GÂY 180% SÁT THƯƠNG
                        state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 6);
                        this.spawnFloatingText(px, py - 20, '⚔️ PHẢN ĐẠN!', '#00f2fe', true);
                        this._spawnParticles(px, py, '#00f2fe', 14, 210);
                        this._spawnParticles(px, py, '#fde047', 10, 180);

                        // Tìm kẻ địch gần nhất để phản đòn
                        let nearestEnemy = null;
                        let minDist = 480;
                        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
                            ? window.Game.Enemies.getActiveList()
                            : [];

                        for (let eIdx = 0; eIdx < activeEnemies.length; eIdx++) {
                            const enemy = activeEnemies[eIdx];
                            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                            const d = Math.hypot(enemy.x - px, enemy.y - py);
                            if (d < minDist) {
                                minDist = d;
                                nearestEnemy = enemy;
                            }
                        }

                        const targetAngle = nearestEnemy
                            ? Math.atan2(nearestEnemy.y - py, nearestEnemy.x - px)
                            : (slashAngle + (Math.random() - 0.5) * 0.2);

                        // Đưa đạn phản xạ vào Bullet Pool của người chơi
                        const defBullet = this._getFreeBullet();
                        if (defBullet) {
                            defBullet.subType = 'deflected';
                            defBullet.x = px;
                            defBullet.y = py;
                            defBullet.vx = Math.cos(targetAngle) * 650;
                            defBullet.vy = Math.sin(targetAngle) * 650;
                            defBullet.speed = 650;
                            defBullet.radius = 10;
                            defBullet.traveled = 0;
                            defBullet.maxDistance = 460;
                            defBullet.damage = Math.round(baseDmg * 1.80);
                            defBullet.color = '#00f2fe';
                            defBullet.glow = '#ffffff';
                            defBullet.weaponKey = weaponKey;
                        }

                        // Tia sét năng lượng kết nối đạn phản đòn
                        const beam = this._getFreeLaserBeam();
                        if (beam) {
                            beam.x1 = px;
                            beam.y1 = py;
                            beam.x2 = px + Math.cos(targetAngle) * 80;
                            beam.y2 = py + Math.sin(targetAngle) * 80;
                            beam.color = '#00f2fe';
                            beam.coreColor = '#ffffff';
                            beam.width = 8;
                            beam.isLightning = true;
                            beam.life = 0.22;
                            beam.maxLife = 0.22;
                        }

                        // Vô hiệu hóa đạn quái mà không dùng splice
                        proj.dead = true;
                        proj.hp = 0;
                        if (typeof proj.destroy === 'function') proj.destroy();
                    } else {
                        // ĐÒN 1 & 2: CHÉM VỠ ĐẠN, HỒI +3 NỘ & LÀM ĐẠN LỆCH HƯỚNG BAY NGƯỢC
                        state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 3);
                        this._spawnParticles(px, py, '#fde047', 9, 160);
                        this._spawnParticles(px, py, '#ffffff', 6, 130);
                        this.spawnFloatingText(px, py - 18, '+3 Nộ (Phá Đạn)', '#fde047');

                        // Đảo ngược vận tốc đạn quái và vô hiệu hóa sát thương đối với người chơi
                        if (typeof proj.vx === 'number' && typeof proj.vy === 'number') {
                            proj.vx = -proj.vx * 1.25;
                            proj.vy = -proj.vy * 1.25;
                            proj.friendly = true;
                            proj.timeline = 'NONE'; // Ngăn gây hại lên người chơi
                        } else {
                            proj.dead = true;
                            proj.hp = 0;
                        }
                    }
                }
            }
        }

        if (deflectedCount > 0 && window.Game.Audio && typeof window.Game.Audio.playSlash === 'function') {
            window.Game.Audio.playSlash();
        }
    },

    _spawnSpaceLightningBurst: function (x, y, primaryColor, boltsCount, radius) {
        const count = boltsCount || 5;
        const maxR = radius || 135;

        for (let i = 0; i < count; i++) {
            const angle = (i * Math.PI * 2) / count + (Math.random() - 0.5) * 0.45;
            const dist = maxR * (0.7 + Math.random() * 0.35);
            const beam = this._getFreeLaserBeam();
            if (beam) {
                beam.x1 = x;
                beam.y1 = y;
                beam.x2 = x + Math.cos(angle) * dist;
                beam.y2 = y + Math.sin(angle) * dist;
                beam.color = primaryColor || '#00f2fe';
                beam.coreColor = '#fde047';
                beam.width = 7;
                beam.isLightning = true;
                beam.life = 0.28;
                beam.maxLife = 0.28;
            }
        }
        this._spawnParticles(x, y, '#00f2fe', 10, 195);
        this._spawnParticles(x, y, '#fde047', 8, 165);
    },

    registerEnemyKill: function (enemy) {
        const player = window.Game.player;
        this.killStreakCount = (this.killStreakTimer > 0) ? (this.killStreakCount + 1) : 1;
        this.killStreakTimer = 4.0;

        if (this.killStreakCount >= 2) {
            this._applySpeedBuff(3.0);

            let title = 'DOUBLE KILL!';
            let subText = '⚡ +15% TỐC CHẠY (3s)';
            let bannerColor = '#38bdf8';
            let glowColor = '#0284c7';

            if (this.killStreakCount === 3) {
                title = 'TRIPLE KILL!';
                bannerColor = '#facc15';
                glowColor = '#ca8a04';
            } else if (this.killStreakCount === 4) {
                title = 'ULTRA KILL!';
                bannerColor = '#ff0844';
                glowColor = '#be123c';
            } else if (this.killStreakCount >= 5) {
                title = 'HUYỀN THOẠI THỜI KHÔNG!';
                subText = `🔥 CHUỖI ${this.killStreakCount} HẠ GỤC (+15% TỐC CHẠY)`;
                bannerColor = '#e879f9';
                glowColor = '#9333ea';
            }

            this.killStreakBanner = {
                title, subText, color: bannerColor, glow: glowColor, life: 2.6, maxLife: 2.6, scale: 1.35
            };

            if (player) {
                this._spawnParticles(player.x, player.y, bannerColor, 12, 160);
            }
        }
    },

    _applySpeedBuff: function (duration) {
        const player = window.Game.player;
        this.speedBuffTimer = Math.max(this.speedBuffTimer || 0, duration || 3.0);
        if (player && this._appliedSpeedBonus === 0) {
            const baseSpd = player.baseSpeed || player.speed || 240;
            this._appliedSpeedBonus = Math.round(baseSpd * 0.15);
            if (typeof player.speed === 'number') {
                player.speed += this._appliedSpeedBonus;
            }
        }
    },

    _clearSpeedBuff: function () {
        const player = window.Game.player;
        if (player && this._appliedSpeedBonus > 0 && typeof player.speed === 'number') {
            player.speed = Math.max(100, player.speed - this._appliedSpeedBonus);
        }
        this._appliedSpeedBonus = 0;
        this.speedBuffTimer = 0;
    },

    useSkill: function (skillIndex, options) {
        if (window.Game.state && window.Game.state.isPaused) return;
        this._initSpriteSheets();
        this._initObjectPools();

        const skills = this.getActiveSkills();
        const skill = skills[skillIndex];
        if (!skill) return;

        const player = window.Game.player;
        if (!player || player.hp <= 0) return;

        const state = window.Game.state || {};
        const opts = options || {};

        if (state.adminNoCd === true) {
            for (let i = 0; i < skills.length; i++) skills[i].cd = 0;
        }

        if (skillIndex === 3) {
            const currentRage = state.rage || 0;
            if (currentRage < 100 && skill.cd > 0 && !state.adminNoCd) return;
            if (currentRage < 100 && skill.cd <= 0 && !state.adminNoCd) {
                this.spawnFloatingText(player.x, player.y - 35, 'Cần 100 Nộ!', '#c084fc');
                return;
            }
        } else {
            if (skill.cd > 0) return;
        }

        const weaponKey = state.currentWeapon || 'iron_sword';
        const weapon = this._getCurrentWeaponConfig();
        const aimCfg = this.getSkillAimConfig(skillIndex);
        const effectiveSearchRange = (aimCfg && aimCfg.range) || (weapon && weapon.range) || 240;

        let fireAngle = player.angle || 0;
        if (opts.manualAim && typeof opts.aimAngle === 'number') {
            fireAngle = opts.aimAngle;
            player.angle = fireAngle;
        } else {
            fireAngle = this._applyMicroAutoAim(player, effectiveSearchRange, false, weaponKey);
        }

        const overdriveCdMult = (this.overdriveTimer > 0 && skillIndex === 0) ? 0.6 : 1.0;
        const comboAtkSpeedMult = (this.comboHits >= 15 && skillIndex === 0) ? 0.88 : 1.0;
        skill.cd = skill.maxCd * overdriveCdMult * comboAtkSpeedMult;

        if (skillIndex === 0) {
            this._performBasicAttack(player, weaponKey, weapon, fireAngle, opts);
            return;
        }

        const skillId = skill.id;
        if (skillId === 'blink') {
            this._performShadowBlink(player, weaponKey, weapon, fireAngle);
        } else if (skillId === 'warp') {
            this._performShieldCharge(player, weaponKey, weapon, fireAngle);
        } else if (skillId === 'dash' || skillIndex === 1) {
            this._performDashSlash(player, weaponKey, weapon, fireAngle, opts);
        } else if (skillId === 'shuriken') {
            this._performPhantomShurikens(player, weaponKey, weapon, fireAngle);
        } else if (skillId === 'singularity') {
            this._performEarthquakeSlam(player, weaponKey, weapon);
        } else if (skillId === 'storm' || skillIndex === 2) {
            this._performSuperStorm(player, weaponKey, weapon, fireAngle, opts);
        } else if (skillId === 'overdrive') {
            this._performPhantomOverdrive(player, weaponKey, weapon);
        } else if (skillId === 'abyss') {
            this._performImmortalFortress(player, weaponKey, weapon);
        } else {
            this._performChronoFreeze(player);
        }
    },

    _checkPerfectDodge: function (player, radiusBonus) {
        const enemiesModule = window.Game.Enemies;
        const projectiles = (enemiesModule && Array.isArray(enemiesModule.projectiles)) ? enemiesModule.projectiles : [];
        const currentTimeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
        let dodgedBullets = 0;

        for (let i = 0; i < projectiles.length; i++) {
            const proj = projectiles[i];
            if (!proj || proj.dead || proj.hp <= 0) continue;
            if (proj.timeline !== 'ALL' && proj.timeline !== currentTimeline) continue;

            if (Math.hypot(proj.x - player.x, proj.y - player.y) <= (radiusBonus || 68) + (proj.radius || 6)) {
                this._spawnParticles(proj.x, proj.y, '#00f2fe', 6, 150);
                proj.dead = true;
                proj.hp = 0;
                dodgedBullets++;
            }
        }

        if (dodgedBullets > 0) {
            const state = window.Game.state || {};
            state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 20);
            player.shield = Math.min(player.maxShield || 100, (player.shield || 0) + 18);

            if (this.skills[2]) {
                this.skills[2].cd = Math.max(0, (this.skills[2].cd || 0) - 2.0);
            }

            player.screenShake = Math.max(player.screenShake || 0, 0.26);
            this._spawnSpaceLightningBurst(player.x, player.y, '#00f2fe', 5, 120);
            this.spawnFloatingText(player.x, player.y - 52, '⚡ LƯỚT HOÀN HẢO! (+20 Nộ / +18 Giáp / -2s Chiêu 2)', '#00f2fe', true);
        }
        return dodgedBullets;
    },

    // ------------------------------------------------------------------------
    // KỸ NĂNG RIÊNG CỦA SHADOW ASSASSIN
    // ------------------------------------------------------------------------
    _performShadowBlink: function (player, weaponKey, weapon, angle) {
        if (window.Game.Audio && typeof window.Game.Audio.playSlash === 'function') {
            window.Game.Audio.playSlash();
        }
        const dodged = this._checkPerfectDodge(player, 75);
        const baseDmg = this._calculateBaseDamage(weaponKey, weapon);
        const blinkRange = 280;

        this._spawnAfterimage(player, angle, '#ec4899');
        this._spawnParticles(player.x, player.y, '#ec4899', 16, 180);

        const startX = player.x;
        const startY = player.y;
        let finalX = startX;
        let finalY = startY;

        for (let step = 20; step <= blinkRange; step += 20) {
            const tx = startX + Math.cos(angle) * step;
            const ty = startY + Math.sin(angle) * step;
            if (!window.Game.World || typeof window.Game.World.canMoveTo !== 'function' || window.Game.World.canMoveTo(tx, ty)) {
                finalX = tx;
                finalY = ty;
            } else {
                break;
            }
        }

        player.x = finalX;
        player.y = finalY;
        player.dashTime = 0;

        const beam = this._getFreeLaserBeam();
        if (beam) {
            beam.x1 = startX; beam.y1 = startY;
            beam.x2 = finalX; beam.y2 = finalY;
            beam.color = '#ec4899'; beam.coreColor = '#ffffff';
            beam.width = 12; beam.isLightning = false;
            beam.life = 0.25; beam.maxLife = 0.25;
        }

        this._spawnAfterimage(player, angle + Math.PI, '#00f2fe');

        const slash = this._getFreeSlash();
        if (slash) {
            slash.x = player.x; slash.y = player.y; slash.angle = angle;
            slash.radius = 135; slash.arc = Math.PI * 1.4;
            slash.color = '#ec4899'; slash.glow = '#00f2fe';
            slash.isCyber = true; slash.isDashSprite = true;
            slash.swingDir = 1; slash.life = 0.30; slash.maxLife = 0.30;
        }

        this._checkMeleeBulletDeflect(player, angle, 135, Math.PI * 1.4, true, weaponKey);

        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
            const segDist = this._pointToSegmentDistance(enemy.x, enemy.y, startX, startY, finalX, finalY);
            const endDist = Math.hypot(enemy.x - finalX, enemy.y - finalY);
            if (segDist <= (enemy.radius || 20) + 55 || endDist <= 135) {
                const dmg = Math.round(baseDmg * (dodged > 0 ? 2.2 : 1.85));
                this._applyDamageToEnemy(enemy, dmg, angle + Math.PI, 120, '#ec4899', weaponKey, 'storm');
            }
        }
    },

    _performPhantomShurikens: function (player, weaponKey, weapon, angle) {
        if (window.Game.Audio && typeof window.Game.Audio.playSlash === 'function') {
            window.Game.Audio.playSlash();
        }
        const baseDmg = this._calculateBaseDamage(weaponKey, weapon);
        const enhanced = this._getEnhancedColors(weaponKey, weapon);
        const fanCount = 5;
        const spreadArc = Math.PI * 0.52;

        for (let i = 0; i < fanCount; i++) {
            const offset = (i / (fanCount - 1) - 0.5) * spreadArc;
            const bladeAngle = angle + offset;
            const shuriken = this._getFreeBullet();
            if (shuriken) {
                shuriken.subType = 'shuriken';
                shuriken.x = player.x + Math.cos(bladeAngle) * 24;
                shuriken.y = player.y + Math.sin(bladeAngle) * 24;
                shuriken.vx = Math.cos(bladeAngle) * 760;
                shuriken.vy = Math.sin(bladeAngle) * 760;
                shuriken.rotation = 0;
                shuriken.traveled = 0;
                shuriken.maxDistance = 410;
                shuriken.radius = 18;
                shuriken.damage = Math.round(baseDmg * 1.35);
                shuriken.bleedDamage = Math.round(baseDmg * 0.28);
                shuriken.returning = false;
                shuriken.returnSpeed = 820;
                shuriken.color = enhanced.isAscended ? enhanced.color : '#f59e0b';
                shuriken.glow = enhanced.isAscended ? enhanced.glow : '#ec4899';
                shuriken.weaponKey = weaponKey;
            }
        }
        this._spawnParticles(player.x, player.y, '#f59e0b', 14, 175);
    },

    _performPhantomOverdrive: function (player, weaponKey, weapon) {
        const state = window.Game.state;
        if (!state) return;

        state.rage = Math.max(0, (state.rage || 0) - 100);
        this.overdriveTimer = 6.0;

        if (window.Game.Audio && typeof window.Game.Audio.playExplosion === 'function') {
            window.Game.Audio.playExplosion();
        }

        player.screenShake = Math.max(player.screenShake || 0, 0.36);
        const baseDmg = this._calculateBaseDamage(weaponKey, weapon);

        const sw = this._getFreeShockwave();
        if (sw) {
            sw.x = player.x; sw.y = player.y; sw.radius = 20; sw.maxRadius = 520;
            sw.color = '#f43f5e'; sw.life = 0.45; sw.maxLife = 0.45;
        }

        this.spawnFloatingText(player.x, player.y - 48, '🌌 ÁN TỬ HƯ VÔ! (+40% TỐC ĐÁNH / +35% CRIT)', '#f43f5e', true);

        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist <= 520) {
                const beam = this._getFreeLaserBeam();
                if (beam) {
                    beam.x1 = player.x; beam.y1 = player.y;
                    beam.x2 = enemy.x; beam.y2 = enemy.y;
                    beam.color = '#f43f5e'; beam.coreColor = '#fde047';
                    beam.width = 9; beam.isLightning = false;
                    beam.life = 0.35; beam.maxLife = 0.35;
                }
                this._spawnParticles(enemy.x, enemy.y, '#f43f5e', 12, 200);
                this._applyDamageToEnemy(enemy, Math.round(baseDmg * 3.1), Math.atan2(enemy.y - player.y, enemy.x - player.x), 150, '#f43f5e', weaponKey, 'storm');
            }
        }
    },

    // ------------------------------------------------------------------------
    // KỸ NĂNG RIÊNG CỦA IRON JUGGERNAUT
    // ------------------------------------------------------------------------
    _performShieldCharge: function (player, weaponKey, weapon, angle) {
        if (window.Game.Audio && typeof window.Game.Audio.playExplosion === 'function') {
            window.Game.Audio.playExplosion();
        }
        this._checkPerfectDodge(player, 80);

        const shieldGain = Math.round((player.maxShield || 100) * 0.25);
        player.shield = Math.min(player.maxShield || 100, (player.shield || 0) + shieldGain);
        this.spawnFloatingText(player.x, player.y - 40, `🛡️ KHIÊN ĐỘT KÍCH (+${shieldGain} GIÁP)!`, '#eab308', true);

        const dashDuration = 0.18;
        const dashDistance = 230;
        const baseDmg = this._calculateBaseDamage(weaponKey, weapon);

        player.dashTime = dashDuration;
        this.dashState = {
            startX: player.x, startY: player.y, angle,
            speed: dashDistance / dashDuration,
            duration: dashDuration, timeLeft: dashDuration,
            damage: Math.round(baseDmg * 1.9),
            stunDuration: 1.5,
            weaponKey, dashColor: '#f59e0b',
            afterimagesSpawned: 0, hitIds: new Set()
        };

        const slash = this._getFreeSlash();
        if (slash) {
            slash.x = player.x; slash.y = player.y; slash.angle = angle;
            slash.radius = 135; slash.arc = Math.PI;
            slash.color = '#f59e0b'; slash.glow = '#fde047';
            slash.isCyber = true; slash.isDashSprite = true;
            slash.swingDir = 1; slash.life = 0.30; slash.maxLife = 0.30;
        }

        this._checkMeleeBulletDeflect(player, angle, 135, Math.PI, true, weaponKey);
    },

    _performEarthquakeSlam: function (player, weaponKey, weapon) {
        if (window.Game.Audio && typeof window.Game.Audio.playExplosion === 'function') {
            window.Game.Audio.playExplosion();
        }

        player.screenShake = 0.42;
        const slamRadius = 260;
        const baseDmg = this._calculateBaseDamage(weaponKey, weapon);
        const slamDamage = Math.round(baseDmg * 2.35);

        const sw = this._getFreeShockwave();
        if (sw) {
            sw.x = player.x; sw.y = player.y; sw.radius = 20; sw.maxRadius = slamRadius;
            sw.color = '#ea580c'; sw.life = 0.45; sw.maxLife = 0.45;
        }

        const mz = this._getFreeMagmaZone();
        if (mz) {
            mz.x = player.x; mz.y = player.y; mz.radius = slamRadius;
            mz.life = 4.0; mz.maxLife = 4.0;
            mz.tickTimer = 0.4; mz.tickDamage = Math.round(baseDmg * 0.45);
            mz.weaponKey = weaponKey;
        }

        this._spawnParticles(player.x, player.y, '#ea580c', 32, 220);
        this._spawnParticles(player.x, player.y, '#fde047', 18, 180);

        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist <= slamRadius + (enemy.radius || 22)) {
                enemy.stunTimer = Math.max(enemy.stunTimer || 0, 1.0);
                this._applyDamageToEnemy(enemy, slamDamage, Math.atan2(enemy.y - player.y, enemy.x - player.x), 240, '#ea580c', weaponKey, 'storm');
            }
        }
    },

    _performImmortalFortress: function (player, weaponKey, weapon) {
        const state = window.Game.state;
        if (!state) return;

        state.rage = Math.max(0, (state.rage || 0) - 100);
        this.fortressTimer = 7.0;
        this.fortressPulseTimer = 0.2;

        player.shield = player.maxShield || 110;
        player.hp = Math.min(player.maxHp || 175, player.hp + Math.round((player.maxHp || 175) * 0.30));

        if (window.Game.Audio && typeof window.Game.Audio.playLevelUp === 'function') {
            window.Game.Audio.playLevelUp();
        }

        player.screenShake = 0.38;

        const sw1 = this._getFreeShockwave();
        if (sw1) { sw1.x = player.x; sw1.y = player.y; sw1.radius = 20; sw1.maxRadius = 360; sw1.color = '#3b82f6'; sw1.life = 0.55; sw1.maxLife = 0.55; }
        const sw2 = this._getFreeShockwave();
        if (sw2) { sw2.x = player.x; sw2.y = player.y; sw2.radius = 15; sw2.maxRadius = 280; sw2.color = '#f59e0b'; sw2.life = 0.45; sw2.maxLife = 0.45; }

        this.spawnFloatingText(player.x, player.y - 48, '🌟 PHÁO ĐÀI BẤT DIỆT! (FULL KHIÊN + SÉT HỘ THỂ 7s)', '#38bdf8', true);
    },

    // ------------------------------------------------------------------------
    // ĐÒN ĐÁNH THƯỜNG & COMBO 3-HIT
    // ------------------------------------------------------------------------
    _performBasicAttack: function (player, weaponKey, weapon, angle, opts) {
        if (this.comboResetTimer > 0) {
            this.comboStep = (this.comboStep + 1) % 3;
        } else {
            this.comboStep = 0;
        }
        this.comboResetTimer = 0.85;

        const comboStep = this.comboStep;
        const isThirdHit = comboStep === 2;
        const weaponLevel = this._getWeaponLevel(weaponKey);
        const isAscendedFinisher = isThirdHit && weaponLevel >= 10;
        const ascensionSizeMult = isAscendedFinisher ? 1.15 : 1.0;

        const damageMult = isThirdHit ? 1.45 : (comboStep === 1 ? 1.15 : 1.0);
        const rangeMult = (isThirdHit ? 1.25 : 1.0) * ascensionSizeMult;
        let baseDmg = this._calculateBaseDamage(weaponKey, weapon) * damageMult;
        const enhanced = this._getEnhancedColors(weaponKey, weapon);

        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        // 1. SÚNG LASER (QUÁ NHIỆT & SUY GIẢM THEO CỰ LY)
        if (weaponKey === 'laser_gun') {
            if (window.Game.Audio && typeof window.Game.Audio.playLaser === 'function') {
                window.Game.Audio.playLaser();
            }

            this.weaponHeat = Math.min(this.maxWeaponHeat, (this.weaponHeat || 0) + 28);
            const isOverheated = this.weaponHeat >= 80;

            let actualAngle = angle;
            let heatDmgMult = 1.0;

            if (isOverheated) {
                const angleSpread = (Math.random() - 0.5) * 0.28;
                actualAngle += angleSpread;
                heatDmgMult = 0.65;
                this.spawnFloatingText(player.x, player.y - 40, '🔥 SÚNG QUÁ NHIỆT!', '#ef4444', true);
                this._spawnParticles(player.x, player.y, '#ef4444', 8, 140);
            }

            const effectiveRange = weapon.range * rangeMult;
            const beamWidth = weapon.beamWidth * (isThirdHit ? 1.6 : 1.0) * ascensionSizeMult;
            const startX = player.x + Math.cos(actualAngle) * 24;
            const startY = player.y + Math.sin(actualAngle) * 24;
            const endX = player.x + Math.cos(actualAngle) * effectiveRange;
            const endY = player.y + Math.sin(actualAngle) * effectiveRange;

            const beam = this._getFreeLaserBeam();
            if (beam) {
                beam.x1 = startX; beam.y1 = startY;
                beam.x2 = endX; beam.y2 = endY;
                beam.color = isOverheated ? '#ff3b30' : enhanced.color;
                beam.coreColor = isThirdHit ? '#fde047' : '#ffffff';
                beam.width = (isThirdHit ? 24 : 14) * ascensionSizeMult;
                beam.isLightning = false;
                beam.life = isThirdHit ? 0.34 : 0.22;
                beam.maxLife = beam.life;
            }

            if (isThirdHit) {
                const aoeEndRadius = Math.round(115 * ascensionSizeMult);
                const sw = this._getFreeShockwave();
                if (sw) {
                    sw.x = endX; sw.y = endY; sw.radius = 15; sw.maxRadius = aoeEndRadius;
                    sw.color = enhanced.color; sw.life = 0.35; sw.maxLife = 0.35;
                }
                this._spawnParticles(endX, endY, enhanced.particle || '#ff0844', 22, 210);

                if (isAscendedFinisher) {
                    this._spawnSpaceLightningBurst(endX, endY, enhanced.color, 6, aoeEndRadius * 1.15);
                }

                if (player) player.screenShake = Math.max(player.screenShake || 0, 0.22);

                for (let i = 0; i < activeEnemies.length; i++) {
                    const enemy = activeEnemies[i];
                    if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                    if (Math.hypot(enemy.x - endX, enemy.y - endY) <= aoeEndRadius + (enemy.radius || 22)) {
                        this._applyDamageToEnemy(enemy, Math.round(baseDmg * heatDmgMult * 1.25), actualAngle, 160, enhanced.color, weaponKey, 'finisher');
                    }
                }
            }

            for (let d = 40; d <= effectiveRange; d += 45) {
                this._spawnParticles(player.x + Math.cos(actualAngle) * d, player.y + Math.sin(actualAngle) * d, enhanced.particle, isThirdHit ? 4 : 2, 85);
            }

            const piercedList = [];
            for (let i = 0; i < activeEnemies.length; i++) {
                const enemy = activeEnemies[i];
                if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                const hitDist = this._pointToSegmentDistance(enemy.x, enemy.y, startX, startY, endX, endY);
                if (hitDist <= (enemy.radius || 22) + beamWidth * 0.5) {
                    const distToPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
                    piercedList.push({ enemy, dist: distToPlayer });
                }
            }

            piercedList.sort((a, b) => a.dist - b.dist);

            for (let rank = 0; rank < piercedList.length; rank++) {
                const item = piercedList[rank];
                let pierceMult = 1.0;
                if (rank === 1) pierceMult = 0.65;
                else if (rank >= 2) pierceMult = 0.40;

                const distMult = (item.dist > 260) ? 0.75 : 1.0;
                const finalLaserDmg = Math.round(baseDmg * heatDmgMult * pierceMult * distMult);

                this._applyDamageToEnemy(item.enemy, finalLaserDmg, actualAngle, isThirdHit ? 140 : 80, enhanced.color, weaponKey, 'attack');
            }
            return;
        }

        // 2. PHÁO NĂNG LƯỢNG THỜI KHÔNG (CHRONO CANNON)
        if (weaponKey === 'chrono_cannon') {
            if (window.Game.Audio && typeof window.Game.Audio.playLaser === 'function') {
                window.Game.Audio.playLaser();
            }

            // Giật lùi nhẹ 4px
            const recoilX = player.x - Math.cos(angle) * 4;
            const recoilY = player.y - Math.sin(angle) * 4;
            if (!window.Game.World || typeof window.Game.World.canMoveTo !== 'function' || window.Game.World.canMoveTo(recoilX, recoilY)) {
                player.x = recoilX;
                player.y = recoilY;
            }

            const effectiveRange = weapon.range * (isThirdHit ? 1.15 : 1.0) * ascensionSizeMult;
            const aoeRadius = (weapon.aoeRadius || 92) * (isThirdHit ? 1.3 : 1.0) * ascensionSizeMult;
            const startX = player.x + Math.cos(angle) * 28;
            const startY = player.y + Math.sin(angle) * 28;

            let targetDist = effectiveRange * (opts.distRatio || 1.0);
            if (!opts.manualAim) {
                for (let i = 0; i < activeEnemies.length; i++) {
                    const enemy = activeEnemies[i];
                    if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                    const distToPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
                    if (distToPlayer <= effectiveRange) {
                        const segDist = this._pointToSegmentDistance(enemy.x, enemy.y, startX, startY, player.x + Math.cos(angle) * effectiveRange, player.y + Math.sin(angle) * effectiveRange);
                        if (segDist <= (enemy.radius || 22) + 28 && distToPlayer < targetDist) {
                            targetDist = distToPlayer;
                        }
                    }
                }
            }

            const targetX = player.x + Math.cos(angle) * targetDist;
            const targetY = player.y + Math.sin(angle) * targetDist;

            const ball = this._getFreeBullet();
            if (ball) {
                ball.subType = 'cannon';
                ball.x = startX; ball.y = startY;
                ball.targetX = targetX; ball.targetY = targetY;
                ball.angle = angle;
                ball.speed = weapon.speed || 580;
                ball.radius = (isThirdHit ? 18 : 13) * ascensionSizeMult;
                ball.aoeRadius = aoeRadius;
                ball.damage = baseDmg;
                ball.color = enhanced.isAscended ? enhanced.color : '#00f2fe';
                ball.glow = enhanced.isAscended ? enhanced.glow : '#fbbf24';
                ball.weaponKey = weaponKey;
                ball.isThirdHit = isThirdHit;
                ball.isAscendedFinisher = isAscendedFinisher;
            }

            if (isAscendedFinisher) {
                this._spawnSpaceLightningBurst(startX, startY, enhanced.color, 4, 90);
            }
            this._spawnParticles(startX, startY, enhanced.particle || '#fbbf24', 10, 140);
            return;
        }

        // 3. VŨ KHÍ CẬN CHIẾN (MICRO-LUNGE 14PX & CHUỖI COMBO 3-HIT)
        if (window.Game.Audio && typeof window.Game.Audio.playSlash === 'function') {
            window.Game.Audio.playSlash();
        }

        const lungeTargetX = player.x + Math.cos(angle) * 14;
        const lungeTargetY = player.y + Math.sin(angle) * 14;
        if (!window.Game.World || typeof window.Game.World.canMoveTo !== 'function' || window.Game.World.canMoveTo(lungeTargetX, lungeTargetY)) {
            player.x = lungeTargetX;
            player.y = lungeTargetY;
        }

        const isCyber = weaponKey === 'cyber_sword' || enhanced.isAscended;
        const isScythe = weaponKey === 'void_scythe';
        const effectiveRange = weapon.range * rangeMult;
        const effectiveArc = isScythe
            ? Math.PI * 2
            : Math.min(Math.PI * 2, weapon.arc * (comboStep === 1 ? 1.1 : isThirdHit ? 1.25 : 1.0) * (isAscendedFinisher ? 1.1 : 1.0));

        const slashDuration = isThirdHit ? 0.30 : 0.24;
        const slash = this._getFreeSlash();
        if (slash) {
            slash.x = player.x; slash.y = player.y; slash.angle = angle;
            slash.radius = effectiveRange; slash.arc = effectiveArc;
            slash.color = isScythe && !enhanced.isAscended ? '#a855f7' : enhanced.color;
            slash.glow = isScythe && !enhanced.isAscended ? '#6b21a8' : enhanced.glow;
            slash.isCyber = isCyber || isScythe; slash.isScythe = isScythe;
            slash.isAscendedFinisher = isAscendedFinisher;
            slash.isDashSprite = false;
            slash.comboStep = comboStep;
            slash.swingDir = comboStep === 1 ? -1 : 1; // Đòn 2 đảo chiều vung kiếm
            slash.life = slashDuration; slash.maxLife = slashDuration;
        }

        // Kiểm tra phản đòn quái
        this._checkMeleeBulletDeflect(player, angle, effectiveRange, effectiveArc, isThirdHit, weaponKey);

        const tipX = player.x + Math.cos(angle) * (effectiveRange * 0.75);
        const tipY = player.y + Math.sin(angle) * (effectiveRange * 0.75);

        if (isAscendedFinisher) {
            this._spawnSpaceLightningBurst(tipX, tipY, enhanced.color, 6, effectiveRange * 0.95);
        }

        // Khi Combo >= 15 Hits: Phóng thêm Kiếm khí sấm sét
        if (this.comboHits >= 15) {
            this._spawnSpaceLightningBurst(tipX, tipY, '#38bdf8', 3, 75);
            const extraWave = this._getFreeBullet();
            if (extraWave) {
                extraWave.subType = 'crescent';
                extraWave.x = player.x + Math.cos(angle) * 26;
                extraWave.y = player.y + Math.sin(angle) * 26;
                extraWave.vx = Math.cos(angle) * 720;
                extraWave.vy = Math.sin(angle) * 720;
                extraWave.angle = angle;
                extraWave.traveled = 0;
                extraWave.maxDistance = 240;
                extraWave.radius = 28;
                extraWave.damage = Math.round(baseDmg * 0.5);
                extraWave.color = '#38bdf8';
                extraWave.glow = '#0284c7';
                extraWave.isAscendedFinisher = false;
            }
        }

        // Đòn 3 cận chiến phóng Kiếm Khí Bán Nguyệt lớn
        if ((weaponKey === 'iron_sword' || weaponKey === 'cyber_sword') && isThirdHit) {
            const wave = this._getFreeBullet();
            if (wave) {
                wave.subType = 'crescent';
                wave.x = player.x + Math.cos(angle) * 32;
                wave.y = player.y + Math.sin(angle) * 32;
                wave.vx = Math.cos(angle) * 680;
                wave.vy = Math.sin(angle) * 680;
                wave.angle = angle;
                wave.traveled = 0;
                wave.maxDistance = Math.round(310 * ascensionSizeMult);
                wave.radius = Math.round(44 * ascensionSizeMult);
                wave.damage = Math.round(baseDmg * 1.35);
                wave.color = enhanced.color || '#f8fafc';
                wave.glow = enhanced.glow || '#f39c12';
                wave.isAscendedFinisher = isAscendedFinisher;
            }
        }

        // Đòn 3 Lưỡi Hái tạo Hố Đen Hư Không
        if (isScythe && isThirdHit) {
            const bh = this._getFreeBlackHole();
            if (bh) {
                bh.x = tipX; bh.y = tipY;
                bh.radius = Math.round(190 * ascensionSizeMult);
                bh.pullSpeed = 185;
                bh.life = 1.25; bh.maxLife = 1.25;
                bh.tickTimer = 0.2;
                bh.damage = Math.round(baseDmg * 0.4);
                bh.color = enhanced.isAscended ? enhanced.color : '#a855f7';
                bh.glow = enhanced.isAscended ? enhanced.glow : '#6b21a8';
                bh.isAscendedFinisher = isAscendedFinisher;
            }
        }

        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;

            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist = Math.hypot(dx, dy);

            if (dist <= effectiveRange + (enemy.radius || 20)) {
                const angleToEnemy = Math.atan2(dy, dx);
                const angleDiff = Math.abs(this._normalizeAngle(angleToEnemy - angle));

                if (isScythe || angleDiff <= effectiveArc * 0.55 || dist <= (player.radius || 20) + (enemy.radius || 20) + 12) {
                    this._applyDamageToEnemy(enemy, baseDmg, angleToEnemy, isThirdHit ? 170 : 90, enhanced.color, weaponKey, 'attack');
                }
            }
        }
    },

    // ------------------------------------------------------------------------
    // KỸ NĂNG DASH CỦA TIME TRAVELER: LƯỚT CHÉM & TÀN DƯ THỜI KHÔNG
    // ------------------------------------------------------------------------
    _performDashSlash: function (player, weaponKey, weapon, angle, opts) {
        if (window.Game.Audio && typeof window.Game.Audio.playSlash === 'function') {
            window.Game.Audio.playSlash();
        }

        const dodgedBullets = this._checkPerfectDodge(player, 68);
        const dashDuration = 0.15;
        const dashDistance = 240;
        const dashSpeed = dashDistance / dashDuration;
        const baseDmg = this._calculateBaseDamage(weaponKey, weapon);
        const enhanced = this._getEnhancedColors(weaponKey, weapon);

        const startX = player.x;
        const startY = player.y;

        player.dashTime = dashDuration;

        this.dashState = {
            startX: startX, startY: startY, angle, speed: dashSpeed,
            duration: dashDuration, timeLeft: dashDuration,
            damage: Math.round(baseDmg * (dodgedBullets > 0 ? 1.95 : 1.65)),
            weaponKey, dashColor: enhanced.isAscended ? enhanced.color : '#00f2fe',
            afterimagesSpawned: 0, hitIds: new Set()
        };

        // KÍCH HOẠT TÀN DƯ THỜI KHÔNG: Lặp lại đòn chém sau đúng 1.5 giây
        const echo = this._getFreeSpacetimeEcho();
        if (echo) {
            echo.x = startX;
            echo.y = startY;
            echo.angle = angle;
            echo.delay = 1.5;
            echo.radius = 140;
            echo.damage = Math.round(baseDmg * 1.10);
            echo.color = '#00f2fe';
            echo.weaponKey = weaponKey;
            echo.triggered = false;
            echo.life = 1.85;
            echo.maxLife = 1.85;
        }

        const slash = this._getFreeSlash();
        if (slash) {
            slash.x = player.x; slash.y = player.y; slash.angle = angle;
            slash.radius = 140; slash.arc = Math.PI;
            slash.color = this.dashState.dashColor;
            slash.glow = '#ffffff';
            slash.isCyber = true;
            slash.isDashSprite = true; // Dùng sprite luot_chem_2.jpg
            slash.swingDir = 1;
            slash.life = 0.30; slash.maxLife = 0.30;
        }

        // Phản đạn quái khi lướt chém
        this._checkMeleeBulletDeflect(player, angle, 140, Math.PI, true, weaponKey);

        this._spawnAfterimage(player, angle, this.dashState.dashColor);
        this.dashState.afterimagesSpawned = 1;
        this._spawnParticles(player.x, player.y, this.dashState.dashColor, 12, 150);
    },

    _spawnAfterimage: function (player, angle, color) {
        const ai = this._getFreeAfterimage();
        if (ai) {
            ai.x = player.x; ai.y = player.y; ai.angle = angle;
            ai.radius = player.radius || 20;
            ai.weapon = (window.Game.state && window.Game.state.currentWeapon) || 'iron_sword';
            ai.color = color || '#00f2fe';
            ai.life = 0.38; ai.maxLife = 0.38;
        }
    },

    _performSuperStorm: function (player, weaponKey, weapon, angle, opts) {
        if (window.Game.Audio && typeof window.Game.Audio.playExplosion === 'function') {
            window.Game.Audio.playExplosion();
        }

        player.screenShake = 0.35;
        const stormRadius = 250;
        const baseDmg = this._calculateBaseDamage(weaponKey, weapon);
        const skillDamage = Math.round(baseDmg * 2.2);
        const enhanced = this._getEnhancedColors(weaponKey, weapon);
        const mainColor = enhanced.isAscended ? enhanced.color : '#ff0844';

        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        // Hút kẻ địch về tâm
        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist <= stormRadius && dist > 15) {
                const pullPower = Math.min(65, (stormRadius - dist) * 0.45 + 25);
                const pullAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                const nx = enemy.x + Math.cos(pullAngle) * pullPower;
                const ny = enemy.y + Math.sin(pullAngle) * pullPower;
                if (!window.Game.World || typeof window.Game.World.canMoveTo !== 'function' || window.Game.World.canMoveTo(nx, ny)) {
                    enemy.x = nx;
                    enemy.y = ny;
                }
            }
        }

        const sw = this._getFreeShockwave();
        if (sw) {
            sw.x = player.x; sw.y = player.y; sw.radius = 25; sw.maxRadius = stormRadius;
            sw.color = mainColor; sw.life = 0.42; sw.maxLife = 0.42;
        }

        const slash = this._getFreeSlash();
        if (slash) {
            slash.x = player.x; slash.y = player.y; slash.angle = angle;
            slash.radius = stormRadius * 0.9; slash.arc = Math.PI * 2;
            slash.color = mainColor; slash.glow = enhanced.isAscended ? enhanced.glow : '#ffb199';
            slash.isCyber = true; slash.isScythe = true;
            slash.life = 0.36; slash.maxLife = 0.36;
        }

        for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 4;
            const beam = this._getFreeLaserBeam();
            if (beam) {
                beam.x1 = player.x; beam.y1 = player.y;
                beam.x2 = player.x + Math.cos(a) * stormRadius;
                beam.y2 = player.y + Math.sin(a) * stormRadius;
                beam.color = mainColor; beam.coreColor = '#fde047';
                beam.width = 8; beam.isLightning = true;
                beam.life = 0.32; beam.maxLife = 0.32;
            }
        }

        this._spawnParticles(player.x, player.y, mainColor, 34, 230);
        this._spawnParticles(player.x, player.y, enhanced.particle || '#fde047', 18, 190);

        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist <= stormRadius + (enemy.radius || 22)) {
                this._applyDamageToEnemy(enemy, skillDamage, Math.atan2(enemy.y - player.y, enemy.x - player.x), 210, mainColor, weaponKey, 'storm');
            }
        }
    },

    _performChronoFreeze: function (player) {
        const state = window.Game.state;
        if (!state) return;

        state.rage = Math.max(0, (state.rage || 0) - 100);
        state.chronoFreezeTimer = 3.2;

        if (window.Game.Audio && typeof window.Game.Audio.playFreeze === 'function') {
            window.Game.Audio.playFreeze();
        }

        player.screenShake = Math.max(player.screenShake || 0, 0.28);

        const sw1 = this._getFreeShockwave();
        if (sw1) { sw1.x = player.x; sw1.y = player.y; sw1.radius = 20; sw1.maxRadius = 1100; sw1.color = '#a855f7'; sw1.life = 0.65; sw1.maxLife = 0.65; }
        const sw2 = this._getFreeShockwave();
        if (sw2) { sw2.x = player.x; sw2.y = player.y; sw2.radius = 10; sw2.maxRadius = 900; sw2.color = '#00f2fe'; sw2.life = 0.55; sw2.maxLife = 0.55; }

        this._spawnParticles(player.x, player.y, '#a855f7', 36, 260);
        this._spawnParticles(player.x, player.y, '#00f2fe', 30, 220);
        this.spawnFloatingText(player.x, player.y - 42, '⏳ NGƯNG ĐỌNG THỜI GIAN (3.2s)!', '#00f2fe', true);
    },

    // ------------------------------------------------------------------------
    // TÍNH TOÁN & GÂY SÁT THƯƠNG (BACKSTAB, VẾT NỨT THỜI KHÔNG, CROSS-FLASH)
    // ------------------------------------------------------------------------
    _applyDamageToEnemy: function (enemy, rawAmount, hitAngle, knockback, hitColor, weaponKey, sourceSkill) {
        if (!enemy || enemy.dead || enemy.hp <= 0) return;

        const player = window.Game.player;
        const state = window.Game.state || {};

        this.comboHits++;
        this.comboTimer = this.comboMaxTimer;

        // Đòn đánh điểm yếu sau lưng (Backstab x1.45 ST)
        const isMeleeWeapon = weaponKey === 'iron_sword' || weaponKey === 'cyber_sword' || weaponKey === 'void_scythe';
        const enemyFacing = (typeof enemy.facingAngle === 'number')
            ? enemy.facingAngle
            : (typeof enemy.angle === 'number' ? enemy.angle : Math.atan2(enemy.vy || 0, enemy.vx || 0));

        let isBackstab = false;
        if (isMeleeWeapon) {
            const angleDiffFacing = Math.abs(this._normalizeAngle(enemyFacing - hitAngle));
            if (angleDiffFacing < Math.PI * 0.45) {
                isBackstab = true;
            }
        }

        const backstabMultiplier = isBackstab ? 1.45 : 1.0;
        const comboCritBonus = Math.min(0.25, Math.floor(this.comboHits / 10) * 0.05);
        const overdriveCritBonus = this.overdriveTimer > 0 ? 0.35 : 0;
        const totalCritRate = 0.18 + comboCritBonus + overdriveCritBonus;
        const isCrit = Math.random() < totalCritRate;

        let finalDamage = Math.max(1, Math.round(rawAmount * backstabMultiplier * (isCrit ? 1.65 : 1.0)));

        if (isBackstab) {
            this.spawnFloatingText(enemy.x, enemy.y - (enemy.radius || 20) - 22, '⚡ ĐÁNH LÉN SAU LƯNG! (x1.45 ST)', '#fde047', true);
            this._spawnParticles(enemy.x, enemy.y, '#fde047', 12, 190);
        }

        // Vết Nứt Thời Không khi thời gian ngưng đọng (+25% sát thương chuẩn)
        if (state.chronoFreezeTimer && state.chronoFreezeTimer > 0) {
            const riftTrueDamage = Math.max(1, Math.round(finalDamage * 0.25));
            finalDamage += riftTrueDamage;
            this.spawnFloatingText(enemy.x, enemy.y - (enemy.radius || 20) - 38, `💥 VẾT NỨT THỜI KHÔNG (+${riftTrueDamage} ST CHUẨN)!`, '#c084fc', true);
            this._spawnSpaceLightningBurst(enemy.x, enemy.y, '#a855f7', 3, 60);
        }

        if (enemy.isBoss && (sourceSkill === 'dash' || sourceSkill === 'storm')) {
            const currentTl = state.timeline || 'PRESENT';
            if (currentTl === enemy.shieldTimeline && enemy.shatterAvailable) {
                enemy.shatterAvailable = false;
                const shatterDmg = Math.max(1, Math.round(enemy.maxHp * 0.05));
                enemy.hp = Math.max(0, enemy.hp - shatterDmg);
                enemy.stunTimer = 1.5;

                if (window.Game.Enemies && typeof window.Game.Enemies.spawnSpecificLoot === 'function') {
                    window.Game.Enemies.spawnSpecificLoot(enemy.x, enemy.y, 'HP_ORB', 2, 25);
                }

                state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 15);
                this.spawnFloatingText(enemy.x, enemy.y - enemy.radius - 38, '⚡ PHÁ KHIÊN THỜI KHÔNG! (SUY YẾU +35% ST)', '#00f2fe', true);
                this.spawnFloatingText(player.x, player.y - 45, '+15 NỘ & 2 HP ORB!', '#4ade80', true);

                const sw = this._getFreeShockwave();
                if (sw) { sw.x = enemy.x; sw.y = enemy.y; sw.radius = 25; sw.maxRadius = 280; sw.color = '#00f2fe'; sw.life = 0.45; sw.maxLife = 0.45; }
                this._spawnParticles(enemy.x, enemy.y, '#00f2fe', 28, 260);

                if (player) player.screenShake = Math.max(player.screenShake || 0, 0.38);

                if (enemy.hp <= 0 && window.Game.Enemies && typeof window.Game.Enemies._handleEnemyDeath === 'function') {
                    window.Game.Enemies._handleEnemyDeath(enemy);
                    return;
                }
            }
        }

        if (!state.chronoFreezeTimer || state.chronoFreezeTimer <= 0) {
            state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 3);
        }

        // Tia chớp chữ X Chí Mạng (Cross-Flash) từ Pool
        if (isCrit) {
            const cf = this._getFreeCrossFlash();
            if (cf) {
                cf.x = enemy.x;
                cf.y = enemy.y;
                cf.size = (enemy.radius || 20) + 22;
                cf.color = '#fde047';
                cf.life = 0.22;
                cf.maxLife = 0.22;
            }

            if (player) {
                player.screenShake = Math.max(player.screenShake || 0, 0.16);
                player.hitStopTimer = Math.max(player.hitStopTimer || 0, 0.025);
            }
        }

        const now = performance.now() * 0.001;
        const currentWeapon = weaponKey || state.currentWeapon || 'iron_sword';
        const equippedRelics = Array.isArray(state.equippedRelics) ? state.equippedRelics : [];
        const hasVampRelic = equippedRelics.includes('relic_vamp');
        const isVoidScythe = currentWeapon === 'void_scythe';

        if (player && player.hp > 0 && (hasVampRelic || isVoidScythe) && (!this._lastLeechTime || now - this._lastLeechTime >= 0.25)) {
            let lifestealRatio = isVoidScythe ? 0.04 : 0;
            if (hasVampRelic) lifestealRatio += 0.04;

            const maxHealCap = Math.max(3, Math.round(player.maxHp * 0.045));
            const healAmount = Math.min(maxHealCap, Math.round(finalDamage * lifestealRatio));

            if (healAmount > 0 && player.hp < player.maxHp) {
                this._lastLeechTime = now;
                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                this.spawnFloatingText(player.x, player.y - 28, `+${healAmount} HP`, '#4ade80');
            }
        }

        const isAoESkill = sourceSkill === 'storm' || sourceSkill === 'finisher';
        const isFrontBlocked = (!isBackstab && enemy.isTanker && !isAoESkill && window.Game.Enemies && typeof window.Game.Enemies._isHitBlockedByShield === 'function')
            ? window.Game.Enemies._isHitBlockedByShield(enemy, player ? player.x : enemy.x, player ? player.y : enemy.y)
            : false;

        if (!isFrontBlocked) {
            const kbFactor = enemy.isBoss ? 0.05 : enemy.isElite ? 0.35 : 0.75;
            const pushDist = (knockback || 80) * 0.14 * kbFactor;
            const targetX = enemy.x + Math.cos(hitAngle) * pushDist;
            const targetY = enemy.y + Math.sin(hitAngle) * pushDist;

            if (!window.Game.World || typeof window.Game.World.canMoveTo !== 'function' || window.Game.World.canMoveTo(targetX, targetY)) {
                enemy.x = targetX;
                enemy.y = targetY;
            }
        }

        this._spawnParticles(enemy.x, enemy.y, isCrit ? '#f59e0b' : hitColor || '#f39c12', isCrit ? 16 : 10, isCrit ? 175 : 140);

        if (window.Game.Enemies && typeof window.Game.Enemies.damageEnemy === 'function') {
            window.Game.Enemies.damageEnemy(enemy, finalDamage, isCrit, false, isAoESkill || isBackstab, player ? player.x : undefined, player ? player.y : undefined);
        }
    },

    _normalizeAngle: function (angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    },

    _pointToSegmentDistance: function (px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x1, py - y1);
        let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    },

    _explodeCannonBall: function (ball) {
        if (window.Game.Audio && typeof window.Game.Audio.playExplosion === 'function') {
            window.Game.Audio.playExplosion();
        }
        if (window.Game.player) {
            window.Game.player.screenShake = Math.max(window.Game.player.screenShake || 0, 0.22);
        }

        const sw = this._getFreeShockwave();
        if (sw) {
            sw.x = ball.x; sw.y = ball.y; sw.radius = 15; sw.maxRadius = ball.aoeRadius;
            sw.color = ball.color || '#00f2fe'; sw.life = 0.35; sw.maxLife = 0.35;
        }

        if (ball.isAscendedFinisher) {
            this._spawnSpaceLightningBurst(ball.x, ball.y, ball.color || '#00f2fe', 6, ball.aoeRadius * 1.15);
        }

        this._spawnParticles(ball.x, ball.y, ball.color || '#00f2fe', 22, 210);
        this._spawnParticles(ball.x, ball.y, ball.glow || '#fbbf24', 18, 180);

        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        const sweetSpotDist = ball.aoeRadius * 0.40;

        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
            const dist = Math.hypot(enemy.x - ball.x, enemy.y - ball.y);
            if (dist <= ball.aoeRadius + (enemy.radius || 22)) {
                const sweetSpotMult = (dist <= sweetSpotDist) ? 1.0 : 0.55;
                const finalCannonDmg = Math.round(ball.damage * sweetSpotMult);
                this._applyDamageToEnemy(enemy, finalCannonDmg, Math.atan2(enemy.y - ball.y, enemy.x - ball.x), 170, ball.color || '#fbbf24', ball.weaponKey, 'finisher');
            }
        }
    },
// ------------------------------------------------------------------------
    // CẬP NHẬT TRẠNG THÁI COMBAT (VÒNG LẶP UPDATEdt - KHÔNG DÙNG .splice())
    // ------------------------------------------------------------------------
    update: function (dt) {
        if (window.Game.state && window.Game.state.isPaused) return;

        const skills = this.getActiveSkills();
        if (window.Game.state && window.Game.state.adminNoCd === true) {
            for (let i = 0; i < skills.length; i++) skills[i].cd = 0;
        }

        const player = window.Game.player;
        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        // 1. Tản nhiệt súng Laser: Giảm 38 điểm/giây
        if (this.weaponHeat > 0) {
            this.weaponHeat = Math.max(0, this.weaponHeat - dt * 38);
        }

        if (this.overdriveTimer > 0) {
            this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
        }

        // 2. Cập nhật Pháo Đài Bất Diệt (Iron Juggernaut Chiêu 3)
        if (this.fortressTimer > 0 && player) {
            this.fortressTimer = Math.max(0, this.fortressTimer - dt);
            this.fortressPulseTimer -= dt;
            if (this.fortressPulseTimer <= 0) {
                this.fortressPulseTimer = 0.85;
                const weaponKey = (window.Game.state && window.Game.state.currentWeapon) || 'iron_sword';
                const pulseDmg = Math.round(this._calculateBaseDamage(weaponKey, this._getCurrentWeaponConfig()) * 0.65);

                player.shield = Math.min(player.maxShield || 110, (player.shield || 0) + 8);
                this.spawnFloatingText(player.x, player.y - 25, '+8 Khiên', '#38bdf8');

                const sw = this._getFreeShockwave();
                if (sw) {
                    sw.x = player.x; sw.y = player.y; sw.radius = 18; sw.maxRadius = 185;
                    sw.color = '#38bdf8'; sw.life = 0.28; sw.maxLife = 0.28;
                }

                // Chém vỡ đạn quái xung quanh khi phát xung
                const enemyProjectiles = (window.Game.Enemies && Array.isArray(window.Game.Enemies.projectiles)) ? window.Game.Enemies.projectiles : [];
                for (let pi = 0; pi < enemyProjectiles.length; pi++) {
                    const pr = enemyProjectiles[pi];
                    if (pr && !pr.dead && pr.hp > 0 && Math.hypot(pr.x - player.x, pr.y - player.y) <= 185) {
                        this._spawnParticles(pr.x, pr.y, '#38bdf8', 6, 140);
                        pr.dead = true;
                        pr.hp = 0;
                    }
                }

                for (let i = 0; i < activeEnemies.length; i++) {
                    const e = activeEnemies[i];
                    if (!e || e.dead || e.hp <= 0) continue;
                    if (Math.hypot(e.x - player.x, e.y - player.y) <= 185 + (e.radius || 20)) {
                        this._applyDamageToEnemy(e, pulseDmg, Math.atan2(e.y - player.y, e.x - player.x), 140, '#38bdf8', weaponKey, 'storm');
                    }
                }
            }
        }

        if (this.killStreakTimer > 0) {
            this.killStreakTimer -= dt;
            if (this.killStreakTimer <= 0) this.killStreakCount = 0;
        }

        if (this.killStreakBanner) {
            this.killStreakBanner.life -= dt;
            this.killStreakBanner.scale = Math.max(1.0, this.killStreakBanner.scale - dt * 1.4);
            if (this.killStreakBanner.life <= 0) this.killStreakBanner = null;
        }

        if (this.speedBuffTimer > 0) {
            this.speedBuffTimer -= dt;
            if (this.speedBuffTimer <= 0) this._clearSpeedBuff();
        }

        if (this.cdHasteTimer > 0) this.cdHasteTimer = Math.max(0, this.cdHasteTimer - dt);

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.comboHits = 0;
        }

        if (this.comboResetTimer > 0) {
            this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
            if (this.comboResetTimer === 0) this.comboStep = 0;
        }

        // 3. Cập nhật Dash / Lướt Chém
        if (this.dashState && player) {
            const ds = this.dashState;
            const stepDist = ds.speed * dt;
            const subSteps = 3;
            const stepX = (Math.cos(ds.angle) * stepDist) / subSteps;
            const stepY = (Math.sin(ds.angle) * stepDist) / subSteps;

            for (let s = 0; s < subSteps; s++) {
                const nx = player.x + stepX;
                const ny = player.y + stepY;
                const canMoveX = !window.Game.World || typeof window.Game.World.canMoveTo !== 'function' || window.Game.World.canMoveTo(nx, player.y);
                const canMoveY = !window.Game.World || typeof window.Game.World.canMoveTo !== 'function' || window.Game.World.canMoveTo(player.x, ny);
                if (canMoveX) player.x = nx;
                if (canMoveY) player.y = ny;
            }

            const progress = 1 - Math.max(0, ds.timeLeft / ds.duration);
            const targetGhostCount = Math.min(4, Math.floor(progress * 4) + 1);
            while (ds.afterimagesSpawned < targetGhostCount) {
                this._spawnAfterimage(player, ds.angle, ds.afterimagesSpawned % 2 === 0 ? (ds.dashColor || '#00f2fe') : '#a855f7');
                ds.afterimagesSpawned++;
            }

            this._spawnParticles(player.x, player.y, ds.dashColor || '#00f2fe', 2, 85);

            for (let i = 0; i < activeEnemies.length; i++) {
                const enemy = activeEnemies[i];
                if (!enemy || enemy.dead || enemy.hp <= 0 || ds.hitIds.has(enemy.id)) continue;
                if (Math.hypot(enemy.x - player.x, enemy.y - player.y) <= (enemy.radius || 22) + 75) {
                    ds.hitIds.add(enemy.id);
                    if (ds.stunDuration) {
                        enemy.stunTimer = Math.max(enemy.stunTimer || 0, ds.stunDuration);
                    }
                    this._applyDamageToEnemy(enemy, ds.damage, ds.angle, 190, ds.dashColor || '#00f2fe', ds.weaponKey, 'dash');
                }
            }

            ds.timeLeft -= dt;
            player.dashTime = Math.max(0, ds.timeLeft);

            if (ds.timeLeft <= 0) {
                this.dashState = null;
                player.dashTime = 0;
            }
        } else if (player && player.dashTime > 0) {
            player.dashTime = Math.max(0, player.dashTime - dt);
        }

        // Hồi chiêu kỹ năng
        const hasteMult = this.cdHasteTimer > 0 ? 1.35 : 1.0;
        const anomalyMult = Math.max(1.0, this.terrainCdrMultiplier || 1.0);
        const cdRate = hasteMult * anomalyMult;

        for (let i = 0; i < skills.length; i++) {
            if (skills[i].cd > 0) {
                skills[i].cd = Math.max(0, skills[i].cd - dt * cdRate);
            }
        }

        // 4. CẬP NHẬT TÀN DƯ THỜI KHÔNG (SPACETIME ECHOES) - LẶP LẠI NHÁT CHÉM SAU 1.5S
        for (let i = 0; i < this.spacetimeEchoes.length; i++) {
            const echo = this.spacetimeEchoes[i];
            if (!echo.active) continue;

            echo.delay -= dt;
            echo.life -= dt;

            // Đạt mốc 1.5s: Kích hoạt đòn chém lặp lại tại vị trí cũ
            if (echo.delay <= 0 && !echo.triggered) {
                echo.triggered = true;

                if (window.Game.Audio && typeof window.Game.Audio.playSlash === 'function') {
                    window.Game.Audio.playSlash();
                }

                // Tạo vệt chém lặp lại từ SpriteSheet
                const slash = this._getFreeSlash();
                if (slash) {
                    slash.x = echo.x;
                    slash.y = echo.y;
                    slash.angle = echo.angle;
                    slash.radius = echo.radius;
                    slash.arc = Math.PI;
                    slash.color = '#00f2fe';
                    slash.glow = '#ffffff';
                    slash.isCyber = true;
                    slash.isDashSprite = true;
                    slash.swingDir = 1;
                    slash.life = 0.32;
                    slash.maxLife = 0.32;
                }

                const sw = this._getFreeShockwave();
                if (sw) {
                    sw.x = echo.x; sw.y = echo.y; sw.radius = 15; sw.maxRadius = echo.radius;
                    sw.color = '#00f2fe'; sw.life = 0.32; sw.maxLife = 0.32;
                }

                this._spawnParticles(echo.x, echo.y, '#00f2fe', 18, 190);
                this._spawnSpaceLightningBurst(echo.x, echo.y, '#00f2fe', 4, echo.radius);
                this.spawnFloatingText(echo.x, echo.y - 30, '⏳ TÀN DƯ THỜI KHÔNG!', '#00f2fe', true);

                // Gây sát thương diện rộng tại điểm tàn dư
                for (let j = 0; j < activeEnemies.length; j++) {
                    const enemy = activeEnemies[j];
                    if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                    if (Math.hypot(enemy.x - echo.x, enemy.y - echo.y) <= echo.radius + (enemy.radius || 20)) {
                        this._applyDamageToEnemy(enemy, echo.damage, echo.angle, 160, '#00f2fe', echo.weaponKey, 'dash');
                    }
                }
            }

            if (echo.life <= 0) {
                echo.active = false;
            }
        }

        // 5. CẬP NHẬT TỔ HỢP PROJECTILE / BULLET POOL (CANNON, CRESCENT, SHURIKEN, PHẢN ĐÒN)
        for (let i = 0; i < this.bullets.length; i++) {
            const b = this.bullets[i];
            if (!b.active) continue;

            if (b.subType === 'cannon') {
                const dx = b.targetX - b.x;
                const dy = b.targetY - b.y;
                const dist = Math.hypot(dx, dy);
                const moveStep = b.speed * dt;

                if (dist <= moveStep) {
                    b.x = b.targetX;
                    b.y = b.targetY;
                    this._explodeCannonBall(b);
                    b.active = false;
                } else {
                    b.x += (dx / dist) * moveStep;
                    b.y += (dy / dist) * moveStep;
                }
            } else if (b.subType === 'crescent') {
                const moveStep = Math.hypot(b.vx, b.vy) * dt;
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.traveled += moveStep;

                for (let j = 0; j < activeEnemies.length; j++) {
                    const enemy = activeEnemies[j];
                    if (!enemy || enemy.dead || enemy.hp <= 0 || b.hitIds.has(enemy.id)) continue;
                    if (Math.hypot(enemy.x - b.x, enemy.y - b.y) <= b.radius + (enemy.radius || 22)) {
                        b.hitIds.add(enemy.id);
                        this._applyDamageToEnemy(enemy, b.damage, b.angle, 160, b.color, 'iron_sword', 'finisher');
                    }
                }

                if (b.traveled >= b.maxDistance) {
                    b.active = false;
                }
            } else if (b.subType === 'shuriken') {
                b.rotation += dt * 26;

                if (!b.returning) {
                    const moveStep = Math.hypot(b.vx, b.vy) * dt;
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    b.traveled += moveStep;

                    for (let j = 0; j < activeEnemies.length; j++) {
                        const enemy = activeEnemies[j];
                        if (!enemy || enemy.dead || enemy.hp <= 0 || b.hitIds.has(enemy.id)) continue;
                        if (Math.hypot(enemy.x - b.x, enemy.y - b.y) <= b.radius + (enemy.radius || 20)) {
                            b.hitIds.add(enemy.id);
                            this._applyDamageToEnemy(enemy, b.damage, Math.atan2(b.vy, b.vx), 95, b.color, b.weaponKey, 'finisher');

                            const bleed = this._getFreeBleedEffect();
                            if (bleed) {
                                bleed.enemy = enemy;
                                bleed.ticksLeft = 3;
                                bleed.tickTimer = 0.45;
                                bleed.damage = b.bleedDamage;
                                bleed.weaponKey = b.weaponKey;
                            }
                        }
                    }

                    if (b.traveled >= b.maxDistance) {
                        b.returning = true;
                    }
                } else {
                    const targetX = player ? player.x : b.x;
                    const targetY = player ? player.y : b.y;
                    const dx = targetX - b.x;
                    const dy = targetY - b.y;
                    const distToPlayer = Math.hypot(dx, dy);
                    const step = (b.returnSpeed || 820) * dt;

                    if (distToPlayer <= step || distToPlayer <= 22) {
                        this._spawnParticles(b.x, b.y, '#f59e0b', 4, 90);
                        b.active = false;
                        continue;
                    }

                    b.x += (dx / distToPlayer) * step;
                    b.y += (dy / distToPlayer) * step;

                    const returnDamage = Math.round(b.damage * 0.65);
                    for (let j = 0; j < activeEnemies.length; j++) {
                        const enemy = activeEnemies[j];
                        if (!enemy || enemy.dead || enemy.hp <= 0 || b.returnHitIds.has(enemy.id)) continue;
                        if (Math.hypot(enemy.x - b.x, enemy.y - b.y) <= b.radius + (enemy.radius || 20)) {
                            b.returnHitIds.add(enemy.id);
                            this._applyDamageToEnemy(enemy, returnDamage, Math.atan2(dy, dx), 120, '#ec4899', b.weaponKey, 'finisher');
                        }
                    }
                }
            } else if (b.subType === 'deflected') {
                const moveStep = Math.hypot(b.vx, b.vy) * dt;
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.traveled += moveStep;

                for (let j = 0; j < activeEnemies.length; j++) {
                    const enemy = activeEnemies[j];
                    if (!enemy || enemy.dead || enemy.hp <= 0 || b.hitIds.has(enemy.id)) continue;
                    if (Math.hypot(enemy.x - b.x, enemy.y - b.y) <= b.radius + (enemy.radius || 20)) {
                        b.hitIds.add(enemy.id);
                        this._applyDamageToEnemy(enemy, b.damage, Math.atan2(b.vy, b.vx), 180, b.color, b.weaponKey, 'finisher');
                        this._spawnParticles(b.x, b.y, '#00f2fe', 10, 160);
                        b.active = false;
                        break;
                    }
                }

                if (b.traveled >= b.maxDistance) {
                    b.active = false;
                }
            }
        }

        // 6. Cập nhật Hiệu ứng Chảy Máu (Bleed Effects)
        for (let i = 0; i < this.bleedEffects.length; i++) {
            const bl = this.bleedEffects[i];
            if (!bl.active) continue;
            if (!bl.enemy || bl.enemy.dead || bl.enemy.hp <= 0 || bl.ticksLeft <= 0) {
                bl.active = false;
                continue;
            }
            bl.tickTimer -= dt;
            if (bl.tickTimer <= 0) {
                bl.tickTimer = 0.45;
                bl.ticksLeft--;
                this._spawnParticles(bl.enemy.x, bl.enemy.y, '#ef4444', 5, 90);
                if (window.Game.Enemies && typeof window.Game.Enemies.damageEnemy === 'function') {
                    window.Game.Enemies.damageEnemy(bl.enemy, bl.damage, false, false, true);
                }
            }
        }

        // 7. Cập nhật Vùng Dung Nham Địa Chấn
        for (let i = 0; i < this.magmaZones.length; i++) {
            const mz = this.magmaZones[i];
            if (!mz.active) continue;
            mz.life -= dt;
            mz.tickTimer -= dt;

            if (mz.tickTimer <= 0) {
                mz.tickTimer = 0.45;
                for (let j = 0; j < activeEnemies.length; j++) {
                    const enemy = activeEnemies[j];
                    if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                    if (Math.hypot(enemy.x - mz.x, enemy.y - mz.y) <= mz.radius + (enemy.radius || 20)) {
                        this._applyDamageToEnemy(enemy, mz.tickDamage, Math.atan2(mz.y - enemy.y, mz.x - enemy.x), 20, '#ea580c', mz.weaponKey, 'storm');
                    }
                }
            }

            if (mz.life <= 0) mz.active = false;
        }

        // 8. Cập nhật Hố Đen Hư Không
        for (let i = 0; i < this.blackHoles.length; i++) {
            const bh = this.blackHoles[i];
            if (!bh.active) continue;
            bh.life -= dt;
            bh.tickTimer -= dt;

            for (let j = 0; j < activeEnemies.length; j++) {
                const enemy = activeEnemies[j];
                if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                const dx = bh.x - enemy.x;
                const dy = bh.y - enemy.y;
                const dist = Math.hypot(dx, dy);

                if (dist <= bh.radius && dist > 14) {
                    const pull = (bh.pullSpeed * (1 - dist / bh.radius) + 35) * dt;
                    const pullX = enemy.x + (dx / dist) * pull;
                    const pullY = enemy.y + (dy / dist) * pull;
                    if (!window.Game.World || typeof window.Game.World.canMoveTo !== 'function' || window.Game.World.canMoveTo(pullX, pullY)) {
                        enemy.x = pullX;
                        enemy.y = pullY;
                    }
                }

                if (bh.tickTimer <= 0 && dist <= bh.radius * 0.75) {
                    this._applyDamageToEnemy(enemy, bh.damage, Math.atan2(dy, dx), 30, bh.color, 'void_scythe', 'finisher');
                }
            }

            if (bh.tickTimer <= 0) {
                if (bh.isAscendedFinisher) {
                    this._spawnSpaceLightningBurst(bh.x, bh.y, '#00f2fe', 3, bh.radius * 0.7);
                }
                bh.tickTimer = 0.22;
            }

            if (bh.life <= 0) bh.active = false;
        }

        // 9. Cập nhật các hiệu ứng hiển thị tĩnh (Thu hồi pool qua cờ active)
        for (let i = 0; i < this.crossFlashes.length; i++) {
            if (this.crossFlashes[i].active && (this.crossFlashes[i].life -= dt) <= 0) {
                this.crossFlashes[i].active = false;
            }
        }
        for (let i = 0; i < this.afterimages.length; i++) {
            if (this.afterimages[i].active && (this.afterimages[i].life -= dt) <= 0) {
                this.afterimages[i].active = false;
            }
        }
        for (let i = 0; i < this.slashes.length; i++) {
            const s = this.slashes[i];
            if (s.active) {
                if (player && !s.isDashSprite) {
                    s.x = player.x;
                    s.y = player.y;
                }
                if ((s.life -= dt) <= 0) s.active = false;
            }
        }
        for (let i = 0; i < this.laserBeams.length; i++) {
            if (this.laserBeams[i].active && (this.laserBeams[i].life -= dt) <= 0) {
                this.laserBeams[i].active = false;
            }
        }
        for (let i = 0; i < this.shockwaves.length; i++) {
            const sw = this.shockwaves[i];
            if (sw.active) {
                sw.life -= dt;
                sw.radius = 20 + (sw.maxRadius - 20) * (1 - Math.max(0, sw.life / sw.maxLife));
                if (sw.life <= 0) sw.active = false;
            }
        }
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.active) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= 0.92;
                p.vy *= 0.92;
                if ((p.life -= dt) <= 0) p.active = false;
            }
        }
        for (let i = 0; i < this.floatingTexts.length; i++) {
            const ft = this.floatingTexts[i];
            if (ft.active) {
                ft.x += ft.vx * dt;
                ft.y += ft.vy * dt;
                ft.vy += 95 * dt;
                if ((ft.life -= dt) <= 0) ft.active = false;
            }
        }
    },

    // ------------------------------------------------------------------------
    // RENDER CANVAS 60 FPS CHO MOBILE (ZERO SHADOWBLUR, INT COORDINATES (x|0))
    // ------------------------------------------------------------------------
    draw: function (ctx, camera) {
        const camX = ((camera && camera.x) || 0) | 0;
        const camY = ((camera && camera.y) || 0) | 0;
        const now = performance.now() * 0.001;

        ctx.save();

        // 0. Vùng Dung Nham Địa Chấn
        for (let i = 0; i < this.magmaZones.length; i++) {
            const mz = this.magmaZones[i];
            if (!mz.active) continue;

            const alpha = Math.min(0.65, (mz.life / mz.maxLife) * 0.75);
            const posX = (mz.x - camX) | 0;
            const posY = (mz.y - camY) | 0;
            const r = mz.radius | 0;

            ctx.save();
            ctx.translate(posX, posY);
            ctx.fillStyle = `rgba(234, 88, 12, ${alpha * 0.45})`;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(253, 224, 71, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([14, 10]);
            ctx.beginPath();
            ctx.arc(0, 0, (r * 0.92) | 0, now * 2, now * 2 + Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 0b. Tàn Dư Thời Không (Vòng xoáy chờ kích hoạt chém)
        for (let i = 0; i < this.spacetimeEchoes.length; i++) {
            const echo = this.spacetimeEchoes[i];
            if (!echo.active) continue;

            const posX = (echo.x - camX) | 0;
            const posY = (echo.y - camY) | 0;
            const alpha = Math.max(0, echo.life / echo.maxLife);

            ctx.save();
            ctx.translate(posX, posY);
            ctx.globalAlpha = alpha * 0.65;
            ctx.fillStyle = echo.color;
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();

            // Hiệu ứng phát sáng bằng vòng tròn mờ (Thay thế shadowBlur)
            ctx.globalAlpha = alpha * 0.25;
            ctx.beginPath();
            ctx.arc(0, 0, 36, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = alpha * 0.85;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(0, 0, ((echo.radius * (1 - alpha * 0.35)) | 0), now * 4, now * 4 + Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 1. Hố Đen Hư Không
        for (let i = 0; i < this.blackHoles.length; i++) {
            const bh = this.blackHoles[i];
            if (!bh.active) continue;

            const posX = (bh.x - camX) | 0;
            const posY = (bh.y - camY) | 0;
            const r = bh.radius | 0;

            ctx.save();
            ctx.translate(posX, posY);
            ctx.rotate(-now * 4.5);
            ctx.strokeStyle = bh.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, (r * 0.85) | 0, 0, Math.PI * 1.5);
            ctx.stroke();

            // Quầng sáng mờ quanh tâm hố đen (thay cho shadowBlur)
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = bh.color;
            ctx.beginPath();
            ctx.arc(0, 0, 32, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 2. Bóng Mờ (Afterimages)
        for (let i = 0; i < this.afterimages.length; i++) {
            const g = this.afterimages[i];
            if (!g.active) continue;

            const posX = (g.x - camX) | 0;
            const posY = (g.y - camY) | 0;

            ctx.save();
            ctx.translate(posX, posY);
            ctx.rotate(g.angle);
            ctx.globalAlpha = Math.max(0, (g.life / g.maxLife) * 0.65);
            ctx.fillStyle = g.color;
            ctx.beginPath();
            ctx.arc(0, 0, g.radius | 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 3. Sóng Xung Kích (Shockwaves)
        for (let i = 0; i < this.shockwaves.length; i++) {
            const sw = this.shockwaves[i];
            if (!sw.active) continue;

            const alpha = Math.max(0, sw.life / sw.maxLife);
            const posX = (sw.x - camX) | 0;
            const posY = (sw.y - camY) | 0;
            const r = sw.radius | 0;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = (6 * alpha + 2) | 0;
            ctx.beginPath();
            ctx.arc(posX, posY, r, 0, Math.PI * 2);
            ctx.stroke();

            // Glow mờ lan tỏa
            ctx.globalAlpha = alpha * 0.2;
            ctx.lineWidth = (12 * alpha + 4) | 0;
            ctx.stroke();
            ctx.restore();
        }

        // 4. Các Loại Đạn (Bullets / Crescent Waves / Shurikens / Deflected Bullets)
        for (let i = 0; i < this.bullets.length; i++) {
            const b = this.bullets[i];
            if (!b.active) continue;

            const posX = (b.x - camX) | 0;
            const posY = (b.y - camY) | 0;

            ctx.save();
            ctx.translate(posX, posY);

            if (b.subType === 'cannon') {
                const r = b.radius | 0;
                // Lớp quầng sáng ngoài (Thay shadowBlur)
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = b.glow;
                ctx.beginPath();
                ctx.arc(0, 0, (r * 1.6) | 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 0.85;
                ctx.fillStyle = b.glow;
                ctx.beginPath();
                ctx.arc(0, 0, (r * 1.25) | 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 1.0;
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
            } else if (b.subType === 'crescent') {
                ctx.rotate(b.angle);
                const r = b.radius | 0;
                ctx.fillStyle = b.glow;
                ctx.strokeStyle = b.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, r, -Math.PI * 0.42, Math.PI * 0.42);
                ctx.arc((-r * 0.45) | 0, 0, (r * 0.7) | 0, Math.PI * 0.4, -Math.PI * 0.4, true);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (b.subType === 'shuriken') {
                ctx.rotate(b.rotation);
                const r = b.radius | 0;
                ctx.fillStyle = b.returning ? '#ec4899' : b.color;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let arm = 0; arm < 4; arm++) {
                    const ba = (arm * Math.PI) / 2;
                    ctx.lineTo((Math.cos(ba) * r) | 0, (Math.sin(ba) * r) | 0);
                    ctx.lineTo((Math.cos(ba + 0.4) * (r * 0.35)) | 0, (Math.sin(ba + 0.4) * (r * 0.35)) | 0);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (b.subType === 'deflected') {
                // Đạn phản đòn: vòng sáng sấm sét xanh ngọc
                ctx.rotate(Math.atan2(b.vy, b.vx));
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = '#00f2fe';
                ctx.beginPath();
                ctx.arc(0, 0, 16, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 1.0;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#00f2fe';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-18, 0);
                ctx.lineTo(18, 0);
                ctx.stroke();
            }
            ctx.restore();
        }

        // 5. Vệt Chém (SpriteSheet 12-Frame: chem_2.jpg & luot_chem_2.jpg)
        for (let i = 0; i < this.slashes.length; i++) {
            const s = this.slashes[i];
            if (!s.active) continue;

            const sheetKey = s.isDashSprite ? 'dashSlash' : 'slash';
            const sheet = this.spriteSheets && this.spriteSheets[sheetKey];
            const posX = (s.x - camX) | 0;
            const posY = (s.y - camY) | 0;

            ctx.save();
            const progress = 1 - Math.max(0, Math.min(1, s.life / (s.maxLife || 0.24)));

            if (sheet && sheet.loaded && sheet.img && !s.isScythe) {
                const totalFrames = sheet.cols * sheet.rows; // 12 frames
                const frameIdx = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
                const col = frameIdx % sheet.cols;
                const row = Math.floor(frameIdx / sheet.cols);

                const fw = (sheet.img.width / sheet.cols) | 0;
                const fh = (sheet.img.height / sheet.rows) | 0;

                const padX = 4;
                const padY = 4;
                const sx = (col * fw + padX) | 0;
                const sy = (row * fh + padY) | 0;
                const sw = (fw - padX * 2 - (frameIdx === 11 ? 18 : 0)) | 0;
                const sh = (fh - padY * 2) | 0;

                ctx.translate(posX, posY);
                ctx.rotate(s.angle);

                if (s.swingDir === -1) {
                    ctx.scale(1, -1);
                }

                if (!s.isDashSprite) {
                    ctx.rotate(Math.PI * 0.5); // Bù góc chuẩn diện mạo vung kiếm trước mặt
                }

                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = Math.min(1, (s.life / s.maxLife) * 1.7);

                if (s.isDashSprite) {
                    const renderW = (s.radius * 2.1) | 0;
                    const renderH = (s.radius * 1.55) | 0;
                    ctx.drawImage(
                        sheet.img,
                        sx, sy, sw, sh,
                        ((-renderW * 0.25) | 0), ((-renderH * 0.5) | 0), renderW, renderH
                    );
                } else {
                    const renderSize = (s.radius * 1.95) | 0;
                    ctx.drawImage(
                        sheet.img,
                        sx, sy, sw, sh,
                        ((-renderSize * 0.5) | 0), ((-renderSize * 0.72) | 0), renderSize, renderSize
                    );
                }
            } else {
                ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
                ctx.beginPath();
                ctx.arc(posX, posY, s.radius | 0, s.angle - s.arc * 0.5, s.angle + s.arc * 0.5);
                ctx.strokeStyle = s.color;
                ctx.lineWidth = s.isCyber ? 6 : 4;
                ctx.stroke();
            }
            ctx.restore();
        }

        // 6. Tia Laser & Tia Sét
        for (let i = 0; i < this.laserBeams.length; i++) {
            const b = this.laserBeams[i];
            if (!b.active) continue;

            const alpha = Math.max(0, b.life / b.maxLife);
            const x1 = (b.x1 - camX) | 0;
            const y1 = (b.y1 - camY) | 0;
            const x2 = (b.x2 - camX) | 0;
            const y2 = (b.y2 - camY) | 0;

            ctx.save();
            ctx.lineCap = 'round';

            // Quầng sáng ngoài (glow)
            ctx.globalAlpha = alpha * 0.35;
            ctx.strokeStyle = b.color;
            ctx.lineWidth = ((b.width * 2) | 0);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Lõi laser sắc nét
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = b.coreColor || '#ffffff';
            ctx.lineWidth = Math.max(1, (b.width * 0.5) | 0);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
        }

        // 7. Tia Chớp Chữ X Chí Mạng (Impact Cross-Flash)
        for (let i = 0; i < this.crossFlashes.length; i++) {
            const cf = this.crossFlashes[i];
            if (!cf.active) continue;

            const alpha = Math.max(0, cf.life / cf.maxLife);
            const posX = (cf.x - camX) | 0;
            const posY = (cf.y - camY) | 0;
            const sz = cf.size | 0;

            ctx.save();
            ctx.translate(posX, posY);
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = cf.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-sz, -sz);
            ctx.lineTo(sz, sz);
            ctx.moveTo(-sz, sz);
            ctx.lineTo(sz, -sz);
            ctx.stroke();
            ctx.restore();
        }

        // 8. Hạt Hiệu Ứng (Particles)
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            const posX = (p.x - camX) | 0;
            const posY = (p.y - camY) | 0;
            const sz = Math.max(1, p.size | 0);

            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(posX, posY, sz, 0, Math.PI * 2);
            ctx.fill();
        }

        // 9. Chữ Số Bay (Floating Damage Numbers)
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < this.floatingTexts.length; i++) {
            const ft = this.floatingTexts[i];
            if (!ft.active) continue;

            const posX = (ft.x - camX) | 0;
            const posY = (ft.y - camY) | 0;

            ctx.save();
            ctx.globalAlpha = Math.min(1, Math.max(0, (ft.life / ft.maxLife) * 1.25));
            ctx.font = ft.isCrit ? '900 22px sans-serif' : 'bold 16px sans-serif';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.strokeText(ft.text, posX, posY);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, posX, posY);
            ctx.restore();
        }

        // 10. Combo Counter, Kill Streak Banner & Thanh Nhiệt Súng Dưới Chân
        const player = window.Game.player;
        if (player) {
            const hx = ((player.x - camX) | 0);
            const hy = ((player.y - camY) | 0);
            const currentWeapon = (window.Game.state && window.Game.state.currentWeapon) || 'iron_sword';

            // Thanh nhiệt Laser Gun khi Heat > 20%
            if (currentWeapon === 'laser_gun' && this.weaponHeat > 20) {
                const heatRatio = Math.min(1, this.weaponHeat / this.maxWeaponHeat);
                const barW = 38;
                const barH = 5;
                const barX = (hx - barW / 2) | 0;
                const barY = (hy + (player.radius || 20) + 10) | 0;

                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

                ctx.fillStyle = heatRatio >= 0.8 ? '#ef4444' : '#f59e0b';
                ctx.fillRect(barX, barY, ((barW * heatRatio) | 0), barH);

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);
                ctx.restore();
            }

            const headerY = (hy - (player.radius || 20) - 36) | 0;
            if (this.comboHits >= 2 && this.comboTimer > 0) {
                const critBonus = Math.min(25, Math.floor(this.comboHits / 10) * 5);
                ctx.save();
                ctx.textAlign = 'center';
                ctx.font = 'italic 900 16px sans-serif';
                ctx.fillStyle = this.comboHits >= 10 ? '#facc15' : '#38bdf8';
                ctx.fillText(`${this.comboHits} COMBO! (+${critBonus}% Crit)`, hx, headerY);
                ctx.restore();
            }

            if (this.killStreakBanner && this.killStreakBanner.life > 0) {
                const kb = this.killStreakBanner;
                ctx.save();
                ctx.translate(hx, (headerY - 28) | 0);
                ctx.scale(kb.scale || 1, kb.scale || 1);
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.strokeStyle = kb.color;
                ctx.lineWidth = 2;
                ctx.strokeRect(-90, -16, 180, 32);
                ctx.fillRect(-90, -16, 180, 32);
                ctx.font = '900 13px sans-serif';
                ctx.fillStyle = kb.color;
                ctx.fillText(kb.title, 0, -3);
                ctx.font = 'bold 9px sans-serif';
                ctx.fillStyle = '#e2e8f0';
                ctx.fillText(kb.subText, 0, 8);
                ctx.restore();
            }
        }

        ctx.restore();
    }
};