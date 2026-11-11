/**
 * ============================================================================
 * TỰA GAME: KẺ DU HÀNH THỜI KHÔNG (TIME TRAVELER ACTION RPG)
 * FILE: main.js - CORE GAME ENGINE ARCHITECTURE (PHẦN 1/2)
 * QUY MÔ: ĐẠI TU TOÀN DIỆN CHO DESKTOP & MOBILE HIGH-REFRESH (120Hz / GPU DYNAMIC SCALING)
 * ============================================================================
 * CÁC HỆ THỐNG ĐÃ TỐI ƯU VÀ NÂNG CẤP:
 * 1. ĐỒNG BỘ THỨ TỰ UPDATE: Gán Game.state.player = Game.player trước toàn bộ Module.
 * 2. GIÁM SÁT 120Hz & DYNAMIC DPR: Capped 1.5 trên 2K/3K, tự động hạ DPR và kích hoạt Culling khi < 45 FPS trong 3s.
 * 3. AERO BOOTS TRAIL (I.3): Vệt lửa 2.5s gây sát thương liên tục và làm chậm quái 30% trong 1.5s.
 * 4. LAST STAND PENDANT (I.6): Khiên ảo 50% HP trong 5s khi máu < 25% (Hồi 60s).
 * 5. QUANTUM REVIVE (III.10): Buffer 50 snapshots (5s), tua ngược vị trí, hồi 50% HP/Khiên và phóng sấm sét đẩy lùi khi máu về 0.
 * 6. PET EVOLUTION & LOOT COMPANION (V.1 - V.2): Hào quang Cấp 2, buff khiên mỗi 10s, Bậc 3 quét nhặt đồ bán kính 650px.
 * ============================================================================
 */

window.Game = window.Game || {};

