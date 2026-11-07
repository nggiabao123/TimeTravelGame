/**
 * FILE: main.js (BẢN ĐẠI TU SIÊU CẤP - ULTIMATE GRAPHICS & COMBAT ENGINE)
 * KẺ DU HÀNH THỜI KHÔNG
 * 
 * TÍNH NĂNG NÂNG CẤP:
 * 1. ĐẠI TU RENDER 5 LOẠI VŨ KHÍ TRÊN TAY CỰC NGẦU (drawWeaponInHand):
 *    - 'iron_sword' & 'cyber_sword': Tận dụng Sprite chem_2.jpg kết hợp tia sét Plasma chạy dọc thân kiếm khi Cường hóa hoặc thức tỉnh Cyber.
 *    - 'laser_gun': Súng trường năng lượng Cyber với lõi Plasma, Tia Laser Dẫn Hướng (Red/Cyan Laser Sight) dài 200px, nòng đỏ rực bốc khói khi Quá Nhiệt (weaponHeat >= 70).
 *    - 'void_scythe': Lưỡi Hái Hư Không hắc ám cán dài, phát quang tử khí tím đen.
 *    - 'chrono_cannon': Đại Pháo Trọng Lực Thời Không với 2 vòng tụ từ trường xoay ngược chiều liên tục ở đầu nòng.
 *    - Hoạt ảnh Độ Giật (Recoil) & Nhịp Chém (Swing) mượt mà theo từng cú vung đòn và phát bắn.
 * 2. TIẾN HÓA TINH LINH THỜI KHÔNG (updateTimePet):
 *    - PAST: Hào quang thời gian hồi phục +6 HP mỗi 6 giây.
 *    - PRESENT: Đạn Lượng Tử làm chậm 35% mục tiêu trúng đòn.
 *    - FUTURE: Gia tốc xạ kích tăng 25% tốc độ bắn.
 * 3. BOSS RAID OVERLAY CHO CẢ CHÚA TỂ THỜI KHÔNG & 3 BOSS PHỤ KỶ NGUYÊN (drawBossRaidOverlayAndZoneHud):
 *    - Hiển thị thanh máu Raid hoành tráng phía trên màn hình trong phạm vi 900px.
 */

window.Game = window.Game || {};

