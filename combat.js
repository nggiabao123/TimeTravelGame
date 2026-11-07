/**
 * ============================================================================
 * TỰA GAME: KẺ DU HÀNH THỜI KHÔNG (TIME TRAVELER)
 * FILE: combat.js - BẢN NÂNG CẤP SIÊU CẤP TOÀN DIỆN (PRINCIPAL COMBAT SYSTEM)
 * ============================================================================
 * ĐÃ TÍCH HỢP ĐẦY ĐỦ 7 HỆ THỐNG NÂNG CẤP ĐỘT PHÁ:
 * 1. Smart Cone Auto-Aim: Khóa nón góc hẹp (Súng: ±15°, <=230px | Cận chiến: ±38°, <=165px + Lướt 14px).
 * 2. Cân bằng chuyên sâu Vũ khí tầm xa:
 *    - Laser Gun: Damage 88, Range 410, BeamWidth 16, Cơ chế Quá nhiệt (Heat System), Suy giảm xuyên thấu & cự ly.
 *    - Chrono Cannon: Damage 185, Range 430, AoE 92, Speed 580, Sát thương Sweet-Spot tâm nổ, Độ giật lùi 4px.
 * 3. Đại tu Cận chiến:
 *    - Chém tan đạn & Phản xạ đạn (Blade Deflect / Parry Đòn 1-2 phá đạn +3 Nộ, Đòn 3/Cyber Sword phản đòn 180% ST).
 *    - Đòn đánh điểm yếu sau lưng (Backstab Critical x1.45 ST, xuyên khiên Tanker).
 *    - Combo tiến hóa (>=15 Hits: Tăng 12% Tốc đánh & phóng Kiếm khí sấm sét).
 * 4. Nâng cấp bộ kỹ năng 3 nhân vật:
 *    - Time Traveler: Dash để lại Bóng Ma Thời Không nổ 85% ST, Storm hút địch 250px, Freeze kích hoạt Vết Nứt Thời Không +25% ST Chuẩn.
 *    - Shadow Assassin: Shuriken Boomerang tự động quay về người nhân vật gây 65% ST lượt về.
 *    - Iron Juggernaut: Abyss Pháo Đài tạo sóng đẩy lùi đạn và hồi +8 Giáp mỗi nhịp.
 * 5. Hệ thống Canvas VFX 60 FPS:
 *    - Thanh nhiệt súng Laser dưới chân nhân vật khi Heat > 20%.
 *    - Impact Cross-Flash (Tia chớp chữ X) khi kích hoạt Chí mạng.
 *    - Giữ nguyên vẹn 100% cấu trúc SpriteSheet 12-frame chuẩn xác cho chem_2.jpg & luot_chem_2.jpg.
 * ============================================================================
 */

window.Game = window.Game || {};