(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // 1. BIẾN TOÀN CỤC NỘI BỘ VÀ KHỞI TẠO ENGINE
    // -------------------------------------------------------------------------
    let canvas = null;
    let ctx = null;
    let lastTime = 0;
    let animFrameId = null;
    let cameraInitialized = false;
    let lastSyncedCharId = null;

    let lastRecordedHp = 100;
    let lastRecordedShield = 50;
    let shieldBreakNovaCd = 0;
    let stationaryOutCombatTimer = 0;
    let regenParticleTimer = 0;
    let autoSaveTimer = 0;

    let combatTimer = 0;
    let isPlayerInCombat = false;
    let currentZoneLabel = null;

    // Giám sát FPS & Tự động thích ứng hiệu năng (120Hz / Dynamic Resolution Scaling)
    let frameCount = 0;
    let fpsTimer = 0;
    let currentFps = 60;
    let lowFpsTimeCounter = 0;
    let currentDpr = 1.0;
    let isLowPerformanceMode = false;

    // -------------------------------------------------------------------------
    // 2. CÁC CƠ CHẾ RELIC & HỆ THỐNG MỚI (AERO BOOTS, LAST STAND, SECOND CHANCE)
    // -------------------------------------------------------------------------
    
    // Mảng lưu trữ các điểm cháy của Vệt Lửa Phản Lực (Aero Boots Trail)
    const aeroBootsFireTrail = [];
    let aeroBootsDropTimer = 0;

    // Trạng thái Khiên Mặt Dây Chuyền Bất Khuất (Last Stand Pendant)
    const lastStandState = {
        cooldown: 0,
        activeDuration: 0,
        shieldAmount: 0,
        maxShieldAmount: 0
    };

    // Hệ thống Hồi Sinh Lượng Tử (Quantum Revive - Tua ngược 5 giây)
    const quantumReviveState = {
        usedInCurrentMatch: false,
        historyBuffer: [], // Lưu trữ tối đa 50 snapshots (0.1s/lần = 5 giây)
        snapshotTimer: 0,
        isRewinding: false,
        rewindVfxTimer: 0
    };

    // Hệ thống Tinh Linh Thời Không (Pet Evolution & Loot Companion)
    const petState = {
        x: 1920,
        y: 1920,
        vx: 0,
        vy: 0,
        phase: 0,
        fireTimer: 0,
        healTimer: 6.0,
        quantumShieldTimer: 10.0, // Định kỳ 10s buff khiên lượng tử cho người chơi
        trail: [],
        mode: 'ORBIT', // 'ORBIT' | 'FETCHING' | 'RETURN'
        targetLoot: null,
        carriedLoot: null,
        fetchSpeed: 460
    };

    // Hoạt ảnh Giật & Vung Vũ khí
    const weaponAnim = {
        recoilX: 0,
        recoilAngle: 0,
        lastAttackState: false
    };

    // Bảng Thống Kê Sát Thương Cuối Trận (Combat Recap - V.9)
    const combatRecapData = {
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        damageMitigated: 0,
        projectilesReflected: 0,
        dpsBuckets: [],
        currentSecondDamage: 0,
        secondTimer: 0,
        matchDuration: 0,
        isOpen: false
    };

    // -------------------------------------------------------------------------
    // 3. HÀM TIỆN ÍCH HỆ THỐNG, TỐI ƯU DPR & AN TOÀN DỮ LIỆU
    // -------------------------------------------------------------------------

    function hasRelic(relicKey) {
        if (!relicKey) return false;

        // Ưu tiên 1: Kiểm tra trực tiếp từ Game.Systems nếu đã sẵn sàng
        if (window.Game && window.Game.Systems && typeof window.Game.Systems.hasEquippedRelic === 'function') {
            return window.Game.Systems.hasEquippedRelic(relicKey);
        }

        // Ưu tiên 2: Fallback an toàn duyệt mảng Game.state.equippedRelics
        if (!window.Game || !window.Game.state || !Array.isArray(window.Game.state.equippedRelics)) {
            return false;
        }

        const equipped = window.Game.state.equippedRelics;
        const resolveFn = (window.Game.Systems && typeof window.Game.Systems._resolveRelicKey === 'function')
            ? window.Game.Systems._resolveRelicKey.bind(window.Game.Systems)
            : null;

        const targetCanonical = resolveFn ? resolveFn(relicKey) : relicKey;

        for (let i = 0; i < equipped.length; i++) {
            const item = equipped[i];
            if (!item) continue;
            if (item === relicKey || item === targetCanonical) return true;
            if (resolveFn && resolveFn(item) === targetCanonical) return true;
        }

        return false;
    }

    function calculateTargetDpr() {
        const isLowSettingActive = !!(
            Game.state?.lowGraphicsMode ||
            Game.isLowPerformanceMode ||
            isLowPerformanceMode
        );
        if (isLowSettingActive) {
            return 1.0;
        }
        // Khóa trần 1.5 trên màn hình độ phân giải siêu cao (2K/3K/4K) để đảm bảo 90Hz/120Hz ổn định
        return Math.min(window.devicePixelRatio || 1, 1.5);
    }

    function ensureRuntimePlayerAndCameraSafety() {
        window.Game.state = window.Game.state || {};
        window.Game.player = window.Game.player || {};
        window.Game.camera = window.Game.camera || { x: 0, y: 0, width: 800, height: 600, zoom: 1.0 };

        const player = Game.player;
        const state = Game.state;
        const charId = state.selectedCharacter || player.characterId || 'time_traveler';
        const cfg = (Game.charactersConfig && Game.charactersConfig[charId]) || {
            id: 'time_traveler',
            name: 'Kẻ Du Hành Thời Không',
            spriteColor: '#2563eb',
            accentColor: '#38bdf8',
            radius: 20,
            baseHp: 100,
            baseShield: 50,
            baseSpeed: 240,
            hpRegen: 2.5,
            shieldRegenRate: 0.05,
            ccResistance: 0.1,
            skills: []
        };

        if (typeof player.x !== 'number' || isNaN(player.x)) player.x = 1920;
        if (typeof player.y !== 'number' || isNaN(player.y)) player.y = 1920;
        if (typeof player.vx !== 'number' || isNaN(player.vx)) player.vx = 0;
        if (typeof player.vy !== 'number' || isNaN(player.vy)) player.vy = 0;
        if (typeof player.angle !== 'number' || isNaN(player.angle)) player.angle = 0;

        if (lastSyncedCharId !== charId) {
            lastSyncedCharId = charId;
            player.characterId = charId;
            player.radius = cfg.radius || 20;
            player.hpRegen = cfg.hpRegen ?? 2.5;
            player.shieldRegenRate = cfg.shieldRegenRate ?? 0.05;
            player.ccResistance = cfg.ccResistance ?? 0.0;

            if (Game.Systems && typeof Game.Systems.applyCharacterStats === 'function') {
                Game.Systems.applyCharacterStats(charId);
            }
            lastRecordedHp = player.hp;
            lastRecordedShield = player.shield;
        }

        // Đồng bộ tham chiếu hai chiều liên tục
        Game.state.player = player;
    }

    function isGamePausedOrModalOpen() {
        if (Game.state && Game.state.isPaused === true) return true;
        if (combatRecapData.isOpen) return true;

        const modalIds = [
            'shop-modal',
            'giftcode-modal',
            'character-select-modal',
            'settings-modal',
            'backpack-modal'
        ];

        for (let i = 0; i < modalIds.length; i++) {
            const m = document.getElementById(modalIds[i]);
            if (m && !m.classList.contains('hidden')) return true;
        }
        return false;
    }

    function resizeCanvas() {
        if (!canvas) return;
        const targetDpr = calculateTargetDpr();
        currentDpr = targetDpr;

        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;

        const internalWidth = Math.floor(displayWidth * currentDpr);
        const internalHeight = Math.floor(displayHeight * currentDpr);

        if (canvas.width !== internalWidth || canvas.height !== internalHeight) {
            canvas.width = internalWidth;
            canvas.height = internalHeight;
            canvas.style.width = displayWidth + 'px';
            canvas.style.height = displayHeight + 'px';
        }

        const isMobile = displayWidth <= 900 || displayHeight <= 550;
        Game.camera.zoom = isMobile ? 0.68 : 1.0;
        Game.camera.width = displayWidth / Game.camera.zoom;
        Game.camera.height = displayHeight / Game.camera.zoom;

        if (Game.Controls && typeof Game.Controls.onResize === 'function') {
            Game.Controls.onResize(displayWidth, displayHeight);
        }
    }

    function lerpAngle(current, target, t) {
        let diff = target - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return current + diff * Math.min(1, t);
    }

    function canPlayerMoveTo(targetX, targetY) {
        if (!Game.World || typeof Game.World.canMoveTo !== 'function') return true;
        return Game.World.canMoveTo(targetX, targetY, Game.player.radius || 20);
    }

    function isInsideCamera(x, y, radius, camera) {
        return (
            x + radius >= camera.x &&
            x - radius <= camera.x + camera.width &&
            y + radius >= camera.y &&
            y - radius <= camera.y + camera.height
        );
    }

    function spawnCulledParticles(x, y, color, count, speed) {
        if (!Game.Combat || typeof Game.Combat._spawnParticles !== 'function') return;
        const cullFactor = isLowPerformanceMode ? 0.25 : 1.0;
        const adjustedCount = Math.max(1, Math.floor(count * cullFactor));
        Game.Combat._spawnParticles(x, y, color, adjustedCount, speed);
    }

    // -------------------------------------------------------------------------
    // 4. HỆ THỐNG SNAPSHOT & HỒI SINH LƯỢNG TỬ (QUANTUM REVIVE - 5 GIÂY)
    // -------------------------------------------------------------------------

    function recordPlayerChronoSnapshot(dt) {
        const player = Game.player;
        if (!player || player.hp <= 0) return;

        quantumReviveState.snapshotTimer += dt;
        // Ghi nhận trạng thái mỗi 0.1s (10 snapshot/giây => 50 snapshot = 5 giây)
        if (quantumReviveState.snapshotTimer >= 0.1) {
            quantumReviveState.snapshotTimer = 0;
            quantumReviveState.historyBuffer.push({
                x: player.x,
                y: player.y,
                hp: player.hp,
                shield: player.shield,
                angle: player.angle
            });

            if (quantumReviveState.historyBuffer.length > 50) {
                quantumReviveState.historyBuffer.shift();
            }
        }
    }

    function triggerQuantumRevive() {
        const player = Game.player;
        const state = Game.state;

        // Tua ngược về snapshot 5 giây trước (snapshot cũ nhất trong buffer)
        const targetSnapshot = quantumReviveState.historyBuffer.length > 0 
            ? quantumReviveState.historyBuffer[0] 
            : { x: 1920, y: 1920 };

        quantumReviveState.usedInCurrentMatch = true;
        quantumReviveState.isRewinding = true;
        quantumReviveState.rewindVfxTimer = 1.2;

        player.x = targetSnapshot.x;
        player.y = targetSnapshot.y;
        player.vx = 0;
        player.vy = 0;
        player.hp = Math.round(player.maxHp * 0.50); // Hồi 50% Máu tối đa
        player.shield = Math.round(player.maxShield * 0.50); // Hồi 50% Giáp tối đa
        player.screenShake = 0.65;

        // Phóng bão sấm sét lượng tử đẩy lùi và gây choáng toàn bộ quái vật xung quanh
        const activeEnemies = (Game.Enemies && typeof Game.Enemies.getActiveList === 'function')
            ? Game.Enemies.getActiveList()
            : ((Game.Enemies && Game.Enemies.list) || []);

        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (!e || e.dead || e.hp <= 0) continue;
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 420) {
                const angle = Math.atan2(dy, dx);
                const pushDist = Math.max(120, 380 - dist);
                e.x += Math.cos(angle) * pushDist * 0.5;
                e.y += Math.sin(angle) * pushDist * 0.5;
                e.stunTimer = Math.max(e.stunTimer || 0, 1.5); // Choáng 1.5s
                
                const lightningDmg = Math.round(80 + (state?.level || 1) * 12);
                if (Game.Enemies && typeof Game.Enemies.damageEnemy === 'function') {
                    Game.Enemies.damageEnemy(e, lightningDmg, true);
                } else {
                    e.hp -= lightningDmg;
                }
            }
        }

        spawnCulledParticles(player.x, player.y, '#00f2fe', 45, 320);
        spawnCulledParticles(player.x, player.y, '#f59e0b', 35, 260);

        if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
            Game.Combat.spawnFloatingText(player.x, player.y - 45, '⚡ HỒI SINH LƯỢNG TỬ (TUA NGƯỢC 5S)!', '#00f2fe');
        }
        if (Game.Combat && Array.isArray(Game.Combat.laserBeams)) {
            Game.Combat.laserBeams.push({
                x1: player.x,
                y1: player.y - 600,
                x2: player.x,
                y2: player.y,
                color: '#00f2fe',
                coreColor: '#ffffff',
                width: 26,
                life: 0.55,
                maxLife: 0.55
            });
        }
        if (Game.Audio && typeof Game.Audio.playTimeShift === 'function') {
            Game.Audio.playTimeShift();
        }
        if (Game.Systems && typeof Game.Systems.notify === 'function') {
            Game.Systems.notify('⚡ Nghịch Lý Thời Không: Đã tua ngược thời gian sống sót!', '#00f2fe');
        }
    }

    // -------------------------------------------------------------------------
    // 5. CƠ CHẾ VỆT LỬA PHẢN LỰC (AERO BOOTS - I.3)
    // -------------------------------------------------------------------------

    function updateAeroBootsFireTrail(dt) {
        const player = Game.player;
        const isAeroBootsEquipped = hasRelic('relic_aero_boots');

        // Chỉ sinh vệt lửa khi ĐANG TRANG BỊ Giày Phản Lực và đang di chuyển
        if (isAeroBootsEquipped && player && player.hp > 0) {
            const currentSpeed = Math.hypot(player.vx || 0, player.vy || 0);
            if (currentSpeed > 30) {
                aeroBootsDropTimer += dt;
                if (aeroBootsDropTimer >= 0.08) {
                    aeroBootsDropTimer = 0;
                    const jitterX = (Math.random() - 0.5) * 8;
                    const jitterY = (Math.random() - 0.5) * 8;
                    aeroBootsFireTrail.push({
                        x: player.x + jitterX,
                        y: player.y + jitterY + 8,
                        radius: 22,
                        life: 2.5, // Tồn tại 2.5 giây
                        maxLife: 2.5,
                        tickTimer: 0
                    });
                }
            }
        } else {
            aeroBootsDropTimer = 0;
        }

        // Cập nhật vòng đời và sát thương/làm chậm của vệt lửa lên quái vật
        const activeEnemies = (Game.Enemies && typeof Game.Enemies.getActiveList === 'function')
            ? Game.Enemies.getActiveList()
            : ((Game.Enemies && Game.Enemies.list) || []);

        for (let i = aeroBootsFireTrail.length - 1; i >= 0; i--) {
            const fire = aeroBootsFireTrail[i];
            fire.life -= dt;
            if (fire.life <= 0) {
                aeroBootsFireTrail.splice(i, 1);
                continue;
            }

            fire.tickTimer += dt;
            if (fire.tickTimer >= 0.25) { // Gây sát thương mỗi 0.25s
                fire.tickTimer = 0;
                const fireDmg = Math.round(18 + (Game.state?.level || 1) * 3.5);

                for (let j = 0; j < activeEnemies.length; j++) {
                    const e = activeEnemies[j];
                    if (!e || e.dead || e.hp <= 0) continue;
                    const dist = Math.hypot(e.x - fire.x, e.y - fire.y);
                    if (dist <= fire.radius + (e.radius || 18)) {
                        // Làm chậm 30% trong 1.5s và thiêu đốt
                        e.slowTimer = Math.max(e.slowTimer || 0, 1.5);
                        e.slowAmount = 0.30;
                        if (Game.Enemies && typeof Game.Enemies.damageEnemy === 'function') {
                            Game.Enemies.damageEnemy(e, fireDmg, false);
                        } else {
                            e.hp -= fireDmg;
                        }
                        combatRecapData.totalDamageDealt += fireDmg;
                        combatRecapData.currentSecondDamage += fireDmg;
                        if (!isLowPerformanceMode && Math.random() < 0.4) {
                            spawnCulledParticles(e.x, e.y, '#ff4500', 3, 60);
                        }
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // 6. GIÁM SÁT CHIẾN ĐẤU, RECAP & HIỆU NĂNG 120Hz
    // -------------------------------------------------------------------------

    function updateCombatState(dt, hpLost, shieldLost) {
        const wasInCombat = isPlayerInCombat;

        let isUsingAction = false;
        if (Game.Controls && Game.Controls.buttons) {
            const btns = Game.Controls.buttons;
            isUsingAction = !!(
                btns.attack?.pressed ||
                btns.skill1?.pressed ||
                btns.skill2?.pressed ||
                btns.skill3?.pressed
            );
        }

        const activeEnemies = (Game.Enemies && typeof Game.Enemies.getActiveList === 'function')
            ? Game.Enemies.getActiveList()
            : ((Game.Enemies && Game.Enemies.list) || []);
        let enemyNear = false;
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (!e || e.dead || e.hp <= 0) continue;
            if (Math.hypot(e.x - Game.player.x, e.y - Game.player.y) < 360) {
                enemyNear = true;
                break;
            }
        }

        if (hpLost > 0 || shieldLost > 0 || isUsingAction || enemyNear) {
            combatTimer = 4.0;
        } else if (combatTimer > 0) {
            combatTimer = Math.max(0, combatTimer - dt);
        }

        isPlayerInCombat = combatTimer > 0;
        Game.isPlayerInCombat = isPlayerInCombat;

        if (wasInCombat !== isPlayerInCombat) {
            if (Game.UI && typeof Game.UI.setCombatState === 'function') {
                Game.UI.setCombatState(isPlayerInCombat);
            }
        }

        // Cập nhật Combat Recap: Lưu vết DPS 30 giây gần nhất
        combatRecapData.matchDuration += dt;
        combatRecapData.secondTimer += dt;
        if (combatRecapData.secondTimer >= 1.0) {
            combatRecapData.secondTimer = 0;
            combatRecapData.dpsBuckets.push(combatRecapData.currentSecondDamage);
            if (combatRecapData.dpsBuckets.length > 30) {
                combatRecapData.dpsBuckets.shift();
            }
            combatRecapData.currentSecondDamage = 0;
        }
    }

    function updatePerformanceMonitor(rawDt) {
        frameCount++;
        fpsTimer += rawDt;

        if (fpsTimer >= 1.0) {
            currentFps = frameCount / fpsTimer;
            frameCount = 0;
            fpsTimer = 0;
            Game.currentFps = Math.round(currentFps);

            // Tự động kích hoạt Dynamic Scaling / Culling nếu FPS dưới 45 trong 3 giây liên tục
            if (currentFps < 45) {
                lowFpsTimeCounter += 1.0;
                if (lowFpsTimeCounter >= 3.0 && !isLowPerformanceMode) {
                    isLowPerformanceMode = true;
                    Game.isLowPerformanceMode = true;
                    if (Game.state) Game.state.lowGraphicsMode = true;

                    if (Game.Combat && Array.isArray(Game.Combat.particles)) {
                        Game.Combat.particles.length = Math.min(Game.Combat.particles.length, 25);
                    }
                    if (Game.Combat && Array.isArray(Game.Combat.floatingTexts)) {
                        Game.Combat.floatingTexts.length = Math.min(Game.Combat.floatingTexts.length, 12);
                    }

                    resizeCanvas();
                    if (Game.Systems && typeof Game.Systems.notify === 'function') {
                        Game.Systems.notify('⚡ Hiệu năng: Đã bật Dynamic Scaling & Chế độ Tiết Kiệm GPU!', '#f59e0b');
                    }
                }
            } else if (currentFps >= 55) {
                lowFpsTimeCounter = Math.max(0, lowFpsTimeCounter - 1.0);
            }
        }
    }

    // -------------------------------------------------------------------------
    // 7. CẬP NHẬT KỸ NĂNG, PHÒNG THỦ, HỒI PHỤC VÀ BẤT KHUẤT
    // -------------------------------------------------------------------------

    function updateCharacterSkillsAndDefense(dt) {
        const player = Game.player;

        // CƠ CHẾ: MẶT DÂY CHUYỀN BẤT KHUẤT (Last Stand Pendant - I.6)
        if (lastStandState.cooldown > 0) {
            lastStandState.cooldown = Math.max(0, lastStandState.cooldown - dt);
        }
        if (lastStandState.activeDuration > 0) {
            lastStandState.activeDuration = Math.max(0, lastStandState.activeDuration - dt);
            if (lastStandState.activeDuration <= 0) {
                lastStandState.shieldAmount = 0;
            }
        }

        const isLastStandEquipped = hasRelic('relic_last_stand');
        // Nếu vừa tháo Cổ Vật ra khỏi Balo trong lúc đang có khiên thì hủy khiên ảo ngay lập tức
        if (!isLastStandEquipped && lastStandState.shieldAmount > 0) {
            lastStandState.shieldAmount = 0;
            lastStandState.activeDuration = 0;
        }

        // Kích hoạt khiên ảo 50% HP trong 5s khi máu < 25% (Hồi chiêu 60s)
        if (isLastStandEquipped && player.hp > 0 && player.hp < player.maxHp * 0.25 && lastStandState.cooldown <= 0) {
            lastStandState.cooldown = 60.0;
            lastStandState.activeDuration = 5.0;
            lastStandState.maxShieldAmount = Math.round(player.maxHp * 0.50);
            lastStandState.shieldAmount = lastStandState.maxShieldAmount;

            player.screenShake = 0.35;
            spawnCulledParticles(player.x, player.y, '#fbbf24', 28, 220);
            if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
                Game.Combat.spawnFloatingText(player.x, player.y - 40, '🛡️ KHIÊN BẤT KHUẤT (+50% HP)!', '#fbbf24');
            }
            if (Game.Audio && typeof Game.Audio.playShieldBreak === 'function') {
                Game.Audio.playShieldBreak();
            }
        }

        // Đồng bộ thuộc tính khiên ảo vào player cho Combat tính toán giảm sát thương
        player.lastStandActive = (lastStandState.activeDuration > 0 && lastStandState.shieldAmount > 0);
        player.lastStandShield = lastStandState.shieldAmount;

        // CƠ CHẾ: NHẪN HỒI PHỤC SINH MỆNH (Regen Ring - I.4)
        const isRegenRingEquipped = hasRelic('relic_regen_ring');
        if (isRegenRingEquipped && player.hp > 0 && player.hp < player.maxHp) {
            // Tự động hồi phục 2% Máu tối đa mỗi giây ngay cả khi đang giao tranh
            const regenAmount = player.maxHp * 0.02 * dt;
            player.hp = Math.min(player.maxHp, player.hp + regenAmount);

            regenParticleTimer -= dt;
            if (regenParticleTimer <= 0) {
                regenParticleTimer = 0.35;
                if (!isLowPerformanceMode) {
                    const rx = player.x + (Math.random() - 0.5) * 24;
                    const ry = player.y + (Math.random() - 0.5) * 24;
                    spawnCulledParticles(rx, ry, '#22c55e', 2, 40);
                }
            }
        }

        // Hồi phục Giáp tự nhiên khi đứng yên / ngoài giao tranh
        const isStationary = Math.hypot(player.vx || 0, player.vy || 0) < 6;
        if (isStationary && !isPlayerInCombat) {
            stationaryOutCombatTimer += dt;
        } else {
            stationaryOutCombatTimer = 0;
        }

        const charRegenRate = player.shieldRegenRate || 0.05;
        if (player.shieldCooldown > 0) {
            const cdRecoverRate = stationaryOutCombatTimer >= 5.0 ? 2.0 : 1.0;
            player.shieldCooldown = Math.max(0, player.shieldCooldown - dt * cdRecoverRate);
        } else if (player.shield < player.maxShield && player.hp > 0) {
            const isMeditating = stationaryOutCombatTimer >= 5.0;
            const regenMult = isMeditating ? 2.2 : 1.0;
            player.shield = Math.min(player.maxShield, player.shield + player.maxShield * charRegenRate * regenMult * dt);

            if (isMeditating && !isLowPerformanceMode && Math.random() < 0.2) {
                spawnCulledParticles(player.x, player.y, '#38bdf8', 2, 35);
            }
        }

        // Hồi máu cơ bản của nhân vật ngoài giao tranh
        if (player.hp < player.maxHp && (player.hpRegen || 0) > 0 && !isPlayerInCombat) {
            player.hp = Math.min(player.maxHp, player.hp + player.hpRegen * dt);
        }

        lastRecordedHp = player.hp;
        lastRecordedShield = player.shield;
    }

    // -------------------------------------------------------------------------
    // 8. CẬP NHẬT DI CHUYỂN, AERO BOOTS VÀ KIỂM TRA TỬ TRẬN
    // -------------------------------------------------------------------------

    function updatePlayerMovement(dt) {
        const player = Game.player;
        const state = Game.state;

        if (player.godMode || state.godMode) {
            player.hp = player.maxHp;
            player.shield = player.maxShield;
        }

        // KIỂM TRA MÁU TỤT VỀ 0 -> HỒI SINH LƯỢNG TỬ HOẶC PHẠT TỬ TRẬN
        if (player.hp <= 0) {
            if (!quantumReviveState.usedInCurrentMatch) {
                triggerQuantumRevive();
                return;
            }

            // Phạt tử trận thông thường nếu đã dùng Hồi Sinh Lượng Tử
            const lostGold = Math.floor((state.gold || 0) * 0.20);
            state.gold = Math.max(0, (state.gold || 0) - lostGold);
            player.hp = player.maxHp;
            player.shield = player.maxShield;
            player.x = 1920;
            player.y = 1920;
            player.vx = 0;
            player.vy = 0;

            quantumReviveState.usedInCurrentMatch = false;
            quantumReviveState.historyBuffer.length = 0;

            if (Game.Enemies && typeof Game.Enemies.onPlayerRespawn === 'function') {
                Game.Enemies.onPlayerRespawn();
            }
            if (Game.Systems && typeof Game.Systems.notify === 'function') {
                Game.Systems.notify(`Tái tạo Thời Không! Mất ${lostGold}G (-20%)!`, '#ef4444');
            }
            if (Game.Systems && typeof Game.Systems.saveGame === 'function') {
                Game.Systems.saveGame();
            }
            return;
        }

        // Ghi nhận Snapshot tua ngược thời gian
        recordPlayerChronoSnapshot(dt);

        // Cập nhật Vệt Lửa Aero Boots
        updateAeroBootsFireTrail(dt);

        if (player.dashTime && player.dashTime > 0) return;

        const input = (Game.Controls && typeof Game.Controls.getInput === 'function')
            ? Game.Controls.getInput() || {}
            : {};

        let moveX = input.dx ?? input.x ?? input.vx ?? input.moveX ?? 0;
        let moveY = input.dy ?? input.y ?? input.vy ?? input.moveY ?? 0;
        const len = Math.hypot(moveX, moveY);
        if (len > 1) {
            moveX /= len;
            moveY /= len;
        }

        let terrainSpeedMult = 1.0;
        currentZoneLabel = null;
        if (Game.World && typeof Game.World.getTerrainEffectAt === 'function') {
            const terrain = Game.World.getTerrainEffectAt(player.x, player.y, dt);
            if (terrain) {
                terrainSpeedMult = terrain.speedMultiplier || 1.0;
                currentZoneLabel = terrain.zoneName || null;
                if (Game.Combat) {
                    Game.Combat.terrainCdrMultiplier = terrain.cdrMultiplier || 1.0;
                }
                if (terrain.damagePerSec > 0 && !state.godMode) {
                    player.hp = Math.max(0, player.hp - terrain.damagePerSec * dt);
                }
            }
        }

        let speedMultiplier = terrainSpeedMult;

        // Tăng +25% tốc độ chạy nếu trang bị Giày Lướt Phản Lực (Aero Boots)
        if (hasRelic('relic_aero_boots')) {
            speedMultiplier *= 1.25;
        }

        if (Game.Combat && Game.Combat.overdriveTimer > 0) {
            speedMultiplier *= 1.22;
        }
        if (player.slowTimer && player.slowTimer > 0) {
            player.slowTimer = Math.max(0, player.slowTimer - dt);
            const rawSlow = player.slowAmount || 0.35;
            const effectiveSlow = rawSlow * (1 - Math.min(0.85, player.ccResistance || 0));
            speedMultiplier *= Math.max(0.3, 1 - effectiveSlow);
        }

        const effectiveSpeed = (player.speed || 240) * speedMultiplier;
        const targetVx = moveX * effectiveSpeed;
        const targetVy = moveY * effectiveSpeed;

        const accel = len > 0.01 ? 18 : 22;
        player.vx += (targetVx - player.vx) * Math.min(1, accel * dt);
        player.vy += (targetVy - player.vy) * Math.min(1, accel * dt);

        if (len > 0.01) {
            player.angle = lerpAngle(player.angle, Math.atan2(moveY, moveX), 20 * dt);
        }

        const nextX = player.x + player.vx * dt;
        const nextY = player.y + player.vy * dt;

        if (canPlayerMoveTo(nextX, player.y)) {
            player.x = nextX;
        } else {
            player.vx = 0;
        }

        if (canPlayerMoveTo(player.x, nextY)) {
            player.y = nextY;
        } else {
            player.vy = 0;
        }

        // Hoạt ảnh vung / giật vũ khí
        const isAttackingNow = !!(Game.Controls && Game.Controls.buttons && Game.Controls.buttons.attack?.pressed);
        const wKey = state.currentWeapon || 'iron_sword';
        const isMelee = (wKey === 'iron_sword' || wKey === 'cyber_sword' || wKey === 'void_scythe');

        if (isAttackingNow && !weaponAnim.lastAttackState) {
            if (isMelee) {
                weaponAnim.recoilAngle = 0.55;
                weaponAnim.recoilX = 8;
            } else {
                weaponAnim.recoilX = -12;
                weaponAnim.recoilAngle = -0.22;
            }
        }
        weaponAnim.lastAttackState = isAttackingNow;
        weaponAnim.recoilX += (0 - weaponAnim.recoilX) * Math.min(1, 14 * dt);
        weaponAnim.recoilAngle += (0 - weaponAnim.recoilAngle) * Math.min(1, 14 * dt);

        const interactPrompt = document.getElementById('interact-prompt');
        if (interactPrompt && Game.World && typeof Game.World.getNearbyInteractable === 'function') {
            const nearby = Game.World.getNearbyInteractable(player.x, player.y);
            interactPrompt.classList.toggle('hidden', !nearby);
        }
    }

    // -------------------------------------------------------------------------
    // 9. CẬP NHẬT AI TINH LINH THỜI KHÔNG (PET EVOLUTION & LOOT COMPANION)
    // -------------------------------------------------------------------------

    function updateTimePet(dt) {
        const state = Game.state;
        const player = Game.player;
        if (!state || !state.hasPet || !player || player.hp <= 0) return;

        const timeline = state.timeline || 'PRESENT';
        const isEvolved = !!(state.petEvolved || (state.upgrades && state.upgrades.pet_evolution));
        const hasLootCompanion = !!(state.lootCompanion || (state.upgrades && state.upgrades.loot_companion) || isEvolved);

        // KỸ NĂNG TIẾN HÓA CẤP 2: KHIÊN LƯỢNG TỬ MỖI 10S
        if (isEvolved) {
            petState.quantumShieldTimer -= dt;
            if (petState.quantumShieldTimer <= 0) {
                petState.quantumShieldTimer = 10.0;
                player.shield = Math.min(player.maxShield, player.shield + 30);
                spawnCulledParticles(player.x, player.y, '#00f2fe', 16, 120);
                if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
                    Game.Combat.spawnFloatingText(player.x, player.y - 32, '🛡️ KHIÊN TINH LINH (+30 GIÁP)!', '#00f2fe');
                }
            }
        }

        // KỸ NĂNG BẬC 3: QUÉT VÀ NHẶT VẬT PHẨM TRONG BÁN KÍNH 650PX
        const lootDrops = (Game.Enemies && Array.isArray(Game.Enemies.lootDrops)) ? Game.Enemies.lootDrops : [];

        if (hasLootCompanion) {
            if (petState.mode === 'ORBIT') {
                let nearestLoot = null;
                let minLootDist = 650;

                for (let i = 0; i < lootDrops.length; i++) {
                    const drop = lootDrops[i];
                    if (!drop || drop.collected) continue;
                    const d = Math.hypot(drop.x - player.x, drop.y - player.y);
                    if (d <= minLootDist) {
                        minLootDist = d;
                        nearestLoot = drop;
                    }
                }

                if (nearestLoot) {
                    petState.mode = 'FETCHING';
                    petState.targetLoot = nearestLoot;
                }
            } else if (petState.mode === 'FETCHING') {
                const loot = petState.targetLoot;
                if (!loot || loot.collected) {
                    petState.mode = 'RETURN';
                    petState.targetLoot = null;
                } else {
                    const toLootAngle = Math.atan2(loot.y - petState.y, loot.x - petState.x);
                    petState.x += Math.cos(toLootAngle) * petState.fetchSpeed * dt;
                    petState.y += Math.sin(toLootAngle) * petState.fetchSpeed * dt;

                    if (Math.hypot(loot.x - petState.x, loot.y - petState.y) < 24) {
                        loot.collected = true;
                        petState.carriedLoot = loot;
                        petState.mode = 'RETURN';
                        petState.targetLoot = null;
                    }
                }
            } else if (petState.mode === 'RETURN') {
                const toPlayerAngle = Math.atan2(player.y - petState.y, player.x - petState.x);
                petState.x += Math.cos(toPlayerAngle) * petState.fetchSpeed * dt;
                petState.y += Math.sin(toPlayerAngle) * petState.fetchSpeed * dt;

                if (Math.hypot(player.x - petState.x, player.y - petState.y) < 32) {
                    if (petState.carriedLoot) {
                        const item = petState.carriedLoot;
                        if (item.type === 'GOLD') {
                            state.gold = (state.gold || 0) + (item.amount || 10);
                            if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
                                Game.Combat.spawnFloatingText(player.x, player.y - 25, `+${item.amount}G`, '#fbbf24');
                            }
                        } else if (item.type === 'SHARD' || item.type === 'TIME_SHARD') {
                            state.timeShards = (state.timeShards || 0) + (item.amount || 1);
                            if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
                                Game.Combat.spawnFloatingText(player.x, player.y - 25, `+${item.amount} 💎`, '#38bdf8');
                            }
                        }
                        petState.carriedLoot = null;
                    }
                    petState.mode = 'ORBIT';
                }
            }
        }

        // Chế độ bay lượn quanh người chơi
        if (petState.mode === 'ORBIT') {
            petState.phase += dt * 2.8;
            const targetX = player.x + Math.cos(petState.phase) * 58;
            const targetY = player.y - 36 + Math.sin(petState.phase * 2) * 20;

            petState.x += (targetX - petState.x) * Math.min(1, 14 * dt);
            petState.y += (targetY - petState.y) * Math.min(1, 14 * dt);
        }

        const maxTrailLength = isLowPerformanceMode ? 3 : 8;
        petState.trail.push({ x: petState.x, y: petState.y, life: 0.25 });
        if (petState.trail.length > maxTrailLength) petState.trail.shift();
        for (let i = petState.trail.length - 1; i >= 0; i--) {
            petState.trail[i].life -= dt;
            if (petState.trail[i].life <= 0) petState.trail.splice(i, 1);
        }

        // Hồi máu Kỷ Nguyên Quá Khứ (PAST)
        if (timeline === 'PAST') {
            petState.healTimer -= dt;
            if (petState.healTimer <= 0) {
                petState.healTimer = 6.0;
                if (player.hp < player.maxHp) {
                    player.hp = Math.min(player.maxHp, player.hp + 6);
                    if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
                        Game.Combat.spawnFloatingText(player.x, player.y - 30, '+6 HP', '#4ade80');
                    }
                    spawnCulledParticles(player.x, player.y, '#22c55e', 8, 80);
                }
            }
        } else {
            petState.healTimer = 6.0;
        }

        // Laser tự động của Tinh Linh
        petState.fireTimer -= dt;
        if (petState.fireTimer <= 0) {
            const enemies = (Game.Enemies && typeof Game.Enemies.getActiveList === 'function')
                ? Game.Enemies.getActiveList()
                : ((Game.Enemies && Game.Enemies.list) || []);
            let nearest = null;
            let minDist = 420;
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e || e.dead || e.hp <= 0) continue;
                const d = Math.hypot(e.x - petState.x, e.y - petState.y);
                if (d <= minDist) {
                    minDist = d;
                    nearest = e;
                }
            }

            if (nearest) {
                const baseCooldown = (timeline === 'FUTURE') ? (1.35 / 1.25) : 1.35;
                petState.fireTimer = baseCooldown;

                const wKey = state.currentWeapon || 'iron_sword';
                const wLvl = (state.weaponLevels && state.weaponLevels[wKey]) || 0;
                const petDmg = Math.round((38 + (state.level || 1) * 9) * (1 + wLvl * 0.06));

                const beamColor = (timeline === 'PRESENT') ? '#10b981' : (timeline === 'FUTURE') ? '#00f2fe' : '#f59e0b';
                if (Game.Combat && Array.isArray(Game.Combat.laserBeams)) {
                    Game.Combat.laserBeams.push({
                        x1: petState.x,
                        y1: petState.y,
                        x2: nearest.x,
                        y2: nearest.y,
                        color: beamColor,
                        coreColor: '#ffffff',
                        width: 7,
                        life: 0.22,
                        maxLife: 0.22
                    });
                }
                if (Game.Audio && typeof Game.Audio.playLaser === 'function') Game.Audio.playLaser();

                if (timeline === 'PRESENT') {
                    nearest.slowTimer = 2.5;
                    nearest.slowAmount = 0.35;
                    if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
                        Game.Combat.spawnFloatingText(nearest.x, nearest.y - 18, '❄️ CHẬM 35%', '#34d399');
                    }
                }

                if (Game.Enemies && typeof Game.Enemies.damageEnemy === 'function') {
                    Game.Enemies.damageEnemy(nearest, petDmg, false);
                } else {
                    nearest.hp -= petDmg;
                }
                combatRecapData.totalDamageDealt += petDmg;
                combatRecapData.currentSecondDamage += petDmg;
            } else {
                petState.fireTimer = 0.25;
            }
        }
    }