(function () {
    let canvas = null;
    let ctx = null;
    let lastTime = 0;
    let cameraInitialized = false;
    let lastSyncedCharId = null;

    let lastRecordedHp = (Game.player && Game.player.hp) || 100;
    let lastRecordedShield = (Game.player && Game.player.shield) || 50;
    let shieldBreakNovaCd = 0;
    let stationaryOutCombatTimer = 0;
    let regenParticleTimer = 0;
    let autoSaveTimer = 0;

    let combatTimer = 0;
    let isPlayerInCombat = false;
    let currentZoneLabel = null;

    let frameCount = 0;
    let fpsTimer = 0;
    let currentFps = 60;
    let isLowPerformanceMode = false;

    // Quản lý Trạng thái Tinh Linh Thời Không
    const petState = {
        x: 1920,
        y: 1920,
        phase: 0,
        fireTimer: 0,
        healTimer: 6.0,
        trail: []
    };

    // Quản lý Hoạt ảnh Giật / Vung Vũ khí (Recoil & Swing Animation)
    const weaponAnim = {
        recoilX: 0,
        recoilAngle: 0,
        lastAttackState: false
    };

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
    }

    function isGamePausedOrModalOpen() {
        if (Game.state && Game.state.isPaused === true) return true;
        const shopModal = document.getElementById('shop-modal');
        if (shopModal && !shopModal.classList.contains('hidden')) return true;
        const giftModal = document.getElementById('giftcode-modal');
        if (giftModal && !giftModal.classList.contains('hidden')) return true;
        const charModal = document.getElementById('character-select-modal');
        if (charModal && !charModal.classList.contains('hidden')) return true;
        return false;
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const isMobile = window.innerWidth <= 900 || window.innerHeight <= 550;
        Game.camera.zoom = isMobile ? 0.68 : 1.0;
        Game.camera.width = canvas.width / Game.camera.zoom;
        Game.camera.height = canvas.height / Game.camera.zoom;

        if (Game.Controls && typeof Game.Controls.onResize === 'function') {
            Game.Controls.onResize(canvas.width, canvas.height);
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
            : [];
        let enemyNear = false;
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (!e || e.dead || e.hp <= 0) continue;
            if (Math.hypot(e.x - Game.player.x, e.y - Game.player.y) < 340) {
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
    }

    function updatePerformanceMonitor(rawDt) {
        frameCount++;
        fpsTimer += rawDt;

        if (fpsTimer >= 1.0) {
            currentFps = frameCount / fpsTimer;
            frameCount = 0;
            fpsTimer = 0;
            Game.currentFps = Math.round(currentFps);

            if (currentFps < 50 && !isLowPerformanceMode) {
                isLowPerformanceMode = true;
                Game.isLowPerformanceMode = true;
                if (Game.Combat && Array.isArray(Game.Combat.particles) && Game.Combat.particles.length > 60) {
                    Game.Combat.particles.length = 60;
                }
            } else if (currentFps >= 55 && isLowPerformanceMode) {
                isLowPerformanceMode = false;
                Game.isLowPerformanceMode = false;
            }
        }
    }

    function spawnCulledParticles(x, y, color, count, speed) {
        if (!Game.Combat || typeof Game.Combat._spawnParticles !== 'function') return;
        const cullFactor = isLowPerformanceMode ? 0.35 : 1.0;
        const adjustedCount = Math.max(1, Math.floor(count * cullFactor));
        Game.Combat._spawnParticles(x, y, color, adjustedCount, speed);
    }

    function updateCharacterSkillsAndDefense(dt) {
        const player = Game.player;

        if (shieldBreakNovaCd > 0) shieldBreakNovaCd = Math.max(0, shieldBreakNovaCd - dt);

        let hpLost = Math.max(0, lastRecordedHp - player.hp);
        const shieldLost = Math.max(0, lastRecordedShield - player.shield);

        // Giảm 60% sát thương vào máu khi bật Pháo Đài Bất Diệt
        if (hpLost > 0 && Game.Combat && Game.Combat.fortressTimer > 0) {
            const mitigated = Math.round(hpLost * 0.60);
            player.hp = Math.min(player.maxHp, player.hp + mitigated);
            hpLost = Math.max(0, lastRecordedHp - player.hp);
        }

        updateCombatState(dt, hpLost, shieldLost);

        if (hpLost > 0 || shieldLost > 0) {
            player.shieldCooldown = 8.0;
            stationaryOutCombatTimer = 0;

            if (lastRecordedShield > 0 && player.shield <= 0) {
                if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
                    Game.Combat.spawnFloatingText(player.x, player.y - 34, '💥 VỠ GIÁP!', '#00f2fe');
                }
                if (shieldBreakNovaCd <= 0) {
                    shieldBreakNovaCd = 10.0;
                    player.screenShake = Math.max(player.screenShake || 0, 0.35);
                    spawnCulledParticles(player.x, player.y, '#00f2fe', 16, 200);
                }
            }
        }

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

            if (isMeditating && !isLowPerformanceMode) {
                regenParticleTimer -= dt;
                if (regenParticleTimer <= 0) {
                    regenParticleTimer = 0.25;
                    const angle = Math.random() * Math.PI * 2;
                    spawnCulledParticles(player.x + Math.cos(angle) * 22, player.y + Math.sin(angle) * 22, '#38bdf8', 2, 45);
                }
            }
        }

        if (player.hp < player.maxHp && (player.hpRegen || 0) > 0 && !isPlayerInCombat) {
            player.hp = Math.min(player.maxHp, player.hp + player.hpRegen * dt);
        }

        lastRecordedHp = player.hp;
        lastRecordedShield = player.shield;
    }

    function updatePlayerMovement(dt) {
        const player = Game.player;
        const state = Game.state;

        if (player.godMode || state.godMode) {
            player.hp = player.maxHp;
            player.shield = player.maxShield;
        }

        if (player.hp <= 0) {
            const lostGold = Math.floor((state.gold || 0) * 0.20);
            state.gold = Math.max(0, (state.gold || 0) - lostGold);
            player.hp = player.maxHp;
            player.shield = player.maxShield;
            player.x = 1920;
            player.y = 1920;
            player.vx = 0;
            player.vy = 0;

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

        // Cập nhật hoạt ảnh Giật / Vung Vũ Khí (Recoil & Swing Animation)
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

    /**
     * TIẾN HÓA TINH LINH THỜI KHÔNG (updateTimePet):
     * - Kỷ nguyên PAST: Mỗi 6 giây tạo xung hồi +6 HP cho nhân vật.
     * - Kỷ nguyên PRESENT: Đạn làm chậm 35% tốc độ di chuyển quái trong 2.5s.
     * - Kỷ nguyên FUTURE: Gia tốc +25% tốc độ bắn (cooldown x0.8).
     */
    function updateTimePet(dt) {
        const state = Game.state;
        const player = Game.player;
        if (!state || !state.hasPet || !player || player.hp <= 0) return;

        const timeline = state.timeline || 'PRESENT';

        // 1. Quỹ đạo bay bám theo người chơi
        petState.phase += dt * 2.8;
        const targetX = player.x + Math.cos(petState.phase) * 58;
        const targetY = player.y - 36 + Math.sin(petState.phase * 2) * 20;

        petState.x += (targetX - petState.x) * Math.min(1, 14 * dt);
        petState.y += (targetY - petState.y) * Math.min(1, 14 * dt);

        // Vết đuôi năng lượng
        petState.trail.push({ x: petState.x, y: petState.y, life: 0.25 });
        if (petState.trail.length > 8) petState.trail.shift();
        for (let i = petState.trail.length - 1; i >= 0; i--) {
            petState.trail[i].life -= dt;
            if (petState.trail[i].life <= 0) petState.trail.splice(i, 1);
        }

        // 2. Hiệu ứng Kỷ Nguyên PAST: Hồi nhẹ +6 HP mỗi 6 giây
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

        // 3. Xạ kích Laser và Tác động Kỷ Nguyên
        petState.fireTimer -= dt;
        if (petState.fireTimer <= 0) {
            const enemies = (Game.Enemies && typeof Game.Enemies.getActiveList === 'function')
                ? Game.Enemies.getActiveList()
                : [];
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
                // FUTURE: Tăng 25% tốc độ bắn (Cooldown giảm còn 1.08s thay vì 1.35s)
                const baseCooldown = (timeline === 'FUTURE') ? (1.35 / 1.25) : 1.35;
                petState.fireTimer = baseCooldown;

                const wKey = state.currentWeapon || 'iron_sword';
                const wLvl = (state.weaponLevels && state.weaponLevels[wKey]) || 0;
                const petDmg = Math.round((38 + (state.level || 1) * 9) * (1 + wLvl * 0.06));

                // PRESENT: Đạn laser mang hiệu ứng làm chậm
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

                // Gây sát thương và hiệu ứng khống chế
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
            } else {
                petState.fireTimer = 0.25;
            }
        }
    }

    /**
     * ĐẠI TU HÀM drawWeaponInHand VẼ RIÊNG 5 VŨ KHÍ TRÊN TAY:
     * 1. 'iron_sword': Frame 0 của chem_2.jpg hoặc thanh kiếm thép sáng loáng.
     * 2. 'cyber_sword': Thân kiếm tích hợp lõi tia điện hồ quang (Lightning Arcs) chạy dọc.
     * 3. 'laser_gun': Súng trường Quang Tuyến Cyber, báng súng kim loại, Tia Laser Dẫn Hướng (Red/Cyan Laser Sight) dài 200px. Nếu weaponHeat >= 70 nòng bốc khói đỏ rực!
     * 4. 'void_scythe': Lưỡi Hái Hư Không cán dài, lưỡi cong bán nguyệt tử khí tím đen huyền bí.
     * 5. 'chrono_cannon': Đại Pháo Trọng Lực Thời Không cỡ lớn với 2 vòng năng lượng xoay nghịch chiều ở nòng.
     */
    function drawWeaponInHand(ctx, weaponKey, radius, wLevel, now) {
        const isAscended = wLevel >= 5;
        const glowColor = wLevel >= 15 ? '#ff0844' : wLevel >= 10 ? '#e879f9' : wLevel >= 5 ? '#fbbf24' : '#38bdf8';
        const weaponHeat = (Game.Combat && typeof Game.Combat.weaponHeat === 'number') ? Game.Combat.weaponHeat : 0;

        ctx.save();

        // Áp dụng Hoạt ảnh Giật & Vung vũ khí
        ctx.translate(weaponAnim.recoilX, 0);
        ctx.rotate(weaponAnim.recoilAngle);

        if (isAscended) {
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
                    // Fallback kiếm vector chi tiết
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

                // Lõi tia điện Plasma hồ quang chạy dọc thân kiếm nếu là Cyber Sword hoặc Lv >= 5
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

                    // Hạt điện hồ quang
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

                // 1. Thân súng trường Cyber
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 1.5;
                ctx.fillRect(0, -5, 24, 8); // Thân súng
                ctx.strokeRect(0, -5, 24, 8);

                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-6, -2, 7, 10); // Báng súng & tay cầm

                // Lõi năng lượng Plasma phát sáng ở buồng đạn
                ctx.fillStyle = weaponHeat >= 70 ? '#ef4444' : '#00f2fe';
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 8;
                ctx.fillRect(6, -3, 8, 4);

                // Nòng súng trường
                const isOverheated = weaponHeat >= 70;
                ctx.fillStyle = isOverheated ? '#ff1744' : '#334155';
                ctx.fillRect(24, -4, 12, 6);

                // Khói và tàn lửa nếu súng bị quá nhiệt (weaponHeat >= 70)
                if (isOverheated) {
                    ctx.fillStyle = 'rgba(255, 69, 0, 0.85)';
                    ctx.beginPath();
                    ctx.arc(36, -1, 3 + Math.sin(now * 25) * 1.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Vệt khói bốc lên từ nòng
                    ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
                    ctx.beginPath();
                    ctx.arc(38 + Math.cos(now * 8) * 3, -6 + Math.sin(now * 12) * 2, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 2. TIA LASER DẪN HƯỚNG (Red/Cyan Laser Sight) dài 200px
                ctx.restore();
                ctx.save();
                ctx.translate(radius * 0.85 + 36, 4); // Điểm đầu nòng súng
                const laserColor = isOverheated ? 'rgba(239, 68, 68, 0.85)' : 'rgba(6, 182, 212, 0.75)';
                ctx.strokeStyle = laserColor;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(200, 0);
                ctx.stroke();

                // Điểm ngắm chấm đỏ/xanh ở cuối tia
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

                // 1. Cán dài Hư Không bằng hợp kim đen
                ctx.fillStyle = '#1e1b4b';
                ctx.strokeStyle = '#581c87';
                ctx.lineWidth = 1.8;
                ctx.fillRect(-10, -3, 38, 5);
                ctx.strokeRect(-10, -3, 38, 5);

                // 2. Lưỡi cong bán nguyệt tử khí tím đen
                ctx.save();
                ctx.translate(28, 0);
                ctx.rotate(Math.PI * 0.35);

                ctx.fillStyle = '#2e1065';
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2.2;
                ctx.shadowColor = '#c084fc';
                ctx.shadowBlur = 12;

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(12, -26, 28, -28, 38, -14);
                ctx.bezierCurveTo(24, -20, 10, -12, 0, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Hào quang tử khí linh hồn
                const soulPulse = Math.sin(now * 6) * 3;
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

                // 1. Thân pháo cơ học hạng nặng
                ctx.fillStyle = '#0f172a';
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.fillRect(-4, -8, 28, 16);
                ctx.strokeRect(-4, -8, 28, 16);

                // Lõi trọng lực bên trong pháo
                ctx.fillStyle = '#0284c7';
                ctx.fillRect(4, -5, 12, 10);

                // 2. HAI VÒNG TỤ NĂNG LƯỢNG XOAY NGƯỢC CHIỀU Ở ĐẦU NÒNG
                const muzzleX = 28;

                // Vòng 1: Xoay xuôi chiều
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

                // Vòng 2: Xoay ngược chiều
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

                // Điểm tụ năng lượng trung tâm
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

        // Hào quang Thức Tỉnh Vũ Khí (+10 trở lên) hoặc Trạng thái Kỹ năng Tối thượng
        if (wLevel >= 10 || isFortress || isOverdrive) {
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

        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, radius * 0.85, radius * 0.9, radius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(player.angle || 0);

        // Render vũ khí độc bản trên tay với hoạt ảnh giật
        drawWeaponInHand(ctx, weaponKey, radius, wLevel, now);

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

        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.fillText(`[${charCfg.name || 'Du Hành'}]`, 0, -radius - 12);
        ctx.restore();

        ctx.restore();

        // Render Tinh Linh Thời Không với cánh xoay Drone công nghệ cao
        if (state.hasPet) {
            for (let i = 0; i < petState.trail.length; i++) {
                const tr = petState.trail[i];
                ctx.fillStyle = `rgba(0, 242, 254, ${Math.max(0, tr.life * 1.6)})`;
                ctx.beginPath();
                ctx.arc(tr.x - camera.x, tr.y - camera.y, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }

            const px = petState.x - camera.x;
            const py = petState.y - camera.y;
            ctx.save();
            ctx.translate(px, py);

            // Cánh xoay Drone
            ctx.save();
            ctx.rotate(now * 7);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.8;
            ctx.strokeRect(-8, -8, 16, 16);
            ctx.restore();

            // Thân tinh linh phát sáng
            const petColor = state.timeline === 'PAST' ? '#f59e0b' : state.timeline === 'FUTURE' ? '#00f2fe' : '#10b981';
            ctx.fillStyle = petColor;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.restore();
        }
    }

    /**
     * BOSS RAID OVERLAY CHO CẢ CHÚA TỂ THỜI KHÔNG (isBoss) LẪN 3 BOSS PHỤ (isMiniBoss)
     */
    function drawBossRaidOverlayAndZoneHud(ctx, width, height) {
        const player = Game.player;
        const state = Game.state || {};
        if (!player) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // 1. Hiển thị thông báo Dị Điểm / Đài Năng Lượng đang đứng
        if (currentZoneLabel) {
            ctx.save();
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            const pillW = Math.max(190, ctx.measureText(currentZoneLabel).width + 28);
            const pillX = width * 0.5 - pillW * 0.5;
            const pillY = height - 118;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1.5;
            ctx.fillRect(pillX, pillY, pillW, 24);
            ctx.strokeRect(pillX, pillY, pillW, 24);

            ctx.fillStyle = '#67e8f9';
            ctx.fillText(`◈ ${currentZoneLabel}`, width * 0.5, pillY + 16);
            ctx.restore();
        }

        // 2. Tìm Boss hoặc Mini-Boss gần nhất trong phạm vi 900px
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

        // 3. Hiển thị Thanh máu Raid phía trên đỉnh màn hình
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

            ctx.fillStyle = 'rgba(9, 13, 24, 0.92)';
            ctx.fillRect(bx - 6, by - 24, barW + 12, barH + 34);
            ctx.strokeStyle = isMainBoss ? shieldColor : '#c084fc';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx - 6, by - 24, barW + 12, barH + 34);

            // Nền máu còn lại
            const fillColor = isMainBoss
                ? (targetBoss.phase === 3 ? '#dc2626' : targetBoss.phase === 2 ? '#f97316' : '#ec4899')
                : '#9333ea';
            ctx.fillStyle = fillColor;
            ctx.fillRect(bx, by, barW * ratio, barH);

            // Tiêu đề Boss
            ctx.font = 'bold 11.5px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = isMainBoss ? '#fde047' : '#e879f9';
            const titlePrefix = isMainBoss ? `💀 [BOSS RAID] ${targetBoss.name}` : `⚔️ [BOSS PHỤ] ${targetBoss.name}`;
            ctx.fillText(titlePrefix, bx, by - 8);

            // Trạng thái Kỷ nguyên tương thích
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

            // Số máu dạng văn bản
            ctx.textAlign = 'center';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${Math.ceil(targetBoss.hp)} / ${targetBoss.maxHp} HP`, width * 0.5, by + barH - 3);
        }

        ctx.restore();
    }

    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const rawDt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

        ensureRuntimePlayerAndCameraSafety();
        updatePerformanceMonitor(rawDt);

        const player = Game.player;
        const state = Game.state;
        const isPaused = isGamePausedOrModalOpen();

        const isMobile = window.innerWidth <= 900 || window.innerHeight <= 550;
        const zoom = isMobile ? 0.68 : 1.0;
        Game.camera.zoom = zoom;
        Game.camera.width = (canvas.width || window.innerWidth) / zoom;
        Game.camera.height = (canvas.height || window.innerHeight) / zoom;

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

            updateCharacterSkillsAndDefense(rawDt);
            updatePlayerMovement(dt);
            updateTimePet(dt);

            if (Game.Combat && typeof Game.Combat.update === 'function') Game.Combat.update(dt);
            if (Game.Enemies && typeof Game.Enemies.update === 'function') Game.Enemies.update(dt);
        }

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

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(zoom, zoom);

        if (Game.World && typeof Game.World.draw === 'function') Game.World.draw(ctx, renderCamera);
        if (Game.Enemies && typeof Game.Enemies.draw === 'function') Game.Enemies.draw(ctx, renderCamera);

        drawPlayer(ctx, renderCamera);

        if (Game.Combat && typeof Game.Combat.draw === 'function') Game.Combat.draw(ctx, renderCamera);

        ctx.restore();

        if (Game.World && typeof Game.World.drawMinimap === 'function') {
            Game.World.drawMinimap(ctx, canvas.width, canvas.height);
        }
        drawBossRaidOverlayAndZoneHud(ctx, canvas.width, canvas.height);
        if (Game.Controls && typeof Game.Controls.drawUI === 'function') {
            Game.Controls.drawUI(ctx, canvas.width, canvas.height, renderCamera);
        }

        requestAnimationFrame(gameLoop);
    }

    window.onload = function () {
        canvas = document.getElementById('gameCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

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
        requestAnimationFrame(gameLoop);
    };
})();