window.Game.Combat = {
    // Bộ quản lý Sprite Sheet 12 frame (4 cột x 3 hàng)
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

    // CÂN BẰNG THÔNG SỐ VŨ KHÍ TẦM XA & CẬN CHIẾN THEO YÊU CẦU MỚI
    weapons: {
        iron_sword: { name: 'Kiếm Sắt', damage: 25, range: 95, arc: Math.PI * 0.75, color: '#f8fafc', glow: '#f39c12', type: 'melee' },
        cyber_sword: { name: 'Kiếm Điện Tử', damage: 80, range: 135, arc: Math.PI * 1.15, color: '#00f2fe', glow: '#06b6d4', type: 'cyber_melee' },
        laser_gun: { name: 'Súng Laser', damage: 88, range: 410, beamWidth: 16, color: '#ff0844', glow: '#fb7185', type: 'laser' },
        void_scythe: { name: 'Lưỡi Hái Hư Không', damage: 210, range: 165, arc: Math.PI * 2, color: '#a855f7', glow: '#6b21a8', type: 'scythe', lifesteal: 0.04 },
        chrono_cannon: { name: 'Pháo Năng Lượng Thời Không', damage: 185, range: 430, aoeRadius: 92, speed: 580, color: '#00f2fe', glow: '#fbbf24', type: 'cannon' }
    },

    // Quản lý các đối tượng Combat Entity
    slashes: [],
    laserBeams: [],
    shockwaves: [],
    particles: [],
    floatingTexts: [],
    afterimages: [],
    cannonBalls: [],
    crescentWaves: [],
    blackHoles: [],
    shurikens: [],
    magmaZones: [],
    bleedEffects: [],
    chronoPhantoms: [],
    crossFlashes: [],
    dashState: null,

    // Trạng thái hiệu ứng Buff & Hệ thống Nhiệt độ Súng
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

    init: function () {
        this._initSpriteSheets();

        this.slashes = [];
        this.laserBeams = [];
        this.shockwaves = [];
        this.particles = [];
        this.floatingTexts = [];
        this.afterimages = [];
        this.cannonBalls = [];
        this.crescentWaves = [];
        this.blackHoles = [];
        this.shurikens = [];
        this.magmaZones = [];
        this.bleedEffects = [];
        this.chronoPhantoms = [];
        this.crossFlashes = [];
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

    // ========================================================================
    // 1. SMART CONE AUTO-AIM (CHỈ AIM TRONG HÌNH NÓN HẸP TRƯỚC MẶT)
    // ========================================================================
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
            maxAllowedAngle = (15 * Math.PI) / 180; // Nón hẹp ±15 độ
        } else if (isMelee) {
            searchRadius = Math.min(165, maxRange || 165);
            maxAllowedAngle = (38 * Math.PI) / 180; // Nón ±38 độ
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

            // Bỏ qua nếu kẻ địch nằm ngoài hình nón quy định
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

        // Không tìm thấy mục tiêu trong nón: Bắn thẳng theo hướng nhìn
        return currentFacingAngle;
    },

    // ========================================================================
    // 3. ĐẠI TU VŨ KHÍ CẬN CHIẾN: CHÉM TAN & PHẢN XẠ ĐẠN (BLADE DEFLECT / PARRY)
    // ========================================================================
    _checkMeleeBulletDeflect: function (player, slashAngle, slashRadius, slashArc, isThirdHit, weaponKey) {
        const enemiesModule = window.Game.Enemies;
        if (!enemiesModule || !Array.isArray(enemiesModule.projectiles) || enemiesModule.projectiles.length === 0) return;

        const projectiles = enemiesModule.projectiles;
        const currentTimeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
        const baseDmg = this._calculateBaseDamage(weaponKey, this._getCurrentWeaponConfig());
        let deflectedCount = 0;

        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            if (!proj) continue;
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
                    projectiles.splice(i, 1);
                    deflectedCount++;

                    const state = window.Game.state || {};

                    if (isThirdHit || weaponKey === 'cyber_sword') {
                        // ĐÒN 3 HOẶC KIẾM ĐIỆN TỬ: PHẢN XẠ ĐẠN GÂY 180% SÁT THƯƠNG
                        state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 6);
                        this.spawnFloatingText(px, py - 20, '⚔️ PHẢN ĐẠN!', '#00f2fe', true);
                        this._spawnParticles(px, py, '#00f2fe', 14, 210);
                        this._spawnParticles(px, py, '#fde047', 10, 180);

                        // Tìm kẻ địch gần nhất để phóng tia phản đòn
                        let nearestEnemy = null;
                        let minDist = 450;
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

                        const targetX = nearestEnemy ? nearestEnemy.x : (px + Math.cos(slashAngle) * 280);
                        const targetY = nearestEnemy ? nearestEnemy.y : (py + Math.sin(slashAngle) * 280);

                        this.laserBeams.push({
                            x1: px, y1: py, x2: targetX, y2: targetY,
                            color: '#00f2fe', coreColor: '#ffffff', width: 9, isLightning: true,
                            life: 0.22, maxLife: 0.22
                        });

                        if (nearestEnemy) {
                            const reflectDmg = Math.round(baseDmg * 1.80);
                            this._applyDamageToEnemy(nearestEnemy, reflectDmg, Math.atan2(targetY - py, targetX - px), 170, '#00f2fe', weaponKey, 'finisher');
                        }
                    } else {
                        // ĐÒN 1 & 2: CHÉM VỠ ĐẠN, HỒI +3 NỘ & TIA LỬA KIM LOẠI
                        state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 3);
                        this._spawnParticles(px, py, '#fde047', 9, 160);
                        this._spawnParticles(px, py, '#ffffff', 6, 130);
                        this.spawnFloatingText(px, py - 18, '+3 Nộ (Phá Đạn)', '#fde047');
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
            this.laserBeams.push({
                x1: x, y1: y,
                x2: x + Math.cos(angle) * dist,
                y2: y + Math.sin(angle) * dist,
                color: primaryColor || '#00f2fe',
                coreColor: '#fde047',
                width: 7,
                isLightning: true,
                life: 0.28,
                maxLife: 0.28
            });
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

        const skills = this.getActiveSkills();
        const skill = skills[skillIndex];
        if (!skill) return;

        const player = window.Game.player;
        if (!player || player.hp <= 0) return;

        const state = window.Game.state || {};
        const opts = options || {};

        if (state.adminNoCd === true) {
            skills.forEach(s => s.cd = 0);
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
            // ÁP DỤNG SMART CONE AIM THEO GÓC NHỎ TRƯỚC MẶT
            fireAngle = this._applyMicroAutoAim(player, effectiveSearchRange, false, weaponKey);
        }

        const overdriveCdMult = (this.overdriveTimer > 0 && skillIndex === 0) ? 0.6 : 1.0;
        // Combo >= 15 Hits: Tăng +12% tốc đánh (giảm thời gian hồi chiêu thường 12%)
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

        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            if (!proj) continue;
            if (proj.timeline !== 'ALL' && proj.timeline !== currentTimeline) continue;

            if (Math.hypot(proj.x - player.x, proj.y - player.y) <= (radiusBonus || 68) + (proj.radius || 6)) {
                this._spawnParticles(proj.x, proj.y, '#00f2fe', 6, 150);
                projectiles.splice(i, 1);
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

    // ========================================================================
    // KỸ NĂNG RIÊNG CỦA SHADOW ASSASSIN (NỮ SÁT THỦ BÓNG ĐÊM)
    // ========================================================================
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

        this.laserBeams.push({
            x1: startX, y1: startY, x2: finalX, y2: finalY,
            color: '#ec4899', coreColor: '#ffffff', width: 12, life: 0.25, maxLife: 0.25
        });

        this._spawnAfterimage(player, angle + Math.PI, '#00f2fe');
        this.slashes.push({
            x: player.x, y: player.y, angle: angle, radius: 135, arc: Math.PI * 1.4,
            color: '#ec4899', glow: '#00f2fe', isCyber: true,
            isDashSprite: true, swingDir: 1,
            life: 0.30, maxLife: 0.30
        });

        // Chém tan đạn trên đường dịch chuyển
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

    // Chiêu 2 Sát thủ: Phi Đao Ma Quái (Boomerang Return)
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
            this.shurikens.push({
                x: player.x + Math.cos(bladeAngle) * 24,
                y: player.y + Math.sin(bladeAngle) * 24,
                vx: Math.cos(bladeAngle) * 760,
                vy: Math.sin(bladeAngle) * 760,
                rotation: 0,
                traveled: 0,
                maxDistance: 410,
                radius: 18,
                damage: Math.round(baseDmg * 1.35),
                bleedDamage: Math.round(baseDmg * 0.28),
                returning: false,
                returnSpeed: 820,
                color: enhanced.isAscended ? enhanced.color : '#f59e0b',
                glow: enhanced.isAscended ? enhanced.glow : '#ec4899',
                weaponKey: weaponKey,
                hitIds: new Set(),
                returnHitIds: new Set()
            });
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

        this.shockwaves.push({ x: player.x, y: player.y, radius: 20, maxRadius: 520, color: '#f43f5e', life: 0.45, maxLife: 0.45 });
        this.spawnFloatingText(player.x, player.y - 48, '🌌 ÁN TỬ HƯ VÔ! (QUÁ TẢI +40% TỐC ĐÁNH / +35% CRIT)', '#f43f5e', true);

        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        for (let i = 0; i < activeEnemies.length; i++) {
            const enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist <= 520) {
                this.laserBeams.push({
                    x1: player.x, y1: player.y, x2: enemy.x, y2: enemy.y,
                    color: '#f43f5e', coreColor: '#fde047', width: 9, life: 0.35, maxLife: 0.35
                });
                this._spawnParticles(enemy.x, enemy.y, '#f43f5e', 12, 200);
                this._applyDamageToEnemy(enemy, Math.round(baseDmg * 3.1), Math.atan2(enemy.y - player.y, enemy.x - player.x), 150, '#f43f5e', weaponKey, 'storm');
            }
        }
    },

    // ========================================================================
    // KỸ NĂNG RIÊNG CỦA IRON JUGGERNAUT (HỘ VỆ TINH VÂN)
    // ========================================================================
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

        this.slashes.push({
            x: player.x, y: player.y, angle: angle, radius: 135, arc: Math.PI,
            color: '#f59e0b', glow: '#fde047', isCyber: true,
            isDashSprite: true, swingDir: 1,
            life: 0.30, maxLife: 0.30
        });

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

        this.shockwaves.push({
            x: player.x, y: player.y, radius: 20, maxRadius: slamRadius, color: '#ea580c', life: 0.45, maxLife: 0.45
        });

        this.magmaZones.push({
            x: player.x,
            y: player.y,
            radius: slamRadius,
            life: 4.0,
            maxLife: 4.0,
            tickTimer: 0.4,
            tickDamage: Math.round(baseDmg * 0.45),
            weaponKey: weaponKey
        });

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

    // Chiêu 3 Hộ Vệ Tinh Vân: Pháo Đài Bất Diệt
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
        this.shockwaves.push({ x: player.x, y: player.y, radius: 20, maxRadius: 360, color: '#3b82f6', life: 0.55, maxLife: 0.55 });
        this.shockwaves.push({ x: player.x, y: player.y, radius: 15, maxRadius: 280, color: '#f59e0b', life: 0.45, maxLife: 0.45 });
        this.spawnFloatingText(player.x, player.y - 48, '🌟 PHÁO ĐÀI BẤT DIỆT! (FULL KHIÊN + SÉT HỘ THỂ 7s)', '#38bdf8', true);
    },

    // ========================================================================
    // ĐÒN ĐÁNH THƯỜNG & KỸ NĂNG CỦA TIME TRAVELER
    // ========================================================================
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

        const damageMult = isThirdHit ? 1.45 : 1.0;
        const rangeMult = (isThirdHit ? 1.25 : 1.0) * ascensionSizeMult;
        let baseDmg = this._calculateBaseDamage(weaponKey, weapon) * damageMult;
        const enhanced = this._getEnhancedColors(weaponKey, weapon);

        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        // --------------------------------------------------------------------
        // 2. CÂN BẰNG SÚNG LASER (QUÁ NHIỆT & SUY GIẢM XUYÊN THẤU)
        // --------------------------------------------------------------------
        if (weaponKey === 'laser_gun') {
            if (window.Game.Audio && typeof window.Game.Audio.playLaser === 'function') {
                window.Game.Audio.playLaser();
            }

            // Tăng nhiệt độ
            this.weaponHeat = Math.min(this.maxWeaponHeat, (this.weaponHeat || 0) + 28);
            const isOverheated = this.weaponHeat >= 80;

            let actualAngle = angle;
            let heatDmgMult = 1.0;

            if (isOverheated) {
                // Lệch góc bắn ngẫu nhiên ±0.14 rad
                const angleSpread = (Math.random() - 0.5) * 0.28;
                actualAngle += angleSpread;
                // Giảm 35% sát thương
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

            this.laserBeams.push({
                x1: startX, y1: startY, x2: endX, y2: endY,
                color: isOverheated ? '#ff3b30' : enhanced.color,
                coreColor: isThirdHit ? '#fde047' : '#ffffff',
                width: (isThirdHit ? 24 : 14) * ascensionSizeMult,
                life: isThirdHit ? 0.34 : 0.22,
                maxLife: isThirdHit ? 0.34 : 0.22
            });

            if (isThirdHit) {
                const aoeEndRadius = Math.round(115 * ascensionSizeMult);
                this.shockwaves.push({
                    x: endX, y: endY, radius: 15, maxRadius: aoeEndRadius, color: enhanced.color, life: 0.35, maxLife: 0.35
                });
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

            // Thu thập và sắp xếp các quái trúng tia laser theo cự ly từ gần đến xa (Pierce & Distance Falloff)
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
                if (rank === 1) pierceMult = 0.65; // Quái thứ 2 nhận 65%
                else if (rank >= 2) pierceMult = 0.40; // Quái thứ 3 trở đi nhận 40%

                // Giảm thêm 25% nếu cự ly ngoài 260px
                const distMult = (item.dist > 260) ? 0.75 : 1.0;
                const finalLaserDmg = Math.round(baseDmg * heatDmgMult * pierceMult * distMult);

                this._applyDamageToEnemy(item.enemy, finalLaserDmg, actualAngle, isThirdHit ? 140 : 80, enhanced.color, weaponKey, 'attack');
            }
            return;
        }

        // --------------------------------------------------------------------
        // 2. CÂN BẰNG PHÁO NĂNG LƯỢNG THỜI KHÔNG (CHRONO CANNON)
        // --------------------------------------------------------------------
        if (weaponKey === 'chrono_cannon') {
            if (window.Game.Audio && typeof window.Game.Audio.playLaser === 'function') {
                window.Game.Audio.playLaser();
            }

            // Hiệu ứng giật lùi nhẹ 4px cho người chơi khi khai hỏa
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

            this.cannonBalls.push({
                x: startX, y: startY, targetX, targetY, angle,
                speed: weapon.speed || 580,
                radius: (isThirdHit ? 18 : 13) * ascensionSizeMult,
                aoeRadius, damage: baseDmg,
                color: enhanced.isAscended ? enhanced.color : '#00f2fe',
                glow: enhanced.isAscended ? enhanced.glow : '#fbbf24',
                weaponKey, isThirdHit, isAscendedFinisher
            });

            if (isAscendedFinisher) {
                this._spawnSpaceLightningBurst(startX, startY, enhanced.color, 4, 90);
            }
            this._spawnParticles(startX, startY, enhanced.particle || '#fbbf24', 10, 140);
            return;
        }

        // --------------------------------------------------------------------
        // 3. VŨ KHÍ CẬN CHIẾN (MICRO-STEP LUNGE 14PX, CHÉM PHẢN ĐẠN, COMBO TIẾN HÓA)
        // --------------------------------------------------------------------
        if (window.Game.Audio && typeof window.Game.Audio.playSlash === 'function') {
            window.Game.Audio.playSlash();
        }

        // Micro-Step Lunge: Lướt nhẹ 14px về phía trước khi vung kiếm
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
        this.slashes.push({
            x: player.x, y: player.y, angle, radius: effectiveRange, arc: effectiveArc,
            color: isScythe && !enhanced.isAscended ? '#a855f7' : enhanced.color,
            glow: isScythe && !enhanced.isAscended ? '#6b21a8' : enhanced.glow,
            isCyber: isCyber || isScythe, isScythe, isAscendedFinisher,
            isDashSprite: false,
            comboStep, swingDir: comboStep === 1 ? -1 : 1,
            life: slashDuration, maxLife: slashDuration
        });

        // Kiểm tra phản đạn / phá đạn của quái
        this._checkMeleeBulletDeflect(player, angle, effectiveRange, effectiveArc, isThirdHit, weaponKey);

        const tipX = player.x + Math.cos(angle) * (effectiveRange * 0.75);
        const tipY = player.y + Math.sin(angle) * (effectiveRange * 0.75);

        if (isAscendedFinisher) {
            this._spawnSpaceLightningBurst(tipX, tipY, enhanced.color, 6, effectiveRange * 0.95);
        }

        // Combo >= 15 Hits: Tự động phóng thêm tia chớp kiếm khí nhỏ
        if (this.comboHits >= 15) {
            this._spawnSpaceLightningBurst(tipX, tipY, '#38bdf8', 3, 75);
            this.crescentWaves.push({
                x: player.x + Math.cos(angle) * 26,
                y: player.y + Math.sin(angle) * 26,
                vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720,
                angle, traveled: 0, maxDistance: 240,
                radius: 28, damage: Math.round(baseDmg * 0.5),
                color: '#38bdf8', glow: '#0284c7',
                isAscendedFinisher: false, hitIds: new Set()
            });
        }

        if ((weaponKey === 'iron_sword' || weaponKey === 'cyber_sword') && isThirdHit) {
            const waveX = player.x + Math.cos(angle) * 32;
            const waveY = player.y + Math.sin(angle) * 32;
            this.crescentWaves.push({
                x: waveX, y: waveY, vx: Math.cos(angle) * 680, vy: Math.sin(angle) * 680,
                angle, traveled: 0, maxDistance: Math.round(310 * ascensionSizeMult),
                radius: Math.round(44 * ascensionSizeMult), damage: Math.round(baseDmg * 1.35),
                color: enhanced.color || '#f8fafc', glow: enhanced.glow || '#f39c12',
                isAscendedFinisher, hitIds: new Set()
            });
        }

        if (isScythe && isThirdHit) {
            const bhRadius = Math.round(190 * ascensionSizeMult);
            this.blackHoles.push({
                x: tipX, y: tipY, radius: bhRadius, pullSpeed: 185, duration: 1.25, life: 1.25,
                tickTimer: 0.2, damage: Math.round(baseDmg * 0.4),
                color: enhanced.isAscended ? enhanced.color : '#a855f7',
                glow: enhanced.isAscended ? enhanced.glow : '#6b21a8',
                isAscendedFinisher
            });
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

    // 4. KỸ NĂNG DASH CỦA TIME TRAVELER (BÓNG MA THỜI KHÔNG)
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

        // Để lại 1 "Bóng Ma Thời Không" tại vị trí xuất phát tồn tại 1.2s, nổ 85% sát thương
        this.chronoPhantoms.push({
            x: startX,
            y: startY,
            life: 1.2,
            maxLife: 1.2,
            damage: Math.round(baseDmg * 0.85),
            radius: 95,
            color: '#00f2fe',
            weaponKey: weaponKey
        });

        this.slashes.push({
            x: player.x,
            y: player.y,
            angle: angle,
            radius: 140,
            arc: Math.PI,
            color: this.dashState.dashColor,
            glow: '#ffffff',
            isCyber: true,
            isDashSprite: true,
            swingDir: 1,
            life: 0.30,
            maxLife: 0.30
        });

        // Phản đạn / phá đạn khi lướt chém
        this._checkMeleeBulletDeflect(player, angle, 140, Math.PI, true, weaponKey);

        this._spawnAfterimage(player, angle, this.dashState.dashColor);
        this.dashState.afterimagesSpawned = 1;
        this._spawnParticles(player.x, player.y, this.dashState.dashColor, 12, 150);
    },

    _spawnAfterimage: function (player, angle, color) {
        this.afterimages.push({
            x: player.x, y: player.y, angle,
            radius: player.radius || 20,
            weapon: (window.Game.state && window.Game.state.currentWeapon) || 'iron_sword',
            color: color || '#00f2fe', life: 0.38, maxLife: 0.38
        });
    },

    // 4. KỸ NĂNG STORM CỦA TIME TRAVELER (HÚT ĐỊCH VỀ TÂM)
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

        // Hút nhẹ toàn bộ kẻ địch trong bán kính 250px về gần tâm
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

        this.shockwaves.push({
            x: player.x, y: player.y, radius: 25, maxRadius: stormRadius, color: mainColor, life: 0.42, maxLife: 0.42
        });

        this.slashes.push({
            x: player.x, y: player.y, angle: angle, radius: stormRadius * 0.9, arc: Math.PI * 2,
            color: mainColor, glow: enhanced.isAscended ? enhanced.glow : '#ffb199',
            isCyber: true, isScythe: true,
            life: 0.36, maxLife: 0.36
        });

        for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 4;
            this.laserBeams.push({
                x1: player.x, y1: player.y,
                x2: player.x + Math.cos(a) * stormRadius, y2: player.y + Math.sin(a) * stormRadius,
                color: mainColor, coreColor: '#fde047', width: 8, isLightning: true, life: 0.32, maxLife: 0.32
            });
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

    // 4. CHIÊU CUỐI FREEZE (NGƯNG ĐỌNG THỜI GIAN)
    _performChronoFreeze: function (player) {
        const state = window.Game.state;
        if (!state) return;

        state.rage = Math.max(0, (state.rage || 0) - 100);
        state.chronoFreezeTimer = 3.2;

        if (window.Game.Audio && typeof window.Game.Audio.playFreeze === 'function') {
            window.Game.Audio.playFreeze();
        }

        player.screenShake = Math.max(player.screenShake || 0, 0.28);
        this.shockwaves.push({ x: player.x, y: player.y, radius: 20, maxRadius: 1100, color: '#a855f7', life: 0.65, maxLife: 0.65 });
        this.shockwaves.push({ x: player.x, y: player.y, radius: 10, maxRadius: 900, color: '#00f2fe', life: 0.55, maxLife: 0.55 });
        this._spawnParticles(player.x, player.y, '#a855f7', 36, 260);
        this._spawnParticles(player.x, player.y, '#00f2fe', 30, 220);
        this.spawnFloatingText(player.x, player.y - 42, '⏳ NGƯNG ĐỌNG THỜI GIAN (3.2s)!', '#00f2fe', true);
    },

    // ========================================================================
    // TÍNH TOÁN VÀ GÂY SÁT THƯƠNG CHO KẺ ĐỊCH (BACKSTAB, CRIT CROSS-FLASH, VẾT NỨT)
    // ========================================================================
    _applyDamageToEnemy: function (enemy, rawAmount, hitAngle, knockback, hitColor, weaponKey, sourceSkill) {
        if (!enemy || enemy.dead || enemy.hp <= 0) return;

        const player = window.Game.player;
        const state = window.Game.state || {};

        this.comboHits++;
        this.comboTimer = this.comboMaxTimer;

        // 3. ĐÒN ĐÁNH ĐIỂM YẾU SAU LƯNG (BACKSTAB CRITICAL X1.45 ST)
        const isMeleeWeapon = weaponKey === 'iron_sword' || weaponKey === 'cyber_sword' || weaponKey === 'void_scythe';
        const enemyFacing = (typeof enemy.facingAngle === 'number')
            ? enemy.facingAngle
            : (typeof enemy.angle === 'number' ? enemy.angle : Math.atan2(enemy.vy || 0, enemy.vx || 0));

        let isBackstab = false;
        if (isMeleeWeapon) {
            const angleDiffFacing = Math.abs(this._normalizeAngle(enemyFacing - hitAngle));
            // Cùng chiều hướng đòn đánh: tấn công từ phía sau lưng quái
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

        // 4. HIỆU ỨNG VẾT NỨT THỜI KHÔNG TRONG LÚC CHRONO FREEZE (+25% SÁT THƯƠNG CHUẨN)
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

                this.shockwaves.push({ x: enemy.x, y: enemy.y, radius: 25, maxRadius: 280, color: '#00f2fe', life: 0.45, maxLife: 0.45 });
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

        // 5. TIA CHỚP LÓE SÁNG CHỮ X (IMPACT CROSS-FLASH) KHI GÂY CHÍ MẠNG
        if (isCrit) {
            this.crossFlashes.push({
                x: enemy.x,
                y: enemy.y,
                size: (enemy.radius || 20) + 22,
                color: '#fde047',
                life: 0.22,
                maxLife: 0.22
            });

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
        // Backstab xuyên hoàn toàn khiên Tanker
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

    spawnFloatingText: function (x, y, text, color, isCrit) {
        const offsetX = (Math.random() - 0.5) * 24;
        this.floatingTexts.push({
            x: x + offsetX, y, vx: offsetX * 0.85, vy: isCrit ? -85 : -65,
            text: String(text), color: color || '#ffffff', isCrit: Boolean(isCrit),
            life: isCrit ? 1.15 : 0.95, maxLife: isCrit ? 1.15 : 0.95
        });

        if (this.floatingTexts.length > 40) {
            this.floatingTexts.splice(0, this.floatingTexts.length - 40);
        }
    },

    _spawnParticles: function (x, y, color, count, maxSpeed) {
        const speed = maxSpeed || 120;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = (0.25 + Math.random() * 0.75) * speed;
            const life = 0.25 + Math.random() * 0.35;
            this.particles.push({
                x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
                size: 2.5 + Math.random() * 3.5, color: color || '#ffffff', life, maxLife: life
            });
        }
        if (this.particles.length > 130) {
            this.particles.splice(0, this.particles.length - 130);
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

    // 2. SÁT THƯƠNG TÂM NỔ PHÂN TẦNG (SWEET-SPOT AOE CỦA CHRONO CANNON)
    _explodeCannonBall: function (ball) {
        if (window.Game.Audio && typeof window.Game.Audio.playExplosion === 'function') {
            window.Game.Audio.playExplosion();
        }
        if (window.Game.player) {
            window.Game.player.screenShake = Math.max(window.Game.player.screenShake || 0, 0.22);
        }

        this.shockwaves.push({
            x: ball.x, y: ball.y, radius: 15, maxRadius: ball.aoeRadius,
            color: ball.color || '#00f2fe', life: 0.35, maxLife: 0.35
        });

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
                // Kẻ địch ở tâm nhận 100% sát thương, ở rìa chỉ nhận 55%
                const sweetSpotMult = (dist <= sweetSpotDist) ? 1.0 : 0.55;
                const finalCannonDmg = Math.round(ball.damage * sweetSpotMult);
                this._applyDamageToEnemy(enemy, finalCannonDmg, Math.atan2(enemy.y - ball.y, enemy.x - ball.x), 170, ball.color || '#fbbf24', ball.weaponKey, 'finisher');
            }
        }
    },

    update: function (dt) {
        if (window.Game.state && window.Game.state.isPaused) return;

        const skills = this.getActiveSkills();
        if (window.Game.state && window.Game.state.adminNoCd === true) {
            skills.forEach(s => s.cd = 0);
        }

        const player = window.Game.player;
        const activeEnemies = (window.Game.Enemies && typeof window.Game.Enemies.getActiveList === 'function')
            ? window.Game.Enemies.getActiveList()
            : [];

        // Tự động tản nhiệt súng Laser: Giảm 38/s
        if (this.weaponHeat > 0) {
            this.weaponHeat = Math.max(0, this.weaponHeat - dt * 38);
        }

        if (this.overdriveTimer > 0) {
            this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
        }

        // Cập nhật Pháo Đài Bất Diệt (Iron Juggernaut Chiêu 3)
        if (this.fortressTimer > 0 && player) {
            this.fortressTimer = Math.max(0, this.fortressTimer - dt);
            this.fortressPulseTimer -= dt;
            if (this.fortressPulseTimer <= 0) {
                this.fortressPulseTimer = 0.85;
                const weaponKey = (window.Game.state && window.Game.state.currentWeapon) || 'iron_sword';
                const pulseDmg = Math.round(this._calculateBaseDamage(weaponKey, this._getCurrentWeaponConfig()) * 0.65);

                // Hồi +8 Khiên mỗi nhịp xung
                player.shield = Math.min(player.maxShield || 110, (player.shield || 0) + 8);
                this.spawnFloatingText(player.x, player.y - 25, '+8 Khiên', '#38bdf8');

                this.shockwaves.push({
                    x: player.x, y: player.y, radius: 18, maxRadius: 185, color: '#38bdf8', life: 0.28, maxLife: 0.28
                });

                // Đẩy lùi & chém vỡ đạn quái xung quanh
                const enemyProjectiles = (window.Game.Enemies && Array.isArray(window.Game.Enemies.projectiles)) ? window.Game.Enemies.projectiles : [];
                for (let pi = enemyProjectiles.length - 1; pi >= 0; pi--) {
                    const pr = enemyProjectiles[pi];
                    if (pr && Math.hypot(pr.x - player.x, pr.y - player.y) <= 185) {
                        this._spawnParticles(pr.x, pr.y, '#38bdf8', 6, 140);
                        enemyProjectiles.splice(pi, 1);
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

        // Cập nhật Lướt Chém / Khiên Đột Kích
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

        const hasteMult = this.cdHasteTimer > 0 ? 1.35 : 1.0;
        const anomalyMult = Math.max(1.0, this.terrainCdrMultiplier || 1.0);
        const cdRate = hasteMult * anomalyMult;

        for (let i = 0; i < skills.length; i++) {
            if (skills[i].cd > 0) {
                skills[i].cd = Math.max(0, skills[i].cd - dt * cdRate);
            }
        }

        // Cập nhật Bóng Ma Thời Không (Chrono Phantoms)
        for (let i = this.chronoPhantoms.length - 1; i >= 0; i--) {
            const cp = this.chronoPhantoms[i];
            cp.life -= dt;
            if (cp.life <= 0) {
                // Phát nổ gây 85% sát thương
                if (window.Game.Audio && typeof window.Game.Audio.playExplosion === 'function') {
                    window.Game.Audio.playExplosion();
                }
                this.shockwaves.push({
                    x: cp.x, y: cp.y, radius: 15, maxRadius: cp.radius,
                    color: '#00f2fe', life: 0.32, maxLife: 0.32
                });
                this._spawnParticles(cp.x, cp.y, '#00f2fe', 20, 200);
                this._spawnSpaceLightningBurst(cp.x, cp.y, '#00f2fe', 4, cp.radius);

                for (let j = 0; j < activeEnemies.length; j++) {
                    const enemy = activeEnemies[j];
                    if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                    if (Math.hypot(enemy.x - cp.x, enemy.y - cp.y) <= cp.radius + (enemy.radius || 20)) {
                        this._applyDamageToEnemy(enemy, cp.damage, Math.atan2(enemy.y - cp.y, enemy.x - cp.x), 150, '#00f2fe', cp.weaponKey, 'storm');
                    }
                }
                this.chronoPhantoms.splice(i, 1);
            }
        }

        // Cập nhật Phi Đao Ma Quái (Boomerang Return của Shadow Assassin)
        for (let i = this.shurikens.length - 1; i >= 0; i--) {
            const sh = this.shurikens[i];
            sh.rotation += dt * 26;

            if (!sh.returning) {
                const moveStep = Math.hypot(sh.vx, sh.vy) * dt;
                sh.x += sh.vx * dt;
                sh.y += sh.vy * dt;
                sh.traveled += moveStep;

                for (let j = 0; j < activeEnemies.length; j++) {
                    const enemy = activeEnemies[j];
                    if (!enemy || enemy.dead || enemy.hp <= 0 || sh.hitIds.has(enemy.id)) continue;
                    if (Math.hypot(enemy.x - sh.x, enemy.y - sh.y) <= sh.radius + (enemy.radius || 20)) {
                        sh.hitIds.add(enemy.id);
                        this._applyDamageToEnemy(enemy, sh.damage, Math.atan2(sh.vy, sh.vx), 95, sh.color, sh.weaponKey, 'finisher');
                        this.bleedEffects.push({
                            enemy: enemy,
                            ticksLeft: 3,
                            tickTimer: 0.45,
                            damage: sh.bleedDamage,
                            weaponKey: sh.weaponKey
                        });
                    }
                }

                if (sh.traveled >= sh.maxDistance) {
                    sh.returning = true; // Kích hoạt Boomerang quay về
                }
            } else {
                // Quỹ đạo quay ngược về vị trí hiện tại của nhân vật
                const targetX = player ? player.x : sh.x;
                const targetY = player ? player.y : sh.y;
                const dx = targetX - sh.x;
                const dy = targetY - sh.y;
                const distToPlayer = Math.hypot(dx, dy);
                const step = (sh.returnSpeed || 820) * dt;

                if (distToPlayer <= step || distToPlayer <= 22) {
                    this._spawnParticles(sh.x, sh.y, '#f59e0b', 4, 90);
                    this.shurikens.splice(i, 1);
                    continue;
                }

                sh.x += (dx / distToPlayer) * step;
                sh.y += (dy / distToPlayer) * step;

                // Gây thêm 65% sát thương trên đường thu về
                const returnDamage = Math.round(sh.damage * 0.65);
                for (let j = 0; j < activeEnemies.length; j++) {
                    const enemy = activeEnemies[j];
                    if (!enemy || enemy.dead || enemy.hp <= 0 || sh.returnHitIds.has(enemy.id)) continue;
                    if (Math.hypot(enemy.x - sh.x, enemy.y - sh.y) <= sh.radius + (enemy.radius || 20)) {
                        sh.returnHitIds.add(enemy.id);
                        this._applyDamageToEnemy(enemy, returnDamage, Math.atan2(dy, dx), 120, '#ec4899', sh.weaponKey, 'finisher');
                    }
                }
            }
        }

        for (let i = this.bleedEffects.length - 1; i >= 0; i--) {
            const bl = this.bleedEffects[i];
            if (!bl.enemy || bl.enemy.dead || bl.enemy.hp <= 0 || bl.ticksLeft <= 0) {
                this.bleedEffects.splice(i, 1);
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

        for (let i = this.magmaZones.length - 1; i >= 0; i--) {
            const mz = this.magmaZones[i];
            mz.life -= dt;
            mz.tickTimer -= dt;

            if (mz.tickTimer <= 0) {
                mz.tickTimer = 0.45;
                for (let j = 0; j < activeEnemies.length; j++) {
                    const enemy = activeEnemies[j];
                    if (!enemy || enemy.dead || enemy.hp <= 0) continue;
                    const dist = Math.hypot(enemy.x - mz.x, enemy.y - mz.y);
                    if (dist <= mz.radius + (enemy.radius || 20)) {
                        this._applyDamageToEnemy(enemy, mz.tickDamage, Math.atan2(mz.y - enemy.y, mz.x - enemy.x), 20, '#ea580c', mz.weaponKey, 'storm');
                    }
                }
            }

            if (mz.life <= 0) {
                this.magmaZones.splice(i, 1);
            }
        }

        for (let i = this.crescentWaves.length - 1; i >= 0; i--) {
            const wave = this.crescentWaves[i];
            const moveStep = Math.hypot(wave.vx, wave.vy) * dt;
            wave.x += wave.vx * dt;
            wave.y += wave.vy * dt;
            wave.traveled += moveStep;

            for (let j = 0; j < activeEnemies.length; j++) {
                const enemy = activeEnemies[j];
                if (!enemy || enemy.dead || enemy.hp <= 0 || wave.hitIds.has(enemy.id)) continue;
                if (Math.hypot(enemy.x - wave.x, enemy.y - wave.y) <= wave.radius + (enemy.radius || 22)) {
                    wave.hitIds.add(enemy.id);
                    this._applyDamageToEnemy(enemy, wave.damage, wave.angle, 160, wave.color, 'iron_sword', 'finisher');
                }
            }

            if (wave.traveled >= wave.maxDistance) {
                this.crescentWaves.splice(i, 1);
            }
        }

        for (let i = this.blackHoles.length - 1; i >= 0; i--) {
            const bh = this.blackHoles[i];
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

            if (bh.life <= 0) this.blackHoles.splice(i, 1);
        }

        for (let i = this.cannonBalls.length - 1; i >= 0; i--) {
            const ball = this.cannonBalls[i];
            const dx = ball.targetX - ball.x;
            const dy = ball.targetY - ball.y;
            const dist = Math.hypot(dx, dy);
            const moveStep = ball.speed * dt;

            if (dist <= moveStep) {
                ball.x = ball.targetX;
                ball.y = ball.targetY;
                this._explodeCannonBall(ball);
                this.cannonBalls.splice(i, 1);
            } else {
                ball.x += (dx / dist) * moveStep;
                ball.y += (dy / dist) * moveStep;
            }
        }

        for (let i = this.crossFlashes.length - 1; i >= 0; i--) {
            if ((this.crossFlashes[i].life -= dt) <= 0) this.crossFlashes.splice(i, 1);
        }
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            if ((this.afterimages[i].life -= dt) <= 0) this.afterimages.splice(i, 1);
        }
        for (let i = this.slashes.length - 1; i >= 0; i--) {
            if (player) { this.slashes[i].x = player.x; this.slashes[i].y = player.y; }
            if ((this.slashes[i].life -= dt) <= 0) this.slashes.splice(i, 1);
        }
        for (let i = this.laserBeams.length - 1; i >= 0; i--) {
            if ((this.laserBeams[i].life -= dt) <= 0) this.laserBeams.splice(i, 1);
        }
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.life -= dt;
            sw.radius = 20 + (sw.maxRadius - 20) * (1 - Math.max(0, sw.life / sw.maxLife));
            if (sw.life <= 0) this.shockwaves.splice(i, 1);
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.92;
            p.vy *= 0.92;
            if ((p.life -= dt) <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.x += ft.vx * dt;
            ft.y += ft.vy * dt;
            ft.vy += 95 * dt;
            if ((ft.life -= dt) <= 0) this.floatingTexts.splice(i, 1);
        }
    },

    // ========================================================================
    // 5. HỆ THỐNG RENDER CANVAS 60 FPS (VFX, HEAT BAR, CROSS-FLASH, SPRITE SHEET)
    // ========================================================================
    draw: function (ctx, camera) {
        const camX = (camera && camera.x) || 0;
        const camY = (camera && camera.y) || 0;
        const now = performance.now() * 0.001;

        ctx.save();

        // 0. Vùng Dung Nham Địa Chấn (Magma Zones)
        for (let i = 0; i < this.magmaZones.length; i++) {
            const mz = this.magmaZones[i];
            const alpha = Math.min(0.65, (mz.life / mz.maxLife) * 0.75);
            ctx.save();
            ctx.translate(mz.x - camX, mz.y - camY);
            ctx.fillStyle = `rgba(234, 88, 12, ${alpha * 0.45})`;
            ctx.beginPath();
            ctx.arc(0, 0, mz.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(253, 224, 71, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([14, 10]);
            ctx.beginPath();
            ctx.arc(0, 0, mz.radius * 0.92, now * 2, now * 2 + Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 0b. Bóng Ma Thời Không (Chrono Phantoms)
        for (let i = 0; i < this.chronoPhantoms.length; i++) {
            const cp = this.chronoPhantoms[i];
            const alpha = Math.max(0, cp.life / cp.maxLife);
            ctx.save();
            ctx.translate(cp.x - camX, cp.y - camY);
            ctx.globalAlpha = alpha * 0.7;
            ctx.fillStyle = cp.color;
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.arc(0, 0, cp.radius * (1 - alpha * 0.4), now * 3, now * 3 + Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 1. Hố Đen
        for (let i = 0; i < this.blackHoles.length; i++) {
            const bh = this.blackHoles[i];
            ctx.save();
            ctx.translate(bh.x - camX, bh.y - camY);
            ctx.rotate(-now * 4.5);
            ctx.strokeStyle = bh.color;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, bh.radius * 0.85, 0, Math.PI * 1.5);
            ctx.stroke();
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 2. Bóng Mờ (Afterimages)
        for (let i = 0; i < this.afterimages.length; i++) {
            const g = this.afterimages[i];
            ctx.save();
            ctx.translate(g.x - camX, g.y - camY);
            ctx.rotate(g.angle);
            ctx.globalAlpha = Math.max(0, (g.life / g.maxLife) * 0.65);
            ctx.fillStyle = g.color;
            ctx.beginPath();
            ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 3. Sóng Xung Kích
        for (let i = 0; i < this.shockwaves.length; i++) {
            const sw = this.shockwaves[i];
            const alpha = Math.max(0, sw.life / sw.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = 6 * alpha + 2;
            ctx.beginPath();
            ctx.arc(sw.x - camX, sw.y - camY, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 4. Kiếm Khí Bán Nguyệt
        for (let i = 0; i < this.crescentWaves.length; i++) {
            const wave = this.crescentWaves[i];
            ctx.save();
            ctx.translate(wave.x - camX, wave.y - camY);
            ctx.rotate(wave.angle);
            ctx.fillStyle = wave.glow;
            ctx.strokeStyle = wave.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, wave.radius, -Math.PI * 0.42, Math.PI * 0.42);
            ctx.arc(-wave.radius * 0.45, 0, wave.radius * 0.7, Math.PI * 0.4, -Math.PI * 0.4, true);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // 4b. Phi Đao Ma Quái (Shurikens)
        for (let i = 0; i < this.shurikens.length; i++) {
            const sh = this.shurikens[i];
            ctx.save();
            ctx.translate(sh.x - camX, sh.y - camY);
            ctx.rotate(sh.rotation);
            ctx.fillStyle = sh.returning ? '#ec4899' : sh.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let b = 0; b < 4; b++) {
                const ba = (b * Math.PI) / 2;
                ctx.lineTo(Math.cos(ba) * sh.radius, Math.sin(ba) * sh.radius);
                ctx.lineTo(Math.cos(ba + 0.4) * (sh.radius * 0.35), Math.sin(ba + 0.4) * (sh.radius * 0.35));
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // 5. Vệt Chém (Slashes - SpriteSheet 12-Frame chuẩn từ chem_2.jpg & luot_chem_2.jpg)
        for (let i = 0; i < this.slashes.length; i++) {
            const s = this.slashes[i];
            const sheetKey = s.isDashSprite ? 'dashSlash' : 'slash';
            const sheet = this.spriteSheets && this.spriteSheets[sheetKey];

            ctx.save();
            const progress = 1 - Math.max(0, Math.min(1, s.life / (s.maxLife || 0.24)));

            if (sheet && sheet.loaded && sheet.img && !s.isScythe) {
                const totalFrames = sheet.cols * sheet.rows; // 12 frames (4 cột x 3 hàng)
                const frameIdx = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
                const col = frameIdx % sheet.cols;
                const row = Math.floor(frameIdx / sheet.cols);

                const fw = sheet.img.width / sheet.cols;
                const fh = sheet.img.height / sheet.rows;

                // Cắt bỏ viền rìa và watermark frame 11
                const padX = 4;
                const padY = 4;
                const sx = col * fw + padX;
                const sy = row * fh + padY;
                const sw = fw - padX * 2 - (frameIdx === 11 ? 18 : 0);
                const sh = fh - padY * 2;

                ctx.translate(s.x - camX, s.y - camY);
                ctx.rotate(s.angle);

                if (s.swingDir === -1) {
                    ctx.scale(1, -1);
                }

                // Bù góc +90 độ cho chem_2.jpg để vòng cung vung ngang chuẩn diện mạo trước mặt
                if (!s.isDashSprite) {
                    ctx.rotate(Math.PI * 0.5);
                }

                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = Math.min(1, (s.life / s.maxLife) * 1.7);

                if (s.isDashSprite) {
                    const renderW = s.radius * 2.1;
                    const renderH = s.radius * 1.55;
                    ctx.drawImage(
                        sheet.img,
                        sx, sy, sw, sh,
                        -renderW * 0.25, -renderH * 0.5, renderW, renderH
                    );
                } else {
                    const renderSize = s.radius * 1.95;
                    ctx.drawImage(
                        sheet.img,
                        sx, sy, sw, sh,
                        -renderSize * 0.5, -renderSize * 0.72, renderSize, renderSize
                    );
                }
            } else {
                ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
                ctx.beginPath();
                ctx.arc(s.x - camX, s.y - camY, s.radius, s.angle - s.arc * 0.5, s.angle + s.arc * 0.5);
                ctx.strokeStyle = s.color;
                ctx.lineWidth = s.isCyber ? 6 : 4;
                ctx.stroke();
            }
            ctx.restore();
        }

        // 6. Đạn Cannon
        for (let i = 0; i < this.cannonBalls.length; i++) {
            const ball = this.cannonBalls[i];
            ctx.save();
            ctx.fillStyle = ball.glow;
            ctx.beginPath();
            ctx.arc(ball.x - camX, ball.y - camY, ball.radius * 1.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = ball.color;
            ctx.beginPath();
            ctx.arc(ball.x - camX, ball.y - camY, ball.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 7. Tia Laser & Tia chớp
        for (let i = 0; i < this.laserBeams.length; i++) {
            const b = this.laserBeams[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, b.life / b.maxLife);
            ctx.lineCap = 'round';
            ctx.strokeStyle = b.color;
            ctx.lineWidth = b.width;
            ctx.beginPath();
            ctx.moveTo(b.x1 - camX, b.y1 - camY);
            ctx.lineTo(b.x2 - camX, b.y2 - camY);
            ctx.stroke();
            ctx.restore();
        }

        // 7b. Tia chớp chữ X Chí Mạng (Impact Cross-Flash)
        for (let i = 0; i < this.crossFlashes.length; i++) {
            const cf = this.crossFlashes[i];
            const alpha = Math.max(0, cf.life / cf.maxLife);
            ctx.save();
            ctx.translate(cf.x - camX, cf.y - camY);
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = cf.color;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            // Nét gạch chéo 1
            ctx.moveTo(-cf.size, -cf.size);
            ctx.lineTo(cf.size, cf.size);
            // Nét gạch chéo 2
            ctx.moveTo(-cf.size, cf.size);
            ctx.lineTo(cf.size, -cf.size);
            ctx.stroke();
            ctx.restore();
        }

        // 8. Hạt hiệu ứng
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x - camX, p.y - camY, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Chữ số sát thương nổi
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < this.floatingTexts.length; i++) {
            const ft = this.floatingTexts[i];
            ctx.save();
            ctx.globalAlpha = Math.min(1, Math.max(0, (ft.life / ft.maxLife) * 1.25));
            ctx.font = ft.isCrit ? '900 22px sans-serif' : 'bold 16px sans-serif';
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.strokeText(ft.text, ft.x - camX, ft.y - camY);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x - camX, ft.y - camY);
            ctx.restore();
        }

        // 9. Combo Counter, Kill Streak Banner & Thanh Quá Nhiệt Dưới Chân
        const player = window.Game.player;
        if (player) {
            const hx = player.x - camX;
            const hy = player.y - camY;
            const currentWeapon = (window.Game.state && window.Game.state.currentWeapon) || 'iron_sword';

            // Vẽ thanh nhiệt độ súng Laser khi cầm Laser Gun và nhiệt độ > 20%
            if (currentWeapon === 'laser_gun' && this.weaponHeat > 20) {
                const heatRatio = Math.min(1, this.weaponHeat / this.maxWeaponHeat);
                const barW = 38;
                const barH = 5;
                const barX = hx - barW / 2;
                const barY = hy + (player.radius || 20) + 10;

                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

                // Màu chuyển dần từ cam sang đỏ gắt khi quá nhiệt
                ctx.fillStyle = heatRatio >= 0.8 ? '#ef4444' : '#f59e0b';
                ctx.fillRect(barX, barY, barW * heatRatio, barH);

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);
                ctx.restore();
            }

            const headerY = hy - (player.radius || 20) - 36;
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
                ctx.translate(hx, headerY - 28);
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