/**
 * FILE: enemies.js
 * BẢN NÂNG CẤP SIÊU CẤP HỆ THỐNG AI CHIẾN THUẬT, ANTI-SNIPER & 3 MINI-BOSS KỶ NGUYÊN:
 * 1. 3 BOSS PHỤ KỶ NGUYÊN (isMiniBoss: true) HOÀN THIỆN NHIỆM VỤ #4:
 *    - PAST (1620, 1740): [BOSS PHỤ] Cự Thạch Hộ Pháp (ancient_miniboss, 2400 HP, R:34)
 *      + Giậm đất tạo 3 vòng sóng chấn động liên hoàn & dựng Giáp Đá giảm 60% sát thương tầm xa.
 *    - PRESENT (2220, 1740): [BOSS PHỤ] Mẫu Hoàng Độc Tố (mutant_miniboss, 2800 HP, R:34)
 *      + Bắn chùm 5 quả cầu axit độc & triệu hồi 2 quái tự bạo nhỏ mỗi 9 giây.
 *    - FUTURE (1920, 1720): [BOSS PHỤ] Chiến Giáp Phản Quang (robot_miniboss, 3200 HP, R:35)
 *      + Kích hoạt Khiên Gương Lượng Tử 3s mỗi 8s: Phản xạ tia laser về phía người chơi nếu bắn
 *        bằng laser_gun / chrono_cannon; bị phá vỡ ngay nếu người chơi áp sát chém cận chiến.
 * 2. AI KHẮC CHẾ ĐỨNG XA BẮN SÚNG (ANTI-SNIPER TACTICAL AI):
 *    - Evasive Sidestep: Quái isKiter / isElite tự động lướt ngang vuông góc 90° (x2.4 tốc độ,
 *      0.22s, hồi 3.2s) kèm vệt bóng mờ khi bị ngắm bởi laser_gun / chrono_cannon (< 20°, 180-450px).
 *    - Khiên Tanker nâng cấp: Chặn 88% sát thương từ xa (> 210px) và nảy mảnh vỡ phản kích;
 *      nhận thêm +25% sát thương nếu bị áp sát (< 130px) hoặc đánh sau lưng.
 * 3. ĐỘI HÌNH LIÊN KẾT CHIẾN THUẬT (TACTICAL SYNERGY):
 *    - Quái isKiter khi mất máu ưu tiên lùi về nấp sau lưng đồng đội isTanker gần đó.
 * 4. VẬT PHẨM RƠI MỚI: OVERDRIVE_ORB (Ngọc Cuồng Nộ Đỏ Cam - 6% quái thường, 100% Mini-Boss):
 *    - Tăng +25 Nộ, làm mát tức thì weaponHeat = 0 và tăng +20% tốc độ đánh trong 4 giây.
 * 5. ĐỒ HỌA CANVAS MINI-BOSS & HIỆU ỨNG CHIẾN ĐẤU ĐẦY ĐỦ.
 */

window.Game = window.Game || {};