// -------------------------------------------------------------------------
    // 10. HỆ THỐNG VẼ VỆT LỬA PHẢN LỰC & HIỆU ỨNG TUA NGƯỢC THỜI GIAN
    // -------------------------------------------------------------------------

    function drawAeroBootsFireTrail(ctx, camera) {
        if (aeroBootsFireTrail.length === 0) return;
        const now = performance.now() * 0.001;

        ctx.save();
        for (let i = 0; i < aeroBootsFireTrail.length; i++) {
            const fire = aeroBootsFireTrail[i];
            const screenX = fire.x - camera.x;
            const screenY = fire.y - camera.y;

            // Frustum Culling: Bỏ qua các vệt lửa ngoài khung nhìn camera
            if (screenX < -60 || screenX > camera.width + 60 || screenY < -60 || screenY > camera.height + 60) {
                continue;
            }

            const lifeRatio = Math.max(0, fire.life / fire.maxLife);
            const flicker = 0.85 + Math.sin(now * 18 + i * 2) * 0.15;
            const currentRadius = fire.radius * (0.6 + 0.4 * lifeRatio) * flicker;

            // Vòng lửa ngoài (Cam / Đỏ thiêu đốt)
            ctx.fillStyle = `rgba(239, 68, 68, ${0.45 * lifeRatio})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
            ctx.fill();

            // Lõi lửa trong (Vàng rực / Trắng plasma)
            ctx.fillStyle = `rgba(251, 191, 36, ${0.75 * lifeRatio})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentRadius * 0.55, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * lifeRatio})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentRadius * 0.25, 0, Math.PI * 2);
            ctx.fill();

            // Tia lửa lách tách khi không ở chế độ siêu tiết kiệm
            if (!isLowPerformanceMode && Math.random() < 0.25) {
                ctx.fillStyle = '#fef08a';
                const sparkDist = currentRadius * (0.8 + Math.random() * 0.4);
                const sparkAngle = Math.random() * Math.PI * 2;
                ctx.fillRect(
                    screenX + Math.cos(sparkAngle) * sparkDist,
                    screenY + Math.sin(sparkAngle) * sparkDist,
                    2.5,
                    2.5
                );
            }
        }
        ctx.restore();
    }

    function drawQuantumReviveVfx(ctx, camera) {
        if (!quantumReviveState.isRewinding || quantumReviveState.rewindVfxTimer <= 0) return;
        const player = Game.player;
        const screenX = player.x - camera.x;
        const screenY = player.y - camera.y;
        const t = quantumReviveState.rewindVfxTimer;
        const now = performance.now() * 0.001;

        ctx.save();
        // Vòng sóng xung kích co cụm ngược về tâm nhân vật
        const shockRadius = Math.max(10, t * 180);
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 3.5;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, shockRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, shockRadius * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Vẽ các tia sét lượng tử nghịch đảo
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i + now * 12;
            const startDist = shockRadius;
            const endDist = 8;
            ctx.strokeStyle = i % 2 === 0 ? '#38bdf8' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenX + Math.cos(angle) * startDist, screenY + Math.sin(angle) * startDist);
            const midX = screenX + Math.cos(angle + 0.2) * (startDist * 0.5);
            const midY = screenY + Math.sin(angle + 0.2) * (startDist * 0.5);
            ctx.lineTo(midX, midY);
            ctx.lineTo(screenX + Math.cos(angle) * endDist, screenY + Math.sin(angle) * endDist);
            ctx.stroke();
        }
        ctx.restore();
    }

    // -------------------------------------------------------------------------
    // 11. DỰNG HÌNH VŨ KHÍ CHI TIẾT TRÊN TAY NHÂN VẬT (WEAPON RENDER ENGINE)
    // -------------------------------------------------------------------------

    function drawWeaponInHand(ctx, weaponKey, radius, wLevel, now) {
        const isAscended = wLevel >= 5;
        const glowColor = wLevel >= 15 ? '#ff0844' : wLevel >= 10 ? '#e879f9' : wLevel >= 5 ? '#fbbf24' : '#38bdf8';
        const weaponHeat = (Game.Combat && typeof Game.Combat.weaponHeat === 'number') ? Game.Combat.weaponHeat : 0;

        ctx.save();
        ctx.translate(weaponAnim.recoilX, 0);
        ctx.rotate(weaponAnim.recoilAngle);

        if (isAscended && !isLowPerformanceMode) {
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 10;
        }

        switch (weaponKey) {
            case 'cyber_sword':
            case 'iron_sword': {
                const slashSheet = Game.Combat && Game.Combat.spriteSheets && Game.Combat.spriteSheets.slash;
                ctx.save();
                ctx.translate(radius * 0.75, 4);
                ctx.rotate(Math.PI * 0.22);

                if (slashSheet && slashSheet.loaded && slashSheet.img) {
                    const img = slashSheet.img;
                    const fw = img.width / 4;
                    const fh = img.height / 3;
                    ctx.globalCompositeOperation = 'screen';
                    const renderSize = radius * 1.6;
                    ctx.drawImage(
                        img,
                        2, 2, fw - 4, fh - 4,
                        -renderSize * 0.3, -renderSize * 0.5, renderSize, renderSize
                    );
                } else {
                    ctx.fillStyle = weaponKey === 'cyber_sword' ? '#38bdf8' : '#e2e8f0';
                    ctx.strokeStyle = weaponKey === 'cyber_sword' ? '#0284c7' : '#475569';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(radius * 0.3, 6);
                    ctx.lineTo(radius + 20, 6);
                    ctx.lineTo(radius + 26, 9);
                    ctx.lineTo(radius + 20, 12);
                    ctx.lineTo(radius * 0.3, 12);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }

                if (weaponKey === 'cyber_sword' || wLevel >= 5) {
                    ctx.strokeStyle = '#00f2fe';
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    const bladeStart = radius * 0.4;
                    const bladeEnd = radius + 22;
                    ctx.moveTo(bladeStart, 9);
                    for (let step = bladeStart; step <= bladeEnd; step += 6) {
                        const jitter = Math.sin(now * 30 + step) * 3.5;
                        ctx.lineTo(step, 9 + jitter);
                    }
                    ctx.stroke();

                    ctx.fillStyle = '#ffffff';
                    const sparkX = bladeStart + ((now * 60) % (bladeEnd - bladeStart));
                    ctx.fillRect(sparkX, 8, 3, 3);
                }
                ctx.restore();
                break;
            }

            case 'laser_gun': {
                ctx.save();
                ctx.translate(radius * 0.85, 5);

                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 1.5;
                ctx.fillRect(0, -5, 24, 8);
                ctx.strokeRect(0, -5, 24, 8);

                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-6, -2, 7, 10);

                ctx.fillStyle = weaponHeat >= 70 ? '#ef4444' : '#00f2fe';
                if (!isLowPerformanceMode) {
                    ctx.shadowColor = ctx.fillStyle;
                    ctx.shadowBlur = 8;
                }
                ctx.fillRect(6, -3, 8, 4);
                ctx.shadowBlur = 0;

                const isOverheated = weaponHeat >= 70;
                ctx.fillStyle = isOverheated ? '#ff1744' : '#334155';
                ctx.fillRect(24, -4, 12, 6);

                if (isOverheated && !isLowPerformanceMode) {
                    ctx.fillStyle = 'rgba(255, 69, 0, 0.85)';
                    ctx.beginPath();
                    ctx.arc(36, -1, 3 + Math.sin(now * 25) * 1.5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
                    ctx.beginPath();
                    ctx.arc(38 + Math.cos(now * 8) * 3, -6 + Math.sin(now * 12) * 2, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
                ctx.save();
                ctx.translate(radius * 0.85 + 36, 4);
                const laserColor = isOverheated ? 'rgba(239, 68, 68, 0.85)' : 'rgba(6, 182, 212, 0.75)';
                ctx.strokeStyle = laserColor;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(200, 0);
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.fillStyle = isOverheated ? '#ef4444' : '#00f2fe';
                ctx.beginPath();
                ctx.arc(200, 0, 2.5 + Math.sin(now * 20) * 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
            }

            case 'void_scythe': {
                ctx.save();
                ctx.translate(radius * 0.6, 6);
                ctx.rotate(-Math.PI * 0.15);

                ctx.fillStyle = '#1e1b4b';
                ctx.strokeStyle = '#581c87';
                ctx.lineWidth = 1.8;
                ctx.fillRect(-10, -3, 38, 5);
                ctx.strokeRect(-10, -3, 38, 5);

                ctx.save();
                ctx.translate(28, 0);
                ctx.rotate(Math.PI * 0.35);

                ctx.fillStyle = '#2e1065';
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2.2;
                if (!isLowPerformanceMode) {
                    ctx.shadowColor = '#c084fc';
                    ctx.shadowBlur = 12;
                }

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(12, -26, 28, -28, 38, -14);
                ctx.bezierCurveTo(24, -20, 10, -12, 0, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 0;

                ctx.strokeStyle = 'rgba(232, 121, 249, 0.75)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();

                ctx.restore();
                break;
            }

            case 'chrono_cannon': {
                ctx.save();
                ctx.translate(radius * 0.7, 5);

                ctx.fillStyle = '#0f172a';
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.fillRect(-4, -8, 28, 16);
                ctx.strokeRect(-4, -8, 28, 16);

                ctx.fillStyle = '#0284c7';
                ctx.fillRect(4, -5, 12, 10);

                const muzzleX = 28;

                ctx.save();
                ctx.translate(muzzleX, 0);
                ctx.rotate(now * 4);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.2;
                ctx.setLineDash([7, 5]);
                ctx.beginPath();
                ctx.ellipse(0, 0, 5, 14, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                ctx.save();
                ctx.translate(muzzleX + 5, 0);
                ctx.rotate(-now * 4.5);
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.ellipse(0, 0, 4, 11, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(muzzleX + 2, 0, 3 + Math.sin(now * 15) * 1.2, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
                break;
            }
        }

        ctx.restore();
    }

    // -------------------------------------------------------------------------
    // 12. DỰNG HÌNH NHÂN VẬT, KHIÊN BẤT KHUẤT & TINH LINH CẤP CAO
    // -------------------------------------------------------------------------

    function drawPlayer(ctx, camera) {
        const player = Game.player;
        const state = Game.state;
        const screenX = player.x - camera.x;
        const screenY = player.y - camera.y;
        const now = performance.now() * 0.001;

        const charId = state.selectedCharacter || player.characterId || 'time_traveler';
        const charCfg = (Game.charactersConfig && Game.charactersConfig[charId]) || {};
        const isFortress = Game.Combat && Game.Combat.fortressTimer > 0;
        const isOverdrive = Game.Combat && Game.Combat.overdriveTimer > 0;
        const scaleMult = isFortress ? 1.25 : 1.0;

        const radius = (player.radius || charCfg.radius || 20) * scaleMult;
        const baseColor = charCfg.spriteColor || '#2563eb';
        const accentColor = charCfg.accentColor || '#38bdf8';
        const weaponKey = state.currentWeapon || 'iron_sword';
        const wLevel = (state.weaponLevels && state.weaponLevels[weaponKey]) || 0;

        ctx.save();
        ctx.translate(screenX, screenY);

        // Hào quang cường hóa Overdrive / Fortress / Cấp 10+
        if ((wLevel >= 10 || isFortress || isOverdrive) && !isLowPerformanceMode) {
            ctx.save();
            ctx.rotate(now * 2.5);
            ctx.strokeStyle = isFortress ? '#3b82f6' : isOverdrive ? '#f43f5e' : '#e879f9';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.arc(0, 0, radius + 11, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Bóng đổ chân nhân vật
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, radius * 0.85, radius * 0.9, radius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(player.angle || 0);

        drawWeaponInHand(ctx, weaponKey, radius, wLevel, now);

        // Chi tiết nhân vật đặc trưng
        if (charId === 'shadow_assassin') {
            ctx.fillStyle = isOverdrive ? 'rgba(244, 63, 94, 0.65)' : 'rgba(109, 40, 217, 0.45)';
            ctx.beginPath();
            ctx.moveTo(-radius * 0.4, -radius * 0.6);
            ctx.lineTo(-radius * 1.65, 0);
            ctx.lineTo(-radius * 0.4, radius * 0.6);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(radius * 0.5, -radius * 0.75);
            ctx.lineTo(radius * 1.35, -radius * 0.35);
            ctx.moveTo(radius * 0.5, radius * 0.75);
            ctx.lineTo(radius * 1.35, radius * 0.35);
            ctx.stroke();
        } else if (charId === 'iron_juggernaut') {
            ctx.fillStyle = '#451a03';
            ctx.fillRect(-radius * 0.5, -radius * 1.15, radius * 0.9, radius * 2.3);
            ctx.strokeStyle = isFortress ? '#38bdf8' : '#f59e0b';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, radius + 2, -Math.PI * 0.42, Math.PI * 0.42);
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, radius + 3.5, Math.PI * 0.65, Math.PI * 1.35);
            ctx.stroke();
        }

        // Khối thân chính của nhân vật
        ctx.fillStyle = baseColor;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(radius * 0.42, 0, radius * 0.34, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // HIỆU ỨNG: VÒNG CẦU ÁNH SÁNG VÀNG KIM BẤT KHUẤT (Last Stand Sphere)
        if (lastStandState.activeDuration > 0 && lastStandState.shieldAmount > 0) {
            ctx.save();
            const pulse = 1.0 + Math.sin(now * 12) * 0.08;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.arc(0, 0, (radius + 14) * pulse, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
            ctx.fill();

            // Vòng hoa văn quay quanh khiên
            ctx.rotate(now * 3);
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([8, 10]);
            ctx.beginPath();
            ctx.arc(0, 0, (radius + 18) * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Giáp năng lượng cơ bản
        if (player.shield > 0) {
            const shieldRatio = Math.max(0.2, Math.min(1, player.shield / (player.maxShield || 60)));
            ctx.save();
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 + shieldRatio * 0.5})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, radius + 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Tên nhân vật trên đầu
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.fillText(`[${charCfg.name || 'Du Hành'}]`, 0, -radius - 12);
        ctx.restore();

        ctx.restore();

        // DỰNG HÌNH TINH LINH THỜI KHÔNG (PET TIẾN HÓA CẤP 2 & LOOT COMPANION)
        if (state.hasPet) {
            const isEvolved = !!(state.petEvolved || (state.upgrades && state.upgrades.pet_evolution));

            for (let i = 0; i < petState.trail.length; i++) {
                const tr = petState.trail[i];
                ctx.fillStyle = isEvolved 
                    ? `rgba(168, 85, 247, ${Math.max(0, tr.life * 2.0)})` 
                    : `rgba(0, 242, 254, ${Math.max(0, tr.life * 1.6)})`;
                ctx.beginPath();
                ctx.arc(tr.x - camera.x, tr.y - camera.y, isEvolved ? 4.5 : 3.5, 0, Math.PI * 2);
                ctx.fill();
            }

            const px = petState.x - camera.x;
            const py = petState.y - camera.y;
            ctx.save();
            ctx.translate(px, py);

            // VÒNG HÀO QUANG CẤP 2 CHO TINH LINH TIẾN HÓA (Pet Evolution - V.1)
            if (isEvolved && !isLowPerformanceMode) {
                ctx.save();
                ctx.rotate(-now * 4);
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 1.8;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.arc(0, 0, 16, 0, Math.PI * 2);
                ctx.stroke();

                ctx.rotate(now * 6);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.2;
                ctx.strokeRect(-11, -11, 22, 22);
                ctx.restore();
            } else {
                ctx.save();
                ctx.rotate(now * 7);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.8;
                ctx.strokeRect(-8, -8, 16, 16);
                ctx.restore();
            }

            const petColor = isEvolved
                ? (state.timeline === 'PAST' ? '#f59e0b' : state.timeline === 'FUTURE' ? '#a855f7' : '#00f2fe')
                : (state.timeline === 'PAST' ? '#f59e0b' : state.timeline === 'FUTURE' ? '#00f2fe' : '#10b981');

            ctx.fillStyle = petColor;
            ctx.beginPath();
            ctx.arc(0, 0, isEvolved ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            // Hiển thị vật phẩm đang gắp mang về cho người chơi
            if (petState.carriedLoot) {
                ctx.fillStyle = petState.carriedLoot.type === 'GOLD' ? '#fbbf24' : '#38bdf8';
                ctx.beginPath();
                ctx.arc(0, 11, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // -------------------------------------------------------------------------
    // 13. DỰNG HÌNH OVERLAY BOSS RAID & THANH MÁU
    // -------------------------------------------------------------------------

    function drawBossRaidOverlayAndZoneHud(ctx, width, height) {
        const player = Game.player;
        const state = Game.state || {};
        if (!player) return;

        ctx.save();

        if (currentZoneLabel) {
            ctx.save();
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            const pillW = Math.max(190, ctx.measureText(currentZoneLabel).width + 28);
            const pillX = width * 0.5 - pillW * 0.5;
            const pillY = height - 118;

            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1.5;
            ctx.fillRect(pillX, pillY, pillW, 24);
            ctx.strokeRect(pillX, pillY, pillW, 24);

            ctx.fillStyle = '#67e8f9';
            ctx.fillText(`◈ ${currentZoneLabel}`, width * 0.5, pillY + 16);
            ctx.restore();
        }

        const enemies = (Game.Enemies && Array.isArray(Game.Enemies.list)) ? Game.Enemies.list : [];
        let targetBoss = null;
        let minDist = 900;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.dead || e.hp <= 0) continue;
            if (e.isBoss || e.isMiniBoss) {
                const dist = Math.hypot(e.x - player.x, e.y - player.y);
                if (dist <= minDist) {
                    minDist = dist;
                    targetBoss = e;
                }
            }
        }

        if (targetBoss) {
            const isMainBoss = !!targetBoss.isBoss;
            const barW = Math.min(420, width * 0.58);
            const barH = isMainBoss ? 16 : 13;
            const bx = width * 0.5 - barW * 0.5;
            const by = 54;
            const ratio = Math.max(0, Math.min(1, targetBoss.hp / Math.max(1, targetBoss.maxHp)));

            const shieldTl = targetBoss.shieldTimeline || targetBoss.timeline || 'PRESENT';
            const isMatched = state.timeline === shieldTl;
            const shieldColor = shieldTl === 'PAST' ? '#f59e0b' : shieldTl === 'PRESENT' ? '#10b981' : '#00f2fe';
            const tlName = shieldTl === 'PAST' ? 'QUÁ KHỨ' : shieldTl === 'PRESENT' ? 'HIỆN TẠI' : 'TƯƠNG LAI';

            ctx.fillStyle = '#090d18';
            ctx.fillRect(bx - 6, by - 24, barW + 12, barH + 34);
            ctx.strokeStyle = isMainBoss ? shieldColor : '#c084fc';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx - 6, by - 24, barW + 12, barH + 34);

            const fillColor = isMainBoss
                ? (targetBoss.phase === 3 ? '#dc2626' : targetBoss.phase === 2 ? '#f97316' : '#ec4899')
                : '#9333ea';
            ctx.fillStyle = fillColor;
            ctx.fillRect(bx, by, barW * ratio, barH);

            ctx.font = 'bold 11.5px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = isMainBoss ? '#fde047' : '#e879f9';
            const titlePrefix = isMainBoss ? `💀 [BOSS RAID] ${targetBoss.name}` : `⚔️ [BOSS PHỤ] ${targetBoss.name}`;
            ctx.fillText(titlePrefix, bx, by - 8);

            ctx.textAlign = 'right';
            if (isMainBoss) {
                ctx.fillStyle = isMatched ? '#4ade80' : '#ff0844';
                ctx.fillText(
                    isMatched ? `✓ CÙNG PHA (${tlName})` : `⚠️ LỆCH PHA! ĐỔI SANG: ${tlName}`,
                    bx + barW,
                    by - 8
                );
            } else {
                ctx.fillStyle = '#38bdf8';
                ctx.fillText(`KỶ NGUYÊN: ${tlName}`, bx + barW, by - 8);
            }

            ctx.textAlign = 'center';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${Math.ceil(targetBoss.hp)} / ${targetBoss.maxHp} HP`, width * 0.5, by + barH - 3);
        }

        ctx.restore();
    }

    // -------------------------------------------------------------------------
    // 14. BẢNG THỐNG KÊ SÁT THƯƠNG CUỐI TRẬN (COMBAT RECAP - V.9)
    // -------------------------------------------------------------------------

    function drawCombatRecapButtonAndModal(ctx, width, height) {
        ctx.save();

        // 1. NÚT MỞ BẢNG RECAP TẠI GÓC TRÊN TRÁI MÀN HÌNH
        const btnX = 14;
        const btnY = 56;
        const btnW = 92;
        const btnH = 26;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(btnX, btnY, btnW, btnH);

        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('📊 Recap', btnX + btnW / 2, btnY + 17);

        // 2. NỘI DUNG MODAL COMBAT RECAP KHI MỞ
        if (combatRecapData.isOpen) {
            // Màn mờ nền
            ctx.fillStyle = 'rgba(5, 8, 17, 0.88)';
            ctx.fillRect(0, 0, width, height);

            const modalW = Math.min(540, width * 0.90);
            const modalH = Math.min(380, height * 0.82);
            const mx = width * 0.5 - modalW * 0.5;
            const my = height * 0.5 - modalH * 0.5;

            // Khung modal
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(mx, my, modalW, modalH);
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 2;
            ctx.strokeRect(mx, my, modalW, modalH);

            // Tiêu đề
            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = '#fde047';
            ctx.textAlign = 'left';
            ctx.fillText('⚡ BẢNG THỐNG KÊ CHIẾN ĐẤU (COMBAT RECAP)', mx + 20, my + 30);

            // Nút đóng
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(mx + modalW - 36, my + 12, 24, 24);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('✕', mx + modalW - 24, my + 29);

            // Thống kê dạng số liệu
            ctx.font = '13px sans-serif';
            ctx.fillStyle = '#e2e8f0';
            ctx.textAlign = 'left';

            const lineY = my + 60;
            ctx.fillText(`• Tổng Sát Thương Gây Ra:`, mx + 24, lineY);
            ctx.fillStyle = '#ff0844';
            ctx.fillText(`${combatRecapData.totalDamageDealt.toLocaleString()} DMG`, mx + 230, lineY);

            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(`• Tổng Sát Thương Gánh Chịu:`, mx + 24, lineY + 26);
            ctx.fillStyle = '#f97316';
            ctx.fillText(`${combatRecapData.totalDamageTaken.toLocaleString()} DMG`, mx + 230, lineY + 26);

            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(`• Sát Thương Đỡ / Giảm Trừ:`, mx + 24, lineY + 52);
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(`${combatRecapData.damageMitigated.toLocaleString()} DMG`, mx + 230, lineY + 52);

            const reflectedCount = (Game.Combat && Game.Combat.projectilesReflected) || combatRecapData.projectilesReflected || 0;
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(`• Số Đạn Đã Phản Xạ:`, mx + 24, lineY + 78);
            ctx.fillStyle = '#4ade80';
            ctx.fillText(`${reflectedCount} Đạn`, mx + 230, lineY + 78);

            // BIỂU ĐỒ DPS (DPS GRAPH)
            const chartX = mx + 24;
            const chartY = my + 175;
            const chartW = modalW - 48;
            const chartH = modalH - 200;

            ctx.fillStyle = '#090d18';
            ctx.fillRect(chartX, chartY, chartW, chartH);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.strokeRect(chartX, chartY, chartW, chartH);

            ctx.font = '11px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Biểu đồ Biến thiên DPS theo thời gian (30 giây gần nhất):', chartX, chartY - 6);

            const buckets = combatRecapData.dpsBuckets;
            if (buckets.length > 1) {
                let maxDps = 100;
                for (let i = 0; i < buckets.length; i++) {
                    if (buckets[i] > maxDps) maxDps = buckets[i];
                }

                ctx.strokeStyle = '#00f2fe';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const stepX = chartW / Math.max(1, buckets.length - 1);

                for (let i = 0; i < buckets.length; i++) {
                    const plotX = chartX + i * stepX;
                    const plotY = chartY + chartH - (buckets[i] / maxDps) * (chartH - 12) - 4;
                    if (i === 0) {
                        ctx.moveTo(plotX, plotY);
                    } else {
                        ctx.lineTo(plotX, plotY);
                    }
                }
                ctx.stroke();

                // Điểm mút cuối
                const lastX = chartX + (buckets.length - 1) * stepX;
                const lastY = chartY + chartH - (buckets[buckets.length - 1] / maxDps) * (chartH - 12) - 4;
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'center';
                ctx.fillText('Chưa có đủ dữ liệu giao tranh để dựng biểu đồ.', chartX + chartW / 2, chartY + chartH / 2);
            }
        }

        ctx.restore();
    }

    function handleRecapClick(screenX, screenY) {
        const btnX = 14;
        const btnY = 56;
        const btnW = 92;
        const btnH = 26;

        // Bấm nút Mở Recap
        if (screenX >= btnX && screenX <= btnX + btnW && screenY >= btnY && screenY <= btnY + btnH) {
            combatRecapData.isOpen = !combatRecapData.isOpen;
            return true;
        }

        // Bấm nút Đóng trong Modal
        if (combatRecapData.isOpen) {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const modalW = Math.min(540, width * 0.90);
            const modalH = Math.min(380, height * 0.82);
            const mx = width * 0.5 - modalW * 0.5;
            const my = height * 0.5 - modalH * 0.5;

            const closeX = mx + modalW - 36;
            const closeY = my + 12;
            if (screenX >= closeX && screenX <= closeX + 24 && screenY >= closeY && screenY <= closeY + 24) {
                combatRecapData.isOpen = false;
                return true;
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // 15. HIỂN THỊ CHỈ SỐ FPS & TỐI ƯU HIỆU NĂNG 120Hz (V.8)
    // -------------------------------------------------------------------------

    function drawPerformanceFpsCounter(ctx, width) {
        ctx.save();
        const displayFps = Math.max(1, Math.round(currentFps));
        const fpsColor = displayFps >= 50 ? '#4ade80' : displayFps >= 35 ? '#fbbf24' : '#ef4444';
        const dprText = currentDpr.toFixed(1);
        const modeBadge = isLowPerformanceMode ? ' [ECO 60Hz]' : ' [120Hz ULTRA]';
        const text = `FPS: ${displayFps} | DPR: ${dprText}${modeBadge}`;

        ctx.font = 'bold 11px monospace';
        const textWidth = ctx.measureText(text).width;
        const boxW = textWidth + 16;
        const boxH = 22;
        const x = width - boxW - 12;
        const y = 10;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeStyle = fpsColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, boxW, boxH);

        ctx.fillStyle = fpsColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 8, y + boxH / 2);

        ctx.restore();
    }

    // -------------------------------------------------------------------------
    // 16. VÒNG LẶP CHÍNH (GAMELOOP) VÀ DỰNG HÌNH THEO KHUNG NHÌN CAMERA
    // -------------------------------------------------------------------------

    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;

        // Delta Time Clamping: Khóa tối đa 0.05s để chống bay xuyên vật thể khi giật lag
        const rawDt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

        ensureRuntimePlayerAndCameraSafety();
        updatePerformanceMonitor(rawDt);

        const player = Game.player;
        const state = Game.state;
        const isPaused = isGamePausedOrModalOpen();

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const isMobile = screenWidth <= 900 || screenHeight <= 550;
        const zoom = isMobile ? 0.68 : 1.0;

        Game.camera.zoom = zoom;
        Game.camera.width = screenWidth / zoom;
        Game.camera.height = screenHeight / zoom;

        if (!isPaused) {
            if (state.potionCooldown > 0) state.potionCooldown = Math.max(0, state.potionCooldown - rawDt);
            state.timeShiftCooldown = Math.max(0, (state.timeShiftCooldown || 0) - rawDt);

            autoSaveTimer += rawDt;
            if (autoSaveTimer >= 5.0) {
                autoSaveTimer = 0;
                if (Game.Systems && typeof Game.Systems.saveGame === 'function') Game.Systems.saveGame();
            }

            const dt = (player.hitStopTimer && player.hitStopTimer > 0) ? rawDt * 0.1 : rawDt;
            if (player.hitStopTimer > 0) player.hitStopTimer = Math.max(0, player.hitStopTimer - rawDt);

            // BƯỚC QUAN TRỌNG: GÁN THAM CHIẾU PLAYER TRƯỚC TOÀN BỘ CÁC MODULE CON
            Game.state.player = Game.player;

            // Thứ tự cập nhật logic game chuẩn xác:
            if (Game.Systems && typeof Game.Systems.update === 'function') {
                Game.Systems.update(dt);
            }
            if (Game.World && typeof Game.World.update === 'function') {
                Game.World.update(dt, player, Game.Enemies ? Game.Enemies.list : [], Game.Combat ? Game.Combat.bullets : []);
            }
            if (Game.AbyssAndBounties && typeof Game.AbyssAndBounties.update === 'function') {
                Game.AbyssAndBounties.update(dt);
            }
            if (Game.TalentsAndTitles && typeof Game.TalentsAndTitles.updatePetCompanion === 'function') {
                Game.TalentsAndTitles.updatePetCompanion(dt);
            }

            updateCharacterSkillsAndDefense(rawDt);
            updatePlayerMovement(dt);
            updateTimePet(dt);

            if (Game.Combat && typeof Game.Combat.update === 'function') {
                Game.Combat.update(dt);
            }
            if (Game.Enemies && typeof Game.Enemies.update === 'function') {
                Game.Enemies.update(dt);
            }
        }

        // Camera theo dõi người chơi mượt mà với quán tính cao
        const targetCamX = player.x - Game.camera.width / 2;
        const targetCamY = player.y - Game.camera.height / 2;
        if (!cameraInitialized || isNaN(Game.camera.x) || isNaN(Game.camera.y)) {
            Game.camera.x = targetCamX;
            Game.camera.y = targetCamY;
            cameraInitialized = true;
        } else {
            Game.camera.x += (targetCamX - Game.camera.x) * Math.min(1, 16 * rawDt);
            Game.camera.y += (targetCamY - Game.camera.y) * Math.min(1, 16 * rawDt);
        }

        // Rung lắc màn hình (Screen Shake)
        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        if (player.screenShake && player.screenShake > 0) {
            player.screenShake = Math.max(0, player.screenShake - rawDt);
            const intensity = player.screenShake * 18;
            shakeOffsetX = (Math.random() * 2 - 1) * intensity;
            shakeOffsetY = (Math.random() * 2 - 1) * intensity;
        }

        const renderCamera = {
            x: Game.camera.x + shakeOffsetX,
            y: Game.camera.y + shakeOffsetY,
            width: Game.camera.width,
            height: Game.camera.height,
            zoom: zoom
        };

        if (Game.Systems && typeof Game.Systems.updateUI === 'function') {
            Game.Systems.updateUI();
        }

        // Dọn sạch Canvas ({ alpha: false } tối ưu hóa GPU)
        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);

        // VẼ THẾ GIỚI GAME THEO ZOOM VÀ TỌA ĐỘ CAMERA
        ctx.save();
        ctx.scale(zoom, zoom);

        if (Game.World && typeof Game.World.draw === 'function') {
            Game.World.draw(ctx, renderCamera);
        }

        // Dựng hình Vệt Lửa Phản Lực của Aero Boots
        drawAeroBootsFireTrail(ctx, renderCamera);

        if (Game.Enemies && typeof Game.Enemies.draw === 'function') {
            Game.Enemies.draw(ctx, renderCamera);
        }

        drawPlayer(ctx, renderCamera);
        drawQuantumReviveVfx(ctx, renderCamera);

        if (Game.Combat && typeof Game.Combat.draw === 'function') {
            Game.Combat.draw(ctx, renderCamera);
        }

        ctx.restore();

        // VẼ HUD & UI LỚP TĨNH THEO TỈ LỆ PIXEL THỰC MÀN HÌNH (SỬA LỖI MINIMAP)
        if (Game.World && typeof Game.World.drawMinimap === 'function') {
            // Định nghĩa chuẩn trong world.js nhận (ctx, player, enemies, screenWidth, screenHeight)
            if (Game.World.drawMinimap.length >= 4) {
                Game.World.drawMinimap(
                    ctx,
                    player,
                    Game.Enemies ? (Game.Enemies.list || []) : [],
                    screenWidth,
                    screenHeight
                );
            } else {
                // Fallback nếu bản custom world.js chỉ nhận (ctx, screenWidth, screenHeight)
                Game.World.drawMinimap(ctx, screenWidth, screenHeight);
            }
        }

        drawBossRaidOverlayAndZoneHud(ctx, screenWidth, screenHeight);

        if (Game.Controls && typeof Game.Controls.drawUI === 'function') {
            Game.Controls.drawUI(ctx, screenWidth, screenHeight, renderCamera);
        }

        drawCombatRecapButtonAndModal(ctx, screenWidth, screenHeight);
        drawPerformanceFpsCounter(ctx, screenWidth);

        ctx.restore();

        animFrameId = requestAnimationFrame(gameLoop);
    }

    // -------------------------------------------------------------------------
    // 17. QUẢN LÝ VÒNG ĐỜI ỨNG DỤNG (LIFECYCLE & VISIBILITYCHANGE)
    // -------------------------------------------------------------------------

    function pauseGameLoop() {
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        lastTime = 0;
        if (Game.Systems && typeof Game.Systems.saveGame === 'function') {
            Game.Systems.saveGame();
        }
    }

    function resumeGameLoop() {
        if (!animFrameId) {
            lastTime = performance.now();
            animFrameId = requestAnimationFrame(gameLoop);
        }
    }

    window.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            pauseGameLoop();
        } else {
            resumeGameLoop();
        }
    });

    window.addEventListener('blur', function () {
        if (Game.Systems && typeof Game.Systems.saveGame === 'function') {
            Game.Systems.saveGame();
        }
    });

    // -------------------------------------------------------------------------
    // 18. KHỞI CHẠY ENGINE KHI TẢI TRANG (INITIALIZATION)
    // -------------------------------------------------------------------------

    window.onload = function () {
        canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        // Khởi tạo Canvas tối ưu hóa phần cứng, tắt kênh Alpha giúp GPU vẽ trực tiếp
        ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Lắng nghe click / chạm mở Combat Recap & Tương tác
        canvas.addEventListener('pointerdown', function (e) {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            handleRecapClick(clickX, clickY);
        });

        // Khởi tạo tuần tự các module hệ thống
        if (Game.World && typeof Game.World.init === 'function') Game.World.init();
        if (Game.Controls && typeof Game.Controls.init === 'function') Game.Controls.init(canvas);
        if (Game.Combat && typeof Game.Combat.init === 'function') Game.Combat.init();
        if (Game.Enemies && typeof Game.Enemies.init === 'function') Game.Enemies.init();
        if (Game.Systems && typeof Game.Systems.init === 'function') Game.Systems.init();
        if (Game.UI && typeof Game.UI.init === 'function') Game.UI.init();

        ensureRuntimePlayerAndCameraSafety();
        lastRecordedHp = Game.player.hp;
        lastRecordedShield = Game.player.shield;
        lastTime = performance.now();
        animFrameId = requestAnimationFrame(gameLoop);
    };

    // Đưa các API tiện ích ra namespace Game toàn cục
    Game.Main = {
        resizeCanvas: resizeCanvas,
        toggleCombatRecap: function () {
            combatRecapData.isOpen = !combatRecapData.isOpen;
        },
        getRecapData: function () {
            return combatRecapData;
        },
        triggerQuantumRevive: triggerQuantumRevive
    };

})();