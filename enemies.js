/**
 * ============================================================================
 * TỰA GAME: KẺ DU HÀNH THỜI KHÔNG (TIME TRAVELER 2D ARPG)
 * MODULE: enemies.js - AI GAMEPLAY & BOSS MECHANICS ENGINE (PHẦN 1 / 2)
 * CHUẨN HIỆU NĂNG: 60 - 120 FPS CANVAS TRÊN THIẾT BỊ DI ĐỘNG
 * ============================================================================
 * DANH MỤC NÂNG CẤP & ĐỒNG BỘ:
 * 1. AI BEHAVIOR TỪNG HỆ QUÁI:
 *    - Quá Khứ (PAST): Golem Đỡ Đòn (chặn trước mặt, Địa Chấn khi HP < 40%),
 *      Pháp Sư Cổ Đại (Kiter giữ cự ly, bắn phép, nối dây chuyền hồi máu đồng minh).
 *    - Hiện Tại (PRESENT): Quái Đột Biến cận chiến cuồng nộ, tự bạo diện rộng khi HP < 32%.
 *    - Tương Lai (FUTURE): Robot Khiên Lượng Tử (phản xạ/nảy đạn súng tầm xa),
 *      Robot Xạ Thủ (lướt né đạn khi phát hiện người chơi ngắm súng tầm xa).
 * 2. 3 MINI-BOSS KỶ NGUYÊN & CHÚA TỂ THỜI KHÔNG:
 *    - Mini-Boss Quá Khứ: Cự Thạch Hộ Pháp với Giáp Đá Cổ Đại (-60% ST tầm xa) & Tam Trọng Địa Chấn.
 *    - Mini-Boss Hiện Tại: Mẫu Hoàng Độc Tố với bão axit 5 tia & triệu hồi ấu trùng tự bạo.
 *    - Mini-Boss Tương Lai: Chiến Giáp Phản Quang với Khiên Gương Lượng Tử (phản xạ tia laser,
 *      chỉ bị phá vỡ và làm choáng bởi đòn cận chiến).
 *    - Boss Toàn Cục: Chúa Tể Thời Không 3 giai đoạn (P1, P2, P3), khiên lệch pha kỷ nguyên,
 *      bão đạn xoắn ốc kép, lướt xung kích và kỹ năng bẻ cong dòng thời gian.
 * 3. TƯƠNG TÁC TRANG BỊ & RELIC:
 *    - Kính Hồng Ngoại Cảnh Báo (Sniper Scope - I.7): Báo trước đường đỏ laser trước 0.65s.
 *    - Giày Lướt Phản Lực (Aero Boots - I.3): Giẫm vệt lửa bị thiêu đốt & làm chậm 40% tốc chạy.
 *    - Trái Tim Băng Giá (Frost Heart - I.5) & Mặt Dây Chuyền Bất Khuất (Last Stand - I.6).
 *    - Bùng Nổ Tro Tàn (Corpse Explosion - II.9): Nổ xác gây 15% HP max quái trong bán kính 130px.
 *    - Chém Xuyên Giáp (Armor Piercing - II.7): Bỏ qua 50% giảm thương khi đánh trúng khiên Tanker.
 *    - Vùng Đất Bị Nguyền (Cursed Grounds - IV.10): +50% EXP diệt quái, giảm 50% thời gian hồi sinh.
 *    - Nam Châm (Loot Magnet - I.1): Hút đồ bán kính lên tới 450px.
 *    - Ngọc Thu Hoạch (Greed Relic - I.2): 25% xác suất x2 Vàng & EXP.
 * ============================================================================
 */

window.Game = window.Game || {};