window.Game.Enemies = {
    list: [],
    projectiles: [],
    lootDrops: [],
    telegraphs: [],
    healWaves: [],
    healLinks: [],
    shieldDeflections: [], // Hiệu ứng tia lửa / lục giác khiên nảy bật
    evadeAfterimages: [],  // Vệt bóng mờ khi quái lướt né tia ngắm hoặc phản xạ laser
    queuedWaveRings: [],   // Hàng đợi sóng chấn động liên hoàn của Cự Thạch Hộ Pháp
    playerSlowTimer: 0,
    _appliedPlayerSlow: 0,
    playerOverdriveTimer: 0,

    init: function () {
        this.list = [];
        this.projectiles = [];
        this.lootDrops = [];
        this.telegraphs = [];
        this.healWaves = [];
        this.healLinks = [];
        this.shieldDeflections = [];
        this.evadeAfterimages = [];
        this.queuedWaveRings = [];
        this._clearPlayerSlow();
        this._clearPlayerOverdrive();

        if (window.Game.state) {
            if (typeof window.Game.state.loopLevel !== 'number') {
                window.Game.state.loopLevel = 1;
            }
            if (typeof window.Game.state.timeShards !== 'number') {
                window.Game.state.timeShards = 0;
            }
            if (!window.Game.state.weaponLevels || typeof window.Game.state.weaponLevels !== 'object') {
                window.Game.state.weaponLevels = {};
            }
        }

        const loop = (window.Game.state && window.Game.state.loopLevel) || 1;
        const bossMult = Math.pow(1.85, Math.max(0, loop - 1));
        const bossInitialHp = Math.round(22000 * bossMult);
        const bossInitialDmg = Math.round(42 * Math.pow(1.5, Math.max(0, loop - 1)));
        const bossInitialGold = Math.round(1200 * Math.pow(1.5, Math.max(0, loop - 1)));

        const spawnCoords = [
            { x: 1050, y: 1850 },
            { x: 1380, y: 1820 },
            { x: 2480, y: 1850 },
            { x: 2820, y: 1920 },
            { x: 1120, y: 2320 },
            { x: 1520, y: 2450 },
            { x: 2320, y: 2420 },
            { x: 2780, y: 2360 },
            { x: 1250, y: 2880 },
            { x: 1750, y: 2950 },
            { x: 2180, y: 2920 },
            { x: 2680, y: 2860 }
        ];

        // 1. Quá Khứ (PAST) - 12 quái cổ đại phân hóa Tanker, Ranged và Melee
        for (let i = 0; i < 12; i++) {
            const pt = this._findSafePosition(spawnCoords[i].x, spawnCoords[i].y);
            let subType = 'goblin';
            let role = 'melee';
            let name = 'Goblin Rừng Già';
            let baseHp = 135;
            let baseSpeed = 130;
            let baseRadius = 18;
            let baseDamage = 16;
            let baseGold = 35;
            let baseExp = 24;

            if (i % 3 === 0) {
                // TANKER / SHIELD-BEARER
                subType = 'golem';
                role = 'tanker';
                name = 'Golem Đá Bọc Giáp';
                baseHp = 300; // Gấp đôi quái thường
                baseSpeed = 82;
                baseRadius = 26;
                baseDamage = 26;
                baseGold = 55;
                baseExp = 36;
            } else if (i % 3 === 2) {
                // RANGED / KITER
                subType = 'shaman';
                role = 'kiter';
                name = 'Pháp Sư Cổ Đại';
                baseHp = 78; // Máu giấy (giảm ~45%)
                baseSpeed = 126;
                baseRadius = 18;
                baseDamage = 20;
                baseGold = 50;
                baseExp = 32;
            }

            const enemy = {
                id: `past_${i}`,
                timeline: 'PAST',
                type: 'ancient',
                subType: subType,
                role: role,
                baseName: name,
                name: name,
                isBoss: false,
                isMiniBoss: false,
                isElite: false,
                isTanker: role === 'tanker',
                isKiter: role === 'kiter',
                x: pt.x,
                y: pt.y,
                spawnX: pt.x,
                spawnY: pt.y,
                baseHp: baseHp,
                hp: baseHp,
                maxHp: baseHp,
                baseSpeed: baseSpeed,
                speed: baseSpeed,
                baseRadius: baseRadius,
                radius: baseRadius,
                baseDamage: baseDamage,
                damage: baseDamage,
                baseGoldReward: baseGold,
                goldReward: baseGold,
                baseExpReward: baseExp,
                expReward: baseExp,
                attackCd: 0,
                shootCd: 1.1 + (i % 3) * 0.4,
                healCd: 3.0,
                groundSlamCd: 0,
                strafeDir: i % 2 === 0 ? 1 : -1,
                strafeTimer: 1.5 + Math.random(),
                evadeCd: 0,
                evadeTimer: 0,
                evadeVx: 0,
                evadeVy: 0,
                afterimageTick: 0,
                hitFlash: 0,
                lastHitTime: 0,
                dead: false,
                respawnTimer: 0,
                patrolAngle: (i * Math.PI) / 6,
                facingAngle: 0
            };

            this._applyEliteRoll(enemy);
            this.list.push(enemy);
        }

        // 2. Hiện Tại (PRESENT) - 12 quái đột biến Cận chiến & Tự bạo
        for (let i = 0; i < 12; i++) {
            const offsetPt = spawnCoords[(i + 4) % 12];
            const pt = this._findSafePosition(offsetPt.x + 80, offsetPt.y - 70);
            const enemy = {
                id: `present_${i}`,
                timeline: 'PRESENT',
                type: 'mutant',
                subType: 'mutant',
                role: 'melee',
                baseName: 'Quái Đột Biến',
                name: 'Quái Đột Biến',
                isBoss: false,
                isMiniBoss: false,
                isElite: false,
                isTanker: false,
                isKiter: false,
                x: pt.x,
                y: pt.y,
                spawnX: pt.x,
                spawnY: pt.y,
                baseHp: 165,
                hp: 165,
                maxHp: 165,
                baseSpeed: 178,
                speed: 178,
                baseRadius: 19,
                radius: 19,
                baseDamage: 22,
                damage: 22,
                baseGoldReward: 45,
                goldReward: 45,
                baseExpReward: 30,
                expReward: 30,
                attackCd: 0,
                shootCd: 0,
                evadeCd: 0,
                evadeTimer: 0,
                evadeVx: 0,
                evadeVy: 0,
                afterimageTick: 0,
                hitFlash: 0,
                lastHitTime: 0,
                dead: false,
                respawnTimer: 0,
                patrolAngle: (i * Math.PI) / 6,
                facingAngle: 0,
                kamikazeActive: false,
                kamikazeTimer: 0,
                kamikazeMaxTimer: 1.8
            };

            this._applyEliteRoll(enemy);
            this.list.push(enemy);
        }

        // 3. Tương Lai (FUTURE) - 12 Robot phân hóa: Robot Hộ Vệ Khiên (Tanker) & Robot Bắn Tỉa (Kiter)
        for (let i = 0; i < 12; i++) {
            const offsetPt = spawnCoords[(i + 8) % 12];
            const pt = this._findSafePosition(offsetPt.x - 70, offsetPt.y + 80);
            const isTanker = i % 3 === 0;
            const isKiter = !isTanker;

            let subType = isTanker ? 'shield_robot' : 'sniper_robot';
            let role = isTanker ? 'tanker' : 'kiter';
            let name = isTanker ? 'Robot Hộ Vệ Khiên' : 'Robot Xạ Thủ Kiter';
            let baseHp = isTanker ? 340 : 105; // Tanker máu x2; Kiter máu giấy
            let baseSpeed = isTanker ? 90 : 138;
            let baseRadius = isTanker ? 25 : 18;
            let baseDamage = isTanker ? 24 : 26;
            let baseGold = isTanker ? 75 : 65;
            let baseExp = isTanker ? 45 : 38;

            const enemy = {
                id: `future_${i}`,
                timeline: 'FUTURE',
                type: 'robot',
                subType: subType,
                role: role,
                baseName: name,
                name: name,
                isBoss: false,
                isMiniBoss: false,
                isElite: false,
                isTanker: isTanker,
                isKiter: isKiter,
                x: pt.x,
                y: pt.y,
                spawnX: pt.x,
                spawnY: pt.y,
                baseHp: baseHp,
                hp: baseHp,
                maxHp: baseHp,
                baseSpeed: baseSpeed,
                speed: baseSpeed,
                baseRadius: baseRadius,
                radius: baseRadius,
                baseDamage: baseDamage,
                damage: baseDamage,
                baseGoldReward: baseGold,
                goldReward: baseGold,
                baseExpReward: baseExp,
                expReward: baseExp,
                attackCd: 0,
                shootCd: 0.9 + (i % 4) * 0.35,
                shieldActive: isTanker, // Tanker luôn dựng khiên
                shieldTimer: 0,
                shieldCd: 0,
                strafeDir: i % 2 === 0 ? 1 : -1,
                strafeTimer: 1.6 + Math.random(),
                evadeCd: 0,
                evadeTimer: 0,
                evadeVx: 0,
                evadeVy: 0,
                afterimageTick: 0,
                hitFlash: 0,
                lastHitTime: 0,
                dead: false,
                respawnTimer: 0,
                patrolAngle: (i * Math.PI) / 6,
                facingAngle: 0
            };

            this._applyEliteRoll(enemy);
            this.list.push(enemy);
        }

        // 4. KHỞI TẠO 3 BOSS PHỤ KỶ NGUYÊN (isMiniBoss: true) CHO NHIỆM VỤ #4
        const miniBossLoopMult = Math.pow(1.75, Math.max(0, loop - 1));
        const miniBossDmgMult = Math.pow(1.45, Math.max(0, loop - 1));

        // 4A. Kỷ nguyên PAST (1620, 1740): [BOSS PHỤ] Cự Thạch Hộ Pháp
        const pastMiniPt = this._findSafePosition(1620, 1740);
        const pastMiniHp = Math.round(2400 * miniBossLoopMult);
        this.list.push({
            id: 'miniboss_past',
            timeline: 'PAST',
            type: 'ancient',
            subType: 'ancient_miniboss',
            role: 'miniboss',
            baseName: '[BOSS PHỤ] Cự Thạch Hộ Pháp',
            name: '[BOSS PHỤ] Cự Thạch Hộ Pháp',
            isBoss: false,
            isMiniBoss: true,
            isElite: true,
            isTanker: false,
            isKiter: false,
            x: pastMiniPt.x,
            y: pastMiniPt.y,
            spawnX: pastMiniPt.x,
            spawnY: pastMiniPt.y,
            baseHp: 2400,
            hp: pastMiniHp,
            maxHp: pastMiniHp,
            baseSpeed: 96,
            speed: 96,
            baseRadius: 34,
            radius: 34,
            baseDamage: 32,
            damage: Math.round(32 * miniBossDmgMult),
            baseGoldReward: 380,
            goldReward: Math.round(380 * miniBossDmgMult),
            baseExpReward: 180,
            expReward: Math.round(180 * Math.pow(1.3, Math.max(0, loop - 1))),
            stoneArmorActive: true, // Luôn dựng Giáp Đá giảm 60% sát thương tầm xa
            slamComboCd: 4.5,
            attackCd: 0,
            shootCd: 2.2,
            evadeCd: 0,
            evadeTimer: 0,
            evadeVx: 0,
            evadeVy: 0,
            afterimageTick: 0,
            hitFlash: 0,
            lastHitTime: 0,
            dead: false,
            respawnTimer: 0,
            patrolAngle: 0,
            facingAngle: Math.PI / 2
        });

        // 4B. Kỷ nguyên PRESENT (2220, 1740): [BOSS PHỤ] Mẫu Hoàng Độc Tố
        const presentMiniPt = this._findSafePosition(2220, 1740);
        const presentMiniHp = Math.round(2800 * miniBossLoopMult);
        this.list.push({
            id: 'miniboss_present',
            timeline: 'PRESENT',
            type: 'mutant',
            subType: 'mutant_miniboss',
            role: 'miniboss',
            baseName: '[BOSS PHỤ] Mẫu Hoàng Độc Tố',
            name: '[BOSS PHỤ] Mẫu Hoàng Độc Tố',
            isBoss: false,
            isMiniBoss: true,
            isElite: true,
            isTanker: false,
            isKiter: false,
            x: presentMiniPt.x,
            y: presentMiniPt.y,
            spawnX: presentMiniPt.x,
            spawnY: presentMiniPt.y,
            baseHp: 2800,
            hp: presentMiniHp,
            maxHp: presentMiniHp,
            baseSpeed: 112,
            speed: 112,
            baseRadius: 34,
            radius: 34,
            baseDamage: 34,
            damage: Math.round(34 * miniBossDmgMult),
            baseGoldReward: 420,
            goldReward: Math.round(420 * miniBossDmgMult),
            baseExpReward: 200,
            expReward: Math.round(200 * Math.pow(1.3, Math.max(0, loop - 1))),
            acidBarrageCd: 2.6,
            summonBroodCd: 9.0,
            strafeDir: 1,
            strafeTimer: 2.0,
            attackCd: 0,
            shootCd: 2.6,
            evadeCd: 0,
            evadeTimer: 0,
            evadeVx: 0,
            evadeVy: 0,
            afterimageTick: 0,
            hitFlash: 0,
            lastHitTime: 0,
            dead: false,
            respawnTimer: 0,
            patrolAngle: 0,
            facingAngle: Math.PI / 2
        });

        // 4C. Kỷ nguyên FUTURE (1920, 1720): [BOSS PHỤ] Chiến Giáp Phản Quang
        const futureMiniPt = this._findSafePosition(1920, 1720);
        const futureMiniHp = Math.round(3200 * miniBossLoopMult);
        this.list.push({
            id: 'miniboss_future',
            timeline: 'FUTURE',
            type: 'robot',
            subType: 'robot_miniboss',
            role: 'miniboss',
            baseName: '[BOSS PHỤ] Chiến Giáp Phản Quang',
            name: '[BOSS PHỤ] Chiến Giáp Phản Quang',
            isBoss: false,
            isMiniBoss: true,
            isElite: true,
            isTanker: false,
            isKiter: false,
            x: futureMiniPt.x,
            y: futureMiniPt.y,
            spawnX: futureMiniPt.x,
            spawnY: futureMiniPt.y,
            baseHp: 3200,
            hp: futureMiniHp,
            maxHp: futureMiniHp,
            baseSpeed: 118,
            speed: 118,
            baseRadius: 35,
            radius: 35,
            baseDamage: 38,
            damage: Math.round(38 * miniBossDmgMult),
            baseGoldReward: 460,
            goldReward: Math.round(460 * miniBossDmgMult),
            baseExpReward: 220,
            expReward: Math.round(220 * Math.pow(1.3, Math.max(0, loop - 1))),
            mirrorShieldActive: false,
            mirrorShieldTimer: 0,
            mirrorShieldCd: 4.5, // Kích hoạt Khiên Gương 3s mỗi 8s
            stunTimer: 0,
            strafeDir: -1,
            strafeTimer: 1.8,
            attackCd: 0,
            shootCd: 1.8,
            evadeCd: 0,
            evadeTimer: 0,
            evadeVx: 0,
            evadeVy: 0,
            afterimageTick: 0,
            hitFlash: 0,
            lastHitTime: 0,
            dead: false,
            respawnTimer: 0,
            patrolAngle: 0,
            facingAngle: Math.PI / 2
        });

        // 5. Chúa Tể Thời Không (Boss Chính)
        this.list.push({
            id: 'chrono_boss',
            timeline: 'ALL',
            type: 'boss',
            subType: 'boss',
            role: 'boss',
            baseName: 'CHÚA TỂ THỜI KHÔNG',
            name: 'CHÚA TỂ THỜI KHÔNG',
            isBoss: true,
            isMiniBoss: false,
            isElite: false,
            isTanker: false,
            isKiter: false,
            x: 1920,
            y: 1050,
            spawnX: 1920,
            spawnY: 1050,
            baseHp: 22000,
            hp: bossInitialHp,
            maxHp: bossInitialHp,
            baseSpeed: 112,
            speed: 112,
            baseRadius: 48,
            radius: 48,
            baseDamage: 42,
            damage: bossInitialDmg,
            baseGoldReward: 1200,
            goldReward: bossInitialGold,
            baseExpReward: 500,
            expReward: 500,
            shieldTimeline: 'PAST',
            nextShieldTimeline: null,
            phaseShiftTimer: 8.0,
            phaseShiftWarningActive: false,
            shatterAvailable: true,
            stunTimer: 0,
            spiralOffset: 0,
            attackCd: 0,
            shootCd: 1.5,
            radialCd: 2.8,
            dashCd: 5.2,
            isDashing: false,
            dashTimer: 0,
            dashVx: 0,
            dashVy: 0,
            satelliteAngle: 0,
            satelliteHitCd: 0,
            meteorCd: 4.5,
            timeWarpCd: 7.5,
            phase: 1,
            hitFlash: 0,
            lastHitTime: 0,
            dead: false,
            respawnTimer: 0,
            patrolAngle: 0,
            facingAngle: Math.PI / 2
        });
    },

    _applyEliteRoll: function (e) {
        if (e.isBoss) return;

        const loop = (window.Game.state && window.Game.state.loopLevel) || 1;
        const loopMult = Math.pow(1.75, Math.max(0, loop - 1));

        if (e.isMiniBoss) {
            const dmgMult = Math.pow(1.45, Math.max(0, loop - 1));
            e.name = e.baseName;
            e.radius = e.baseRadius;
            e.maxHp = Math.round(e.baseHp * loopMult);
            e.hp = e.maxHp;
            e.damage = Math.round(e.baseDamage * dmgMult);
            e.speed = e.baseSpeed;
            e.goldReward = Math.round(e.baseGoldReward * dmgMult);
            e.expReward = Math.round(e.baseExpReward * Math.pow(1.3, Math.max(0, loop - 1)));
            e.isElite = true;
            e.evadeCd = 0;
            e.evadeTimer = 0;

            if (e.subType === 'ancient_miniboss') {
                e.stoneArmorActive = true;
                e.slamComboCd = 4.0;
            } else if (e.subType === 'mutant_miniboss') {
                e.acidBarrageCd = 2.4;
                e.summonBroodCd = 8.5;
            } else if (e.subType === 'robot_miniboss') {
                e.mirrorShieldActive = false;
                e.mirrorShieldTimer = 0;
                e.mirrorShieldCd = 4.5;
                e.stunTimer = 0;
            }
            return;
        }

        const scaledHp = Math.round(e.baseHp * loopMult);
        const scaledDamage = Math.round(e.baseDamage * loopMult);
        const scaledGold = Math.round(e.baseGoldReward * loopMult);
        const scaledExp = Math.round(e.baseExpReward * Math.pow(1.25, Math.max(0, loop - 1)));

        const isElite = Math.random() < 0.35;
        e.isElite = isElite;

        if (isElite) {
            e.name = `[TINH ANH] ${e.baseName}`;
            e.radius = Math.round(e.baseRadius * 1.32);
            e.maxHp = Math.round(scaledHp * 3.2);
            e.hp = e.maxHp;
            e.damage = Math.round(scaledDamage * 1.9);
            e.speed = Math.round(e.baseSpeed * 1.2);
            e.goldReward = Math.round(scaledGold * 2.5);
            e.expReward = Math.round(scaledExp * 2.2);
        } else {
            e.name = e.baseName;
            e.radius = e.baseRadius;
            e.maxHp = scaledHp;
            e.hp = e.maxHp;
            e.damage = scaledDamage;
            e.speed = e.baseSpeed;
            e.goldReward = scaledGold;
            e.expReward = scaledExp;
        }

        e.kamikazeActive = Boolean(e.isSummonedMinion);
        e.kamikazeTimer = e.isSummonedMinion ? 3.2 : 0;
        e.kamikazeMaxTimer = e.isSummonedMinion ? 3.2 : 1.8;
        if (e.isTanker) {
            e.shieldActive = true;
        }
        e.healCd = 3.0;
        e.groundSlamCd = 0;
        e.evadeCd = 0;
        e.evadeTimer = 0;
    },

    _applyPlayerSlow: function (duration) {
        const player = window.Game.player;
        this.playerSlowTimer = Math.max(this.playerSlowTimer || 0, duration || 1.5);
        if (player && this._appliedPlayerSlow === 0 && typeof player.speed === 'number') {
            this._appliedPlayerSlow = Math.round(player.speed * 0.25);
            player.speed = Math.max(90, player.speed - this._appliedPlayerSlow);
        }
    },

    _clearPlayerSlow: function () {
        const player = window.Game.player;
        if (player && this._appliedPlayerSlow > 0 && typeof player.speed === 'number') {
            player.speed += this._appliedPlayerSlow;
        }
        this._appliedPlayerSlow = 0;
        this.playerSlowTimer = 0;
    },

    /**
     * KÍCH HOẠT HIỆU ỨNG OVERDRIVE KHI NHẶT NGỌC CUỒNG NỘ ĐỎ CAM (OVERDRIVE_ORB):
     * - Tăng +25 Nộ, làm mát tức thì nhiệt độ súng (weaponHeat = 0)
     * - Tăng +20% tốc độ đánh trong 4 giây
     */
    _applyPlayerOverdrive: function (duration) {
        const player = window.Game.player;
        const state = window.Game.state;
        const combat = window.Game.Combat;

        this.playerOverdriveTimer = Math.max(this.playerOverdriveTimer || 0, duration || 4.0);

        if (state) {
            state.rage = Math.min(100, (state.rage || 0) + 25);
            state.weaponHeat = 0;
            state.weaponOverheated = false;
            state.overdriveAttackSpeedMult = 1.2;
            state.overdriveTimer = this.playerOverdriveTimer;
        }

        if (player) {
            player.weaponHeat = 0;
            player.isOverheated = false;
            player.attackSpeedBuffMult = 1.2;
            player.overdriveTimer = this.playerOverdriveTimer;
        }

        if (combat) {
            if (typeof combat.weaponHeat === 'number') combat.weaponHeat = 0;
            if (typeof combat.isOverheated === 'boolean') combat.isOverheated = false;
            combat.overdriveSpeedMult = 1.2;
            combat.overdriveTimer = this.playerOverdriveTimer;
        }
    },

    _clearPlayerOverdrive: function () {
        const player = window.Game.player;
        const state = window.Game.state;
        const combat = window.Game.Combat;

        this.playerOverdriveTimer = 0;
        if (state) {
            state.overdriveAttackSpeedMult = 1.0;
            state.overdriveTimer = 0;
        }
        if (player) {
            player.attackSpeedBuffMult = 1.0;
            player.overdriveTimer = 0;
        }
        if (combat) {
            combat.overdriveSpeedMult = 1.0;
            combat.overdriveTimer = 0;
        }
    },

    /**
     * TRIỆU HỒI 2 QUÁI TỰ BẠO NHỎ CỦA MẪU HOÀNG ĐỘC TỐ (PRESENT MINI-BOSS)
     */
    _spawnMutantMinions: function (queen) {
        const activeMinions = this.list.filter(
            m => m.isSummonedMinion && !m.dead && m.hp > 0 && m.parentId === queen.id
        );
        if (activeMinions.length >= 4) return;

        const loop = (window.Game.state && window.Game.state.loopLevel) || 1;
        const hpMult = Math.pow(1.6, Math.max(0, loop - 1));
        const dmgMult = Math.pow(1.4, Math.max(0, loop - 1));

        for (let s = 0; s < 2; s++) {
            const angle = (queen.facingAngle || 0) + (s === 0 ? -0.65 : 0.65);
            const sx = queen.x + Math.cos(angle) * (queen.radius + 24);
            const sy = queen.y + Math.sin(angle) * (queen.radius + 24);
            const safePt = this._findSafePosition(sx, sy);
            const minionHp = Math.round(90 * hpMult);

            this.list.push({
                id: `mutant_minion_${performance.now()}_${Math.random()}`,
                parentId: queen.id,
                isSummonedMinion: true,
                timeline: 'PRESENT',
                type: 'mutant',
                subType: 'mutant_minion',
                role: 'melee',
                baseName: 'Ấu Trùng Tự Bạo',
                name: 'Ấu Trùng Tự Bạo',
                isBoss: false,
                isMiniBoss: false,
                isElite: false,
                isTanker: false,
                isKiter: false,
                x: safePt.x,
                y: safePt.y,
                spawnX: safePt.x,
                spawnY: safePt.y,
                baseHp: 90,
                hp: minionHp,
                maxHp: minionHp,
                baseSpeed: 215,
                speed: 215,
                baseRadius: 14,
                radius: 14,
                baseDamage: 18,
                damage: Math.round(18 * dmgMult),
                baseGoldReward: 15,
                goldReward: 15,
                baseExpReward: 12,
                expReward: 12,
                attackCd: 0,
                shootCd: 0,
                evadeCd: 0,
                evadeTimer: 0,
                evadeVx: 0,
                evadeVy: 0,
                afterimageTick: 0,
                hitFlash: 0,
                lastHitTime: 0,
                dead: false,
                respawnTimer: 0,
                patrolAngle: 0,
                facingAngle: angle,
                kamikazeActive: true,
                kamikazeTimer: 3.4,
                kamikazeMaxTimer: 3.4
            });
        }

        this.healWaves.push({
            x: queen.x,
            y: queen.y,
            radius: 16,
            maxRadius: 145,
            color: 'rgba(168, 85, 247, 0.85)',
            alpha: 1.0
        });

        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
            window.Game.Combat.spawnFloatingText(
                queen.x,
                queen.y - queen.radius - 26,
                '☣️ TRIỆU HỒI ẤU TRÙNG TỰ BẠO!',
                '#c084fc',
                true
            );
        }
    },

    healEnemiesAround: function (x, y, radius) {
        const healRadius = typeof radius === 'number' ? radius : 900;
        const hasCenter = typeof x === 'number' && typeof y === 'number';

        for (let i = this.list.length - 1; i >= 0; i--) {
            const e = this.list[i];
            if (!e) continue;
            if (e.isSummonedMinion) {
                this.list.splice(i, 1);
                continue;
            }
            if (e.dead) continue;

            if (!hasCenter || e.isBoss || e.isMiniBoss || Math.hypot(e.x - x, e.y - y) <= healRadius) {
                e.hp = e.maxHp;
                e.kamikazeActive = false;
                e.kamikazeTimer = 0;
                if (e.isMiniBoss && e.subType === 'robot_miniboss') {
                    e.mirrorShieldActive = false;
                    e.mirrorShieldTimer = 0;
                    e.mirrorShieldCd = 4.5;
                    e.stunTimer = 0;
                }
                if (e.isBoss) {
                    e.phase = 1;
                    e.shieldTimeline = 'PAST';
                    e.nextShieldTimeline = null;
                    e.phaseShiftTimer = 8.0;
                    e.phaseShiftWarningActive = false;
                    e.shatterAvailable = true;
                    e.stunTimer = 0;
                }
            }
        }
    },

    onPlayerRespawn: function () {
        this.projectiles = [];
        this.telegraphs = [];
        this.healLinks = [];
        this.shieldDeflections = [];
        this.evadeAfterimages = [];
        this.queuedWaveRings = [];
        this._clearPlayerSlow();
        this._clearPlayerOverdrive();

        const player = window.Game.player;
        if (player && typeof player.x === 'number' && typeof player.y === 'number') {
            this.healEnemiesAround(player.x, player.y, 900);
        }
        this.healEnemiesAround(null, null, Infinity);

        for (let i = 0; i < this.list.length; i++) {
            const e = this.list[i];
            if (e.isBoss && !e.dead && e.hp > 0) {
                e.x = 1920;
                e.y = 1050;
                e.isDashing = false;
                e.dashTimer = 0;
                e.hp = e.maxHp;
                e.phase = 1;
                e.shieldTimeline = 'PAST';
                e.nextShieldTimeline = null;
                e.phaseShiftTimer = 8.0;
                e.phaseShiftWarningActive = false;
                e.shatterAvailable = true;
                e.stunTimer = 0;
            } else if (e.isMiniBoss && !e.dead && e.hp > 0) {
                e.x = e.spawnX;
                e.y = e.spawnY;
                e.hp = e.maxHp;
            }
        }
    },

    _findSafePosition: function (x, y) {
        if (!window.Game.World || typeof window.Game.World.canMoveTo !== 'function') {
            return { x: x, y: y };
        }
        if (window.Game.World.canMoveTo(x, y)) {
            return { x: x, y: y };
        }
        for (let r = 40; r <= 240; r += 40) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                const tx = x + Math.cos(a) * r;
                const ty = y + Math.sin(a) * r;
                if (ty > 1700 && window.Game.World.canMoveTo(tx, ty)) {
                    return { x: tx, y: ty };
                }
            }
        }
        return { x: x, y: y };
    },

    getActiveList: function () {
        const currentTimeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
        const active = [];

        for (let i = 0; i < this.list.length; i++) {
            const e = this.list[i];
            if (!e.dead && e.hp > 0 && (e.isBoss || e.timeline === currentTimeline)) {
                active.push(e);
            }
        }
        return active;
    },

    _applyDamageToPlayer: function (rawAmount, sourceEnemy) {
        const player = window.Game.player;
        const state = window.Game.state;
        if (!player || player.hp <= 0) return;

        if (state && state.godMode === true) {
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 30, 'BẤT TỬ', '#38bdf8');
            }
            return;
        }

        const dmg = Math.max(1, Math.round(rawAmount));
        player.shieldCooldown = 8.0;

        let remainingDmg = dmg;
        let absorbedByShield = 0;

        if (typeof player.shield === 'number' && player.shield > 0) {
            if (player.shield >= remainingDmg) {
                absorbedByShield = remainingDmg;
                player.shield = Math.max(0, player.shield - remainingDmg);
                remainingDmg = 0;
            } else {
                absorbedByShield = player.shield;
                remainingDmg -= player.shield;
                player.shield = 0;
            }
        }
        player.shield = Math.max(0, player.shield || 0);

        if (remainingDmg > 0) {
            player.hp = Math.max(0, (player.hp || 0) - remainingDmg);
        }

        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
            if (absorbedByShield > 0 && remainingDmg === 0) {
                window.Game.Combat.spawnFloatingText(
                    player.x,
                    player.y - 28,
                    `-${Math.round(absorbedByShield)} KHIÊN`,
                    '#38bdf8'
                );
            } else if (absorbedByShield > 0 && remainingDmg > 0) {
                window.Game.Combat.spawnFloatingText(
                    player.x,
                    player.y - 28,
                    `-${Math.round(remainingDmg)} HP (-${Math.round(absorbedByShield)} Khiên)`,
                    '#ef4444'
                );
            } else {
                window.Game.Combat.spawnFloatingText(
                    player.x,
                    player.y - 28,
                    `-${Math.round(remainingDmg)} HP`,
                    '#ef4444'
                );
            }
        }

        if (player.hp <= 0) {
            this.healEnemiesAround(player.x, player.y, 900);
        }

        if (
            sourceEnemy &&
            !sourceEnemy.dead &&
            sourceEnemy.hp > 0 &&
            state &&
            Array.isArray(state.equippedRelics) &&
            state.equippedRelics.includes('relic_thorn')
        ) {
            const thornDmg = Math.max(1, Math.round(dmg * 0.25));
            this.damageEnemy(sourceEnemy, thornDmg, false, true);
        }
    },

    spawnSpecificLoot: function (x, y, type, count, value) {
        const cnt = typeof count === 'number' ? count : 1;
        const val = typeof value === 'number' ? value : 20;

        for (let i = 0; i < cnt; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 22 + Math.random() * 32;
            this.lootDrops.push({
                type: type || 'HP_ORB',
                value: val,
                x: x,
                y: y,
                vx: Math.cos(angle) * dist * 3.2,
                vy: Math.sin(angle) * dist * 3.2,
                z: 8,
                vz: 110 + Math.random() * 50,
                bounceCount: 0,
                life: 25.0,
                magnetized: false
            });
        }
    },

    _spawnLootDrops: function (enemy) {
        const loop = (window.Game.state && window.Game.state.loopLevel) || 1;
        const loopGoldMult = Math.pow(1.5, Math.max(0, loop - 1));
        const count = enemy.isBoss
            ? 10
            : enemy.isMiniBoss
            ? 7
            : enemy.isElite
            ? 4
            : 2 + Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 18 + Math.random() * 34;
            const roll = Math.random();

            let type = 'GOLD';
            let value = Math.round((12 + Math.floor(Math.random() * 28)) * loopGoldMult);
            if (enemy.isElite) value = Math.round(value * 1.4);
            if (enemy.isMiniBoss) value = Math.round((45 + Math.floor(Math.random() * 35)) * loopGoldMult);
            if (enemy.isBoss) value = Math.round((70 + Math.floor(Math.random() * 60)) * loopGoldMult);

            if (roll < 0.22) {
                type = 'HP_ORB';
                value = 20;
            } else if (roll < 0.52) {
                type = 'EXP_ORB';
                value = enemy.isMiniBoss ? 26 : 16;
            }

            this.lootDrops.push({
                type: type,
                value: value,
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * dist * 3.2,
                vy: Math.sin(angle) * dist * 3.2,
                z: 6,
                vz: 110 + Math.random() * 60,
                bounceCount: 0,
                life: 25.0,
                magnetized: false
            });
        }

        // SHIELD_ORB: 100% cho Boss và Mini-Boss
        const shieldOrbChance = enemy.isBoss || enemy.isMiniBoss ? 1.0 : enemy.isElite ? 0.25 : 0.08;
        if (Math.random() < shieldOrbChance) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 24 + Math.random() * 36;
            this.lootDrops.push({
                type: 'SHIELD_ORB',
                value: enemy.isMiniBoss ? 35 : 25,
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * dist * 3.3,
                vy: Math.sin(angle) * dist * 3.3,
                z: 9,
                vz: 125 + Math.random() * 55,
                bounceCount: 0,
                life: 28.0,
                magnetized: false
            });
        }

        // OVERDRIVE_ORB (Ngọc Cuồng Nộ Đỏ Cam): 100% khi diệt Mini-Boss / Boss, 6% cho quái thường
        const overdriveOrbChance = enemy.isBoss || enemy.isMiniBoss ? 1.0 : 0.06;
        if (Math.random() < overdriveOrbChance) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 26 + Math.random() * 38;
            this.lootDrops.push({
                type: 'OVERDRIVE_ORB',
                value: 25,
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * dist * 3.4,
                vy: Math.sin(angle) * dist * 3.4,
                z: 10,
                vz: 130 + Math.random() * 60,
                bounceCount: 0,
                life: 30.0,
                magnetized: false
            });
        }

        // Mảnh Thời Không (SHARD): Chắc chắn 2-3 mảnh khi diệt Mini-Boss
        let shardCount = 0;
        if (enemy.isBoss) {
            shardCount = 4 + Math.floor(Math.random() * 4);
        } else if (enemy.isMiniBoss) {
            shardCount = 2 + Math.floor(Math.random() * 2); // Chắc chắn 2-3 mảnh
        } else if (enemy.isElite) {
            shardCount = 1 + (Math.random() < 0.4 ? 1 : 0);
        } else if (Math.random() < 0.14) {
            shardCount = 1;
        }

        for (let s = 0; s < shardCount; s++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 24 + Math.random() * 42;
            this.lootDrops.push({
                type: 'SHARD',
                value: 1,
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * dist * 3.5,
                vy: Math.sin(angle) * dist * 3.5,
                z: 10,
                vz: 135 + Math.random() * 65,
                bounceCount: 0,
                life: 35.0,
                magnetized: false
            });
        }
    },

    _handleEnemyDeath: function (enemy) {
        enemy.dead = true;
        // Mini-Boss hồi sinh sau 16s, Boss chính 20s, quái thường 8s
        enemy.respawnTimer = enemy.isBoss ? 20.0 : enemy.isMiniBoss ? 16.0 : 8.0;

        const goldEarned = enemy.goldReward || 50;
        const expEarned = enemy.expReward || 30;

        if (window.Game.state) {
            window.Game.state.gold = (window.Game.state.gold || 0) + goldEarned;
        }

        if (window.Game.Combat) {
            if (typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(
                    enemy.x,
                    enemy.y - enemy.radius - 28,
                    enemy.isMiniBoss ? `🏆 HẠ BOSS PHỤ! +${goldEarned} Vàng` : `+${goldEarned} Vàng`,
                    enemy.isMiniBoss ? '#fde047' : '#facc15',
                    Boolean(enemy.isMiniBoss)
                );
            }
            if (typeof window.Game.Combat.registerEnemyKill === 'function') {
                window.Game.Combat.registerEnemyKill(enemy);
            }
        }

        this._spawnLootDrops(enemy);

        if (window.Game.Systems && typeof window.Game.Systems.onEnemyKilled === 'function') {
            window.Game.Systems.onEnemyKilled(
                enemy.type,
                enemy.isBoss,
                enemy.isElite,
                expEarned,
                Boolean(enemy.isMiniBoss)
            );
        }
    },

    /**
     * KIỂM TRA VŨ KHÍ ĐANG CẦM CỦA NGƯỜI CHƠI CÓ PHẢI SÚNG TẦM XA (laser_gun / chrono_cannon)
     */
    _isPlayerUsingRangedGun: function () {
        const state = window.Game.state;
        const player = window.Game.player;
        const w =
            (state && (state.currentWeapon || state.equippedWeapon || state.weapon)) ||
            (player && (player.currentWeapon || player.weapon)) ||
            '';
        return w === 'laser_gun' || w === 'chrono_cannon';
    },

    /**
     * LẤY GÓC NGẮM HIỆN TẠI CỦA NGƯỜI CHƠI ĐỂ PHỤC VỤ AI NÉ TIA NGẮM (EVASIVE SIDESTEP)
     */
    _getPlayerAimAngle: function (player, fallbackTarget) {
        if (!player) return 0;
        if (typeof player.aimAngle === 'number') return player.aimAngle;
        if (typeof player.facingAngle === 'number') return player.facingAngle;
        if (typeof player.angle === 'number') return player.angle;
        if (window.Game.input && typeof window.Game.input.mouseWorldX === 'number') {
            return Math.atan2(
                window.Game.input.mouseWorldY - player.y,
                window.Game.input.mouseWorldX - player.x
            );
        }
        if (fallbackTarget) {
            return Math.atan2(fallbackTarget.y - player.y, fallbackTarget.x - player.x);
        }
        return 0;
    },

    /**
     * TÌM ĐỒNG ĐỘI TANKER GẦN NHẤT ĐỂ QUÁI KITER LÙI VỀ NẤP SAU LƯNG (TACTICAL SYNERGY)
     */
    _findNearbyTankerAlly: function (kiter) {
        let bestTanker = null;
        let minDist = 420;

        for (let i = 0; i < this.list.length; i++) {
            const ally = this.list[i];
            if (
                !ally ||
                ally.dead ||
                ally.hp <= 0 ||
                ally.id === kiter.id ||
                ally.timeline !== kiter.timeline ||
                !ally.isTanker
            ) {
                continue;
            }
            const d = Math.hypot(ally.x - kiter.x, ally.y - kiter.y);
            if (d < minDist) {
                minDist = d;
                bestTanker = ally;
            }
        }
        return bestTanker;
    },

    /**
     * TÍNH TOÁN VA CHẠM KHỐI KHIÊN CHẮN 120° (TANKER / SHIELD-BEARER) - O(1) VECTOR MATH
     */
    _isHitBlockedByShield: function (enemy, attackerX, attackerY) {
        if (!enemy.isTanker || enemy.dead || enemy.hp <= 0) return false;

        const pX = typeof attackerX === 'number' ? attackerX : (window.Game.player ? window.Game.player.x : enemy.x);
        const pY = typeof attackerY === 'number' ? attackerY : (window.Game.player ? window.Game.player.y : enemy.y);

        const toAtkX = pX - enemy.x;
        const toAtkY = pY - enemy.y;
        const dist = Math.hypot(toAtkX, toAtkY);
        if (dist < 0.001) return false;

        const normAtkX = toAtkX / dist;
        const normAtkY = toAtkY / dist;

        const faceX = Math.cos(enemy.facingAngle || 0);
        const faceY = Math.sin(enemy.facingAngle || 0);

        const dot = faceX * normAtkX + faceY * normAtkY;
        return dot >= 0.50;
    },

    /**
     * XỬ LÝ SÁT THƯƠNG LÊN QUÁI VẬT & MINI-BOSS & BOSS:
     * - Tích hợp Khiên Gương Lượng Tử của Chiến Giáp Phản Quang (FUTURE Mini-Boss).
     * - Tích hợp Giáp Đá Cổ Đại của Cự Thạch Hộ Pháp (PAST Mini-Boss).
     * - Tích hợp Khiên Tanker chống bắn tỉa (chặn 88% ST ở >210px + nảy đạn mảnh vỡ;
     *   nhận +25% ST khi bị áp sát <130px hoặc đánh lén sau lưng).
     */
    damageEnemy: function (enemy, amount, isCrit, isThornDamage, isAoE, attackerX, attackerY) {
        if (!enemy || enemy.dead || enemy.hp <= 0) return;

        const now = performance.now() * 0.001;
        enemy.lastHitTime = now;

        const player = window.Game.player;
        const srcX = typeof attackerX === 'number' ? attackerX : (player ? player.x : enemy.x);
        const srcY = typeof attackerY === 'number' ? attackerY : (player ? player.y : enemy.y);
        const hitDist = Math.hypot(srcX - enemy.x, srcY - enemy.y);

        let finalAmount = amount;
        let isVulnerableHit = false;
        let isShieldBlocked = false;

        // 0A. MINI-BOSS FUTURE: KHIÊN GƯƠNG LƯỢNG TỬ (Chiến Giáp Phản Quang)
        if (enemy.isMiniBoss && enemy.subType === 'robot_miniboss' && enemy.mirrorShieldActive && !isThornDamage) {
            const usingRangedGun = this._isPlayerUsingRangedGun();
            const isMeleeStrike = hitDist <= 150 && !usingRangedGun;

            if (isMeleeStrike) {
                // Người chơi lướt vào chém cận chiến -> Phá vỡ Khiên Gương Lượng Tử!
                enemy.mirrorShieldActive = false;
                enemy.mirrorShieldTimer = 0;
                enemy.mirrorShieldCd = 8.0;
                enemy.stunTimer = 1.2;
                finalAmount *= 1.35;
                isVulnerableHit = true;

                this.healWaves.push({
                    x: enemy.x,
                    y: enemy.y,
                    radius: 15,
                    maxRadius: 150,
                    color: 'rgba(0, 242, 254, 0.9)',
                    alpha: 1.0
                });

                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(
                        enemy.x,
                        enemy.y - enemy.radius - 28,
                        '💥 PHÁ VỠ KHIÊN GƯƠNG! (+35% ST)',
                        '#00f2fe',
                        true
                    );
                }
            } else if (usingRangedGun || hitDist > 150) {
                // Người chơi bắn laser_gun / chrono_cannon hoặc bắn xa vào Khiên Gương -> Phản xạ tia laser!
                finalAmount *= 0.08;
                isShieldBlocked = true;

                const reflectAngle = Math.atan2(srcY - enemy.y, srcX - enemy.x);
                this.projectiles.push({
                    x: enemy.x + Math.cos(reflectAngle) * (enemy.radius + 10),
                    y: enemy.y + Math.sin(reflectAngle) * (enemy.radius + 10),
                    vx: Math.cos(reflectAngle) * 520,
                    vy: Math.sin(reflectAngle) * 520,
                    radius: 9,
                    damage: Math.max(22, Math.round(enemy.damage * 1.15)),
                    color: '#ff0844',
                    timeline: enemy.timeline,
                    life: 2.2,
                    isReflectedLaser: true,
                    sourceEnemy: enemy
                });

                this.shieldDeflections.push({
                    x: enemy.x + Math.cos(reflectAngle) * (enemy.radius + 10),
                    y: enemy.y + Math.sin(reflectAngle) * (enemy.radius + 10),
                    angle: reflectAngle,
                    color: '#ff0844',
                    life: 0.4,
                    maxLife: 0.4
                });

                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(
                        enemy.x,
                        enemy.y - enemy.radius - 26,
                        '⚡ PHẢN XẠ LASER LƯỢNG TỬ! (Áp sát cận chiến để phá!)',
                        '#ff0844',
                        true
                    );
                }
            }
        }

        // 0B. MINI-BOSS PAST: GIÁP ĐÁ CỔ ĐẠI CỦA CỰ THẠCH HỘ PHÁP (Giảm 60% sát thương tầm xa)
        if (enemy.isMiniBoss && enemy.subType === 'ancient_miniboss' && enemy.stoneArmorActive && !isThornDamage) {
            if (hitDist > 185 || this._isPlayerUsingRangedGun()) {
                finalAmount *= 0.40; // Giảm 60% sát thương tầm xa
                isShieldBlocked = true;

                const deflectAngle = Math.atan2(srcY - enemy.y, srcX - enemy.x);
                this.shieldDeflections.push({
                    x: enemy.x + Math.cos(deflectAngle) * (enemy.radius + 6),
                    y: enemy.y + Math.sin(deflectAngle) * (enemy.radius + 6),
                    angle: deflectAngle,
                    color: '#f59e0b',
                    life: 0.3,
                    maxLife: 0.3
                });

                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(
                        enemy.x,
                        enemy.y - enemy.radius - 24,
                        '🪨 GIÁP ĐÁ CỔ ĐẠI (-60% ST TẦM XA)',
                        '#f59e0b',
                        true
                    );
                }
            }
        }

        // 1. KIỂM TRA KHỐI KHIÊN CHỐNG ĐẠN TẦM XA & ĐIỂM YẾU SAU LƯNG CỦA TANKER (isTanker)
        if (enemy.isTanker && !isAoE && !isThornDamage) {
            const blocked = this._isHitBlockedByShield(enemy, srcX, srcY);
            if (blocked) {
                isShieldBlocked = true;

                if (hitDist > 210) {
                    // Đòn bắn từ xa (> 210px) đập vào khiên: Chặn tới 88% sát thương và nảy mảnh vỡ phản kích!
                    finalAmount *= 0.12;

                    const shardAngle = Math.atan2(srcY - enemy.y, srcX - enemy.x) + (Math.random() - 0.5) * 0.12;
                    this.projectiles.push({
                        x: enemy.x + Math.cos(shardAngle) * (enemy.radius + 10),
                        y: enemy.y + Math.sin(shardAngle) * (enemy.radius + 10),
                        vx: Math.cos(shardAngle) * 390,
                        vy: Math.sin(shardAngle) * 390,
                        radius: 6.5,
                        damage: Math.max(12, Math.round(enemy.damage * 0.7)),
                        color: enemy.timeline === 'FUTURE' ? '#38bdf8' : '#fbbf24',
                        timeline: enemy.timeline,
                        life: 2.0,
                        isRicochetShard: true,
                        sourceEnemy: enemy
                    });

                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(
                            enemy.x,
                            enemy.y - enemy.radius - 22,
                            '🛡️ NẢY ĐẠN TẦM XA! (-88% ST)',
                            enemy.timeline === 'FUTURE' ? '#38bdf8' : '#fbbf24',
                            true
                        );
                    }
                } else if (hitDist < 130) {
                    // Người chơi dũng cảm áp sát < 130px: Gây thêm +25% sát thương xuyên áp lực!
                    isShieldBlocked = false;
                    finalAmount *= 1.25;
                    isVulnerableHit = true;
                } else {
                    // Khoảng cách trung bình (130px - 210px): Chặn 78% như cơ bản
                    finalAmount *= 0.22;
                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(
                            enemy.x,
                            enemy.y - enemy.radius - 22,
                            'CHẶN KHIÊN! (-78%)',
                            enemy.timeline === 'FUTURE' ? '#38bdf8' : '#fbbf24',
                            true
                        );
                    }
                }

                if (isShieldBlocked) {
                    this.shieldDeflections.push({
                        x: enemy.x + Math.cos(enemy.facingAngle) * (enemy.radius + 8),
                        y: enemy.y + Math.sin(enemy.facingAngle) * (enemy.radius + 8),
                        angle: enemy.facingAngle,
                        color: enemy.timeline === 'FUTURE' ? '#00f2fe' : '#f59e0b',
                        life: 0.35,
                        maxLife: 0.35
                    });
                }
            } else {
                // Người chơi vòng ra sau lưng (!blocked) hoặc áp sát < 130px: Tanker nhận thêm +25% sát thương!
                finalAmount *= 1.25;
                isVulnerableHit = true;

                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(
                        enemy.x,
                        enemy.y - enemy.radius - 24,
                        '⚡ ĐÁNH LÉN PHÁ GIÁP! (+25% ST)',
                        '#fde047',
                        true
                    );
                }
            }
        }

        // 2. KHIÊN LỆCH PHA PHẢN CHẤN & TRẠNG THÁI SUY YẾU CỦA BOSS CHÍNH
        if (enemy.isBoss) {
            const currentTimeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
            const requiredTimeline = enemy.shieldTimeline || 'PAST';

            if (currentTimeline !== requiredTimeline && !(enemy.stunTimer > 0)) {
                finalAmount *= 0.05;
                const reducedDmg = Math.max(1, Math.round(finalAmount));
                enemy.hp = Math.max(0, enemy.hp - reducedDmg);
                enemy.hitFlash = 0.08;

                if (!isThornDamage) {
                    const backlashDmg = Math.max(10, Math.round(enemy.damage * 0.45));
                    this._applyDamageToPlayer(backlashDmg, null);
                }

                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(
                        enemy.x,
                        enemy.y - enemy.radius - 18,
                        `PHẢN CHẤN LỆCH PHA! (Đổi sang ${enemy.shieldTimeline})`,
                        '#ff0844',
                        true
                    );
                }

                if (enemy.hp <= 0) {
                    this._handleEnemyDeath(enemy);
                }
                return;
            }

            if (enemy.stunTimer > 0) {
                finalAmount *= 1.35;
                isVulnerableHit = true;
            }
        }

        const dmg = Math.max(1, Math.round(finalAmount));
        enemy.hp = Math.max(0, enemy.hp - dmg);
        enemy.hitFlash = isShieldBlocked ? 0.08 : 0.16;

        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
            let textColor = enemy.isBoss || enemy.isMiniBoss ? '#fde047' : '#ff4757';
            let prefix = '-';
            let suffix = '';

            if (isShieldBlocked) {
                textColor = '#94a3b8';
                suffix = ' (KHIÊN)';
            } else if (isThornDamage) {
                textColor = '#10b981';
                suffix = ' (PHẢN)';
            } else if (isVulnerableHit) {
                textColor = '#00f2fe';
                prefix = isCrit ? 'CRIT -' : '-';
                suffix = enemy.isTanker ? ' (+25%!)' : ' (SUY YẾU!)';
            } else if (isCrit) {
                textColor = '#facc15';
                prefix = 'CRIT -';
                suffix = '!';
            }

            window.Game.Combat.spawnFloatingText(
                enemy.x + (Math.random() - 0.5) * 16,
                enemy.y - enemy.radius - 10,
                `${prefix}${dmg}${suffix}`,
                textColor,
                Boolean(isCrit || isVulnerableHit)
            );
        }

        if (enemy.hp <= 0) {
            this._handleEnemyDeath(enemy);
        }
    },

    _canEnemyMoveTo: function (enemy, nx, ny) {
        if (enemy.isBoss && ny > 1520) return false;
        if (!enemy.isBoss && ny < 1680) return false;
        if (window.Game.World && typeof window.Game.World.canMoveTo !== 'function') return true;
        return window.Game.World.canMoveTo(nx, ny);
    },

    /**
     * THUẬT TOÁN RAYCAST LOOKAHEAD 5 HƯỚNG TRÁNH KẸT CHO QUÁI KITING:
     */
    _findSafeKiteVector: function (enemy, wishVx, wishVy, stepDist) {
        const baseAngle = Math.atan2(wishVy, wishVx);
        const testAngles = [0, 0.61, -0.61, 1.22, -1.22]; // 0°, ±35°, ±70°
        const speed = Math.hypot(wishVx, wishVy);

        for (let i = 0; i < testAngles.length; i++) {
            const a = baseAngle + testAngles[i];
            const testNx = enemy.x + Math.cos(a) * stepDist;
            const testNy = enemy.y + Math.sin(a) * stepDist;

            if (this._canEnemyMoveTo(enemy, testNx, testNy)) {
                return {
                    vx: Math.cos(a) * speed,
                    vy: Math.sin(a) * speed
                };
            }
        }
        return { vx: 0, vy: 0 };
    },

    _updateLootDrops: function (dt, player) {
        const hasPet = Boolean(window.Game.state && window.Game.state.hasPet);
        const magnetRadius = hasPet ? 240 : 120;

        for (let i = this.lootDrops.length - 1; i >= 0; i--) {
            const item = this.lootDrops[i];
            item.life -= dt;
            if (item.life <= 0) {
                this.lootDrops.splice(i, 1);
                continue;
            }

            if (item.z > 0 || item.vz !== 0) {
                item.x += item.vx * dt;
                item.y += item.vy * dt;
                item.vx *= 0.92;
                item.vy *= 0.92;

                item.z += item.vz * dt;
                item.vz -= 380 * dt;

                if (item.z <= 0) {
                    item.z = 0;
                    if (item.bounceCount < 1 && Math.abs(item.vz) > 40) {
                        item.vz = -item.vz * 0.45;
                        item.bounceCount++;
                    } else {
                        item.vz = 0;
                    }
                }
            }

            if (player && player.hp > 0) {
                const dx = player.x - item.x;
                const dy = player.y - item.y;
                const dist = Math.hypot(dx, dy);

                if (dist <= magnetRadius || item.magnetized) {
                    item.magnetized = true;
                    const pullSpeed = 460 + (magnetRadius - Math.min(dist, magnetRadius)) * 2.2;
                    const angle = Math.atan2(dy, dx);
                    item.x += Math.cos(angle) * pullSpeed * dt;
                    item.y += Math.sin(angle) * pullSpeed * dt;
                    item.z = Math.max(0, item.z - 120 * dt);
                }

                if (dist <= (player.radius || 20) + 14) {
                    this._collectLootItem(item, player);
                    this.lootDrops.splice(i, 1);
                }
            }
        }
    },

    _collectLootItem: function (item, player) {
        const state = window.Game.state;

        if (window.Game.Audio && typeof window.Game.Audio.playCoin === 'function') {
            window.Game.Audio.playCoin();
        }

        if (item.type === 'GOLD') {
            if (state) state.gold = (state.gold || 0) + item.value;
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 32, `+${item.value}G`, '#facc15');
            }
        } else if (item.type === 'HP_ORB') {
            const maxHp = player.maxHp || 100;
            player.hp = Math.min(maxHp, player.hp + item.value);
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 32, `+${item.value} HP`, '#4ade80');
            }
        } else if (item.type === 'EXP_ORB') {
            if (window.Game.Systems && typeof window.Game.Systems.addExp === 'function') {
                window.Game.Systems.addExp(item.value);
            }
            if (state) state.rage = Math.min(100, (state.rage || 0) + 8);
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 32, `+${item.value} EXP / +8 NỘ`, '#38bdf8');
            }
        } else if (item.type === 'SHIELD_ORB') {
            const maxShield = player.maxShield || 100;
            player.shield = Math.min(maxShield, (player.shield || 0) + item.value);
            if (window.Game.Combat) {
                if (typeof window.Game.Combat.activateCooldownHaste === 'function') {
                    window.Game.Combat.activateCooldownHaste(3.0);
                }
                if (typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(
                        player.x,
                        player.y - 36,
                        `🛡️ +${item.value} GIÁP & TĂNG TỐC HỒI CHIÊU (3s)!`,
                        '#00f2fe',
                        true
                    );
                }
            }
        } else if (item.type === 'OVERDRIVE_ORB') {
            this._applyPlayerOverdrive(4.0);
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(
                    player.x,
                    player.y - 40,
                    '🔥 NGỌC CUỒNG NỘ: +25 NỘ, LÀM MÁT SÚNG & +20% TỐC ĐÁNH (4s)!',
                    '#ff5722',
                    true
                );
            }
        } else if (item.type === 'SHARD') {
            if (state) state.timeShards = (state.timeShards || 0) + item.value;
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 38, `+${item.value} Mảnh Thời Không`, '#d946ef', true);
            }
        }
    },

    _updateTelegraphs: function (dt, player) {
        for (let i = this.telegraphs.length - 1; i >= 0; i--) {
            const tg = this.telegraphs[i];
            tg.timer -= dt;

            if (tg.timer <= 0) {
                if (tg.type === 'METEOR') {
                    this.healWaves.push({
                        x: tg.x,
                        y: tg.y,
                        radius: 10,
                        maxRadius: tg.radius,
                        color: 'rgba(244, 63, 94, 0.85)',
                        alpha: 1.0
                    });

                    if (player && player.hp > 0) {
                        const dist = Math.hypot(player.x - tg.x, player.y - tg.y);
                        if (dist <= tg.radius + (player.radius || 20) - 4) {
                            this._applyDamageToPlayer(tg.damage || 45, tg.sourceBoss || null);
                        }
                    }
                } else if (tg.type === 'BOSS_DASH' && tg.sourceBoss && !tg.sourceBoss.dead) {
                    const boss = tg.sourceBoss;
                    boss.isDashing = true;
                    boss.dashTimer = 0.48;
                    boss.dashVx = Math.cos(tg.angle) * 640;
                    boss.dashVy = Math.sin(tg.angle) * 640;
                }

                this.telegraphs.splice(i, 1);
            }
        }
    },

    /**
     * CẬP NHẬT AI RIÊNG BIỆT CHO 3 BOSS PHỤ KỶ NGUYÊN (isMiniBoss: true)
     */
    _updateMiniBossAI: function (e, dt, player, distToPlayer, dx, dy) {
        if (!player || player.hp <= 0) return;

        if (e.stunTimer && e.stunTimer > 0) {
            e.stunTimer -= dt;
            return;
        }

        const dirX = dx / (distToPlayer || 1);
        const dirY = dy / (distToPlayer || 1);

        // 1. MINI-BOSS QUÁ KHỨ: CỰ THẠCH HỘ PHÁP (3 vòng sóng chấn động liên hoàn & Giáp Đá)
        if (e.subType === 'ancient_miniboss') {
            e.stoneArmorActive = true;
            e.slamComboCd = (typeof e.slamComboCd === 'number' ? e.slamComboCd : 4.5) - dt;

            if (e.slamComboCd <= 0 && distToPlayer <= 290) {
                e.slamComboCd = 5.2;

                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(
                        e.x,
                        e.y - e.radius - 26,
                        '🌋 TAM TRỌNG ĐỊA CHẤN LIÊN HOÀN!',
                        '#f59e0b',
                        true
                    );
                }

                // Tạo 3 vòng sóng chấn động liên hoàn cách nhau 0.32s với bán kính mở rộng dần
                const ringRadii = [145, 205, 265];
                for (let rIdx = 0; rIdx < 3; rIdx++) {
                    this.queuedWaveRings.push({
                        delay: rIdx * 0.32,
                        x: e.x,
                        y: e.y,
                        maxRadius: ringRadii[rIdx],
                        damage: Math.round(e.damage * (0.85 + rIdx * 0.15)),
                        sourceEnemy: e
                    });
                }
            }

            // Bắn mảnh thiên thạch cổ đại tầm trung
            e.shootCd -= dt;
            if (e.shootCd <= 0 && distToPlayer <= 560) {
                e.shootCd = 2.4;
                const baseAngle = Math.atan2(dy, dx);
                const spread = [-0.22, 0, 0.22];
                for (let k = 0; k < spread.length; k++) {
                    const a = baseAngle + spread[k];
                    this.projectiles.push({
                        x: e.x + Math.cos(a) * (e.radius + 8),
                        y: e.y + Math.sin(a) * (e.radius + 8),
                        vx: Math.cos(a) * 310,
                        vy: Math.sin(a) * 310,
                        radius: 8.5,
                        damage: e.damage,
                        color: '#d97706',
                        timeline: 'PAST',
                        life: 2.6,
                        sourceEnemy: e
                    });
                }
            }

            if (distToPlayer > e.radius + (player.radius || 20) + 10 && distToPlayer <= 680) {
                const nx = e.x + dirX * e.speed * dt;
                const ny = e.y + dirY * e.speed * dt;
                if (this._canEnemyMoveTo(e, nx, e.y)) e.x = nx;
                if (this._canEnemyMoveTo(e, e.x, ny)) e.y = ny;
            }
        }

        // 2. MINI-BOSS HIỆN TẠI: MẪU HOÀNG ĐỘC TỐ (Chùm 5 quả cầu axit độc & Triệu hồi 2 quái tự bạo mỗi 9s)
        else if (e.subType === 'mutant_miniboss') {
            e.acidBarrageCd = (typeof e.acidBarrageCd === 'number' ? e.acidBarrageCd : 2.5) - dt;
            if (e.acidBarrageCd <= 0 && distToPlayer <= 620) {
                e.acidBarrageCd = 2.5;
                const baseAngle = Math.atan2(dy, dx);
                // Bắn chùm 5 quả cầu axit độc
                const spread5 = [-0.36, -0.18, 0, 0.18, 0.36];
                for (let k = 0; k < spread5.length; k++) {
                    const a = baseAngle + spread5[k];
                    this.projectiles.push({
                        x: e.x + Math.cos(a) * (e.radius + 8),
                        y: e.y + Math.sin(a) * (e.radius + 8),
                        vx: Math.cos(a) * 330,
                        vy: Math.sin(a) * 330,
                        radius: 8,
                        damage: Math.round(e.damage * 0.9),
                        color: '#a3e635',
                        timeline: 'PRESENT',
                        life: 2.8,
                        sourceEnemy: e
                    });
                }
            }

            // Triệu hồi 2 quái tự bạo nhỏ mỗi 9 giây
            e.summonBroodCd = (typeof e.summonBroodCd === 'number' ? e.summonBroodCd : 9.0) - dt;
            if (e.summonBroodCd <= 0 && distToPlayer <= 680) {
                e.summonBroodCd = 9.0;
                this._spawnMutantMinions(e);
            }

            // Di chuyển chiến thuật giữ khoảng cách vừa phải
            if (distToPlayer <= 680) {
                let moveVx = 0;
                let moveVy = 0;
                if (distToPlayer < 190) {
                    const safeVec = this._findSafeKiteVector(e, -dirX * e.speed, -dirY * e.speed, e.speed * dt * 2.2);
                    moveVx = safeVec.vx;
                    moveVy = safeVec.vy;
                } else if (distToPlayer > 290) {
                    moveVx = dirX * e.speed;
                    moveVy = dirY * e.speed;
                } else {
                    e.strafeTimer = (e.strafeTimer || 1.5) - dt;
                    if (e.strafeTimer <= 0) {
                        e.strafeDir = (e.strafeDir || 1) * -1;
                        e.strafeTimer = 1.6;
                    }
                    moveVx = -dirY * (e.strafeDir || 1) * e.speed * 0.85;
                    moveVy = dirX * (e.strafeDir || 1) * e.speed * 0.85;
                }
                const nx = e.x + moveVx * dt;
                const ny = e.y + moveVy * dt;
                if (this._canEnemyMoveTo(e, nx, e.y)) e.x = nx;
                if (this._canEnemyMoveTo(e, e.x, ny)) e.y = ny;
            }
        }

        // 3. MINI-BOSS TƯƠNG LAI: CHIẾN GIÁP PHẢN QUANG (Khiên Gương Lượng Tử 3s mỗi 8s)
        else if (e.subType === 'robot_miniboss') {
            if (e.mirrorShieldActive) {
                e.mirrorShieldTimer -= dt;
                if (e.mirrorShieldTimer <= 0) {
                    e.mirrorShieldActive = false;
                }
            } else {
                e.mirrorShieldCd = (typeof e.mirrorShieldCd === 'number' ? e.mirrorShieldCd : 8.0) - dt;
                if (e.mirrorShieldCd <= 0 && distToPlayer <= 680) {
                    e.mirrorShieldActive = true;
                    e.mirrorShieldTimer = 3.0;
                    e.mirrorShieldCd = 8.0; // Chu kỳ mỗi 8 giây kích hoạt 3 giây

                    this.healWaves.push({
                        x: e.x,
                        y: e.y,
                        radius: 16,
                        maxRadius: 120,
                        color: 'rgba(56, 189, 248, 0.85)',
                        alpha: 1.0
                    });

                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(
                            e.x,
                            e.y - e.radius - 28,
                            '🪞 KHIÊN GƯƠNG LƯỢNG TỬ (3s) - PHẢN ĐẠN SÚNG!',
                            '#38bdf8',
                            true
                        );
                    }
                }
            }

            e.shootCd -= dt;
            if (e.shootCd <= 0 && distToPlayer <= 620) {
                e.shootCd = 1.75;
                const aimAngle = Math.atan2(dy, dx);
                const spread = [-0.16, 0, 0.16];
                for (let k = 0; k < spread.length; k++) {
                    const a = aimAngle + spread[k];
                    this.projectiles.push({
                        x: e.x + Math.cos(a) * (e.radius + 10),
                        y: e.y + Math.sin(a) * (e.radius + 10),
                        vx: Math.cos(a) * 380,
                        vy: Math.sin(a) * 380,
                        radius: 7,
                        damage: e.damage,
                        color: '#00f2fe',
                        timeline: 'FUTURE',
                        life: 2.5,
                        sourceEnemy: e
                    });
                }
            }

            if (distToPlayer <= 680) {
                let moveVx = 0;
                let moveVy = 0;
                if (distToPlayer > 250) {
                    moveVx = dirX * e.speed;
                    moveVy = dirY * e.speed;
                } else {
                    e.strafeTimer = (e.strafeTimer || 1.5) - dt;
                    if (e.strafeTimer <= 0) {
                        e.strafeDir = (e.strafeDir || 1) * -1;
                        e.strafeTimer = 1.5;
                    }
                    moveVx = -dirY * (e.strafeDir || 1) * e.speed * 0.9;
                    moveVy = dirX * (e.strafeDir || 1) * e.speed * 0.9;
                }
                const nx = e.x + moveVx * dt;
                const ny = e.y + moveVy * dt;
                if (this._canEnemyMoveTo(e, nx, e.y)) e.x = nx;
                if (this._canEnemyMoveTo(e, e.x, ny)) e.y = ny;
            }
        }
    },

    _updateBossAI: function (boss, dt, player, distToPlayer, dx, dy) {
        if (boss.stunTimer > 0) {
            boss.stunTimer -= dt;
            boss.isDashing = false;
            return;
        }

        const hpRatio = boss.hp / Math.max(1, boss.maxHp);
        if (hpRatio > 0.65) {
            boss.phase = 1;
        } else if (hpRatio >= 0.32) {
            boss.phase = 2;
        } else {
            boss.phase = 3;
        }

        if (!player || player.y > 1650) {
            boss.isDashing = false;
            const homeDx = 1920 - boss.x;
            const homeDy = 1050 - boss.y;
            const homeDist = Math.hypot(homeDx, homeDy);

            if (homeDist > 8) {
                boss.x += (homeDx / homeDist) * boss.speed * 1.5 * dt;
                boss.y += (homeDy / homeDist) * boss.speed * 1.5 * dt;
            }
            if (boss.hp < boss.maxHp) {
                boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.08 * dt);
            }
            return;
        }

        boss.phaseShiftTimer = (typeof boss.phaseShiftTimer === 'number' ? boss.phaseShiftTimer : 8.0) - dt;

        if (boss.phaseShiftTimer <= 1.5 && !boss.phaseShiftWarningActive && distToPlayer <= 1000) {
            boss.phaseShiftWarningActive = true;
            const timelines = ['PAST', 'PRESENT', 'FUTURE'];
            const candidates = timelines.filter(t => t !== boss.shieldTimeline);
            boss.nextShieldTimeline = candidates[Math.floor(Math.random() * candidates.length)] || 'FUTURE';

            const nextTlName = boss.nextShieldTimeline === 'PAST' ? 'QUÁ KHỨ' :
                               boss.nextShieldTimeline === 'PRESENT' ? 'HIỆN TẠI' : 'TƯƠNG LAI';

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(
                    boss.x,
                    boss.y - boss.radius - 54,
                    `⚠️ SẮP ĐỔI KHIÊN: ${nextTlName} (1.5s)!`,
                    '#fbbf24',
                    true
                );
            }

            this.telegraphs.push({
                type: 'PHASE_SHIFT_WARNING',
                x: boss.x,
                y: boss.y,
                radius: boss.radius + 34,
                timer: 1.5,
                maxTimer: 1.5,
                targetTimeline: boss.nextShieldTimeline,
                sourceBoss: boss
            });
        }

        if (boss.phaseShiftTimer <= 0 && distToPlayer <= 900) {
            boss.phaseShiftTimer = boss.phase === 3 ? 6.0 : 8.0;
            boss.phaseShiftWarningActive = false;

            if (boss.nextShieldTimeline) {
                boss.shieldTimeline = boss.nextShieldTimeline;
                boss.nextShieldTimeline = null;
            } else {
                const timelines = ['PAST', 'PRESENT', 'FUTURE'];
                const candidates = timelines.filter(t => t !== boss.shieldTimeline);
                boss.shieldTimeline = candidates[Math.floor(Math.random() * candidates.length)] || 'FUTURE';
            }

            boss.shatterAvailable = true;

            this.healWaves.push({
                x: boss.x,
                y: boss.y,
                radius: 20,
                maxRadius: 240,
                color: boss.shieldTimeline === 'PAST'
                    ? 'rgba(245, 158, 11, 0.85)'
                    : boss.shieldTimeline === 'PRESENT'
                    ? 'rgba(16, 185, 129, 0.85)'
                    : 'rgba(0, 242, 254, 0.85)',
                alpha: 1.0
            });

            const currentTlName = boss.shieldTimeline === 'PAST' ? 'QUÁ KHỨ' :
                                  boss.shieldTimeline === 'PRESENT' ? 'HIỆN TẠI' : 'TƯƠNG LAI';

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(
                    boss.x,
                    boss.y - boss.radius - 48,
                    `⚡ KHIÊN THỜI KHÔNG ĐÃ ĐỔI: ${currentTlName}!`,
                    '#00f2fe',
                    true
                );
            }
        }

        if (boss.isDashing) {
            boss.dashTimer -= dt;
            const nx = boss.x + boss.dashVx * dt;
            const ny = boss.y + boss.dashVy * dt;
            if (this._canEnemyMoveTo(boss, nx, boss.y)) boss.x = nx;
            if (this._canEnemyMoveTo(boss, boss.x, ny)) boss.y = ny;

            if (distToPlayer <= boss.radius + (player.radius || 20) + 12 && boss.attackCd <= 0) {
                boss.attackCd = 0.55;
                this._applyDamageToPlayer(boss.damage * 1.45, boss);
            }

            if (boss.dashTimer <= 0) {
                boss.isDashing = false;
            }
            return;
        }

        if (distToPlayer <= 880 && distToPlayer > boss.radius + (player.radius || 20) - 4) {
            const speedMult = boss.phase === 3 ? 1.35 : boss.phase === 2 ? 1.18 : 1.05;
            const vx = (dx / (distToPlayer || 1)) * boss.speed * speedMult;
            const vy = (dy / (distToPlayer || 1)) * boss.speed * speedMult;
            const nx = boss.x + vx * dt;
            const ny = boss.y + vy * dt;

            if (this._canEnemyMoveTo(boss, nx, boss.y)) boss.x = nx;
            if (this._canEnemyMoveTo(boss, boss.x, ny)) boss.y = ny;
        }

        boss.radialCd -= dt;
        if (boss.radialCd <= 0 && distToPlayer <= 860) {
            boss.radialCd = boss.phase === 3 ? 1.75 : boss.phase === 2 ? 2.2 : 2.7;
            const bulletCount = boss.phase === 3 ? 16 : 12;
            const timeAngle = performance.now() * 0.002;
            boss.spiralOffset = (boss.spiralOffset || 0) + 0.42;

            for (let b = 0; b < bulletCount; b++) {
                const aCW = timeAngle + boss.spiralOffset + (b * Math.PI * 2) / bulletCount;
                this.projectiles.push({
                    x: boss.x + Math.cos(aCW) * (boss.radius + 8),
                    y: boss.y + Math.sin(aCW) * (boss.radius + 8),
                    vx: Math.cos(aCW) * 285,
                    vy: Math.sin(aCW) * 285,
                    radius: 8,
                    damage: Math.round(boss.damage * 0.85),
                    color: boss.phase === 3 ? '#ff0844' : '#d946ef',
                    timeline: 'ALL',
                    life: 3.5,
                    sourceEnemy: boss
                });
            }

            for (let b = 0; b < bulletCount; b++) {
                const aCCW = -timeAngle - boss.spiralOffset + (b * Math.PI * 2) / bulletCount + Math.PI / bulletCount;
                this.projectiles.push({
                    x: boss.x + Math.cos(aCCW) * (boss.radius + 14),
                    y: boss.y + Math.sin(aCCW) * (boss.radius + 14),
                    vx: Math.cos(aCCW) * 230,
                    vy: Math.sin(aCCW) * 230,
                    radius: 7,
                    damage: Math.round(boss.damage * 0.78),
                    color: '#00f2fe',
                    timeline: 'ALL',
                    life: 3.6,
                    sourceEnemy: boss
                });
            }
        }

        boss.shootCd -= dt;
        if (boss.shootCd <= 0 && distToPlayer <= 840) {
            boss.shootCd = boss.phase === 3 ? 1.15 : 1.65;
            const leadX = player.x + (player.vx || 0) * 0.25;
            const leadY = player.y + (player.vy || 0) * 0.25;
            const aimAngle = Math.atan2(leadY - boss.y, leadX - boss.x);
            const spreadCount = boss.phase >= 2 ? 2 : 1;

            for (let s = -spreadCount; s <= spreadCount; s++) {
                const spreadAngle = aimAngle + s * 0.15;
                this.projectiles.push({
                    x: boss.x + Math.cos(spreadAngle) * (boss.radius + 10),
                    y: boss.y + Math.sin(spreadAngle) * (boss.radius + 10),
                    vx: Math.cos(spreadAngle) * 365,
                    vy: Math.sin(spreadAngle) * 365,
                    radius: 7,
                    damage: Math.round(boss.damage * 0.75),
                    color: '#38bdf8',
                    timeline: 'ALL',
                    life: 2.6,
                    sourceEnemy: boss
                });
            }
        }

        if (boss.phase >= 2) {
            boss.satelliteAngle += dt * 3.4;
            if (boss.satelliteHitCd > 0) {
                boss.satelliteHitCd = Math.max(0, boss.satelliteHitCd - dt);
            }

            const orbitRadius = boss.radius + 54;
            for (let s = 0; s < 2; s++) {
                const sa = boss.satelliteAngle + s * Math.PI;
                const satX = boss.x + Math.cos(sa) * orbitRadius;
                const satY = boss.y + Math.sin(sa) * orbitRadius;
                const distSat = Math.hypot(player.x - satX, player.y - satY);

                if (distSat <= 18 + (player.radius || 20) && boss.satelliteHitCd <= 0) {
                    boss.satelliteHitCd = 0.55;
                    this._applyDamageToPlayer(Math.round(boss.damage * 0.9), boss);
                }
            }

            boss.dashCd -= dt;
            if (boss.dashCd <= 0 && distToPlayer <= 680) {
                boss.dashCd = boss.phase === 3 ? 4.2 : 5.5;
                const dashAngle = Math.atan2(dy, dx);
                this.telegraphs.push({
                    type: 'BOSS_DASH',
                    x: boss.x,
                    y: boss.y,
                    angle: dashAngle,
                    length: 300,
                    width: boss.radius * 1.8,
                    timer: 0.7,
                    maxTimer: 0.7,
                    sourceBoss: boss
                });
            }
        }

        if (boss.phase === 3) {
            boss.timeWarpCd -= dt;
            if (boss.timeWarpCd <= 0) {
                boss.timeWarpCd = 7.5;
                const timelines = ['PAST', 'PRESENT', 'FUTURE'];
                const currentTl = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
                const otherTimelines = timelines.filter(t => t !== currentTl);
                const randomTimeline = otherTimelines[Math.floor(Math.random() * otherTimelines.length)] || 'FUTURE';

                if (window.Game.state) {
                    window.Game.state.timeline = randomTimeline;
                    if (window.Game.Systems && typeof window.Game.Systems.updateTimelineBadge === 'function') {
                        window.Game.Systems.updateTimelineBadge();
                    }
                    if (window.Game.World && typeof window.Game.World.ensureSafePlayerPosition === 'function') {
                        window.Game.World.ensureSafePlayerPosition();
                    }
                }

                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(
                        player.x,
                        player.y - 65,
                        'CHÚA TỂ THỜI KHÔNG ĐANG BẺ CONG DÒNG THỜI GIAN!',
                        '#f43f5e',
                        true
                    );
                }
            }

            boss.meteorCd -= dt;
            if (boss.meteorCd <= 0 && distToPlayer <= 840) {
                boss.meteorCd = 4.2;
                for (let m = 0; m < 6; m++) {
                    const offsetAngle = (m * Math.PI * 2) / 6 + Math.random() * 0.5;
                    const offsetDist = m === 0 ? 0 : 65 + Math.random() * 115;
                    const mx = player.x + Math.cos(offsetAngle) * offsetDist;
                    const my = Math.min(1500, player.y + Math.sin(offsetAngle) * offsetDist);

                    this.telegraphs.push({
                        type: 'METEOR',
                        x: mx,
                        y: my,
                        radius: 66,
                        timer: 0.9,
                        maxTimer: 0.9,
                        damage: Math.round(boss.damage * 1.4),
                        sourceBoss: boss
                    });
                }
            }
        }
    },

    update: function (dt) {
        if (window.Game.state && window.Game.state.isPaused) return;

        const state = window.Game.state;
        const currentTimeline = (state && state.timeline) || 'PRESENT';
        const player = window.Game.player;

        if (this.playerSlowTimer > 0) {
            this.playerSlowTimer -= dt;
            if (this.playerSlowTimer <= 0) {
                this._clearPlayerSlow();
            }
        }

        if (this.playerOverdriveTimer > 0) {
            this.playerOverdriveTimer -= dt;
            if (this.playerOverdriveTimer <= 0) {
                this._clearPlayerOverdrive();
            }
        }

        // Cập nhật hàng đợi 3 vòng sóng chấn động liên hoàn của Cự Thạch Hộ Pháp
        for (let i = this.queuedWaveRings.length - 1; i >= 0; i--) {
            const qr = this.queuedWaveRings[i];
            qr.delay -= dt;
            if (qr.delay <= 0) {
                this.healWaves.push({
                    x: qr.x,
                    y: qr.y,
                    radius: 16,
                    maxRadius: qr.maxRadius,
                    color: 'rgba(245, 158, 11, 0.9)',
                    alpha: 1.0
                });

                if (player && player.hp > 0) {
                    const d = Math.hypot(player.x - qr.x, player.y - qr.y);
                    if (d <= qr.maxRadius + (player.radius || 20)) {
                        this._applyDamageToPlayer(qr.damage, qr.sourceEnemy || null);
                        this._applyPlayerSlow(1.4);
                    }
                }
                this.queuedWaveRings.splice(i, 1);
            }
        }

        for (let i = this.healWaves.length - 1; i >= 0; i--) {
            const hw = this.healWaves[i];
            hw.radius += (hw.maxRadius - hw.radius) * 8 * dt;
            hw.alpha -= dt * 1.8;
            if (hw.alpha <= 0) {
                this.healWaves.splice(i, 1);
            }
        }

        for (let i = this.healLinks.length - 1; i >= 0; i--) {
            const link = this.healLinks[i];
            link.life -= dt;
            if (link.life <= 0) {
                this.healLinks.splice(i, 1);
            }
        }

        for (let i = this.shieldDeflections.length - 1; i >= 0; i--) {
            const sd = this.shieldDeflections[i];
            sd.life -= dt;
            if (sd.life <= 0) {
                this.shieldDeflections.splice(i, 1);
            }
        }

        for (let i = this.evadeAfterimages.length - 1; i >= 0; i--) {
            const af = this.evadeAfterimages[i];
            af.life -= dt;
            if (af.life <= 0) {
                this.evadeAfterimages.splice(i, 1);
            }
        }

        this._updateLootDrops(dt, player);

        const isFrozen = Boolean(state && typeof state.chronoFreezeTimer === 'number' && state.chronoFreezeTimer > 0);
        if (isFrozen) {
            state.chronoFreezeTimer = Math.max(0, state.chronoFreezeTimer - dt);
            for (let i = 0; i < this.list.length; i++) {
                const e = this.list[i];
                if (e.hitFlash > 0) {
                    e.hitFlash = Math.max(0, e.hitFlash - dt);
                }
                if (e.isBoss && !e.dead && e.hp > 0 && player) {
                    const dx = player.x - e.x;
                    const dy = player.y - e.y;
                    this._updateBossAI(e, dt * 0.35, player, Math.hypot(dx, dy), dx, dy);
                }
            }
            return;
        }

        this._updateTelegraphs(dt, player);

        const cam = window.Game.camera || {
            x: (player && player.x - 640) || 0,
            y: (player && player.y - 360) || 0,
            width: 1280,
            height: 720
        };

        for (let i = this.list.length - 1; i >= 0; i--) {
            const e = this.list[i];

            if (e.dead) {
                // Xóa hẳn quái triệu hồi sau khi chết
                if (e.isSummonedMinion) {
                    this.list.splice(i, 1);
                    continue;
                }

                if (e.respawnTimer > 0) {
                    e.respawnTimer -= dt;
                    if (e.respawnTimer <= 0) {
                        e.dead = false;
                        e.hitFlash = 0;

                        if (e.isBoss) {
                            const loop = (window.Game.state && window.Game.state.loopLevel) || 1;
                            e.x = 1920;
                            e.y = 1050;
                            e.maxHp = Math.round(22000 * Math.pow(1.85, loop - 1));
                            e.hp = e.maxHp;
                            e.damage = Math.round(e.baseDamage * Math.pow(1.5, loop - 1));
                            e.goldReward = Math.round(e.baseGoldReward * Math.pow(1.5, loop - 1));
                            e.phase = 1;
                            e.shieldTimeline = 'PAST';
                            e.nextShieldTimeline = null;
                            e.phaseShiftTimer = 8.0;
                            e.phaseShiftWarningActive = false;
                            e.shatterAvailable = true;
                            e.stunTimer = 0;
                            e.isDashing = false;
                            e.dashTimer = 0;
                            e.radialCd = 2.0;
                            e.shootCd = 1.2;

                            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function' && player) {
                                window.Game.Combat.spawnFloatingText(
                                    player.x,
                                    player.y - 60,
                                    `CHÚA TỂ TÁI SINH (CHU KỲ ${loop})!`,
                                    '#ff0844',
                                    true
                                );
                            }
                        } else {
                            e.x = e.spawnX;
                            e.y = e.spawnY;
                            this._applyEliteRoll(e);
                        }
                    }
                }
                continue;
            }

            if (!e.isBoss && e.timeline !== currentTimeline) {
                continue;
            }

            if (e.hitFlash > 0) {
                e.hitFlash = Math.max(0, e.hitFlash - dt);
            }
            if (e.attackCd > 0) {
                e.attackCd = Math.max(0, e.attackCd - dt);
            }
            if (e.evadeCd > 0) {
                e.evadeCd = Math.max(0, e.evadeCd - dt);
            }

            if (e.isBoss) {
                const dx = player ? player.x - e.x : 0;
                const dy = player ? player.y - e.y : 0;
                const distToPlayer = Math.hypot(dx, dy);
                this._updateBossAI(e, dt, player, distToPlayer, dx, dy);

                if (
                    player &&
                    player.hp > 0 &&
                    distToPlayer <= e.radius + (player.radius || 20) + 6 &&
                    e.attackCd <= 0
                ) {
                    e.attackCd = 0.85;
                    this._applyDamageToPlayer(e.damage, e);
                }
                continue;
            }

            const inUpdateRange =
                e.isMiniBoss ||
                (e.x >= cam.x - 600 &&
                    e.x <= cam.x + cam.width + 600 &&
                    e.y >= cam.y - 600 &&
                    e.y <= cam.y + cam.height + 600);

            if (!inUpdateRange || !player) {
                continue;
            }

            const dx = player.x - e.x;
            const dy = player.y - e.y;
            const distToPlayer = Math.hypot(dx, dy);
            const aggroRange = e.isMiniBoss ? 720 : e.isElite ? 620 : 520;

            if (distToPlayer <= aggroRange) {
                e.facingAngle = Math.atan2(dy, dx);
            }

            // CẬP NHẬT AI CHO 3 BOSS PHỤ KỶ NGUYÊN (isMiniBoss: true)
            if (e.isMiniBoss) {
                this._updateMiniBossAI(e, dt, player, distToPlayer, dx, dy);

                const touchDist = (e.radius || 34) + (player.radius || 20) + 6;
                if (distToPlayer <= touchDist && e.attackCd <= 0) {
                    e.attackCd = 0.85;
                    this._applyDamageToPlayer(e.damage, e);
                }
                continue;
            }

            /**
             * CƠ CHẾ NÉ TIA NGẮM (EVASIVE SIDESTEP - ANTI-SNIPER AI):
             * Khi người chơi cầm laser_gun hoặc chrono_cannon và hướng mặt về phía quái isKiter / isElite
             * (góc lệch < 20 độ ~ 0.349 rad, khoảng cách 180px - 450px), quái có evadeCd (hồi mỗi 3.2s)
             * lập tức lướt ngang vuông góc 90 độ (evadeTimer = 0.22s, tốc độ x2.4) kèm vệt bóng mờ!
             */
            if (
                (e.isKiter || e.isElite) &&
                !e.isTanker &&
                e.evadeCd <= 0 &&
                (e.evadeTimer || 0) <= 0 &&
                distToPlayer >= 180 &&
                distToPlayer <= 450 &&
                this._isPlayerUsingRangedGun()
            ) {
                const anglePlayerToEnemy = Math.atan2(e.y - player.y, e.x - player.x);
                const playerAim = this._getPlayerAimAngle(player, e);
                const angleDiff = Math.abs(Math.atan2(Math.sin(playerAim - anglePlayerToEnemy), Math.cos(playerAim - anglePlayerToEnemy)));

                // 20 độ = 0.349065 rad
                if (angleDiff < 0.349) {
                    e.evadeCd = 3.2;
                    e.evadeTimer = 0.22;
                    const sideSign = Math.random() < 0.5 ? 1 : -1;
                    const perpAngle = anglePlayerToEnemy + (Math.PI / 2) * sideSign;
                    const dashSpeed = e.speed * 2.4;

                    const safeEvade = this._findSafeKiteVector(
                        e,
                        Math.cos(perpAngle) * dashSpeed,
                        Math.sin(perpAngle) * dashSpeed,
                        dashSpeed * 0.22
                    );
                    e.evadeVx = safeEvade.vx;
                    e.evadeVy = safeEvade.vy;
                    e.afterimageTick = 0;

                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(
                            e.x,
                            e.y - e.radius - 18,
                            '💨 LƯỚT NÉ ĐẠN!',
                            '#38bdf8'
                        );
                    }
                }
            }

            // Đang trong trạng thái lướt ngang né đạn (Evasive Sidestep)
            if (e.evadeTimer && e.evadeTimer > 0) {
                e.evadeTimer -= dt;
                e.afterimageTick = (e.afterimageTick || 0) - dt;
                if (e.afterimageTick <= 0) {
                    e.afterimageTick = 0.045;
                    this.evadeAfterimages.push({
                        x: e.x,
                        y: e.y,
                        radius: e.radius,
                        color: e.timeline === 'FUTURE' ? '#00f2fe' : e.timeline === 'PAST' ? '#34d399' : '#c084fc',
                        life: 0.24,
                        maxLife: 0.24
                    });
                }

                const enx = e.x + (e.evadeVx || 0) * dt;
                const eny = e.y + (e.evadeVy || 0) * dt;
                if (this._canEnemyMoveTo(e, enx, e.y)) e.x = enx;
                if (this._canEnemyMoveTo(e, e.x, eny)) e.y = eny;
                continue;
            }

            // Golem Địa Chấn
            if (e.type === 'ancient' && e.subType === 'golem') {
                if (e.groundSlamCd > 0) {
                    e.groundSlamCd = Math.max(0, e.groundSlamCd - dt);
                }
                if (e.hp / Math.max(1, e.maxHp) < 0.40 && e.groundSlamCd <= 0 && distToPlayer <= 190) {
                    e.groundSlamCd = 4.2;
                    const slamRadius = 155;

                    this.healWaves.push({
                        x: e.x,
                        y: e.y,
                        radius: 14,
                        maxRadius: slamRadius,
                        color: 'rgba(245, 158, 11, 0.88)',
                        alpha: 1.0
                    });

                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(e.x, e.y - e.radius - 18, 'ĐỊA CHẤN CỔ ĐẠI!', '#f59e0b');
                    }

                    if (distToPlayer <= slamRadius + (player.radius || 20)) {
                        this._applyDamageToPlayer(Math.round(e.damage * 0.85), e);
                        this._applyPlayerSlow(1.6);
                        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                            window.Game.Combat.spawnFloatingText(player.x, player.y - 42, 'LÀM CHẬM (-25% TỐC)!', '#f59e0b');
                        }
                    }
                }
            }

            // Shaman Trị Liệu & Bắn Phép
            if (e.type === 'ancient' && e.subType === 'shaman') {
                e.healCd -= dt;
                if (e.healCd <= 0) {
                    e.healCd = 3.0;
                    const healRadius = 260;
                    const loop = (window.Game.state && window.Game.state.loopLevel) || 1;
                    const healAmount = Math.round(35 * Math.pow(1.7, Math.max(0, loop - 1)));

                    this.healWaves.push({
                        x: e.x,
                        y: e.y,
                        radius: 15,
                        maxRadius: healRadius,
                        color: 'rgba(16, 185, 129, 0.75)',
                        alpha: 1.0
                    });

                    for (let j = 0; j < this.list.length; j++) {
                        const ally = this.list[j];
                        if (
                            !ally.dead &&
                            ally.hp > 0 &&
                            ally.timeline === 'PAST' &&
                            Math.hypot(ally.x - e.x, ally.y - e.y) <= healRadius
                        ) {
                            if (ally.hp < ally.maxHp) {
                                ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
                                if (ally.id !== e.id) {
                                    this.healLinks.push({
                                        x1: e.x,
                                        y1: e.y,
                                        x2: ally.x,
                                        y2: ally.y,
                                        life: 0.55,
                                        maxLife: 0.55
                                    });
                                }
                            }
                        }
                    }
                }

                if (distToPlayer <= 520) {
                    e.shootCd -= dt;
                    if (e.shootCd <= 0) {
                        e.shootCd = e.isElite ? 1.4 : 1.9;
                        const aimAngle = Math.atan2(dy, dx);
                        const spread = e.isElite ? [-0.15, 0, 0.15] : [0];
                        for (let k = 0; k < spread.length; k++) {
                            const a = aimAngle + spread[k];
                            this.projectiles.push({
                                x: e.x + Math.cos(a) * (e.radius + 6),
                                y: e.y + Math.sin(a) * (e.radius + 6),
                                vx: Math.cos(a) * 300,
                                vy: Math.sin(a) * 300,
                                radius: 7,
                                damage: e.damage,
                                color: '#f97316',
                                timeline: 'PAST',
                                life: 2.5,
                                sourceEnemy: e
                            });
                        }
                    }
                }
            }

            // Quái Đột Biến Tự Bạo
            if (e.type === 'mutant' && e.hp > 0 && e.hp / e.maxHp < 0.32 && !e.kamikazeActive) {
                e.kamikazeActive = true;
                e.kamikazeTimer = 1.8;
                e.kamikazeMaxTimer = 1.8;
                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(e.x, e.y - e.radius - 16, '⚠️ TỰ BẠO ĐỘC TỐ!', '#ef4444');
                }
            }

            if (e.type === 'mutant' && e.kamikazeActive) {
                e.kamikazeTimer -= dt;
                const explodeTriggerDist = e.radius + (player.radius || 20) + 16;
                if (distToPlayer <= explodeTriggerDist || e.kamikazeTimer <= 0) {
                    const explosionRadius = e.isSummonedMinion ? 105 : 130;
                    this.healWaves.push({
                        x: e.x,
                        y: e.y,
                        radius: 12,
                        maxRadius: explosionRadius,
                        color: 'rgba(239, 68, 68, 0.88)',
                        alpha: 1.0
                    });

                    if (distToPlayer <= explosionRadius) {
                        this._applyDamageToPlayer(Math.round(e.damage * (e.isSummonedMinion ? 1.65 : 2.2)), e);
                    }

                    this.damageEnemy(e, e.hp + 999999, false, false, true);
                    continue;
                }
            }

            // Robot Xạ Thủ Bắn Tỉa (Ranged)
            if (e.type === 'robot' && e.isKiter && distToPlayer <= 540) {
                e.shootCd -= dt;
                if (e.shootCd <= 0) {
                    e.shootCd = e.isElite ? 1.25 : 1.7;
                    const aimAngle = Math.atan2(dy, dx);
                    const spread = e.isElite ? [-0.14, 0, 0.14] : [0];
                    for (let k = 0; k < spread.length; k++) {
                        const a = aimAngle + spread[k];
                        this.projectiles.push({
                            x: e.x + Math.cos(a) * (e.radius + 6),
                            y: e.y + Math.sin(a) * (e.radius + 6),
                            vx: Math.cos(a) * 350,
                            vy: Math.sin(a) * 350,
                            radius: 6,
                            damage: e.damage,
                            color: '#00f2fe',
                            timeline: 'FUTURE',
                            life: 2.3,
                            sourceEnemy: e
                        });
                    }
                }
            }

            /**
             * BỘ NÃO DI CHUYỂN CHIẾN THUẬT & ĐỘI HÌNH LIÊN KẾT (TACTICAL SYNERGY):
             * - Nếu Quái Kiter bị mất máu (e.hp < e.maxHp), ưu tiên tìm đồng đội isTanker gần đó
             *   và di chuyển lùi về điểm nấp phía sau lưng Tanker (ngược hướng người chơi) để được che đạn!
             */
            let moveVx = 0;
            let moveVy = 0;
            const currentSpeed = e.kamikazeActive ? e.speed * 1.85 : e.speed;

            if (distToPlayer <= aggroRange) {
                const dirX = dx / (distToPlayer || 1);
                const dirY = dy / (distToPlayer || 1);

                if (e.isKiter) {
                    let usedTankerCover = false;

                    // TACTICAL SYNERGY: Kiter mất máu tìm Tanker đồng đội để nấp sau lưng
                    if (e.hp < e.maxHp) {
                        const protector = this._findNearbyTankerAlly(e);
                        if (protector) {
                            const pToTankerX = protector.x - player.x;
                            const pToTankerY = protector.y - player.y;
                            const pToTankerDist = Math.hypot(pToTankerX, pToTankerY) || 1;

                            // Điểm nấp nằm phía sau lưng Tanker 72px tính từ hướng người chơi
                            const coverX = protector.x + (pToTankerX / pToTankerDist) * 72;
                            const coverY = protector.y + (pToTankerY / pToTankerDist) * 72;
                            const toCoverX = coverX - e.x;
                            const toCoverY = coverY - e.y;
                            const toCoverDist = Math.hypot(toCoverX, toCoverY);

                            e.synergyTankerId = protector.id;

                            if (toCoverDist > 22) {
                                const coverSpeed = currentSpeed * 1.22;
                                const safeCoverVec = this._findSafeKiteVector(
                                    e,
                                    (toCoverX / toCoverDist) * coverSpeed,
                                    (toCoverY / toCoverDist) * coverSpeed,
                                    coverSpeed * dt * 2.2
                                );
                                moveVx = safeCoverVec.vx;
                                moveVy = safeCoverVec.vy;
                                usedTankerCover = true;
                            }
                        } else {
                            e.synergyTankerId = null;
                        }
                    } else {
                        e.synergyTankerId = null;
                    }

                    if (!usedTankerCover) {
                        const safeDistMin = 220;
                        const safeDistMax = 280;

                        if (distToPlayer < 200) {
                            const retreatSpeed = currentSpeed * 1.25;
                            const wishVx = -dirX * retreatSpeed;
                            const wishVy = -dirY * retreatSpeed;

                            const safeVec = this._findSafeKiteVector(e, wishVx, wishVy, retreatSpeed * dt * 2.5);
                            moveVx = safeVec.vx;
                            moveVy = safeVec.vy;
                        } else if (distToPlayer >= safeDistMin && distToPlayer <= safeDistMax) {
                            e.strafeTimer -= dt;
                            if (e.strafeTimer <= 0) {
                                e.strafeDir *= -1;
                                e.strafeTimer = 1.2 + Math.random() * 1.2;
                            }
                            const perpX = -dirY * e.strafeDir;
                            const perpY = dirX * e.strafeDir;
                            moveVx = perpX * currentSpeed * 0.85;
                            moveVy = perpY * currentSpeed * 0.85;
                        } else if (distToPlayer > safeDistMax) {
                            moveVx = dirX * currentSpeed * 0.9;
                            moveVy = dirY * currentSpeed * 0.9;
                        }
                    }
                } else {
                    // Tanker & Quái Melee tiếp cận mục tiêu
                    if (distToPlayer > (e.radius || 20) + (player.radius || 20) - 2) {
                        moveVx = dirX * currentSpeed;
                        moveVy = dirY * currentSpeed;
                    }
                }
            } else {
                // Tuần tra tự do
                e.patrolAngle += dt * 0.8;
                const targetX = e.spawnX + Math.cos(e.patrolAngle) * 55;
                const targetY = e.spawnY + Math.sin(e.patrolAngle) * 55;
                const pdx = targetX - e.x;
                const pdy = targetY - e.y;
                const pdist = Math.hypot(pdx, pdy);
                if (pdist > 5) {
                    moveVx = (pdx / pdist) * (currentSpeed * 0.45);
                    moveVy = (pdy / pdist) * (currentSpeed * 0.45);
                    e.facingAngle = Math.atan2(moveVy, moveVx);
                }
            }

            const nextX = e.x + moveVx * dt;
            const nextY = e.y + moveVy * dt;

            if (this._canEnemyMoveTo(e, nextX, e.y)) e.x = nextX;
            if (this._canEnemyMoveTo(e, e.x, nextY)) e.y = nextY;

            const touchDist = (e.radius || 20) + (player.radius || 20) + 6;
            if (distToPlayer <= touchDist && e.attackCd <= 0) {
                e.attackCd = 0.85;
                this._applyDamageToPlayer(e.damage, e);
            }
        }

        // Cập nhật đạn (Giới hạn 90 viên để duy trì 60 FPS)
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];

            if (p.timeline !== 'ALL' && p.timeline !== currentTimeline) {
                this.projectiles.splice(i, 1);
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            if (p.life <= 0) {
                this.projectiles.splice(i, 1);
                continue;
            }

            if (player && player.hp > 0) {
                const dist = Math.hypot(p.x - player.x, p.y - player.y);
                if (dist <= p.radius + (player.radius || 20)) {
                    this._applyDamageToPlayer(p.damage, p.sourceEnemy || null);
                    this.projectiles.splice(i, 1);
                }
            }
        }

        if (this.projectiles.length > 90) {
            this.projectiles.splice(0, this.projectiles.length - 90);
        }
    },

    draw: function (ctx, camera) {
        const state = window.Game.state;
        const currentTimeline = (state && state.timeline) || 'PRESENT';
        const isFrozen = Boolean(state && state.chronoFreezeTimer > 0);
        const camX = (camera && camera.x) || 0;
        const camY = (camera && camera.y) || 0;
        const camW = (camera && camera.width) || window.innerWidth || 1280;
        const camH = (camera && camera.height) || window.innerHeight || 720;
        const now = performance.now() * 0.001;

        ctx.save();

        this._drawTelegraphs(ctx, camX, camY, now);

        // Hiệu ứng sóng hồi máu / chấn động
        for (let i = 0; i < this.healWaves.length; i++) {
            const hw = this.healWaves[i];
            const sx = hw.x - camX;
            const sy = hw.y - camY;
            ctx.save();
            ctx.globalAlpha = Math.max(0, hw.alpha);
            ctx.strokeStyle = hw.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(sx, sy, hw.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = hw.color;
            ctx.globalAlpha = Math.max(0, hw.alpha * 0.25);
            ctx.fill();
            ctx.restore();
        }

        // Dây chuyền tia sáng xanh Shaman
        if (currentTimeline === 'PAST') {
            for (let i = 0; i < this.healLinks.length; i++) {
                const link = this.healLinks[i];
                const alpha = Math.max(0, link.life / link.maxLife);
                const x1 = link.x1 - camX;
                const y1 = link.y1 - camY;
                const x2 = link.x2 - camX;
                const y2 = link.y2 - camY;

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.shadowColor = '#10b981';
                ctx.shadowBlur = 12;
                ctx.strokeStyle = '#34d399';
                ctx.lineWidth = 4 * alpha + 1.5;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                const midX = (x1 + x2) * 0.5 + Math.sin(now * 18 + i) * 12;
                const midY = (y1 + y2) * 0.5 + Math.cos(now * 18 + i) * 12;
                ctx.quadraticCurveTo(midX, midY, x2, y2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Vẽ vệt bóng mờ khi quái lướt ngang né tia ngắm (Evasive Sidestep Afterimages)
        for (let i = 0; i < this.evadeAfterimages.length; i++) {
            const af = this.evadeAfterimages[i];
            const sx = af.x - camX;
            const sy = af.y - camY;
            const alpha = Math.max(0, (af.life / af.maxLife) * 0.55);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = af.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(sx, sy, af.radius * 0.92, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Hiệu ứng nảy bật tia lửa / Lục giác phản chấn khiên
        for (let i = 0; i < this.shieldDeflections.length; i++) {
            const sd = this.shieldDeflections[i];
            const sx = sd.x - camX;
            const sy = sd.y - camY;
            const alpha = Math.max(0, sd.life / sd.maxLife);

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(sd.angle);
            ctx.globalAlpha = alpha;
            ctx.shadowColor = sd.color;
            ctx.shadowBlur = 12;

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            for (let sp = -1; sp <= 1; sp++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(16 * alpha, sp * 14 * (1 - alpha));
                ctx.stroke();
            }

            ctx.strokeStyle = sd.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 18 * (1.4 - alpha), -Math.PI * 0.35, Math.PI * 0.35);
            ctx.stroke();
            ctx.restore();
        }

        this._drawLootDrops(ctx, camX, camY, now);

        // Vẽ đạn (Bao gồm cả tia laser phản xạ và mảnh vỡ khiên)
        for (let i = 0; i < this.projectiles.length; i++) {
            const p = this.projectiles[i];
            const sx = p.x - camX;
            const sy = p.y - camY;

            if (sx < -50 || sx > camW + 50 || sy < -50 || sy > camH + 50) continue;

            ctx.save();
            ctx.shadowColor = isFrozen ? '#22d3ee' : p.color;
            ctx.shadowBlur = p.isReflectedLaser ? 16 : 10;
            ctx.fillStyle = isFrozen ? '#67e8f9' : p.color;

            if (p.isReflectedLaser) {
                const angle = Math.atan2(p.vy, p.vx);
                ctx.translate(sx, sy);
                ctx.rotate(angle);
                ctx.fillStyle = '#ff0844';
                ctx.fillRect(-14, -4, 28, 8);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-10, -2, 20, 4);
            } else {
                ctx.beginPath();
                ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(sx, sy, p.radius * 0.45, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Vẽ đường liên kết chiến thuật khi Kiter đang nấp sau lưng Tanker
        for (let i = 0; i < this.list.length; i++) {
            const e = this.list[i];
            if (!e.dead && e.hp > 0 && e.timeline === currentTimeline && e.synergyTankerId) {
                const protector = this.list.find(t => t.id === e.synergyTankerId && !t.dead && t.hp > 0);
                if (protector) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 4]);
                    ctx.beginPath();
                    ctx.moveTo(e.x - camX, e.y - camY);
                    ctx.lineTo(protector.x - camX, protector.y - camY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                }
            }
        }

        // Vẽ Quái, Mini-Boss & Boss
        for (let i = 0; i < this.list.length; i++) {
            const e = this.list[i];

            if ((e.isBoss || e.isMiniBoss) && e.dead && e.respawnTimer > 0) {
                if (!e.isBoss && e.timeline !== currentTimeline) continue;
                const bsx = e.spawnX - camX;
                const bsy = e.spawnY - camY;
                if (bsx >= -200 && bsx <= camW + 200 && bsy >= -200 && bsy <= camH + 200) {
                    ctx.save();
                    ctx.translate(bsx, bsy);
                    ctx.strokeStyle = e.isBoss ? 'rgba(168, 85, 247, 0.55)' : 'rgba(244, 63, 94, 0.55)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, (e.isBoss ? 48 : 34) + Math.sin(now * 5) * 5, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = e.isBoss ? '#e879f9' : '#fda4af';
                    ctx.font = 'bold 13px sans-serif';
                    ctx.textAlign = 'center';
                    const label = e.isBoss ? 'CHÚA TỂ TÁI SINH SAU' : `${e.baseName} HỒI SINH`;
                    ctx.fillText(`${label}: ${Math.ceil(e.respawnTimer)}s`, 0, -52);
                    ctx.restore();
                }
                continue;
            }

            if (e.dead || e.hp <= 0) continue;
            if (!e.isBoss && e.timeline !== currentTimeline) continue;

            const sx = e.x - camX;
            const sy = e.y - camY;

            if (sx < -180 || sx > camW + 180 || sy < -180 || sy > camH + 180) {
                continue;
            }

            ctx.save();
            ctx.translate(sx, sy);

            if (e.isMiniBoss) {
                this._drawMiniBossAura(ctx, e, now);
            } else if (e.isElite) {
                this._drawEliteAura(ctx, e, now);
            }

            // Bóng tròn chân
            ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
            ctx.beginPath();
            ctx.ellipse(0, e.radius * 0.85, e.radius * 0.9, e.radius * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();

            if (e.isBoss) {
                this._drawBossBody(ctx, e, now);
            } else if (e.isMiniBoss) {
                this._drawMiniBossBody(ctx, e, now);
            } else if (e.type === 'ancient') {
                this._drawAncientEnemy(ctx, e, now);
            } else if (e.type === 'mutant') {
                this._drawMutantEnemy(ctx, e, now);
            } else if (e.type === 'robot') {
                this._drawRobotEnemy(ctx, e, now);
            }

            if (isFrozen) {
                this._drawFrozenCrystalOverlay(ctx, e);
            }

            if (e.isMiniBoss) {
                this._drawMiniBossCrown(ctx, e, now);
            } else if (e.isElite) {
                this._drawEliteCrown(ctx, e);
            }

            this._drawEnemyHealthBar(ctx, e);

            ctx.restore();
        }

        ctx.restore();
    },

    _drawTelegraphs: function (ctx, camX, camY, now) {
        for (let i = 0; i < this.telegraphs.length; i++) {
            const tg = this.telegraphs[i];
            const sx = tg.x - camX;
            const sy = tg.y - camY;
            const progress = 1 - Math.max(0, tg.timer / (tg.maxTimer || 1));
            const pulse = 0.55 + Math.abs(Math.sin(now * 16)) * 0.45;

            ctx.save();
            if (tg.type === 'METEOR') {
                ctx.fillStyle = `rgba(239, 68, 68, ${0.22 * pulse})`;
                ctx.beginPath();
                ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(244, 63, 94, 0.38)';
                ctx.beginPath();
                ctx.arc(sx, sy, tg.radius * progress, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = `rgba(254, 202, 202, ${0.85 * pulse})`;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (tg.type === 'BOSS_DASH') {
                ctx.translate(sx, sy);
                ctx.rotate(tg.angle);

                ctx.fillStyle = `rgba(239, 68, 68, ${0.28 * pulse})`;
                ctx.fillRect(0, -tg.width / 2, tg.length, tg.width);

                ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
                ctx.fillRect(0, -tg.width / 2, tg.length * progress, tg.width);

                ctx.strokeStyle = '#fca5a5';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(0, -tg.width / 2, tg.length, tg.width);
            } else if (tg.type === 'PHASE_SHIFT_WARNING') {
                const targetTl = tg.targetTimeline || 'FUTURE';
                const ringColor = targetTl === 'PAST' ? '#f59e0b' : targetTl === 'PRESENT' ? '#10b981' : '#00f2fe';
                const flashPulse = 0.5 + Math.sin(now * 22) * 0.5;

                ctx.strokeStyle = ringColor;
                ctx.lineWidth = 4 + flashPulse * 3;
                ctx.globalAlpha = 0.6 + flashPulse * 0.4;
                ctx.setLineDash([14, 8]);
                ctx.beginPath();
                ctx.arc(sx, sy, tg.radius + flashPulse * 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();
        }
    },

    _drawLootDrops: function (ctx, camX, camY, now) {
        for (let i = 0; i < this.lootDrops.length; i++) {
            const item = this.lootDrops[i];
            const sx = item.x - camX;
            const sy = item.y - camY - (item.z || 0);
            const bob = Math.sin(now * 6 + i) * 2.5;

            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(sx, item.y - camY + 4, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            if (item.type === 'GOLD') {
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur = 10;
                ctx.fillStyle = '#facc15';
                ctx.strokeStyle = '#ca8a04';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(sx, sy + bob, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#fef08a';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('G', sx, sy + bob + 0.5);
            } else if (item.type === 'HP_ORB') {
                ctx.shadowColor = '#f43f5e';
                ctx.shadowBlur = 12;
                ctx.fillStyle = '#f43f5e';
                ctx.beginPath();
                ctx.arc(sx, sy + bob, 8.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(sx - 4, sy + bob - 1.2, 8, 2.4);
                ctx.fillRect(sx - 1.2, sy + bob - 4, 2.4, 8);
            } else if (item.type === 'EXP_ORB') {
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 12;
                ctx.fillStyle = '#38bdf8';
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(sx, sy + bob - 9);
                ctx.lineTo(sx + 8, sy + bob);
                ctx.lineTo(sx, sy + bob + 9);
                ctx.lineTo(sx - 8, sy + bob);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (item.type === 'SHIELD_ORB') {
                const cy = sy + bob;
                ctx.save();
                ctx.translate(sx, cy);
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 15;
                ctx.fillStyle = '#0284c7';
                ctx.strokeStyle = '#7dd3fc';
                ctx.lineWidth = 2;

                ctx.beginPath();
                for (let h = 0; h < 6; h++) {
                    const ha = (h * Math.PI) / 3 + now * 2;
                    const hx = Math.cos(ha) * 9.5;
                    const hy = Math.sin(ha) * 9.5;
                    if (h === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#e0f2fe';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (item.type === 'OVERDRIVE_ORB') {
                // Ngọc Cuồng Nộ Đỏ Cam
                const cy = sy + bob;
                ctx.save();
                ctx.translate(sx, cy);
                ctx.rotate(now * 3.5);
                ctx.shadowColor = '#ff5722';
                ctx.shadowBlur = 16;

                ctx.fillStyle = '#ea580c';
                ctx.strokeStyle = '#fde047';
                ctx.lineWidth = 2;

                ctx.beginPath();
                for (let p = 0; p < 8; p++) {
                    const r = p % 2 === 0 ? 11 : 6;
                    const a = (p * Math.PI) / 4;
                    const px = Math.cos(a) * r;
                    const py = Math.sin(a) * r;
                    if (p === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#fef08a';
                ctx.beginPath();
                ctx.arc(0, 0, 3.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (item.type === 'SHARD') {
                const cy = sy + bob;
                ctx.save();
                ctx.translate(sx, cy);
                ctx.rotate(Math.sin(now * 3 + i) * 0.25);

                ctx.shadowColor = '#d946ef';
                ctx.shadowBlur = 16;
                ctx.fillStyle = '#d946ef';
                ctx.strokeStyle = '#f5d0fe';
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(8, -5);
                ctx.lineTo(6, 7);
                ctx.lineTo(0, 12);
                ctx.lineTo(-6, 7);
                ctx.lineTo(-8, -5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            }
            ctx.restore();
        }
    },

    /**
     * HÀO QUANG TÍM ĐỎ ĐẶC TRƯNG CỦA 3 BOSS PHỤ KỶ NGUYÊN (isMiniBoss)
     */
    _drawMiniBossAura: function (ctx, e, now) {
        const spikes = 16;
        const outerR = e.radius + 16 + Math.sin(now * 9) * 3;
        const innerR = e.radius + 7;

        ctx.save();
        ctx.rotate(-now * 2.4);
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / spikes;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(225, 29, 72, 0.28)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#d946ef';
        ctx.stroke();
        ctx.restore();
    },

    /**
     * VƯƠNG MIỆN ĐỎ TÍM CỦA BOSS PHỤ KỶ NGUYÊN
     */
    _drawMiniBossCrown: function (ctx, e, now) {
        const cy = -e.radius - 26;
        ctx.save();
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#f43f5e';
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        ctx.moveTo(-12, cy);
        ctx.lineTo(-15, cy - 12);
        ctx.lineTo(-5, cy - 5);
        ctx.lineTo(0, cy - 15);
        ctx.lineTo(5, cy - 5);
        ctx.lineTo(15, cy - 12);
        ctx.lineTo(12, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f2fe';
        ctx.beginPath();
        ctx.arc(0, cy - 6, 2.5 + Math.sin(now * 8) * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    /**
     * VẼ NGOẠI HÌNH RIÊNG BIỆT CHO 3 MINI-BOSS KỶ NGUYÊN
     */
    _drawMiniBossBody: function (ctx, e, now) {
        const r = e.radius;
        const face = e.facingAngle || 0;

        // 1. PAST MINI-BOSS: Cự Thạch Hộ Pháp
        if (e.subType === 'ancient_miniboss') {
            // Vòng giáp đá quay xung quanh giảm 60% sát thương tầm xa
            ctx.save();
            ctx.rotate(now * 1.6);
            for (let k = 0; k < 6; k++) {
                const a = (k * Math.PI) / 3;
                const rx = Math.cos(a) * (r + 9);
                const ry = Math.sin(a) * (r + 9);
                ctx.fillStyle = '#b45309';
                ctx.strokeStyle = '#fde047';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(rx, ry, 6.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();

            ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#57534e';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Lõi cổ ngữ phát sáng giữa ngực
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(10, 0);
            ctx.lineTo(0, 12);
            ctx.lineTo(-10, 0);
            ctx.closePath();
            ctx.fill();
        }
        // 2. PRESENT MINI-BOSS: Mẫu Hoàng Độc Tố
        else if (e.subType === 'mutant_miniboss') {
            const pulse = Math.sin(now * 7) * 2.5;
            ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#701a75';
            ctx.strokeStyle = '#a3e635';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, r + pulse * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Các túi độc axit quanh thân Mẫu Hoàng
            for (let b = 0; b < 5; b++) {
                const ba = face + (b * Math.PI * 2) / 5 + now * 1.2;
                const bx = Math.cos(ba) * (r * 0.62);
                const by = Math.sin(ba) * (r * 0.62);
                ctx.fillStyle = '#84cc16';
                ctx.beginPath();
                ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // 3. FUTURE MINI-BOSS: Chiến Giáp Phản Quang
        else if (e.subType === 'robot_miniboss') {
            ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#0f172a';
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Lõi Lượng Tử
            ctx.fillStyle = e.mirrorShieldActive ? '#ff0844' : '#38bdf8';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();

            // Hiệu ứng Khiên Gương Lượng Tử đang bật (Phản xạ đạn súng)
            if (e.mirrorShieldActive) {
                ctx.save();
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 20;
                ctx.strokeStyle = '#e0f2fe';
                ctx.lineWidth = 4.5;

                const shieldR = r + 14 + Math.sin(now * 16) * 2;
                ctx.beginPath();
                for (let h = 0; h < 8; h++) {
                    const ha = (h * Math.PI) / 4 + now * 2.5;
                    const hx = Math.cos(ha) * shieldR;
                    const hy = Math.sin(ha) * shieldR;
                    if (h === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();

                ctx.fillStyle = 'rgba(0, 242, 254, 0.24)';
                ctx.fill();
                ctx.restore();
            }
        }
    },

    _drawEliteAura: function (ctx, e, now) {
        const spikes = 14;
        const outerR = e.radius + 12 + Math.sin(now * 8) * 2;
        const innerR = e.radius + 5;

        ctx.save();
        ctx.rotate(now * 2.2);
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / spikes;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
        ctx.restore();
    },

    _drawEliteCrown: function (ctx, e) {
        const cy = -e.radius - 22;
        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(-9, cy);
        ctx.lineTo(-11, cy - 9);
        ctx.lineTo(-4, cy - 4);
        ctx.lineTo(0, cy - 11);
        ctx.lineTo(4, cy - 4);
        ctx.lineTo(11, cy - 9);
        ctx.lineTo(9, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },

    _drawFrozenCrystalOverlay: function (ctx, e) {
        const r = e.radius + 5;
        ctx.save();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.48)';
        ctx.strokeStyle = '#cffafe';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3 - Math.PI / 6;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },

    _drawAncientEnemy: function (ctx, e, now) {
        const r = e.radius;
        const face = e.facingAngle || 0;

        if (e.subType === 'golem') {
            const isEnraged = e.hp / Math.max(1, e.maxHp) < 0.40;
            if (isEnraged) {
                ctx.save();
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(0, 0, r + 6 + Math.sin(now * 12) * 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#78716c';
            ctx.strokeStyle = isEnraged ? '#f59e0b' : '#292524';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Khối Khiên Đá Vòng Cung 120° (±60° quanh facingAngle)
            ctx.save();
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(0, 0, r + 7, face - Math.PI / 3, face + Math.PI / 3);
            ctx.stroke();

            const mx = Math.cos(face) * (r + 7);
            const my = Math.sin(face) * (r + 7);
            ctx.fillStyle = '#b45309';
            ctx.beginPath();
            ctx.arc(mx, my, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (e.subType === 'shaman') {
            ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#065f46';
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(r - 2, -12, 5 + Math.sin(now * 8) * 1.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#65a30d';
            ctx.strokeStyle = '#1a2e05';
            ctx.lineWidth = 2.5;

            ctx.beginPath();
            ctx.moveTo(-r + 2, -4);
            ctx.lineTo(-r - 9, -12);
            ctx.lineTo(-r + 4, 4);
            ctx.moveTo(r - 2, -4);
            ctx.lineTo(r + 9, -12);
            ctx.lineTo(r - 4, 4);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    },

    _drawMutantEnemy: function (ctx, e, now) {
        const r = e.radius;
        const pulse = Math.sin(now * (e.kamikazeActive ? 22 : 8) + e.x) * (e.kamikazeActive ? 4 : 2);
        const isFlashingRed = e.kamikazeActive && Math.floor(now * 16) % 2 === 0;

        if (e.kamikazeActive) {
            const explosionRadius = e.isSummonedMinion ? 105 : 130;
            const maxT = e.kamikazeMaxTimer || 1.8;
            const progress = 1 - Math.max(0, Math.min(1, e.kamikazeTimer / maxT));

            ctx.save();
            ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
            ctx.beginPath();
            ctx.arc(0, 0, explosionRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(244, 63, 94, 0.34)';
            ctx.beginPath();
            ctx.arc(0, 0, explosionRadius * progress, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = isFlashingRed ? '#fef08a' : '#ef4444';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([10, 6]);
            ctx.beginPath();
            ctx.arc(0, 0, explosionRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : isFlashingRed ? '#ef4444' : '#9333ea';
        ctx.strokeStyle = e.kamikazeActive ? '#fef08a' : '#3b0764';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r + pulse * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    },

    _drawRobotEnemy: function (ctx, e, now) {
        const r = e.radius;
        const face = e.facingAngle || 0;

        ctx.strokeStyle = 'rgba(0, 242, 254, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, now * 3, now * 3 + Math.PI * 1.3);
        ctx.stroke();

        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#1e293b';
        ctx.strokeStyle = e.isTanker ? '#38bdf8' : '#00f2fe';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = e.isTanker ? '#38bdf8' : '#ff0844';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (e.isTanker && e.shieldActive) {
            const shieldDist = r + 11;

            ctx.save();
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 14;

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, shieldDist, face - Math.PI / 3, face + Math.PI / 3);
            ctx.stroke();

            const hexAngles = [face - 0.44, face, face + 0.44];
            const hexRadius = 7.5;
            ctx.fillStyle = 'rgba(0, 242, 254, 0.28)';
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 1.6;

            for (let h = 0; h < hexAngles.length; h++) {
                const ha = hexAngles[h];
                const hx = Math.cos(ha) * shieldDist;
                const hy = Math.sin(ha) * shieldDist;

                ctx.beginPath();
                for (let v = 0; v < 6; v++) {
                    const va = ha + (v * Math.PI) / 3;
                    const vx = hx + Math.cos(va) * hexRadius;
                    const vy = hy + Math.sin(va) * hexRadius;
                    if (v === 0) ctx.moveTo(vx, vy);
                    else ctx.lineTo(vx, vy);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        } else if (e.isKiter) {
            ctx.save();
            ctx.rotate(face);
            ctx.fillStyle = '#00f2fe';
            ctx.fillRect(r - 2, -2.5, 12, 5);
            ctx.restore();
        }
    },

    _drawBossBody: function (ctx, e, now) {
        const r = e.radius;
        const currentTimeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';
        const shieldTl = e.shieldTimeline || 'PAST';
        const isOutOfPhase = currentTimeline !== shieldTl;

        let shieldColor = '#f59e0b';
        if (shieldTl === 'PRESENT') {
            shieldColor = '#10b981';
        } else if (shieldTl === 'FUTURE') {
            shieldColor = '#00f2fe';
        }

        ctx.save();
        const shieldRadius = r + 20 + Math.sin(now * 6) * 3;
        ctx.shadowColor = shieldColor;
        ctx.shadowBlur = isOutOfPhase ? 22 : 10;

        ctx.fillStyle = shieldColor;
        ctx.globalAlpha = isOutOfPhase ? 0.22 : 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = isOutOfPhase ? 0.95 : 0.65;
        ctx.strokeStyle = shieldColor;
        ctx.lineWidth = isOutOfPhase ? 5.5 : 3.5;
        for (let k = 0; k < 3; k++) {
            const startA = now * 1.8 + (k * Math.PI * 2) / 3;
            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius, startA, startA + Math.PI * 0.48);
            ctx.stroke();
        }
        ctx.restore();

        if (e.stunTimer > 0) {
            ctx.save();
            ctx.translate(0, -r - 28);
            for (let s = 0; s < 3; s++) {
                const sa = now * 6 + (s * Math.PI * 2) / 3;
                const starX = Math.cos(sa) * 26;
                const starY = Math.sin(sa) * 10;
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.arc(starX, starY, 4.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#00f2fe';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('CHOÁNG! (SUY YẾU +35% ST)', 0, -14);
            ctx.restore();
        }

        if (e.phase === 3) {
            const auraR = r + 16 + Math.sin(now * 10) * 5;
            const auraGrad = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, auraR);
            auraGrad.addColorStop(0, 'rgba(244, 63, 94, 0.65)');
            auraGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.45)');
            auraGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(0, 0, auraR, 0, Math.PI * 2);
            ctx.fill();
        }

        const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, r);
        if (e.hitFlash > 0) {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#fde047');
        } else if (e.phase === 3) {
            grad.addColorStop(0, '#ff0844');
            grad.addColorStop(0.55, '#9333ea');
            grad.addColorStop(1, '#1e1b4b');
        } else {
            grad.addColorStop(0, '#f43f5e');
            grad.addColorStop(0.55, '#6d28d9');
            grad.addColorStop(1, '#0f172a');
        }

        ctx.fillStyle = grad;
        ctx.strokeStyle = shieldColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#090d18';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        if (e.phase >= 2) {
            const orbitRadius = r + 54;
            for (let s = 0; s < 2; s++) {
                const sa = (e.satelliteAngle || 0) + s * Math.PI;
                const sx = Math.cos(sa) * orbitRadius;
                const sy = Math.sin(sa) * orbitRadius;

                ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(sx, sy);
                ctx.stroke();

                ctx.fillStyle = '#00f2fe';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(sx, sy, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    },

    _drawEnemyHealthBar: function (ctx, e) {
        const ratio = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));

        if (e.isBoss) {
            const barW = 210;
            const barH = 14;
            const bx = -barW / 2;
            const by = -e.radius - 36;

            const shieldTl = e.shieldTimeline || 'PAST';
            let shieldLabel = '[KHIÊN: QUÁ KHỨ]';
            let shieldTextColor = '#f59e0b';

            if (shieldTl === 'PRESENT') {
                shieldLabel = '[KHIÊN: HIỆN TẠI]';
                shieldTextColor = '#10b981';
            } else if (shieldTl === 'FUTURE') {
                shieldLabel = '[KHIÊN: TƯƠNG LAI]';
                shieldTextColor = '#00f2fe';
            }

            const shiftRemain = Math.max(0, Math.ceil(e.phaseShiftTimer || 0));

            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.strokeText(`${shieldLabel} (Đảo pha: ${shiftRemain}s)`, 0, by - 24);
            ctx.fillStyle = shieldTextColor;
            ctx.fillText(`${shieldLabel} (Đảo pha: ${shiftRemain}s)`, 0, by - 24);

            ctx.fillStyle = e.phase === 3 ? '#ff0844' : '#fde047';
            ctx.font = 'bold 12px sans-serif';
            ctx.strokeText(`${e.name} [P${e.phase || 1}] (${Math.ceil(e.hp)}/${e.maxHp})`, 0, by - 8);
            ctx.fillText(`${e.name} [P${e.phase || 1}] (${Math.ceil(e.hp)}/${e.maxHp})`, 0, by - 8);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

            ctx.fillStyle = e.phase === 3 ? '#dc2626' : e.phase === 2 ? '#f97316' : '#ec4899';
            ctx.fillRect(bx, by, barW * ratio, barH);

            ctx.strokeStyle = shieldTextColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(bx - 2, by - 2, barW + 4, barH + 4);
        } else if (e.isMiniBoss) {
            // Thanh máu nổi bật dành riêng cho 3 Boss Phụ Kỷ Nguyên
            const barW = 148;
            const barH = 10;
            const bx = -barW / 2;
            const by = -e.radius - 46;

            let traitText = '';
            let traitColor = '#fde047';
            if (e.subType === 'ancient_miniboss') {
                traitText = '🪨 GIÁP ĐÁ (-60% ĐẠN TẦM XA)';
                traitColor = '#f59e0b';
            } else if (e.subType === 'mutant_miniboss') {
                traitText = '☣️ MẪU HOÀNG AXIT & TRIỆU HỒI';
                traitColor = '#a3e635';
            } else if (e.subType === 'robot_miniboss') {
                traitText = e.mirrorShieldActive
                    ? '🪞 KHIÊN GƯƠNG BẬT (PHẢN LASER!)'
                    : `⚡ KHIÊN GƯƠNG SAU: ${Math.ceil(Math.max(0, e.mirrorShieldCd || 0))}s`;
                traitColor = e.mirrorShieldActive ? '#ff0844' : '#00f2fe';
            }

            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.strokeText(traitText, 0, by - 18);
            ctx.fillStyle = traitColor;
            ctx.fillText(traitText, 0, by - 18);

            ctx.font = 'bold 11px sans-serif';
            ctx.strokeText(`${e.name} (${Math.ceil(e.hp)}/${e.maxHp})`, 0, by - 5);
            ctx.fillStyle = '#fda4af';
            ctx.fillText(`${e.name} (${Math.ceil(e.hp)}/${e.maxHp})`, 0, by - 5);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

            ctx.fillStyle = '#e11d48';
            ctx.fillRect(bx, by, barW * ratio, barH);

            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 1.8;
            ctx.strokeRect(bx - 2, by - 2, barW + 4, barH + 4);
        } else {
            const barW = e.isElite ? 56 : 44;
            const barH = e.isElite ? 7 : 6;
            const bx = -barW / 2;
            const by = -e.radius - 14;

            if (e.isElite) {
                ctx.fillStyle = '#fde047';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('TINH ANH', 0, by - 19);
            }

            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

            ctx.fillStyle = e.isElite
                ? '#facc15'
                : e.isTanker
                ? '#f59e0b'
                : e.isKiter
                ? '#00f2fe'
                : e.type === 'ancient'
                ? '#84cc16'
                : e.type === 'mutant'
                ? '#a855f7'
                : '#38bdf8';
            ctx.fillRect(bx, by, barW * ratio, barH);
        }
    }
};