window.Game.Enemies = {
    list: [],
    projectiles: [],
    lootDrops: [],
    telegraphs: [],
    healWaves: [],
    healLinks: [],
    shieldDeflections: [],
    evadeAfterimages: [],
    queuedWaveRings: [],
    corpseExplosions: [],

    // Trạng thái khống chế & bùa lợi người chơi
    playerSlowTimer: 0,
    _appliedPlayerSlow: 0,
    playerOverdriveTimer: 0,
    frostHeartCooldown: 0,
    lastStandCooldown: 0,

    /**
     * TRUY XUẤT CỔ VẬT TRANG BỊ CHUẨN HÓA VỚI SYSTEMS
     */
    _hasRelic: function (relicKey) {
        if (window.Game.Systems && typeof window.Game.Systems.hasEquippedRelic === 'function') {
            return window.Game.Systems.hasEquippedRelic(relicKey);
        }
        const state = window.Game.state;
        if (state && Array.isArray(state.equippedRelics)) {
            const canonical = relicKey.startsWith('relic_') ? relicKey : `relic_${relicKey}`;
            const shortKey = relicKey.replace('relic_', '');
            return state.equippedRelics.includes(canonical) || state.equippedRelics.includes(shortKey);
        }
        return false;
    },

    /**
     * KHỞI TẠO DANH SÁCH THỰC THỂ QUÁI CHO CẢ 3 KỶ NGUYÊN & BOSS
     */
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
        this.corpseExplosions = [];

        this.playerSlowTimer = 0;
        this._appliedPlayerSlow = 0;
        this.playerOverdriveTimer = 0;
        this.frostHeartCooldown = 0;
        this.lastStandCooldown = 0;

        if (window.Game.state) {
            if (typeof window.Game.state.loopLevel !== 'number') window.Game.state.loopLevel = 1;
            if (typeof window.Game.state.timeShards !== 'number') window.Game.state.timeShards = 0;
            if (!window.Game.state.weaponLevels) window.Game.state.weaponLevels = {};
        }

        const loop = (window.Game.state && window.Game.state.loopLevel) || 1;
        const bossMult = Math.pow(1.85, Math.max(0, loop - 1));
        const bossInitialHp = Math.round(22000 * bossMult);
        const bossInitialDmg = Math.round(42 * Math.pow(1.5, Math.max(0, loop - 1)));
        const bossInitialGold = Math.round(1200 * Math.pow(1.5, Math.max(0, loop - 1)));

        const spawnCoords = [
            { x: 1050, y: 1850 }, { x: 1380, y: 1820 }, { x: 2480, y: 1850 }, { x: 2820, y: 1920 },
            { x: 1120, y: 2320 }, { x: 1520, y: 2450 }, { x: 2320, y: 2420 }, { x: 2780, y: 2360 },
            { x: 1250, y: 2880 }, { x: 1750, y: 2950 }, { x: 2180, y: 2920 }, { x: 2680, y: 2860 }
        ];

        // 1. KỶ NGUYÊN QUÁ KHỨ (PAST) - 12 Quái (Golem Đỡ Đòn, Shaman Trị Liệu, Goblin)
        for (let i = 0; i < 12; i++) {
            const pt = this._findSafePosition(spawnCoords[i].x, spawnCoords[i].y);
            let subType = 'goblin';
            let role = 'melee';
            let name = 'Goblin Rừng Già';
            let baseHp = 140;
            let baseSpeed = 135;
            let baseRadius = 18;
            let baseDamage = 16;
            let baseGold = 35;
            let baseExp = 25;

            if (i % 3 === 0) {
                subType = 'golem';
                role = 'tanker';
                name = 'Golem Đá Bọc Giáp';
                baseHp = 320;
                baseSpeed = 85;
                baseRadius = 26;
                baseDamage = 26;
                baseGold = 55;
                baseExp = 38;
            } else if (i % 3 === 2) {
                subType = 'shaman';
                role = 'kiter';
                name = 'Pháp Sư Cổ Đại';
                baseHp = 85;
                baseSpeed = 128;
                baseRadius = 18;
                baseDamage = 20;
                baseGold = 50;
                baseExp = 34;
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
                freezeTimer: 0,
                burnTimer: 0,
                burnDps: 0,
                burnTickTimer: 0,
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

        // 2. KỶ NGUYÊN HIỆN TẠI (PRESENT) - 12 Quái Đột Biến (Cuồng nộ & Tự bạo < 32% HP)
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
                baseHp: 175,
                hp: 175,
                maxHp: 175,
                baseSpeed: 180,
                speed: 180,
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
                freezeTimer: 0,
                burnTimer: 0,
                burnDps: 0,
                burnTickTimer: 0,
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

        // 3. KỶ NGUYÊN TƯƠNG LAI (FUTURE) - 12 Robot (Khiên Lượng Tử Tanker & Bắn Tỉa Né Đạn Kiter)
        for (let i = 0; i < 12; i++) {
            const offsetPt = spawnCoords[(i + 8) % 12];
            const pt = this._findSafePosition(offsetPt.x - 70, offsetPt.y + 80);
            const isTanker = i % 3 === 0;
            const isKiter = !isTanker;

            let subType = isTanker ? 'shield_robot' : 'sniper_robot';
            let role = isTanker ? 'tanker' : 'kiter';
            let name = isTanker ? 'Robot Khiên Lượng Tử' : 'Robot Xạ Thủ Bắn Tỉa';
            let baseHp = isTanker ? 360 : 110;
            let baseSpeed = isTanker ? 92 : 140;
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
                shieldActive: isTanker,
                shieldTimer: 0,
                shieldCd: 0,
                strafeDir: i % 2 === 0 ? 1 : -1,
                strafeTimer: 1.6 + Math.random(),
                evadeCd: 0,
                evadeTimer: 0,
                evadeVx: 0,
                evadeVy: 0,
                afterimageTick: 0,
                freezeTimer: 0,
                burnTimer: 0,
                burnDps: 0,
                burnTickTimer: 0,
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

        // 4. 3 MINI-BOSS KỶ NGUYÊN (isMiniBoss: true)
        const miniBossLoopMult = Math.pow(1.75, Math.max(0, loop - 1));
        const miniBossDmgMult = Math.pow(1.45, Math.max(0, loop - 1));

        // 4A. PAST (1620, 1740): [BOSS PHỤ] Cự Thạch Hộ Pháp
        const pastMiniPt = this._findSafePosition(1620, 1740);
        const pastMiniHp = Math.round(2600 * miniBossLoopMult);
        this.list.push({
            id: 'miniboss_past',
            timeline: 'PAST',
            type: 'ancient',
            subType: 'ancient_miniboss',
            role: 'miniboss',
            baseName: '[MINI-BOSS] Cự Thạch Hộ Pháp',
            name: '[MINI-BOSS] Cự Thạch Hộ Pháp',
            isBoss: false,
            isMiniBoss: true,
            isElite: true,
            isTanker: false,
            isKiter: false,
            x: pastMiniPt.x,
            y: pastMiniPt.y,
            spawnX: pastMiniPt.x,
            spawnY: pastMiniPt.y,
            baseHp: 2600,
            hp: pastMiniHp,
            maxHp: pastMiniHp,
            baseSpeed: 96,
            speed: 96,
            baseRadius: 34,
            radius: 34,
            baseDamage: 32,
            damage: Math.round(32 * miniBossDmgMult),
            baseGoldReward: 400,
            goldReward: Math.round(400 * miniBossDmgMult),
            baseExpReward: 190,
            expReward: Math.round(190 * Math.pow(1.3, Math.max(0, loop - 1))),
            stoneArmorActive: true,
            slamComboCd: 4.5,
            attackCd: 0,
            shootCd: 2.2,
            evadeCd: 0,
            evadeTimer: 0,
            evadeVx: 0,
            evadeVy: 0,
            afterimageTick: 0,
            freezeTimer: 0,
            burnTimer: 0,
            burnDps: 0,
            burnTickTimer: 0,
            hitFlash: 0,
            lastHitTime: 0,
            dead: false,
            respawnTimer: 0,
            patrolAngle: 0,
            facingAngle: Math.PI / 2
        });

        // 4B. PRESENT (2220, 1740): [BOSS PHỤ] Mẫu Hoàng Độc Tố
        const presentMiniPt = this._findSafePosition(2220, 1740);
        const presentMiniHp = Math.round(2900 * miniBossLoopMult);
        this.list.push({
            id: 'miniboss_present',
            timeline: 'PRESENT',
            type: 'mutant',
            subType: 'mutant_miniboss',
            role: 'miniboss',
            baseName: '[MINI-BOSS] Mẫu Hoàng Độc Tố',
            name: '[MINI-BOSS] Mẫu Hoàng Độc Tố',
            isBoss: false,
            isMiniBoss: true,
            isElite: true,
            isTanker: false,
            isKiter: false,
            x: presentMiniPt.x,
            y: presentMiniPt.y,
            spawnX: presentMiniPt.x,
            spawnY: presentMiniPt.y,
            baseHp: 2900,
            hp: presentMiniHp,
            maxHp: presentMiniHp,
            baseSpeed: 114,
            speed: 114,
            baseRadius: 34,
            radius: 34,
            baseDamage: 34,
            damage: Math.round(34 * miniBossDmgMult),
            baseGoldReward: 430,
            goldReward: Math.round(430 * miniBossDmgMult),
            baseExpReward: 210,
            expReward: Math.round(210 * Math.pow(1.3, Math.max(0, loop - 1))),
            acidBarrageCd: 2.5,
            summonBroodCd: 8.5,
            strafeDir: 1,
            strafeTimer: 2.0,
            attackCd: 0,
            shootCd: 2.5,
            evadeCd: 0,
            evadeTimer: 0,
            evadeVx: 0,
            evadeVy: 0,
            afterimageTick: 0,
            freezeTimer: 0,
            burnTimer: 0,
            burnDps: 0,
            burnTickTimer: 0,
            hitFlash: 0,
            lastHitTime: 0,
            dead: false,
            respawnTimer: 0,
            patrolAngle: 0,
            facingAngle: Math.PI / 2
        });

        // 4C. FUTURE (1920, 1720): [BOSS PHỤ] Chiến Giáp Phản Quang
        const futureMiniPt = this._findSafePosition(1920, 1720);
        const futureMiniHp = Math.round(3300 * miniBossLoopMult);
        this.list.push({
            id: 'miniboss_future',
            timeline: 'FUTURE',
            type: 'robot',
            subType: 'robot_miniboss',
            role: 'miniboss',
            baseName: '[MINI-BOSS] Chiến Giáp Phản Quang',
            name: '[MINI-BOSS] Chiến Giáp Phản Quang',
            isBoss: false,
            isMiniBoss: true,
            isElite: true,
            isTanker: false,
            isKiter: false,
            x: futureMiniPt.x,
            y: futureMiniPt.y,
            spawnX: futureMiniPt.x,
            spawnY: futureMiniPt.y,
            baseHp: 3300,
            hp: futureMiniHp,
            maxHp: futureMiniHp,
            baseSpeed: 120,
            speed: 120,
            baseRadius: 35,
            radius: 35,
            baseDamage: 38,
            damage: Math.round(38 * miniBossDmgMult),
            baseGoldReward: 480,
            goldReward: Math.round(480 * miniBossDmgMult),
            baseExpReward: 230,
            expReward: Math.round(230 * Math.pow(1.3, Math.max(0, loop - 1))),
            mirrorShieldActive: false,
            mirrorShieldTimer: 0,
            mirrorShieldCd: 4.5,
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
            freezeTimer: 0,
            burnTimer: 0,
            burnDps: 0,
            burnTickTimer: 0,
            hitFlash: 0,
            lastHitTime: 0,
            dead: false,
            respawnTimer: 0,
            patrolAngle: 0,
            facingAngle: Math.PI / 2
        });

        // 5. CHÚA TỂ THỜI KHÔNG (Boss Toàn Cục)
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
            baseSpeed: 115,
            speed: 115,
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
            freezeTimer: 0,
            burnTimer: 0,
            burnDps: 0,
            burnTickTimer: 0,
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
        if (e.isTanker) e.shieldActive = true;
        e.healCd = 3.0;
        e.groundSlamCd = 0;
        e.evadeCd = 0;
        e.evadeTimer = 0;
        e.freezeTimer = 0;
        e.burnTimer = 0;
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

    _applyPlayerOverdrive: function (duration) {
        const player = window.Game.player;
        const state = window.Game.state;
        const combat = window.Game.Combat;

        this.playerOverdriveTimer = Math.max(this.playerOverdriveTimer || 0, duration || 4.0);

        if (state) {
            state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 25);
            state.weaponHeat = 0;
            state.overdriveTimer = this.playerOverdriveTimer;
        }
        if (player) {
            player.overdriveTimer = this.playerOverdriveTimer;
        }
        if (combat) {
            if (typeof combat.weaponHeat === 'number') combat.weaponHeat = 0;
            combat.overdriveTimer = this.playerOverdriveTimer;
        }
    },

    _clearPlayerOverdrive: function () {
        this.playerOverdriveTimer = 0;
        if (window.Game.state) window.Game.state.overdriveTimer = 0;
        if (window.Game.player) window.Game.player.overdriveTimer = 0;
        if (window.Game.Combat) window.Game.Combat.overdriveTimer = 0;
    },

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
            const minionHp = Math.round(95 * hpMult);

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
                baseHp: 95,
                hp: minionHp,
                maxHp: minionHp,
                baseSpeed: 220,
                speed: 220,
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
                freezeTimer: 0,
                burnTimer: 0,
                burnDps: 0,
                burnTickTimer: 0,
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
            window.Game.Combat.spawnFloatingText(queen.x, queen.y - queen.radius - 26, '☣️ TRIỆU HỒI ẤU TRÙNG TỰ BẠO!', '#c084fc', true);
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
                e.freezeTimer = 0;
                e.burnTimer = 0;
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
        this.corpseExplosions = [];
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

    /**
     * TƯƠNG TÁC VÙNG ĐẤT BỊ NGUYỀN (CURSED GROUNDS - IV.10)
     */
    _isPlayerInCursedGround: function () {
        if (window.Game.World && typeof window.Game.World.isPlayerInCursedGround === 'function') {
            return window.Game.World.isPlayerInCursedGround();
        }
        if (window.Game.state && typeof window.Game.state.inCursedGround === 'boolean') {
            return window.Game.state.inCursedGround;
        }
        const player = window.Game.player;
        if (player && typeof player.x === 'number' && typeof player.y === 'number') {
            return player.x >= 2300 && player.x <= 2900 && player.y >= 2300 && player.y <= 2900;
        }
        return false;
    },

    /**
     * GÂY SÁT THƯƠNG LÊN NGƯỜI CHƠI (TÍCH HỢP FROST HEART I.5 & LAST STAND I.6)
     */
    _applyDamageToPlayer: function (rawAmount, sourceEnemy) {
        const player = window.Game.player;
        const state = window.Game.state;
        if (!player || player.hp <= 0) return;

        if (state && (state.godMode === true || player.godMode === true)) {
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 30, 'BẤT TỬ', '#38bdf8');
            }
            return;
        }

        const dmg = Math.max(1, Math.round(rawAmount));
        const maxHp = player.maxHp || 100;
        const isHeavyHit = dmg >= maxHp * 0.20;

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

        // 1. TRÁI TIM BĂNG GIÁ (FROST HEART - I.5)
        // Khi nhận đòn nặng (>= 20% maxHp) & trang bị relic_frost_heart: hồi 12s, đóng băng 360px trong 2.0s
        if (isHeavyHit && this._hasRelic('relic_frost_heart') && this.frostHeartCooldown <= 0) {
            this.frostHeartCooldown = 12.0;

            this.healWaves.push({
                x: player.x,
                y: player.y,
                radius: 20,
                maxRadius: 360,
                color: 'rgba(56, 189, 248, 0.95)',
                alpha: 1.0
            });

            const currentTimeline = (state && state.timeline) || 'PRESENT';
            for (let i = 0; i < this.list.length; i++) {
                const e = this.list[i];
                if (!e || e.dead || e.hp <= 0) continue;
                if (!e.isBoss && e.timeline !== currentTimeline) continue;

                if (Math.hypot(e.x - player.x, e.y - player.y) <= 360) {
                    e.freezeTimer = Math.max(e.freezeTimer || 0, 2.0);
                    if (e.isBoss) {
                        e.stunTimer = Math.max(e.stunTimer || 0, 1.0);
                    }
                }
            }

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 48, '❄️ TRÁI TIM BĂNG GIÁ: ĐÓNG BĂNG 2S!', '#38bdf8', true);
            }
        }

        // 2. MẶT DÂY CHUYỀN BẤT KHUẤT (LAST STAND PENDANT - I.6)
        // Khi máu < 25%, hồi 60s, tạo khiên ảo bằng 50% maxHp trong 5s
        if (player.hp > 0 && (player.hp / maxHp) < 0.25 && this._hasRelic('relic_last_stand') && this.lastStandCooldown <= 0) {
            this.lastStandCooldown = 60.0;
            const shieldGranted = Math.round(maxHp * 0.50);
            player.shield = Math.max(player.shield || 0, shieldGranted);
            player.lastStandShieldTimer = 5.0;

            this.healWaves.push({
                x: player.x,
                y: player.y,
                radius: 15,
                maxRadius: 180,
                color: 'rgba(234, 179, 8, 0.95)',
                alpha: 1.0
            });

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 56, `🛡️ BẤT KHUẤT! +${shieldGranted} KHIÊN ẢO (5s)!`, '#facc15', true);
            }
        }

        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
            if (absorbedByShield > 0 && remainingDmg === 0) {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 28, `-${Math.round(absorbedByShield)} KHIÊN`, '#38bdf8');
            } else if (absorbedByShield > 0 && remainingDmg > 0) {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 28, `-${Math.round(remainingDmg)} HP (-${Math.round(absorbedByShield)} Khiên)`, '#ef4444');
            } else {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 28, `-${Math.round(remainingDmg)} HP`, '#ef4444');
            }
        }

        if (player.hp <= 0) {
            this.healEnemiesAround(player.x, player.y, 900);
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
        const count = enemy.isBoss ? 10 : enemy.isMiniBoss ? 7 : enemy.isElite ? 4 : 2 + Math.floor(Math.random() * 3);

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

        let shardCount = enemy.isBoss ? (4 + Math.floor(Math.random() * 4)) :
                         enemy.isMiniBoss ? (2 + Math.floor(Math.random() * 2)) :
                         enemy.isElite ? (1 + (Math.random() < 0.4 ? 1 : 0)) :
                         (Math.random() < 0.14 ? 1 : 0);

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

    /**
     * XỬ LÝ KHI QUÁI VẬT BỊ HẠ GỤC
     */
    _handleEnemyDeath: function (enemy) {
        enemy.dead = true;

        // Vùng Đất Bị Nguyền: Giảm 50% thời gian hồi sinh quái
        const inCursed = this._isPlayerInCursedGround();
        let baseRespawn = enemy.isBoss ? 20.0 : enemy.isMiniBoss ? 16.0 : 8.0;
        if (inCursed) baseRespawn *= 0.5;
        enemy.respawnTimer = baseRespawn;

        let goldEarned = enemy.goldReward || 50;
        let expEarned = enemy.expReward || 30;

        // Vùng Đất Bị Nguyền: +50% EXP khi diệt quái
        if (inCursed) {
            expEarned = Math.round(expEarned * 1.50);
        }

        // Ngọc Thu Hoạch (Greed Relic - I.2): 25% xác suất x2 Vàng & EXP
        let isGreedTriggered = false;
        if (this._hasRelic('relic_greed') && Math.random() < 0.25) {
            goldEarned *= 2;
            expEarned *= 2;
            isGreedTriggered = true;
        }

        const state = window.Game.state;
        if (state) state.gold = (state.gold || 0) + goldEarned;

        if (window.Game.Combat) {
            if (typeof window.Game.Combat.spawnFloatingText === 'function') {
                if (isGreedTriggered) {
                    window.Game.Combat.spawnFloatingText(enemy.x, enemy.y - enemy.radius - 42, '💰 x2 THU HOẠCH!', '#facc15', true);
                }
                window.Game.Combat.spawnFloatingText(
                    enemy.x,
                    enemy.y - enemy.radius - 28,
                    enemy.isMiniBoss ? `🏆 HẠ MINI-BOSS! +${goldEarned}G` : `+${goldEarned}G`,
                    enemy.isMiniBoss ? '#fde047' : '#facc15',
                    Boolean(enemy.isMiniBoss)
                );
            }
            if (typeof window.Game.Combat.registerEnemyKill === 'function') {
                window.Game.Combat.registerEnemyKill(enemy);
            }
        }

        // BÙNG NỔ TRO TÀN (CORPSE EXPLOSION - II.9): Nổ xác gây 15% HP max quái trong 130px
        const explosionDamage = Math.max(15, Math.round(enemy.maxHp * 0.15));
        const explosionRadius = 130;

        this.healWaves.push({
            x: enemy.x,
            y: enemy.y,
            radius: 18,
            maxRadius: explosionRadius,
            color: 'rgba(239, 68, 68, 0.92)',
            alpha: 1.0
        });

        this.corpseExplosions.push({
            x: enemy.x,
            y: enemy.y,
            radius: explosionRadius,
            life: 0.35,
            maxLife: 0.35
        });

        for (let i = 0; i < this.list.length; i++) {
            const ally = this.list[i];
            if (!ally || ally.dead || ally.hp <= 0 || ally.id === enemy.id) continue;
            if (ally.timeline !== enemy.timeline && !ally.isBoss) continue;

            if (Math.hypot(ally.x - enemy.x, ally.y - enemy.y) <= explosionRadius) {
                this.damageEnemy(ally, explosionDamage, false, false, true, enemy.x, enemy.y);
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

    _isPlayerUsingRangedGun: function () {
        const state = window.Game.state;
        const player = window.Game.player;
        const w = (state && (state.currentWeapon || state.equippedWeapon)) ||
                  (player && (player.currentWeapon || player.weapon)) || '';
        return w === 'laser_gun' || w === 'chrono_cannon';
    },

    _getPlayerAimAngle: function (player, fallbackTarget) {
        if (!player) return 0;
        if (typeof player.aimAngle === 'number') return player.aimAngle;
        if (typeof player.facingAngle === 'number') return player.facingAngle;
        if (typeof player.angle === 'number') return player.angle;
        if (window.Game.input && typeof window.Game.input.mouseWorldX === 'number') {
            return Math.atan2(window.Game.input.mouseWorldY - player.y, window.Game.input.mouseWorldX - player.x);
        }
        if (fallbackTarget) {
            return Math.atan2(fallbackTarget.y - player.y, fallbackTarget.x - player.x);
        }
        return 0;
    },

    _findNearbyTankerAlly: function (kiter) {
        let bestTanker = null;
        let minDist = 420;

        for (let i = 0; i < this.list.length; i++) {
            const ally = this.list[i];
            if (!ally || ally.dead || ally.hp <= 0 || ally.id === kiter.id || ally.timeline !== kiter.timeline || !ally.isTanker) {
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
        return dot >= 0.50; // Góc đón đòn phía trước 120 độ
    },

    /**
     * TÍNH TOÁN VÀ GÂY SÁT THƯƠNG LÊN QUÁI VẬT
     */
    damageEnemy: function (enemy, amount, isCrit, isThornDamage, isAoE, attackerX, attackerY) {
        if (!enemy || enemy.dead || enemy.hp <= 0) return;

        enemy.lastHitTime = performance.now() * 0.001;
        const player = window.Game.player;
        const state = window.Game.state;
        const srcX = typeof attackerX === 'number' ? attackerX : (player ? player.x : enemy.x);
        const srcY = typeof attackerY === 'number' ? attackerY : (player ? player.y : enemy.y);
        const hitDist = Math.hypot(srcX - enemy.x, srcY - enemy.y);

        let finalAmount = amount;
        let isVulnerableHit = false;
        let isShieldBlocked = false;

        // Kiểm tra Chém Xuyên Giáp (Armor Piercing - II.7)
        const hasArmorPiercing = Boolean(
            state && (
                (state.upgrades && state.upgrades.armorPiercing) ||
                (Array.isArray(state.combatUpgrades) && state.combatUpgrades.includes('armor_piercing')) ||
                state.hasArmorPiercing ||
                (state.weaponEffectLevels && state.weaponEffectLevels.armor_break > 0)
            )
        );
        const isMeleeHit = !this._isPlayerUsingRangedGun() && hitDist <= 165;

        // 1. MINI-BOSS TƯƠNG LAI: KHIÊN GƯƠNG LƯỢNG TỬ
        if (enemy.isMiniBoss && enemy.subType === 'robot_miniboss' && enemy.mirrorShieldActive && !isThornDamage) {
            const usingRangedGun = this._isPlayerUsingRangedGun();
            const isMeleeStrike = hitDist <= 150 && !usingRangedGun;

            if (isMeleeStrike) {
                // Đòn cận chiến phá vỡ Khiên Gương & gây choáng
                enemy.mirrorShieldActive = false;
                enemy.mirrorShieldTimer = 0;
                enemy.mirrorShieldCd = 8.0;
                enemy.stunTimer = 1.2;
                finalAmount *= 1.35;
                isVulnerableHit = true;

                this.healWaves.push({
                    x: enemy.x, y: enemy.y, radius: 15, maxRadius: 150,
                    color: 'rgba(0, 242, 254, 0.9)', alpha: 1.0
                });

                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(enemy.x, enemy.y - enemy.radius - 28, '💥 PHÁ VỠ KHIÊN GƯƠNG! (+35% ST)', '#00f2fe', true);
                }
            } else if (usingRangedGun || hitDist > 150) {
                // Phản xạ đạn súng laser sang người chơi
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
                    window.Game.Combat.spawnFloatingText(enemy.x, enemy.y - enemy.radius - 26, '⚡ PHẢN XẠ LASER LƯỢNG TỬ!', '#ff0844', true);
                }
            }
        }

        // 2. MINI-BOSS QUÁ KHỨ: GIÁP ĐÁ CỔ ĐẠI (-60% ST TẦM XA)
        if (enemy.isMiniBoss && enemy.subType === 'ancient_miniboss' && enemy.stoneArmorActive && !isThornDamage) {
            if (hitDist > 185 || this._isPlayerUsingRangedGun()) {
                finalAmount *= 0.40;
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
                    window.Game.Combat.spawnFloatingText(enemy.x, enemy.y - enemy.radius - 24, '🪨 GIÁP ĐÁ CỔ ĐẠI (-60% ST TẦM XA)', '#f59e0b', true);
                }
            }
        }

        // 3. KHIÊN ROBOT TƯƠNG LAI & TANKER GOLEM ĐỠ ĐÒN
        if (enemy.isTanker && !isAoE && !isThornDamage) {
            const blocked = this._isHitBlockedByShield(enemy, srcX, srcY);
            if (blocked) {
                isShieldBlocked = true;

                if (hitDist > 210) {
                    finalAmount *= 0.12; // Tầm xa bị giảm 88%

                    // Phản xạ mảnh đạn lạc
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
                    isShieldBlocked = false;
                    finalAmount *= 1.25;
                    isVulnerableHit = true;
                } else {
                    let damageFactor = 0.22;
                    if (isMeleeHit && hasArmorPiercing) {
                        damageFactor = 0.61; // Bỏ qua 50% mức cản khiên
                        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                            window.Game.Combat.spawnFloatingText(enemy.x, enemy.y - enemy.radius - 32, '🗡️ XUYÊN 50% KHIÊN!', '#38bdf8', true);
                        }
                    }
                    finalAmount *= damageFactor;
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
                finalAmount *= 1.25;
                isVulnerableHit = true;
                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(enemy.x, enemy.y - enemy.radius - 24, '⚡ ĐÁNH LÉN PHÁ GIÁP! (+25% ST)', '#fde047', true);
                }
            }
        }

        // 4. KHIÊN LỆCH PHA CỦA CHÚA TỂ THỜI KHÔNG
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

                if (enemy.hp <= 0) this._handleEnemyDeath(enemy);
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

    _findSafeKiteVector: function (enemy, wishVx, wishVy, stepDist) {
        const baseAngle = Math.atan2(wishVy, wishVx);
        const testAngles = [0, 0.61, -0.61, 1.22, -1.22];
        const speed = Math.hypot(wishVx, wishVy);

        for (let i = 0; i < testAngles.length; i++) {
            const a = baseAngle + testAngles[i];
            const testNx = enemy.x + Math.cos(a) * stepDist;
            const testNy = enemy.y + Math.sin(a) * stepDist;
            if (this._canEnemyMoveTo(enemy, testNx, testNy)) {
                return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
            }
        }
        return { vx: 0, vy: 0 };
    },

    /**
     * CẬP NHẬT RƠI ĐỒ VÀ NAM CHÂM HÚT (LOOT MAGNET - I.1 TỐI ĐA 450PX)
     */
    _updateLootDrops: function (dt, player) {
        const state = window.Game.state;
        const hasPet = Boolean(state && state.hasPet);

        let magnetRadius = hasPet ? 240 : 120;
        if (this._hasRelic('relic_magnet')) {
            magnetRadius = 450;
        } else if (state && typeof state.lootMagnetRadius === 'number') {
            magnetRadius = Math.max(magnetRadius, state.lootMagnetRadius);
        }
        magnetRadius = Math.min(450, magnetRadius);

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
                    const pullSpeed = 460 + (magnetRadius - Math.min(dist, magnetRadius)) * 2.4;
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

        let isGreedTriggered = false;
        let value = item.value;

        // Ngọc Thu Hoạch (Greed Relic - I.2): 25% xác suất x2
        if ((item.type === 'GOLD' || item.type === 'EXP_ORB') && this._hasRelic('relic_greed') && Math.random() < 0.25) {
            value *= 2;
            isGreedTriggered = true;
        }

        if (item.type === 'GOLD') {
            if (state) state.gold = (state.gold || 0) + value;
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                if (isGreedTriggered) {
                    window.Game.Combat.spawnFloatingText(player.x, player.y - 48, '💰 x2 THU HOẠCH!', '#facc15', true);
                }
                window.Game.Combat.spawnFloatingText(player.x, player.y - 32, `+${value}G`, '#facc15');
            }
        } else if (item.type === 'HP_ORB') {
            const maxHp = player.maxHp || 100;
            player.hp = Math.min(maxHp, player.hp + value);
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 32, `+${value} HP`, '#4ade80');
            }
        } else if (item.type === 'EXP_ORB') {
            if (window.Game.Systems && typeof window.Game.Systems.addExp === 'function') {
                window.Game.Systems.addExp(value);
            }
            if (state) state.rage = Math.min(state.maxRage || 100, (state.rage || 0) + 8);
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                if (isGreedTriggered) {
                    window.Game.Combat.spawnFloatingText(player.x, player.y - 48, '💰 x2 THU HOẠCH!', '#facc15', true);
                }
                window.Game.Combat.spawnFloatingText(player.x, player.y - 32, `+${value} EXP / +8 NỘ`, '#38bdf8');
            }
        } else if (item.type === 'SHIELD_ORB') {
            const maxShield = player.maxShield || 100;
            player.shield = Math.min(maxShield, (player.shield || 0) + value);
            if (window.Game.Combat) {
                if (typeof window.Game.Combat.activateCooldownHaste === 'function') {
                    window.Game.Combat.activateCooldownHaste(3.0);
                }
                if (typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(player.x, player.y - 36, `🛡️ +${value} GIÁP & HỒI CHIÊU NHANH (3s)!`, '#00f2fe', true);
                }
            }
        } else if (item.type === 'OVERDRIVE_ORB') {
            this._applyPlayerOverdrive(4.0);
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 40, '🔥 NGỌC CUỒNG NỘ: +25 NỘ & LÀM MÁT SÚNG!', '#ff5722', true);
            }
        } else if (item.type === 'SHARD') {
            if (state) state.timeShards = (state.timeShards || 0) + value;
            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(player.x, player.y - 38, `+${value} Mảnh Thời Không`, '#d946ef', true);
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
// ========================================================================
    // enemies.js - AI GAMEPLAY & BOSS MECHANICS ENGINE (PHẦN 2 / 2)
    // TIẾP NỐI: VÒNG LẶP UPDATE(DT), HÀNH VI AI KỶ NGUYÊN & CANVAS RENDERER
    // ========================================================================

    /**
     * VÒNG LẶP CẬP NHẬT CHÍNH CỦA ENEMY ENGINE (60 - 120 FPS MOBILE)
     */
    update: function (dt) {
        if (window.Game.state && window.Game.state.isPaused) return;

        const player = window.Game.player;
        const currentTimeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';

        // 1. Cập nhật bùa lợi và trạng thái người chơi
        if (this.playerSlowTimer > 0) {
            this.playerSlowTimer = Math.max(0, this.playerSlowTimer - dt);
            if (this.playerSlowTimer === 0) this._clearPlayerSlow();
        }

        if (this.playerOverdriveTimer > 0) {
            this.playerOverdriveTimer = Math.max(0, this.playerOverdriveTimer - dt);
            if (this.playerOverdriveTimer === 0) this._clearPlayerOverdrive();
        }

        if (this.frostHeartCooldown > 0) {
            this.frostHeartCooldown = Math.max(0, this.frostHeartCooldown - dt);
        }

        if (this.lastStandCooldown > 0) {
            this.lastStandCooldown = Math.max(0, this.lastStandCooldown - dt);
        }

        // 2. Cập nhật Telegraphs cảnh báo & Rơi đồ Loot Drops
        this._updateTelegraphs(dt, player);
        this._updateLootDrops(dt, player);

        // 3. Cập nhật hiệu ứng thị giác (VFX Arrays)
        this._updateVisualEffects(dt);

        // 4. Cập nhật Đạn quái vật (Projectiles)
        this._updateProjectiles(dt, player, currentTimeline);

        // 5. Cập nhật AI và trạng thái từng quái vật
        for (let i = 0; i < this.list.length; i++) {
            const enemy = this.list[i];
            if (!enemy) continue;

            // Xử lý hồi sinh nếu đã chết
            if (enemy.dead) {
                if (enemy.isSummonedMinion) {
                    this.list.splice(i, 1);
                    i--;
                    continue;
                }

                if (enemy.respawnTimer > 0) {
                    enemy.respawnTimer = Math.max(0, enemy.respawnTimer - dt);
                    if (enemy.respawnTimer === 0) {
                        this._respawnEnemy(enemy);
                    }
                }
                continue;
            }

            // Chỉ cập nhật quái ở Kỷ Nguyên hiện tại hoặc Boss Toàn Cục (timeline === 'ALL')
            if (!enemy.isBoss && enemy.timeline !== currentTimeline) continue;

            // Cập nhật trạng thái khống chế & hiệu ứng thời gian
            if (this._updateEnemyStatusEffects(enemy, dt)) {
                continue; // Bị đóng băng hoàn toàn hoặc đang đơ cứng
            }

            // Điều hướng AI theo vai trò và kỷ nguyên
            if (enemy.isBoss) {
                this._updateChronosLordAI(enemy, dt, player);
            } else if (enemy.isMiniBoss) {
                this._updateMiniBossAI(enemy, dt, player);
            } else {
                this._updateRegularEnemyAI(enemy, dt, player);
            }
        }
    },

    /**
     * HỒI SINH QUÁI VẬT VỀ TỌA ĐỘ AN TOÀN
     */
    _respawnEnemy: function (enemy) {
        const safePt = this._findSafePosition(enemy.spawnX, enemy.spawnY);
        enemy.x = safePt.x;
        enemy.y = safePt.y;
        enemy.dead = false;
        enemy.hp = enemy.maxHp;
        enemy.hitFlash = 0;
        enemy.freezeTimer = 0;
        enemy.burnTimer = 0;
        enemy.stunTimer = 0;
        enemy.kamikazeActive = false;
        enemy.kamikazeTimer = 0;

        if (enemy.isTanker) enemy.shieldActive = true;
        if (enemy.subType === 'ancient_miniboss') enemy.stoneArmorActive = true;
        if (enemy.subType === 'robot_miniboss') {
            enemy.mirrorShieldActive = false;
            enemy.mirrorShieldTimer = 0;
            enemy.mirrorShieldCd = 4.5;
        }

        this.healWaves.push({
            x: enemy.x,
            y: enemy.y,
            radius: 12,
            maxRadius: enemy.radius * 2.2,
            color: 'rgba(56, 189, 248, 0.8)',
            alpha: 1.0
        });
    },

    /**
     * CẬP NHẬT TRẠNG THÁI KHỐNG CHẾ (CHOÁNG, ĐÓNG BĂNG, THIÊU ĐỐT, LÀM CHẬM)
     */
    _updateEnemyStatusEffects: function (enemy, dt) {
        if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

        // Ngưng đọng thời gian toàn cục (Chrono Freeze)
        const isChronoFrozen = window.Game.state && window.Game.state.chronoFreezeTimer > 0;
        if (isChronoFrozen) {
            enemy.freezeTimer = Math.max(enemy.freezeTimer || 0, window.Game.state.chronoFreezeTimer);
        }

        // Đóng băng cục bộ
        if (enemy.freezeTimer > 0) {
            enemy.freezeTimer = Math.max(0, enemy.freezeTimer - dt);
            return true; // Dừng toàn bộ di chuyển và hành động
        }

        // Choáng (Stun)
        if (enemy.stunTimer > 0) {
            enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
            return true;
        }

        // Thiêu đốt (Burn DoT)
        if (enemy.burnTimer > 0) {
            enemy.burnTimer = Math.max(0, enemy.burnTimer - dt);
            enemy.burnTickTimer = (enemy.burnTickTimer || 0) + dt;
            if (enemy.burnTickTimer >= 0.5) {
                enemy.burnTickTimer = 0;
                const burnDmg = Math.max(4, Math.round((enemy.burnDps || 25) * 0.5));
                this.damageEnemy(enemy, burnDmg, false, false, true, enemy.x, enemy.y);
            }
        }

        // Làm chậm (Slow)
        if (enemy.slowTimer > 0) {
            enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
            if (enemy.slowTimer === 0) enemy.slowFactor = 1.0;
        } else {
            enemy.slowFactor = 1.0;
        }

        return false;
    },

    /**
     * AI QUÁI THƯỜNG THEO KỶ NGUYÊN (PAST / PRESENT / FUTURE)
     */
    _updateRegularEnemyAI: function (enemy, dt, player) {
        if (!player || player.hp <= 0) return;

        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        const angleToPlayer = Math.atan2(dy, dx);
        enemy.facingAngle = angleToPlayer;

        const currentSpeed = (enemy.speed || 120) * (enemy.slowFactor || 1.0);

        // --- 1. KỶ NGUYÊN QUÁ KHỨ (PAST) ---
        if (enemy.timeline === 'PAST') {
            if (enemy.subType === 'golem') {
                // GOLEM ĐỠ ĐÒN: Che chắn phía trước, HP < 40% tung Địa Chấn
                const hpRatio = enemy.hp / enemy.maxHp;
                if (hpRatio < 0.40) {
                    enemy.groundSlamCd = (enemy.groundSlamCd || 0) - dt;
                    if (enemy.groundSlamCd <= 0 && dist <= 240) {
                        enemy.groundSlamCd = 5.0;
                        this._triggerGolemGroundSlam(enemy, player);
                    }
                }

                // Tiến chậm giữ mặt quay về người chơi
                if (dist > (enemy.radius + (player.radius || 20) + 8)) {
                    const step = currentSpeed * dt;
                    const nx = enemy.x + Math.cos(angleToPlayer) * step;
                    const ny = enemy.y + Math.sin(angleToPlayer) * step;
                    if (this._canEnemyMoveTo(enemy, nx, ny)) {
                        enemy.x = nx;
                        enemy.y = ny;
                    }
                } else {
                    this._performEnemyMeleeAttack(enemy, player, dt, 1.1);
                }
                return;
            }

            if (enemy.subType === 'shaman') {
                // PHÁP SƯ CỔ ĐẠI: Kiter giữ cự ly, bắn phép, nối dây chuyền hồi máu đồng minh
                enemy.healCd = (enemy.healCd || 0) - dt;
                if (enemy.healCd <= 0) {
                    enemy.healCd = 3.5;
                    this._performShamanHealLink(enemy);
                }

                enemy.shootCd = (enemy.shootCd || 0) - dt;
                if (enemy.shootCd <= 0 && dist <= 420) {
                    enemy.shootCd = 2.2;
                    this._shootAncientMagicOrb(enemy, angleToPlayer);
                }

                // Thao tác Kiting giữ cự ly 260 - 360px
                this._handleKiterMovement(enemy, dt, player, dist, angleToPlayer, 260, 360, currentSpeed);
                return;
            }

            // Goblin cận chiến áp sát
            if (dist > (enemy.radius + (player.radius || 20) + 6)) {
                const step = currentSpeed * dt;
                const nx = enemy.x + Math.cos(angleToPlayer) * step;
                const ny = enemy.y + Math.sin(angleToPlayer) * step;
                if (this._canEnemyMoveTo(enemy, nx, ny)) {
                    enemy.x = nx;
                    enemy.y = ny;
                }
            } else {
                this._performEnemyMeleeAttack(enemy, player, dt, 0.85);
            }
            return;
        }

        // --- 2. KỶ NGUYÊN HIỆN TẠI (PRESENT) ---
        if (enemy.timeline === 'PRESENT') {
            // QUÁI ĐỘT BIẾN / ẤU TRÙNG TỰ BẠO: Cuồng nộ, tự bạo khi HP < 32%
            const hpRatio = enemy.hp / enemy.maxHp;
            if (hpRatio < 0.32 && !enemy.kamikazeActive) {
                enemy.kamikazeActive = true;
                enemy.kamikazeTimer = enemy.kamikazeMaxTimer || 1.8;
                if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                    window.Game.Combat.spawnFloatingText(enemy.x, enemy.y - enemy.radius - 20, '⚠️ TỰ BẠO DIỆN RỘNG!', '#ef4444', true);
                }
            }

            if (enemy.kamikazeActive) {
                enemy.kamikazeTimer -= dt;
                const rushSpeed = currentSpeed * 1.45;
                const step = rushSpeed * dt;
                const nx = enemy.x + Math.cos(angleToPlayer) * step;
                const ny = enemy.y + Math.sin(angleToPlayer) * step;
                if (this._canEnemyMoveTo(enemy, nx, ny)) {
                    enemy.x = nx;
                    enemy.y = ny;
                }

                if (enemy.kamikazeTimer <= 0 || dist <= enemy.radius + (player.radius || 20) + 10) {
                    this._explodeKamikazeMutant(enemy, player);
                    return;
                }
                return;
            }

            // Di chuyển cận chiến cuồng nộ
            if (dist > (enemy.radius + (player.radius || 20) + 6)) {
                const step = currentSpeed * dt;
                const nx = enemy.x + Math.cos(angleToPlayer) * step;
                const ny = enemy.y + Math.sin(angleToPlayer) * step;
                if (this._canEnemyMoveTo(enemy, nx, ny)) {
                    enemy.x = nx;
                    enemy.y = ny;
                }
            } else {
                this._performEnemyMeleeAttack(enemy, player, dt, 0.9);
            }
            return;
        }

        // --- 3. KỶ NGUYÊN TƯƠNG LAI (FUTURE) ---
        if (enemy.timeline === 'FUTURE') {
            if (enemy.subType === 'shield_robot') {
                // ROBOT KHIÊN LƯỢNG TỬ: Luôn quay mặt đón đạn, đẩy lùi
                if (dist > (enemy.radius + (player.radius || 20) + 12)) {
                    const step = currentSpeed * dt;
                    const nx = enemy.x + Math.cos(angleToPlayer) * step;
                    const ny = enemy.y + Math.sin(angleToPlayer) * step;
                    if (this._canEnemyMoveTo(enemy, nx, ny)) {
                        enemy.x = nx;
                        enemy.y = ny;
                    }
                } else {
                    this._performEnemyMeleeAttack(enemy, player, dt, 1.25);
                }
                return;
            }

            if (enemy.subType === 'sniper_robot') {
                // ROBOT XẠ THỦ: Né đạn khi phát hiện người chơi ngắm bắn + Kính hồng ngoại báo trước 0.65s
                this._checkSniperEvadeReaction(enemy, dt, player);

                enemy.shootCd = (enemy.shootCd || 0) - dt;
                if (enemy.shootCd <= 0 && dist <= 480) {
                    enemy.shootCd = 2.4;
                    this._chargeSniperShot(enemy, player);
                }

                this._handleKiterMovement(enemy, dt, player, dist, angleToPlayer, 280, 420, currentSpeed);
            }
        }
    },

    /**
     * KITING & NÉ ĐẠN CỦA QUÁI TẦM XA (SHAMAN, SNIPER ROBOT)
     */
    _handleKiterMovement: function (enemy, dt, player, dist, angleToPlayer, minDist, maxDist, speed) {
        if (enemy.evadeTimer && enemy.evadeTimer > 0) {
            enemy.evadeTimer -= dt;
            const ex = enemy.x + enemy.evadeVx * dt;
            const ey = enemy.y + enemy.evadeVy * dt;
            if (this._canEnemyMoveTo(enemy, ex, ey)) {
                enemy.x = ex;
                enemy.y = ey;
            }
            return;
        }

        let wishVx = 0;
        let wishVy = 0;

        if (dist < minDist) {
            // Lùi xa người chơi
            wishVx = -Math.cos(angleToPlayer) * speed;
            wishVy = -Math.sin(angleToPlayer) * speed;
        } else if (dist > maxDist) {
            // Tiến lại gần vừa tầm bắn
            wishVx = Math.cos(angleToPlayer) * speed;
            wishVy = Math.sin(angleToPlayer) * speed;
        } else {
            // Di chuyển ngang (Strafe) giữ khoảng cách
            enemy.strafeTimer = (enemy.strafeTimer || 1.5) - dt;
            if (enemy.strafeTimer <= 0) {
                enemy.strafeTimer = 1.4 + Math.random() * 1.2;
                enemy.strafeDir = (enemy.strafeDir || 1) * -1;
            }
            const strafeAngle = angleToPlayer + Math.PI / 2 * (enemy.strafeDir || 1);
            wishVx = Math.cos(strafeAngle) * (speed * 0.85);
            wishVy = Math.sin(strafeAngle) * (speed * 0.85);
        }

        const safeVector = this._findSafeKiteVector(enemy, wishVx, wishVy, speed * dt);
        enemy.x += safeVector.vx * dt;
        enemy.y += safeVector.vy * dt;
    },

    /**
     * PHẢN ỨNG LƯỚT NÉ ĐẠN CỦA ROBOT XẠ THỦ TƯƠNG LAI
     */
    _checkSniperEvadeReaction: function (enemy, dt, player) {
        enemy.evadeCd = (enemy.evadeCd || 0) - dt;
        if (enemy.evadeCd > 0) return;

        const isAimingAtMe = this._isPlayerUsingRangedGun() && Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 440;
        if (isAimingAtMe && Math.random() < 0.65) {
            enemy.evadeCd = 3.8;
            enemy.evadeTimer = 0.22;
            const evadeAngle = (enemy.facingAngle || 0) + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
            enemy.evadeVx = Math.cos(evadeAngle) * 440;
            enemy.evadeVy = Math.sin(evadeAngle) * 440;

            this.evadeAfterimages.push({
                x: enemy.x,
                y: enemy.y,
                angle: enemy.facingAngle,
                radius: enemy.radius,
                color: '#38bdf8',
                life: 0.35,
                maxLife: 0.35
            });
        }
    },

    /**
     * TẢI PHÁT BẮN TỈA VỚI BÁO ĐỎ TỪ KÍNH HỒNG NGOẠI (SNIPER SCOPE - I.7)
     */
    _chargeSniperShot: function (enemy, player) {
        const fireAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const telegraphDuration = 0.65; // Cảnh báo trước 0.65s

        this.telegraphs.push({
            type: 'SNIPER_LINE',
            sourceEnemy: enemy,
            startX: enemy.x,
            startY: enemy.y,
            angle: fireAngle,
            length: 480,
            timer: telegraphDuration,
            maxTimer: telegraphDuration,
            color: '#ef4444'
        });

        setTimeout(() => {
            if (!enemy || enemy.dead || enemy.hp <= 0) return;
            this.projectiles.push({
                x: enemy.x + Math.cos(fireAngle) * (enemy.radius + 12),
                y: enemy.y + Math.sin(fireAngle) * (enemy.radius + 12),
                vx: Math.cos(fireAngle) * 780,
                vy: Math.sin(fireAngle) * 780,
                radius: 7,
                damage: Math.round(enemy.damage * 1.35),
                color: '#38bdf8',
                timeline: enemy.timeline,
                life: 1.8,
                sourceEnemy: enemy
            });
        }, telegraphDuration * 1000);
    },

    /**
     * BẮN CẦU PHÉP THUẬT CỔ ĐẠI
     */
    _shootAncientMagicOrb: function (enemy, angle) {
        this.projectiles.push({
            x: enemy.x + Math.cos(angle) * (enemy.radius + 10),
            y: enemy.y + Math.sin(angle) * (enemy.radius + 10),
            vx: Math.cos(angle) * 360,
            vy: Math.sin(angle) * 360,
            radius: 8.5,
            damage: Math.round(enemy.damage * 1.15),
            color: '#10b981',
            timeline: enemy.timeline,
            life: 2.2,
            sourceEnemy: enemy
        });
    },

    /**
     * PHÁP SƯ CỔ ĐẠI NỐI DÂY CHUYỀN HỒI MÁU ĐỒNG MINH
     */
    _performShamanHealLink: function (shaman) {
        let lowestAlly = null;
        let lowestRatio = 0.85;

        for (let i = 0; i < this.list.length; i++) {
            const ally = this.list[i];
            if (!ally || ally.dead || ally.hp <= 0 || ally.id === shaman.id) continue;
            if (ally.timeline !== shaman.timeline) continue;

            const d = Math.hypot(ally.x - shaman.x, ally.y - shaman.y);
            if (d <= 320) {
                const ratio = ally.hp / ally.maxHp;
                if (ratio < lowestRatio) {
                    lowestRatio = ratio;
                    lowestAlly = ally;
                }
            }
        }

        if (lowestAlly) {
            const healAmount = Math.round(lowestAlly.maxHp * 0.18);
            lowestAlly.hp = Math.min(lowestAlly.maxHp, lowestAlly.hp + healAmount);

            this.healLinks.push({
                x1: shaman.x,
                y1: shaman.y,
                x2: lowestAlly.x,
                y2: lowestAlly.y,
                life: 0.45,
                maxLife: 0.45
            });

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(lowestAlly.x, lowestAlly.y - lowestAlly.radius - 16, `+${healAmount} HP`, '#4ade80');
            }
        }
    },

    /**
     * GOLEM ĐỠ ĐÒN TUNG ĐỊA CHẤN
     */
    _triggerGolemGroundSlam: function (golem, player) {
        const slamRadius = 160;
        this.healWaves.push({
            x: golem.x,
            y: golem.y,
            radius: 15,
            maxRadius: slamRadius,
            color: 'rgba(245, 158, 11, 0.9)',
            alpha: 1.0
        });

        if (player && player.hp > 0 && Math.hypot(player.x - golem.x, player.y - golem.y) <= slamRadius + (player.radius || 20)) {
            this._applyDamageToPlayer(golem.damage * 1.35, golem);
            this._applyPlayerSlow(2.0);
        }
    },

    /**
     * NỔ TỰ BẠO CỦA QUÁI ĐỘT BIẾN / ẤU TRÙNG
     */
    _explodeKamikazeMutant: function (enemy, player) {
        const blastRadius = enemy.isSummonedMinion ? 110 : 150;
        const blastDamage = Math.round(enemy.damage * (enemy.isSummonedMinion ? 1.4 : 1.8));

        this.healWaves.push({
            x: enemy.x,
            y: enemy.y,
            radius: 20,
            maxRadius: blastRadius,
            color: 'rgba(239, 68, 68, 0.95)',
            alpha: 1.0
        });

        this.corpseExplosions.push({
            x: enemy.x,
            y: enemy.y,
            radius: blastRadius,
            life: 0.4,
            maxLife: 0.4
        });

        if (player && player.hp > 0 && Math.hypot(player.x - enemy.x, player.y - enemy.y) <= blastRadius + (player.radius || 20)) {
            this._applyDamageToPlayer(blastDamage, enemy);
        }

        enemy.hp = 0;
        this._handleEnemyDeath(enemy);
    },

    /**
     * ĐÒN ĐÁNH CẬN CHIẾN QUÁI VẬT
     */
    _performEnemyMeleeAttack: function (enemy, player, dt, cooldownTime) {
        enemy.attackCd = (enemy.attackCd || 0) - dt;
        if (enemy.attackCd <= 0) {
            enemy.attackCd = cooldownTime || 1.0;
            this._applyDamageToPlayer(enemy.damage, enemy);
        }
    },

    // ========================================================================
    // AI 3 MINI-BOSS KỶ NGUYÊN (QUÁ KHỨ, HIỆN TẠI, TƯƠNG LAI)
    // ========================================================================
    _updateMiniBossAI: function (boss, dt, player) {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        boss.facingAngle = angle;

        // 1. MINI-BOSS QUÁ KHỨ: CỰ THẠCH HỘ PHÁP (Tam Trọng Địa Chấn)
        if (boss.subType === 'ancient_miniboss') {
            boss.slamComboCd = (boss.slamComboCd || 4.5) - dt;
            if (boss.slamComboCd <= 0) {
                boss.slamComboCd = 6.0;
                this._performTripleGroundSlam(boss, player);
            }

            if (dist > boss.radius + (player.radius || 20) + 12) {
                const step = boss.speed * dt;
                const nx = boss.x + Math.cos(angle) * step;
                const ny = boss.y + Math.sin(angle) * step;
                if (this._canEnemyMoveTo(boss, nx, ny)) {
                    boss.x = nx;
                    boss.y = ny;
                }
            } else {
                this._performEnemyMeleeAttack(boss, player, dt, 1.2);
            }
            return;
        }

        // 2. MINI-BOSS HIỆN TẠI: MẪU HOÀNG ĐỘC TỐ (Bão Axit 5 Tia & Triệu hồi ấu trùng)
        if (boss.subType === 'mutant_miniboss') {
            boss.acidBarrageCd = (boss.acidBarrageCd || 2.5) - dt;
            if (boss.acidBarrageCd <= 0 && dist <= 520) {
                boss.acidBarrageCd = 3.2;
                this._fireAcidBarrage(boss, angle);
            }

            boss.summonBroodCd = (boss.summonBroodCd || 8.5) - dt;
            if (boss.summonBroodCd <= 0) {
                boss.summonBroodCd = 9.0;
                this._spawnMutantMinions(boss);
            }

            this._handleKiterMovement(boss, dt, player, dist, angle, 240, 380, boss.speed);
            return;
        }

        // 3. MINI-BOSS TƯƠNG LAI: CHIẾN GIÁP PHẢN QUANG (Khiên Gương Lượng Tử)
        if (boss.subType === 'robot_miniboss') {
            if (!boss.mirrorShieldActive) {
                boss.mirrorShieldCd = (boss.mirrorShieldCd || 4.5) - dt;
                if (boss.mirrorShieldCd <= 0) {
                    boss.mirrorShieldActive = true;
                    boss.mirrorShieldTimer = 6.0;
                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(boss.x, boss.y - boss.radius - 28, '🛡️ KHIÊN GƯƠNG LƯỢNG TỬ KÍCH HOẠT!', '#00f2fe', true);
                    }
                }
            } else {
                boss.mirrorShieldTimer -= dt;
                if (boss.mirrorShieldTimer <= 0) {
                    boss.mirrorShieldActive = false;
                    boss.mirrorShieldCd = 5.0;
                }
            }

            boss.shootCd = (boss.shootCd || 1.8) - dt;
            if (boss.shootCd <= 0 && dist <= 500) {
                boss.shootCd = 2.2;
                for (let k = -1; k <= 1; k++) {
                    const sa = angle + k * 0.18;
                    this.projectiles.push({
                        x: boss.x + Math.cos(sa) * (boss.radius + 12),
                        y: boss.y + Math.sin(sa) * (boss.radius + 12),
                        vx: Math.cos(sa) * 580,
                        vy: Math.sin(sa) * 580,
                        radius: 8,
                        damage: Math.round(boss.damage * 0.9),
                        color: '#38bdf8',
                        timeline: boss.timeline,
                        life: 2.0,
                        sourceEnemy: boss
                    });
                }
            }

            this._handleKiterMovement(boss, dt, player, dist, angle, 220, 360, boss.speed);
        }
    },

    /**
     * TAM TRỌNG ĐỊA CHẤN CỦA CỰ THẠCH HỘ PHÁP (3 ĐỢT SÓNG LAN TỎA)
     */
    _performTripleGroundSlam: function (boss, player) {
        const waves = [140, 220, 310];
        const damages = [boss.damage * 1.1, boss.damage * 1.3, boss.damage * 1.6];

        waves.forEach((radius, idx) => {
            setTimeout(() => {
                if (!boss || boss.dead || boss.hp <= 0) return;
                this.healWaves.push({
                    x: boss.x,
                    y: boss.y,
                    radius: 20,
                    maxRadius: radius,
                    color: 'rgba(245, 158, 11, 0.95)',
                    alpha: 1.0
                });

                if (player && player.hp > 0 && Math.hypot(player.x - boss.x, player.y - boss.y) <= radius + (player.radius || 20)) {
                    this._applyDamageToPlayer(damages[idx], boss);
                    this._applyPlayerSlow(1.8);
                }
            }, idx * 450);
        });
    },

    /**
     * BÃO AXIT 5 TIA CỦA MẪU HOÀNG ĐỘC TỐ
     */
    _fireAcidBarrage: function (boss, baseAngle) {
        const spreadCount = 5;
        const totalSpread = Math.PI * 0.45;

        for (let i = 0; i < spreadCount; i++) {
            const angle = baseAngle - totalSpread / 2 + (i / (spreadCount - 1)) * totalSpread;
            this.projectiles.push({
                x: boss.x + Math.cos(angle) * (boss.radius + 14),
                y: boss.y + Math.sin(angle) * (boss.radius + 14),
                vx: Math.cos(angle) * 440,
                vy: Math.sin(angle) * 440,
                radius: 8.5,
                damage: Math.round(boss.damage * 0.85),
                color: '#a855f7',
                timeline: boss.timeline,
                life: 2.5,
                isAcid: true,
                sourceEnemy: boss
            });
        }
    },

    // ========================================================================
    // AI CHÚA TỂ THỜI KHÔNG (GLOBAL BOSS CHRONOS LORD - 3 PHASES)
    // ========================================================================
    _updateChronosLordAI: function (boss, dt, player) {
        if (!player || player.hp <= 0) return;

        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        boss.facingAngle = angle;

        // Cập nhật Phase theo HP (P1: >66%, P2: 33-66%, P3: <33%)
        const hpRatio = boss.hp / boss.maxHp;
        if (hpRatio <= 0.33) boss.phase = 3;
        else if (hpRatio <= 0.66) boss.phase = 2;
        else boss.phase = 1;

        // Xoay chuyển Khiên Kỷ Nguyên theo chu kỳ 8s
        boss.phaseShiftTimer -= dt;
        if (boss.phaseShiftTimer <= 1.5 && !boss.phaseShiftWarningActive) {
            boss.phaseShiftWarningActive = true;
            const shiftOrder = ['PAST', 'PRESENT', 'FUTURE'];
            const curIdx = shiftOrder.indexOf(boss.shieldTimeline);
            boss.nextShieldTimeline = shiftOrder[(curIdx + 1) % shiftOrder.length];

            if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                window.Game.Combat.spawnFloatingText(boss.x, boss.y - boss.radius - 36, `⚠️ SẮP ĐỔI KHIÊN SANG: ${boss.nextShieldTimeline}!`, '#fde047', true);
            }
        }

        if (boss.phaseShiftTimer <= 0) {
            boss.phaseShiftTimer = 8.0;
            boss.phaseShiftWarningActive = false;
            boss.shieldTimeline = boss.nextShieldTimeline || 'PRESENT';
            boss.nextShieldTimeline = null;
            boss.shatterAvailable = true;

            this.healWaves.push({
                x: boss.x,
                y: boss.y,
                radius: 25,
                maxRadius: 320,
                color: boss.shieldTimeline === 'PAST' ? '#f59e0b' : boss.shieldTimeline === 'PRESENT' ? '#10b981' : '#00f2fe',
                alpha: 1.0
            });
        }

        // Vệ tinh xoay bảo vệ (P2 & P3)
        if (boss.phase >= 2) {
            boss.satelliteAngle = (boss.satelliteAngle || 0) + dt * 3.2;
            const satCount = boss.phase === 3 ? 4 : 2;
            const satDist = 95;

            for (let s = 0; s < satCount; s++) {
                const sa = boss.satelliteAngle + (s * Math.PI * 2) / satCount;
                const sx = boss.x + Math.cos(sa) * satDist;
                const sy = boss.y + Math.sin(sa) * satDist;

                if (Math.hypot(player.x - sx, player.y - sy) <= 22 + (player.radius || 20)) {
                    boss.satelliteHitCd = (boss.satelliteHitCd || 0) - dt;
                    if (boss.satelliteHitCd <= 0) {
                        boss.satelliteHitCd = 0.6;
                        this._applyDamageToPlayer(boss.damage * 0.75, boss);
                    }
                }
            }
        }

        // Chiêu 1: Bão đạn xoắn ốc kép (Spiral Bullet Hell)
        boss.spiralOffset = (boss.spiralOffset || 0) + dt * 2.8;
        boss.shootCd = (boss.shootCd || 1.5) - dt;
        if (boss.shootCd <= 0) {
            boss.shootCd = boss.phase === 3 ? 0.28 : boss.phase === 2 ? 0.42 : 0.65;
            for (let arm = 0; arm < 2; arm++) {
                const sAngle = boss.spiralOffset + arm * Math.PI;
                this.projectiles.push({
                    x: boss.x + Math.cos(sAngle) * (boss.radius + 16),
                    y: boss.y + Math.sin(sAngle) * (boss.radius + 16),
                    vx: Math.cos(sAngle) * 380,
                    vy: Math.sin(sAngle) * 380,
                    radius: 9,
                    damage: Math.round(boss.damage * 0.7),
                    color: '#e879f9',
                    timeline: 'ALL',
                    life: 3.2,
                    sourceBoss: boss
                });
            }
        }

        // Chiêu 2: Bão đạn hướng tâm (Radial Bursts)
        boss.radialCd = (boss.radialCd || 2.8) - dt;
        if (boss.radialCd <= 0) {
            boss.radialCd = boss.phase === 3 ? 3.0 : 4.2;
            const bolts = boss.phase === 3 ? 16 : 12;
            for (let b = 0; b < bolts; b++) {
                const bAngle = (b * Math.PI * 2) / bolts;
                this.projectiles.push({
                    x: boss.x + Math.cos(bAngle) * (boss.radius + 18),
                    y: boss.y + Math.sin(bAngle) * (boss.radius + 18),
                    vx: Math.cos(bAngle) * 420,
                    vy: Math.sin(bAngle) * 420,
                    radius: 10,
                    damage: Math.round(boss.damage * 0.85),
                    color: '#00f2fe',
                    timeline: 'ALL',
                    life: 2.8,
                    sourceBoss: boss
                });
            }
        }

        // Chiêu 3: Lướt xung kích xé toạc không gian (Dash Xung Kích)
        if (boss.isDashing) {
            boss.dashTimer -= dt;
            const nx = boss.x + boss.dashVx * dt;
            const ny = boss.y + boss.dashVy * dt;
            if (this._canEnemyMoveTo(boss, nx, ny)) {
                boss.x = nx;
                boss.y = ny;
            }

            if (Math.hypot(player.x - boss.x, player.y - boss.y) <= boss.radius + (player.radius || 20) + 12) {
                this._applyDamageToPlayer(boss.damage * 1.5, boss);
                this._applyPlayerSlow(2.0);
            }

            if (boss.dashTimer <= 0) {
                boss.isDashing = false;
            }
            return;
        }

        boss.dashCd = (boss.dashCd || 5.2) - dt;
        if (boss.dashCd <= 0 && dist > 200) {
            boss.dashCd = boss.phase === 3 ? 5.5 : 7.0;
            this.telegraphs.push({
                type: 'BOSS_DASH',
                sourceBoss: boss,
                startX: boss.x,
                startY: boss.y,
                angle: angle,
                length: 520,
                timer: 0.85,
                maxTimer: 0.85,
                color: '#ff0844'
            });
        }

        // Chiêu 4: Mưa thiên thạch thời không (Meteor Shower - P2 & P3)
        if (boss.phase >= 2) {
            boss.meteorCd = (boss.meteorCd || 4.5) - dt;
            if (boss.meteorCd <= 0) {
                boss.meteorCd = boss.phase === 3 ? 3.8 : 5.0;
                const meteorCount = boss.phase === 3 ? 4 : 2;
                for (let m = 0; m < meteorCount; m++) {
                    const targetX = player.x + (Math.random() - 0.5) * 180;
                    const targetY = player.y + (Math.random() - 0.5) * 180;
                    this.telegraphs.push({
                        type: 'METEOR',
                        sourceBoss: boss,
                        x: targetX,
                        y: targetY,
                        radius: 75,
                        damage: Math.round(boss.damage * 1.4),
                        timer: 1.1,
                        maxTimer: 1.1,
                        color: '#f43f5e'
                    });
                }
            }
        }

        // Di chuyển tiếp cận người chơi
        if (dist > 180) {
            const step = boss.speed * dt;
            const nx = boss.x + Math.cos(angle) * step;
            const ny = boss.y + Math.sin(angle) * step;
            if (this._canEnemyMoveTo(boss, nx, ny)) {
                boss.x = nx;
                boss.y = ny;
            }
        }
    },

    /**
     * CẬP NHẬT CÁC MẢNG HIỆU ỨNG THỊ GIÁC (VFX ENGINE)
     */
    _updateVisualEffects: function (dt) {
        for (let i = this.healWaves.length - 1; i >= 0; i--) {
            const hw = this.healWaves[i];
            hw.radius += (hw.maxRadius - hw.radius) * Math.min(1, dt * 8);
            hw.alpha -= dt * 2.2;
            if (hw.alpha <= 0.05 || hw.radius >= hw.maxRadius * 0.96) {
                this.healWaves.splice(i, 1);
            }
        }

        for (let i = this.healLinks.length - 1; i >= 0; i--) {
            const hl = this.healLinks[i];
            hl.life -= dt;
            if (hl.life <= 0) this.healLinks.splice(i, 1);
        }

        for (let i = this.shieldDeflections.length - 1; i >= 0; i--) {
            const sd = this.shieldDeflections[i];
            sd.life -= dt;
            if (sd.life <= 0) this.shieldDeflections.splice(i, 1);
        }

        for (let i = this.evadeAfterimages.length - 1; i >= 0; i--) {
            const ea = this.evadeAfterimages[i];
            ea.life -= dt;
            if (ea.life <= 0) this.evadeAfterimages.splice(i, 1);
        }

        for (let i = this.corpseExplosions.length - 1; i >= 0; i--) {
            const ce = this.corpseExplosions[i];
            ce.life -= dt;
            if (ce.life <= 0) this.corpseExplosions.splice(i, 1);
        }
    },

    /**
     * CẬP NHẬT ĐẠN QUÁI VẬT & VA CHẠM NGƯỜI CHƠI
     */
    _updateProjectiles: function (dt, player, currentTimeline) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life -= dt;
            if (p.life <= 0 || p.dead) {
                this.projectiles.splice(i, 1);
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Đạn phản đòn do Parry đánh trúng lại quái vật
            if (p.friendly) {
                const enemies = this.getActiveList();
                for (let j = 0; j < enemies.length; j++) {
                    const e = enemies[j];
                    if (!e || e.dead || e.hp <= 0) continue;
                    if (Math.hypot(e.x - p.x, e.y - p.y) <= (e.radius || 20) + p.radius) {
                        this.damageEnemy(e, p.damage || 35, true, false, true, p.x, p.y);
                        this.projectiles.splice(i, 1);
                        break;
                    }
                }
                continue;
            }

            // Va chạm với người chơi
            if (player && player.hp > 0 && (p.timeline === 'ALL' || p.timeline === currentTimeline)) {
                if (Math.hypot(player.x - p.x, player.y - p.y) <= (player.radius || 20) + p.radius) {
                    this._applyDamageToPlayer(p.damage, p.sourceEnemy || p.sourceBoss);
                    if (p.isAcid) this._applyPlayerSlow(1.5);
                    this.projectiles.splice(i, 1);
                }
            }
        }
    },

    // ========================================================================
    // DỰNG HÌNH CANVAS (RENDER ENGINE CHO MOBILE 60-120 FPS)
    // TỐI ƯU: TỌA ĐỘ NGUYÊN (x|0), CULLING TOÀN DIỆN, KHÔNG DÙNG SHADOWBLUR TẬP TRUNG
    // ========================================================================
    draw: function (ctx, camera) {
        const camX = ((camera && camera.x) || 0) | 0;
        const camY = ((camera && camera.y) || 0) | 0;
        const camW = ((camera && camera.width) || window.innerWidth || 1280) | 0;
        const camH = ((camera && camera.height) || window.innerHeight || 720) | 0;
        const now = performance.now() * 0.001;

        ctx.save();

        // 1. Vẽ Telegraphs Cảnh Báo
        this._drawTelegraphs(ctx, camX, camY, camW, camH, now);

        // 2. Vẽ Sóng Chấn Động, Nổ Xác & Trị Liệu
        this._drawVisualEffects(ctx, camX, camY, camW, camH);

        // 3. Vẽ Dây Chuyền Hồi Máu (Heal Links)
        this._drawHealLinks(ctx, camX, camY);

        // 4. Vẽ Bóng Mờ Né Đạn (Evade Afterimages)
        this._drawEvadeAfterimages(ctx, camX, camY);

        // 5. Vẽ Đồ Rơi (Loot Drops)
        this._drawLootDrops(ctx, camX, camY, camW, camH, now);

        // 6. Vẽ Quái Vật & Boss Kỷ Nguyên
        this._drawEnemies(ctx, camX, camY, camW, camH, now);

        // 7. Vẽ Đạn Quái Vật (Projectiles)
        this._drawProjectiles(ctx, camX, camY, camW, camH);

        ctx.restore();
    },

    _drawTelegraphs: function (ctx, camX, camY, camW, camH, now) {
        for (let i = 0; i < this.telegraphs.length; i++) {
            const tg = this.telegraphs[i];
            const progress = 1 - Math.max(0, tg.timer / tg.maxTimer);

            if (tg.type === 'METEOR') {
                const sx = (tg.x - camX) | 0;
                const sy = (tg.y - camY) | 0;
                if (sx < -tg.radius || sx > camW + tg.radius || sy < -tg.radius || sy > camH + tg.radius) continue;

                ctx.save();
                ctx.translate(sx, sy);
                ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
                ctx.beginPath();
                ctx.arc(0, 0, tg.radius | 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = tg.color || '#f43f5e';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, (tg.radius * progress) | 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            } else if (tg.type === 'SNIPER_LINE' || tg.type === 'BOSS_DASH') {
                const sx = (tg.startX - camX) | 0;
                const sy = (tg.startY - camY) | 0;
                const endX = (tg.startX + Math.cos(tg.angle) * tg.length - camX) | 0;
                const endY = (tg.startY + Math.sin(tg.angle) * tg.length - camY) | 0;

                ctx.save();
                ctx.strokeStyle = tg.color || '#ff0844';
                ctx.lineWidth = tg.type === 'BOSS_DASH' ? 6 : 2.5;
                ctx.setLineDash([12, 8]);
                ctx.lineDashOffset = -(now * 40) % 20;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
        }
    },

    _drawVisualEffects: function (ctx, camX, camY, camW, camH) {
        for (let i = 0; i < this.healWaves.length; i++) {
            const hw = this.healWaves[i];
            const sx = (hw.x - camX) | 0;
            const sy = (hw.y - camY) | 0;
            const r = hw.radius | 0;
            if (sx < -r || sx > camW + r || sy < -r || sy > camH + r) continue;

            ctx.save();
            ctx.globalAlpha = Math.max(0, hw.alpha);
            ctx.strokeStyle = hw.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        for (let i = 0; i < this.corpseExplosions.length; i++) {
            const ce = this.corpseExplosions[i];
            const sx = (ce.x - camX) | 0;
            const sy = (ce.y - camY) | 0;
            const r = ce.radius | 0;
            if (sx < -r || sx > camW + r || sy < -r || sy > camH + r) continue;

            ctx.save();
            ctx.globalAlpha = Math.max(0, ce.life / ce.maxLife) * 0.45;
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },

    _drawHealLinks: function (ctx, camX, camY) {
        for (let i = 0; i < this.healLinks.length; i++) {
            const hl = this.healLinks[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, hl.life / hl.maxLife);
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo((hl.x1 - camX) | 0, (hl.y1 - camY) | 0);
            ctx.lineTo((hl.x2 - camX) | 0, (hl.y2 - camY) | 0);
            ctx.stroke();
            ctx.restore();
        }
    },

    _drawEvadeAfterimages: function (ctx, camX, camY) {
        for (let i = 0; i < this.evadeAfterimages.length; i++) {
            const ea = this.evadeAfterimages[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, ea.life / ea.maxLife) * 0.55;
            ctx.fillStyle = ea.color;
            ctx.beginPath();
            ctx.arc((ea.x - camX) | 0, (ea.y - camY) | 0, ea.radius | 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },

    _drawLootDrops: function (ctx, camX, camY, camW, camH, now) {
        for (let i = 0; i < this.lootDrops.length; i++) {
            const item = this.lootDrops[i];
            const sx = (item.x - camX) | 0;
            const sy = (item.y - (item.z || 0) - camY) | 0;
            const shadowY = (item.y - camY) | 0;

            if (sx < -30 || sx > camW + 30 || sy < -30 || sy > camH + 30) continue;

            ctx.save();
            // Bóng đổ vật phẩm
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(sx, shadowY, 7, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Vẽ khối vật phẩm
            if (item.type === 'GOLD') {
                ctx.fillStyle = '#facc15';
                ctx.strokeStyle = '#ca8a04';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(sx, sy, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (item.type === 'EXP_ORB') {
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(sx, sy, 7, 0, Math.PI * 2);
                ctx.fill();
            } else if (item.type === 'HP_ORB') {
                ctx.fillStyle = '#4ade80';
                ctx.beginPath();
                ctx.arc(sx, sy, 7.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (item.type === 'SHIELD_ORB') {
                ctx.fillStyle = '#00f2fe';
                ctx.beginPath();
                ctx.arc(sx, sy, 8, 0, Math.PI * 2);
                ctx.fill();
            } else if (item.type === 'OVERDRIVE_ORB') {
                ctx.fillStyle = '#f43f5e';
                ctx.beginPath();
                ctx.arc(sx, sy, 8.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (item.type === 'SHARD') {
                ctx.fillStyle = '#c084fc';
                ctx.beginPath();
                ctx.moveTo(sx, sy - 8);
                ctx.lineTo(sx + 6, sy);
                ctx.lineTo(sx, sy + 8);
                ctx.lineTo(sx - 6, sy);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    },

    _drawEnemies: function (ctx, camX, camY, camW, camH, now) {
        const currentTimeline = (window.Game.state && window.Game.state.timeline) || 'PRESENT';

        for (let i = 0; i < this.list.length; i++) {
            const enemy = this.list[i];
            if (!enemy || enemy.dead || enemy.hp <= 0) continue;
            if (!enemy.isBoss && enemy.timeline !== currentTimeline) continue;

            const sx = (enemy.x - camX) | 0;
            const sy = (enemy.y - camY) | 0;
            const r = enemy.radius | 0;

            if (sx < -r * 2 || sx > camW + r * 2 || sy < -r * 2 || sy > camH + r * 2) continue;

            ctx.save();
            ctx.translate(sx, sy);

            // Bóng chân
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(0, (r * 0.85) | 0, (r * 0.9) | 0, (r * 0.45) | 0, 0, 0, Math.PI * 2);
            ctx.fill();

            // Hiệu ứng Kamikaze nhấp nháy đỏ
            if (enemy.kamikazeActive) {
                const flash = Math.sin(now * 22) > 0;
                ctx.fillStyle = flash ? '#ef4444' : '#7f1d1d';
            } else if (enemy.hitFlash > 0) {
                ctx.fillStyle = '#ffffff';
            } else if (enemy.freezeTimer > 0) {
                ctx.fillStyle = '#38bdf8';
            } else {
                ctx.fillStyle = enemy.timeline === 'PAST' ? '#10b981' : enemy.timeline === 'PRESENT' ? '#f59e0b' : '#38bdf8';
                if (enemy.isBoss) ctx.fillStyle = '#a855f7';
                else if (enemy.isMiniBoss) ctx.fillStyle = '#ea580c';
            }

            // Thân quái
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Vẽ Khiên Mặt Trước của Tanker
            if (enemy.isTanker) {
                ctx.save();
                ctx.rotate(enemy.facingAngle || 0);
                ctx.strokeStyle = enemy.timeline === 'FUTURE' ? '#00f2fe' : '#f59e0b';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, r + 4, -Math.PI * 0.35, Math.PI * 0.35);
                ctx.stroke();
                ctx.restore();
            }

            // Vẽ Vòng Khiên Lượng Tử Boss Toàn Cục (Chronos Lord)
            if (enemy.isBoss) {
                ctx.save();
                const tlColor = enemy.shieldTimeline === 'PAST' ? '#f59e0b' : enemy.shieldTimeline === 'PRESENT' ? '#10b981' : '#00f2fe';
                ctx.strokeStyle = tlColor;
                ctx.lineWidth = 3.5;
                ctx.setLineDash([10, 6]);
                ctx.rotate(now * 2);
                ctx.beginPath();
                ctx.arc(0, 0, r + 14, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Vẽ Vệ Tinh (Phase 2 & 3)
                if (enemy.phase >= 2) {
                    const satCount = enemy.phase === 3 ? 4 : 2;
                    for (let s = 0; s < satCount; s++) {
                        const sa = (enemy.satelliteAngle || 0) + (s * Math.PI * 2) / satCount;
                        const satX = Math.cos(sa) * 95;
                        const satY = Math.sin(sa) * 95;
                        ctx.fillStyle = '#f43f5e';
                        ctx.beginPath();
                        ctx.arc(satX, satY, 11, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }

            // Thanh máu trên đầu (Quái thường / Tinh Anh / Mini-Boss)
            if (!enemy.isBoss) {
                const barW = Math.max(28, r * 1.8);
                const barH = 4;
                const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect((-barW / 2) | 0, -r - 12, barW, barH);
                ctx.fillStyle = enemy.isMiniBoss ? '#f59e0b' : '#ef4444';
                ctx.fillRect((-barW / 2) | 0, -r - 12, (barW * hpRatio) | 0, barH);
            }

            ctx.restore();
        }
    },

    _drawProjectiles: function (ctx, camX, camY, camW, camH) {
        for (let i = 0; i < this.projectiles.length; i++) {
            const p = this.projectiles[i];
            const sx = (p.x - camX) | 0;
            const sy = (p.y - camY) | 0;
            const r = p.radius | 0;

            if (sx < -r || sx > camW + r || sy < -r || sy > camH + r) continue;

            ctx.save();
            ctx.fillStyle = p.color || '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();

            if (p.isAcid) {
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ctx.restore();
        }
    }
};

// ----------------------------------------------------------------------------
// TỰ ĐỘNG KHỞI TẠO ENEMY ENGINE
// ----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
    window.Game.Enemies.init();
}
    // (Hết Phần 1 - Đang chờ lệnh tiếp tục để nối tiếp Phần 2)