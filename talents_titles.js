/**
 * ============================================================================
 * TRÒ CHƠI: KẺ DU HÀNH THỜI KHÔNG (TIME TRAVELER ACTION RPG)
 * FILE: talents_titles.js (window.Game.TalentsAndTitles)
 * PHIÊN BẢN: 2026 Engine Overhaul - 120Hz Ultra Performance Edition
 * ============================================================================
 * CÁC HẠNG MỤC HỆ THỐNG ĐÃ HOÀN THIỆN:
 * 1. BẢNG THIÊN PHÚ BỔ TRỢ NGOẠI VI (PASSIVE TALENT TREE - V.3):
 *    - 24 nút thiên phú chia đều 3 nhánh: Cuồng Chiến (8), Pháo Đài (8), Thần Tốc (8).
 *    - Công thức scale chi phí Vàng và Mảnh Thời Không (Time Shards 💎) luỹ tiến.
 *    - Reset All Talents: Hoàn trả chính xác 100% Vàng & Shards đã tiêu, reset stats tức thì.
 *    - Hàm applyAllTalentsToPlayer() đồng bộ vĩnh viễn Crit, Crit DMG, Max HP, Shield, Armor,
 *      Move Speed, Magnet Radius lên tối đa 450px, Greed x2 Drop Chance... vào Game.player & Game.state.
 * 
 * 2. 15 DANH HIỆU THỰC CHIẾN & HÀO QUANG CANVAS VFX (V.7):
 *    - Tự động kiểm tra mở khóa dựa trên Game.state.achievementStats (parry, diệt quái lưỡi hái, né hoàn hảo...).
 *    - renderPlayerTitleAura() vẽ trực tiếp quanh nhân vật trên Canvas với 15 kiểu VFX độc quyền,
 *      sử dụng tọa độ số nguyên (Bitwise OR `| 0`) tối ưu hóa cho màn hình 120 FPS.
 * 
 * 3. KỸ NĂNG NHÂN VẬT & TIẾN HÓA TINH LINH (III.1 -> III.10 & V.1, V.2):
 *    - Quản lý mở khóa 10 kỹ năng chuyên sâu theo từng nhân vật (Phân Thân Thời Gian, Bão Từ Hút Máu, ...).
 *    - Hệ thống Tiến Hóa Tinh Linh 3 Bậc: Bậc 1 (Hồi máu/làm chậm), Bậc 2 (Phóng khiên lượng tử 120 điểm mỗi 15s),
 *      Bậc 3 (Apex - Loot Companion tự bay nhặt đồ xa trong bán kính 650px).
 * ============================================================================
 */

(function () {
    'use strict';

    window.Game = window.Game || {};

    const TalentsAndTitles = {
        initialized: false,
        activeTab: 'berserk', // 'berserk' | 'bulwark' | 'utility'

        // ====================================================================
        // I. CẤU HÌNH BẢNG THIÊN PHÚ (PASSIVE TALENT TREE CONFIG - 24 TALENTS)
        // ====================================================================
        TALENT_BRANCHES: {
            BERSERK: 'berserk',
            BULWARK: 'bulwark',
            UTILITY: 'utility'
        },

        TALENTS_CONFIG: {
            // ----------------------------------------------------------------
            // NHÁNH 1: CUỒNG CHIẾN (BERSERK) - 8 NÚT THIÊN PHÚ
            // ----------------------------------------------------------------
            berserk_strike: {
                id: 'berserk_strike',
                branch: 'berserk',
                name: 'Cuồng Lực Khởi Nguyên',
                icon: '⚔️',
                tier: 1,
                maxLevel: 5,
                costGoldPerLevel: 350,
                costShardsPerLevel: 0,
                costMultiplier: 1.55,
                requires: null,
                statsPerLevel: { meleeDamagePercent: 3, rangedDamagePercent: 2 },
                description: 'Tăng sát thương cận chiến +3% và bắn xa +2% mỗi cấp.'
            },
            berserk_keen_edge: {
                id: 'berserk_keen_edge',
                branch: 'berserk',
                name: 'Lưỡi Kiếm Sắc Bén',
                icon: '🗡️',
                tier: 2,
                maxLevel: 5,
                costGoldPerLevel: 600,
                costShardsPerLevel: 1,
                costMultiplier: 1.6,
                requires: 'berserk_strike',
                reqLevel: 3,
                statsPerLevel: { critRate: 0.02 }, // +2% Crit Rate
                description: 'Gia tăng tỉ lệ đòn đánh chí mạng +2% mỗi cấp.'
            },
            berserk_lethal_precision: {
                id: 'berserk_lethal_precision',
                branch: 'berserk',
                name: 'Khai Sơn Trảm Thần',
                icon: '💥',
                tier: 2,
                maxLevel: 5,
                costGoldPerLevel: 750,
                costShardsPerLevel: 1,
                costMultiplier: 1.65,
                requires: 'berserk_strike',
                reqLevel: 3,
                statsPerLevel: { critDamage: 0.08 }, // +8% Crit Damage
                description: 'Gia tăng sát thương bạo kích chí mạng +8% mỗi cấp.'
            },
            berserk_blood_frenzy: {
                id: 'berserk_blood_frenzy',
                branch: 'berserk',
                name: 'Cuồng Nộ Huyết Sắc',
                icon: '🩸',
                tier: 3,
                maxLevel: 5,
                costGoldPerLevel: 1100,
                costShardsPerLevel: 2,
                costMultiplier: 1.7,
                requires: 'berserk_keen_edge',
                reqLevel: 3,
                statsPerLevel: { lifeStealPercent: 0.8 }, // +0.8% hút máu
                description: 'Hồi phục máu bằng 0.8% sát thương cận chiến gây ra mỗi cấp.'
            },
            berserk_armor_crush: {
                id: 'berserk_armor_crush',
                branch: 'berserk',
                name: 'Kình Lực Phá Giáp',
                icon: '🛡️💥',
                tier: 3,
                maxLevel: 5,
                costGoldPerLevel: 1300,
                costShardsPerLevel: 2,
                costMultiplier: 1.75,
                requires: 'berserk_lethal_precision',
                reqLevel: 3,
                statsPerLevel: { armorPenetrationPercent: 6 }, // Bỏ qua 6% giáp
                description: 'Tấn công bỏ qua 6% giáp và lá chắn phản kháng của quái vật mỗi cấp.'
            },
            berserk_overcharge_slash: {
                id: 'berserk_overcharge_slash',
                branch: 'berserk',
                name: 'Trảm Kích Quá Tải',
                icon: '⚡',
                tier: 4,
                maxLevel: 5,
                costGoldPerLevel: 1900,
                costShardsPerLevel: 3,
                costMultiplier: 1.8,
                requires: 'berserk_blood_frenzy',
                reqLevel: 4,
                statsPerLevel: { swordWaveSpeedPercent: 5, swordWaveDamagePercent: 6 },
                description: 'Tăng tốc độ bay của kiếm khí +5% và sát thương kiếm khí +6% mỗi cấp.'
            },
            berserk_furious_counter: {
                id: 'berserk_furious_counter',
                branch: 'berserk',
                name: 'Phản Đòn Cuồng Bạo',
                icon: '🥋',
                tier: 4,
                maxLevel: 5,
                costGoldPerLevel: 2200,
                costShardsPerLevel: 3,
                costMultiplier: 1.8,
                requires: 'berserk_armor_crush',
                reqLevel: 4,
                statsPerLevel: { parryReflectBonusPercent: 12, parryRageGain: 2 },
                description: 'Phản đạn cận chiến gây thêm +12% sát thương và tăng +2 Nộ khi Parry thành công.'
            },
            berserk_god_of_slaughter: {
                id: 'berserk_god_of_slaughter',
                branch: 'berserk',
                name: 'Đồ Thần Thức Tỉnh (Apex)',
                icon: '👑⚔️',
                tier: 5,
                maxLevel: 1,
                costGoldPerLevel: 8000,
                costShardsPerLevel: 15,
                costMultiplier: 1.0,
                requires: 'berserk_overcharge_slash',
                reqLevel: 5,
                statsPerLevel: { executeThreshold: 0.15, slaughterBonusAttack: 25 },
                description: 'Kết liễu quái vật lập tức nếu máu dưới 15%; nhận vĩnh viễn +25 Công lực cơ bản.'
            },

            // ----------------------------------------------------------------
            // NHÁNH 2: PHÁO ĐÀI THỜI KHÔNG (BULWARK) - 8 NÚT THIÊN PHÚ
            // ----------------------------------------------------------------
            bulwark_reinforcement: {
                id: 'bulwark_reinforcement',
                branch: 'bulwark',
                name: 'Cường Hóa Sinh Thể',
                icon: '❤️',
                tier: 1,
                maxLevel: 5,
                costGoldPerLevel: 350,
                costShardsPerLevel: 0,
                costMultiplier: 1.55,
                requires: null,
                statsPerLevel: { maxHpBonus: 40 },
                description: 'Tăng lượng Máu Tối Đa vĩnh viễn +40 điểm mỗi cấp.'
            },
            bulwark_quantum_plating: {
                id: 'bulwark_quantum_plating',
                branch: 'bulwark',
                name: 'Giáp Lượng Tử Bất Hoại',
                icon: '🛡️',
                tier: 2,
                maxLevel: 5,
                costGoldPerLevel: 600,
                costShardsPerLevel: 1,
                costMultiplier: 1.6,
                requires: 'bulwark_reinforcement',
                reqLevel: 3,
                statsPerLevel: { maxShieldBonus: 30, baseArmor: 3 },
                description: 'Gia tăng Khiên Năng Lượng Tối Đa +30 và Giáp Cơ Bản +3 mỗi cấp.'
            },
            bulwark_chrono_pulse: {
                id: 'bulwark_chrono_pulse',
                branch: 'bulwark',
                name: 'Xung Nhịp Hồi Phục',
                icon: '💖',
                tier: 2,
                maxLevel: 5,
                costGoldPerLevel: 750,
                costShardsPerLevel: 1,
                costMultiplier: 1.65,
                requires: 'bulwark_reinforcement',
                reqLevel: 3,
                statsPerLevel: { hpRegenPerSecond: 1.2 },
                description: 'Hồi phục Máu tự nhiên +1.2 HP mỗi giây.'
            },
            bulwark_shockwave_barrier: {
                id: 'bulwark_shockwave_barrier',
                branch: 'bulwark',
                name: 'Màng Phản Xạ Sấm Sét',
                icon: '🌐⚡',
                tier: 3,
                maxLevel: 5,
                costGoldPerLevel: 1100,
                costShardsPerLevel: 2,
                costMultiplier: 1.7,
                requires: 'bulwark_quantum_plating',
                reqLevel: 3,
                statsPerLevel: { thornReflectDamagePercent: 8 },
                description: 'Phản đòn lại 8% sát thương nhận vào dạng sốc điện diện rộng mỗi cấp.'
            },
            bulwark_iron_will: {
                id: 'bulwark_iron_will',
                branch: 'bulwark',
                name: 'Ý Chí Thiết Giáp',
                icon: '🗿',
                tier: 3,
                maxLevel: 5,
                costGoldPerLevel: 1300,
                costShardsPerLevel: 2,
                costMultiplier: 1.75,
                requires: 'bulwark_chrono_pulse',
                reqLevel: 3,
                statsPerLevel: { damageReductionPercent: 3.5 },
                description: 'Giảm 3.5% mọi sát thương nhận vào từ kẻ thù mỗi cấp.'
            },
            bulwark_shield_burst: {
                id: 'bulwark_shield_burst',
                branch: 'bulwark',
                name: 'Xung Kích Vỡ Khiên',
                icon: '💥🛡️',
                tier: 4,
                maxLevel: 5,
                costGoldPerLevel: 1900,
                costShardsPerLevel: 3,
                costMultiplier: 1.8,
                requires: 'bulwark_shockwave_barrier',
                reqLevel: 4,
                statsPerLevel: { shieldBreakStunSeconds: 0.4, shieldBreakAoeDamage: 80 },
                description: 'Khi vỡ Khiên, phát nổ gây 80 sát thương và làm choáng kẻ địch xung quanh 0.4s.'
            },
            bulwark_last_bastion: {
                id: 'bulwark_last_bastion',
                branch: 'bulwark',
                name: 'Chiến Lũy Bất Diệt',
                icon: '🏰',
                tier: 4,
                maxLevel: 5,
                costGoldPerLevel: 2200,
                costShardsPerLevel: 3,
                costMultiplier: 1.8,
                requires: 'bulwark_iron_will',
                reqLevel: 4,
                statsPerLevel: { lowHpArmorBoostPercent: 10, lowHpDamageBoostPercent: 6 },
                description: 'Khi HP dưới 35%, tăng thêm 10% Giáp và 6% Sát thương mỗi cấp.'
            },
            bulwark_immortal_vessel: {
                id: 'bulwark_immortal_vessel',
                branch: 'bulwark',
                name: 'Bất Tử Thần Khu (Apex)',
                icon: '👑🛡️',
                tier: 5,
                maxLevel: 1,
                costGoldPerLevel: 8000,
                costShardsPerLevel: 15,
                costMultiplier: 1.0,
                requires: 'bulwark_last_bastion',
                reqLevel: 5,
                statsPerLevel: { cheatDeathCooldownSec: 150, cheatDeathInvulnerableSec: 3.0 },
                description: 'Ngăn chặn đòn đánh chí tử mỗi 150s, hồi ngay 40% Máu và bất tử trong 3.0 giây.'
            },

            // ----------------------------------------------------------------
            // NHÁNH 3: THẦN TỐC THU HOẠCH (UTILITY / GREED) - 8 NÚT THIÊN PHÚ
            // ----------------------------------------------------------------
            utility_swift_step: {
                id: 'utility_swift_step',
                branch: 'utility',
                name: 'Hành Bộ Phong Lôi',
                icon: '👟',
                tier: 1,
                maxLevel: 5,
                costGoldPerLevel: 350,
                costShardsPerLevel: 0,
                costMultiplier: 1.55,
                requires: null,
                statsPerLevel: { moveSpeedBonus: 8 },
                description: 'Gia tăng tốc độ chạy di chuyển +8 đơn vị mỗi cấp.'
            },
            utility_magnetic_field: {
                id: 'utility_magnetic_field',
                branch: 'utility',
                name: 'Từ Trường Thu Hoạch',
                icon: '🧲',
                tier: 2,
                maxLevel: 5,
                costGoldPerLevel: 600,
                costShardsPerLevel: 1,
                costMultiplier: 1.6,
                requires: 'utility_swift_step',
                reqLevel: 3,
                statsPerLevel: { magnetRadiusBonus: 66 }, // 120px + (5 * 66) = 450px Max Pickup Radius
                description: 'Mở rộng bán kính nam châm tự hút Vàng/EXP +66px (tối đa đạt 450px).'
            },
            utility_golden_fortune: {
                id: 'utility_golden_fortune',
                branch: 'utility',
                name: 'Kho Báu Vô Tận (Greed)',
                icon: '💰',
                tier: 2,
                maxLevel: 5,
                costGoldPerLevel: 750,
                costShardsPerLevel: 1,
                costMultiplier: 1.65,
                requires: 'utility_swift_step',
                reqLevel: 3,
                statsPerLevel: { doubleGoldExpChance: 0.06 }, // +6% tỉ lệ x2
                description: 'Tăng 6% tỉ lệ nhận gấp đôi (x2) Vàng và Điểm Kinh Nghiệm khi tiêu diệt quái.'
            },
            utility_chrono_acceleration: {
                id: 'utility_chrono_acceleration',
                branch: 'utility',
                name: 'Gia Tốc Thời Luân',
                icon: '⏳',
                tier: 3,
                maxLevel: 5,
                costGoldPerLevel: 1100,
                costShardsPerLevel: 2,
                costMultiplier: 1.7,
                requires: 'utility_magnetic_field',
                reqLevel: 3,
                statsPerLevel: { cooldownReductionPercent: 4 }, // -4% CD
                description: 'Giảm thời gian hồi chiêu tất cả kỹ năng chủ động thêm 4% mỗi cấp.'
            },
            utility_overdrive_engine: {
                id: 'utility_overdrive_engine',
                branch: 'utility',
                name: 'Động Cơ Quá Tải',
                icon: '🔥🏎️',
                tier: 3,
                maxLevel: 5,
                costGoldPerLevel: 1300,
                costShardsPerLevel: 2,
                costMultiplier: 1.75,
                requires: 'utility_golden_fortune',
                reqLevel: 3,
                statsPerLevel: { heatCooldownRateBonus: 10, dashCostRageDiscount: 2 },
                description: 'Tăng tốc độ làm nguội súng nhiệt +10/giây và giảm tiêu hao Nộ khi Lướt.'
            },
            utility_dimensional_stash: {
                id: 'utility_dimensional_stash',
                branch: 'utility',
                name: 'Túi Không Gian 4D',
                icon: '🎒💎',
                tier: 4,
                maxLevel: 5,
                costGoldPerLevel: 1900,
                costShardsPerLevel: 3,
                costMultiplier: 1.8,
                requires: 'utility_chrono_acceleration',
                reqLevel: 4,
                statsPerLevel: { bonusShardDropChance: 0.05, orbSpawnMultiplier: 1.1 },
                description: 'Tăng 5% tỉ lệ quái thường rơi Mảnh Thời Không 💎 và +10% tần suất xuất hiện Ngọc Hộ Mệnh.'
            },
            utility_time_dilator: {
                id: 'utility_time_dilator',
                branch: 'utility',
                name: 'Khuếch Đại Giãn Cách',
                icon: '🌀⌛',
                tier: 4,
                maxLevel: 5,
                costGoldPerLevel: 2200,
                costShardsPerLevel: 3,
                costMultiplier: 1.8,
                requires: 'utility_overdrive_engine',
                reqLevel: 4,
                statsPerLevel: { freezeDurationBonusSec: 0.35, slowEffectBoostPercent: 8 },
                description: 'Kéo dài thời gian đóng băng quái +0.35s và tăng hiệu ứng làm chậm thêm 8%.'
            },
            utility_singularity_reaper: {
                id: 'utility_singularity_reaper',
                branch: 'utility',
                name: 'Thu Hoạch Lỗ Đen (Apex)',
                icon: '👑🕳️',
                tier: 5,
                maxLevel: 1,
                costGoldPerLevel: 8000,
                costShardsPerLevel: 15,
                costMultiplier: 1.0,
                requires: 'utility_dimensional_stash',
                reqLevel: 5,
                statsPerLevel: { globalVacuumEvery20s: true, allItemBuffDurationSec: 4 },
                description: 'Mỗi 20 giây phát một sóng hấp dẫn hút toàn bộ vật phẩm trên toàn bản đồ về người chơi.'
            }
        },

        // ====================================================================
        // II. CẤU HÌNH DANH HIỆU THỰC CHIẾN (EQUIPPABLE TITLES - 15 TITLES)
        // ====================================================================
        TITLES_CONFIG: {
            title_swordmaster: {
                id: 'title_swordmaster',
                name: 'Bậc Thầy Kiếm Khí',
                icon: '🗡️✨',
                color: '#00e5ff',
                rarity: 'RARE',
                auraType: 'cyan_blades',
                reqDescription: 'Chém trúng 800 đòn cận chiến bằng Cyber Sword hoặc Lưỡi Hái Hư Không.',
                stats: { meleeDamagePercent: 5, swordWaveSpeedPercent: 10 },
                checkUnlock: function (stats) {
                    return (stats.totalMeleeHits || 0) >= 800;
                }
            },
            title_parry_god: {
                id: 'title_parry_god',
                name: 'Kẻ Phản Đòn Siêu Việt',
                icon: '⚔️🛡️',
                color: '#ffea00',
                rarity: 'EPIC',
                auraType: 'golden_sparks',
                reqDescription: 'Thực hiện thành công 100 lần Phản Đòn (Parry) đạn đạo của quái vật.',
                stats: { parryDamageBonusPercent: 50, parryRageGain: 4 },
                checkUnlock: function (stats) {
                    return (stats.totalParries || 0) >= 100;
                }
            },
            title_blood_reaper: {
                id: 'title_blood_reaper',
                name: 'Huyết Nguyệt Tử Thần',
                icon: '🩸🌙',
                color: '#ff1744',
                rarity: 'EPIC',
                auraType: 'crimson_mist',
                reqDescription: 'Tiêu diệt 1.500 quái vật bằng vũ khí Lưỡi Hái Hư Không.',
                stats: { lifeStealPercent: 4, scytheRadiusPercent: 20 },
                checkUnlock: function (stats) {
                    return (stats.killsWithScythe || 0) >= 1500;
                }
            },
            title_speed_phantom: {
                id: 'title_speed_phantom',
                name: 'Bóng Ma Tốc Độ',
                icon: '⚡👻',
                color: '#76ff03',
                rarity: 'RARE',
                auraType: 'wind_afterimages',
                reqDescription: 'Thực hiện 200 cú lướt né đòn hoàn hảo ngay trước khi trúng đạn.',
                stats: { moveSpeedPercent: 10, perfectDodgeRageGain: 15 },
                checkUnlock: function (stats) {
                    return (stats.perfectDodges || 0) >= 200;
                }
            },
            title_iron_fortress: {
                id: 'title_iron_fortress',
                name: 'Pháo Đài Bất Hoại',
                icon: '🏰⚡',
                color: '#2979ff',
                rarity: 'EPIC',
                auraType: 'electric_shield',
                reqDescription: 'Chịu đựng hơn 50.000 tổng sát thương mà không gục ngã.',
                stats: { maxShieldPercent: 20, reflectLightningDamage: 45 },
                checkUnlock: function (stats) {
                    return (stats.totalDamageTaken || 0) >= 50000;
                }
            },
            title_chrono_lord: {
                id: 'title_chrono_lord',
                name: 'Chúa Tể Thời Không',
                icon: '👑⌛',
                color: '#d500f9',
                rarity: 'LEGENDARY',
                auraType: 'quantum_halo',
                reqDescription: 'Đánh bại Chúa Tể Thời Gian Chrono Lord ở cả 3 kỷ nguyên Thời Gian.',
                stats: { allStatsPercent: 12, timeFreezeDurationSec: 1.0 },
                checkUnlock: function (stats) {
                    return (stats.bossChronoKills || 0) >= 3;
                }
            },
            title_sniper_elite: {
                id: 'title_sniper_elite',
                name: 'Xạ Thủ Lượng Tử',
                icon: '🎯🔫',
                color: '#00e676',
                rarity: 'RARE',
                auraType: 'laser_crosshair',
                reqDescription: 'Bắn trúng 1.200 viên đạn Laser tầm xa trên cự ly 300px.',
                stats: { rangedDamagePercent: 8, laserPierceChance: 0.25 },
                checkUnlock: function (stats) {
                    return (stats.longRangeLaserHits || 0) >= 1200;
                }
            },
            title_demolition_expert: {
                id: 'title_demolition_expert',
                name: 'Chuyên Gia Oanh Tạc',
                icon: '💣🔥',
                color: '#ff9100',
                rarity: 'RARE',
                auraType: 'ember_flames',
                reqDescription: 'Tiêu diệt đồng thời 10 quái vật trong một phát bắn Chrono Cannon 30 lần.',
                stats: { cannonAoeRadiusPercent: 18, cannonBurnDamagePercent: 15 },
                checkUnlock: function (stats) {
                    return (stats.multiKillsCannon || 0) >= 30;
                }
            },
            title_greed_incarnate: {
                id: 'title_greed_incarnate',
                name: 'Đại Phú Hào Thời Gian',
                icon: '💰💎',
                color: '#ffd700',
                rarity: 'EPIC',
                auraType: 'gold_glitter',
                reqDescription: 'Tích lũy tổng cộng 200.000 Vàng và 500 Mảnh Thời Không trong suốt hành trình.',
                stats: { goldDropMultiplier: 1.35, expDropMultiplier: 1.25 },
                checkUnlock: function (stats) {
                    return (stats.lifetimeGold || 0) >= 200000 && (stats.lifetimeShards || 0) >= 500;
                }
            },
            title_abyss_slayer: {
                id: 'title_abyss_slayer',
                name: 'Kẻ Chinh Phục Vực Thẳm',
                icon: '🔱🌌',
                color: '#e040fb',
                rarity: 'LEGENDARY',
                auraType: 'void_portal_swirl',
                reqDescription: 'Vượt qua Tầng 50 trong Chế Độ Vực Thẳm (Abyss Mode).',
                stats: { damageToBossesPercent: 15, abyssResistancePercent: 20 },
                checkUnlock: function (stats) {
                    return (stats.maxAbyssFloor || 0) >= 50;
                }
            },
            title_mini_boss_nemesis: {
                id: 'title_mini_boss_nemesis',
                name: 'Khắc Tinh Thủ Lĩnh',
                icon: '💀🏆',
                color: '#ff5252',
                rarity: 'RARE',
                auraType: 'skull_sigil',
                reqDescription: 'Hạ gục tổng cộng 60 Mini-Boss (Cự Thạch, Mẫu Hoàng, Chiến Giáp).',
                stats: { damageToMiniBossPercent: 22, miniBossLootChance: 0.3 },
                checkUnlock: function (stats) {
                    return (stats.totalMiniBossKills || 0) >= 60;
                }
            },
            title_untouchable: {
                id: 'title_untouchable',
                name: 'Tuyệt Đối Vô Thương',
                icon: '🕊️💫',
                color: '#ffffff',
                rarity: 'LEGENDARY',
                auraType: 'prismatic_feather',
                reqDescription: 'Hoàn thành một đợt sóng quái vật kéo dài 3 phút mà không dính đòn nào.',
                stats: { evasionChance: 0.12, moveSpeedPercent: 8 },
                checkUnlock: function (stats) {
                    return (stats.flawlessSurvivals || 0) >= 1;
                }
            },
            title_berserker_king: {
                id: 'title_berserker_king',
                name: 'Cuồng Đế Diệt Thế',
                icon: '👹🔥',
                color: '#ff3d00',
                rarity: 'LEGENDARY',
                auraType: 'berserk_flame_pillar',
                reqDescription: 'Duy trì thanh Nộ đầy (100 Rage) liên tục trong hơn 45 giây chiến đấu.',
                stats: { attackSpeedPercent: 15, critRate: 0.08, critDamage: 0.25 },
                checkUnlock: function (stats) {
                    return (stats.rageMaxTimeRecord || 0) >= 45;
                }
            },
            title_pet_whisperer: {
                id: 'title_pet_whisperer',
                name: 'Bậc Thầy Tinh Linh',
                icon: '🧚‍♂️✨',
                color: '#18ffff',
                rarity: 'RARE',
                auraType: 'fairy_dust',
                reqDescription: 'Tiến hóa Tinh Linh Thời Không đạt cấp Bậc 3 Tối Thượng.',
                stats: { petAttackCooldownDiscountPercent: 25, petShieldBoostPercent: 30 },
                checkUnlock: function (stats) {
                    return (window.Game.state && window.Game.state.petEvolutionStage >= 3);
                }
            },
            title_time_paradox: {
                id: 'title_time_paradox',
                name: 'Nghịch Lý Bất Hoại',
                icon: '⌛⚛️',
                color: '#651fff',
                rarity: 'MYTHIC',
                auraType: 'quantum_singularity',
                reqDescription: 'Kích hoạt Quantum Rewind (Tua Lại Thời Gian) cứu sống bản thân 50 lần.',
                stats: { quantumRewindHealBonusPercent: 25, cooldownReductionPercent: 10 },
                checkUnlock: function (stats) {
                    return (stats.quantumRewindSaves || 0) >= 50;
                }
            }
        },

        // ====================================================================
        // III. CẤU HÌNH NHÁNH KỸ NĂNG NHÂN VẬT (CHARACTER SKILLS III.1 -> III.10)
        // ====================================================================
        SKILLS_CONFIG: {
            skill_time_clone: {
                id: 'skill_time_clone',
                slotIndex: 1,
                name: 'Phân Thân Thời Gian',
                characterReq: 'time_traveler',
                icon: '👥⏳',
                goldCost: 2000,
                shardsCost: 5,
                description: 'Khi lướt tạo ra 1 bóng ảnh quá khứ tồn tại 1.8s, gây 85% sát thương kiếm khí diện rộng.',
                effectKey: 'hasTimeClone'
            },
            skill_vampiric_vortex: {
                id: 'skill_vampiric_vortex',
                slotIndex: 2,
                name: 'Bão Từ Hút Máu',
                characterReq: 'time_traveler',
                icon: '🌀🩸',
                goldCost: 2800,
                shardsCost: 8,
                description: 'Cơn bão thời gian hút quái vào tâm trong bán kính 250px và hồi 3% lượng máu theo sát thương.',
                effectKey: 'vampiricStorm'
            },
            skill_eternal_stasis: {
                id: 'skill_eternal_stasis',
                slotIndex: 3,
                name: 'Vùng Ngưng Đọng Vĩnh Cửu',
                characterReq: 'time_traveler',
                icon: '🛑❄️',
                goldCost: 3500,
                shardsCost: 12,
                description: 'Vùng đóng băng thời gian làm nứt toác không gian, gây thêm 25% sát thương chuẩn khi tan biến.',
                effectKey: 'eternalStasisCrack'
            },
            skill_multi_blink: {
                id: 'skill_multi_blink',
                slotIndex: 4,
                name: 'Tốc Biến Đa Tầng',
                characterReq: 'shadow_assassin',
                icon: '⚡🗡️',
                goldCost: 2200,
                shardsCost: 6,
                description: 'Có thể lướt liên tiếp 2 lần không tốn thể lực; phi tiêu Shuriken quay về gây thêm 65% sát thương.',
                effectKey: 'multiBlinkShuriken'
            },
            skill_speed_execution: {
                id: 'skill_speed_execution',
                slotIndex: 5,
                name: 'Án Tử Tốc Độ',
                characterReq: 'shadow_assassin',
                icon: '💀💨',
                goldCost: 3200,
                shardsCost: 10,
                description: 'Đột kích từ sau lưng quái vật sẽ chắc chắn chí mạng 100% và tăng tốc chạy +30% trong 2s.',
                effectKey: 'speedExecutionBackstab'
            },
            skill_shockwave_fortress: {
                id: 'skill_shockwave_fortress',
                slotIndex: 6,
                name: 'Pháo Đài Xung Kích',
                characterReq: 'iron_juggernaut',
                icon: '🛡️💥',
                goldCost: 2500,
                shardsCost: 7,
                description: 'Kích hoạt Pháo Đài đẩy lùi mọi đạn đạo xung quanh và hồi phục ngay lập tức +8 Khiên năng lượng.',
                effectKey: 'fortressPulseShield'
            },
            skill_rapid_rage_surge: {
                id: 'skill_rapid_rage_surge',
                slotIndex: 7,
                name: 'Hồi Nộ Thần Tốc',
                characterReq: 'iron_juggernaut',
                icon: '🔥⚡',
                goldCost: 3000,
                shardsCost: 9,
                description: 'Nhận sát thương hồi thêm +4 điểm Nộ; khi đầy Nộ đòn chém gây nổ lan diện rộng 140px.',
                effectKey: 'rapidRageExplosion'
            },
            skill_thunder_shield_ring: {
                id: 'skill_thunder_shield_ring',
                slotIndex: 8,
                name: 'Vòng Bảo Hộ Sấm Sét',
                characterReq: 'all',
                icon: '⚡🌐',
                goldCost: 4000,
                shardsCost: 14,
                description: 'Tạo 3 viên ngọc lôi điện bay quanh người chơi chặn 3 đòn bắn xa mỗi 20s.',
                effectKey: 'thunderOrbDefense'
            },
            skill_deep_ground_slam: {
                id: 'skill_deep_ground_slam',
                slotIndex: 9,
                name: 'Chấn Động Đất Sâu',
                characterReq: 'all',
                icon: '🌋🔨',
                goldCost: 4500,
                shardsCost: 16,
                description: 'Đòn đánh thứ 3 của vũ khí cận chiến nện nứt mặt đất làm choáng mọi quái vật trong 1.5s.',
                effectKey: 'groundSlamStun'
            },
            skill_quantum_resurrection: {
                id: 'skill_quantum_resurrection',
                slotIndex: 10,
                name: 'Hồi Sinh Lượng Tử',
                characterReq: 'all',
                icon: '⚛️✨',
                goldCost: 7000,
                shardsCost: 25,
                description: 'Cho phép nhân vật hồi sinh tại chỗ 1 lần trong mỗi lượt chơi với 100% Máu và 100% Khiên.',
                effectKey: 'quantumResurrectReady'
            }
        },

        // ====================================================================
        // IV. TIẾN HÓA TINH LINH (PET EVOLUTION & LOOT COMPANION - V.1, V.2)
        // ====================================================================
        PET_EVOLUTION_STAGES: [
            {
                stage: 1,
                name: 'Tinh Linh Thời Gian - Ấu Thể',
                icon: '🧚',
                goldCost: 0,
                shardsCost: 0,
                description: 'Theo sát chủ nhân, hỗ trợ hồi máu nhỏ (+6 HP/6s) và bắn tia sáng làm chậm kẻ địch gần.',
                features: {
                    baseHeal: 6,
                    healIntervalSec: 6,
                    slowAura: true,
                    hasShieldProjection: false,
                    lootCompanion: false,
                    lootDistance: 160
                }
            },
            {
                stage: 2,
                name: 'Tinh Linh Thời Không - Vệ Binh Lượng Tử',
                icon: '🧚‍♂️🛡️',
                goldCost: 5000,
                shardsCost: 20,
                description: 'Học kỹ năng [Phóng Khiên Lượng Tử]: Tạo lá chắn hấp thụ 120 sát thương cho người chơi mỗi 15s.',
                features: {
                    baseHeal: 12,
                    healIntervalSec: 5,
                    slowAura: true,
                    hasShieldProjection: true,
                    shieldAmount: 120,
                    shieldCooldownSec: 15,
                    lootCompanion: false,
                    lootDistance: 240
                }
            },
            {
                stage: 3,
                name: 'Tinh Linh Thời Vũ - Thần Thú Đồng Hành (Apex)',
                icon: '👑🧚✨',
                goldCost: 12000,
                shardsCost: 50,
                description: 'Mở khóa [Loot Companion]: Tự động bay tách rời chủ nhân, nhặt đồ và ngọc ở xa mép màn hình.',
                features: {
                    baseHeal: 25,
                    healIntervalSec: 4,
                    slowAura: true,
                    hasShieldProjection: true,
                    shieldAmount: 250,
                    shieldCooldownSec: 12,
                    lootCompanion: true,
                    lootDistance: 650,
                    petFlySpeed: 420
                }
            }
        ],

        // ====================================================================
        // KHỞI TẠO & ĐỒNG BỘ DỮ LIỆU BAN ĐẦU
        // ====================================================================
        init: function () {
            if (this.initialized) return;

            if (!window.Game.state) {
                window.Game.state = {};
            }

            if (!window.Game.state.talents) {
                window.Game.state.talents = {};
            }

            // Điền giá trị mặc định cấp 0 cho toàn bộ 24 thiên phú
            Object.keys(this.TALENTS_CONFIG).forEach((talentId) => {
                if (typeof window.Game.state.talents[talentId] !== 'number') {
                    window.Game.state.talents[talentId] = 0;
                }
            });

            // Danh hiệu đã mở khóa và đang trang bị
            if (!window.Game.state.unlockedTitles) {
                window.Game.state.unlockedTitles = ['title_swordmaster'];
            }
            if (!window.Game.state.equippedTitle) {
                window.Game.state.equippedTitle = 'title_swordmaster';
            }

            // Nhánh kỹ năng nhân vật (III.1 - III.10)
            if (!window.Game.state.unlockedSkills) {
                window.Game.state.unlockedSkills = [];
            }

            // Bậc tiến hóa tinh linh (Mặc định Stage 1)
            if (typeof window.Game.state.petEvolutionStage !== 'number') {
                window.Game.state.petEvolutionStage = 1;
            }

            // Thống kê thành tựu để check danh hiệu
            if (!window.Game.state.achievementStats) {
                window.Game.state.achievementStats = {
                    totalMeleeHits: 0,
                    totalParries: 0,
                    killsWithScythe: 0,
                    perfectDodges: 0,
                    totalDamageTaken: 0,
                    bossChronoKills: 0,
                    longRangeLaserHits: 0,
                    multiKillsCannon: 0,
                    lifetimeGold: 0,
                    lifetimeShards: 0,
                    maxAbyssFloor: 0,
                    totalMiniBossKills: 0,
                    flawlessSurvivals: 0,
                    rageMaxTimeRecord: 0,
                    quantumRewindSaves: 0
                };
            }

            this.bindDomEvents();
            this.applyAllTalentsToPlayer();
            this.applyEquippedTitleStats();

            this.initialized = true;
            console.log('✅ [TalentsAndTitles] Khởi tạo thành công hệ thống Thiên Phú, Danh Hiệu & Tiến Hóa Tinh Linh.');
        },

        bindDomEvents: function () {
            const btnOpenTalents = document.getElementById('btn-open-talents');
            if (btnOpenTalents) {
                btnOpenTalents.addEventListener('click', () => {
                    this.openTalentsModal();
                });
            }

            const btnOpenTitles = document.getElementById('btn-open-titles');
            if (btnOpenTitles) {
                btnOpenTitles.addEventListener('click', () => {
                    this.openTitlesModal();
                });
            }

            const btnResetTalents = document.getElementById('btn-reset-talents');
            if (btnResetTalents) {
                btnResetTalents.addEventListener('click', () => {
                    this.resetAllTalents();
                });
            }
        },

        // ====================================================================
        // TÍNH TOÁN CHI PHÍ NÂNG CẤP THIÊN PHÚ
        // ====================================================================
        getTalentCost: function (talentId) {
            const config = this.TALENTS_CONFIG[talentId];
            if (!config) return { gold: 0, shards: 0 };

            const currentLvl = window.Game.state.talents[talentId] || 0;
            if (currentLvl >= config.maxLevel) {
                return { gold: 0, shards: 0, maxed: true };
            }

            const multiplier = Math.pow(config.costMultiplier, currentLvl);
            const goldCost = Math.round(config.costGoldPerLevel * multiplier);
            const shardCost = config.costShardsPerLevel > 0 
                ? Math.round(config.costShardsPerLevel + currentLvl * 1.2) 
                : 0;

            return {
                gold: goldCost,
                shards: shardCost,
                maxed: false
            };
        },

        canUpgradeTalent: function (talentId) {
            const config = this.TALENTS_CONFIG[talentId];
            if (!config) return { canUpgrade: false, reason: 'Không tìm thấy thiên phú!' };

            const currentLvl = window.Game.state.talents[talentId] || 0;
            if (currentLvl >= config.maxLevel) {
                return { canUpgrade: false, reason: 'Thiên phú đã đạt cấp tối đa!' };
            }

            if (config.requires) {
                const parentLvl = window.Game.state.talents[config.requires] || 0;
                const reqLevel = config.reqLevel || 1;
                if (parentLvl < reqLevel) {
                    const parentConfig = this.TALENTS_CONFIG[config.requires];
                    return {
                        canUpgrade: false,
                        reason: `Cần nâng cấp [${parentConfig ? parentConfig.name : config.requires}] lên cấp ${reqLevel}!`
                    };
                }
            }

            const cost = this.getTalentCost(talentId);
            const currentGold = window.Game.state.gold || 0;
            const currentShards = window.Game.state.timeShards || 0;

            if (currentGold < cost.gold) {
                return {
                    canUpgrade: false,
                    reason: `Không đủ Vàng (Cần: ${cost.gold.toLocaleString('vi-VN')} G)!`
                };
            }

            if (currentShards < cost.shards) {
                return {
                    canUpgrade: false,
                    reason: `Không đủ Mảnh Thời Không (Cần: ${cost.shards} 💎)!`
                };
            }

            return { canUpgrade: true, cost: cost };
        },

        upgradeTalent: function (talentId) {
            const check = this.canUpgradeTalent(talentId);
            if (!check.canUpgrade) {
                if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                    window.Game.Systems.showToastNotification(`⚠️ ${check.reason}`, 'warning');
                }
                return false;
            }

            const cost = check.cost;
            window.Game.state.gold -= cost.gold;
            window.Game.state.timeShards -= cost.shards;
            window.Game.state.talents[talentId] = (window.Game.state.talents[talentId] || 0) + 1;

            if (window.Game.Systems && typeof window.Game.Systems.saveGame === 'function') {
                window.Game.Systems.saveGame();
            }

            this.applyAllTalentsToPlayer();

            if (window.Game.Systems && typeof window.Game.Systems.playSound === 'function') {
                window.Game.Systems.playSound('upgrade_success');
            }

            const talentInfo = this.TALENTS_CONFIG[talentId];
            if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                window.Game.Systems.showToastNotification(
                    `✨ Đã nâng cấp [${talentInfo.name}] lên Cấp ${window.Game.state.talents[talentId]}!`,
                    'success'
                );
            }

            this.renderTalentsTree();

            if (window.Game.Systems && typeof window.Game.Systems.updateLobbyUI === 'function') {
                window.Game.Systems.updateLobbyUI();
            }

            return true;
        },

        // ====================================================================
        // HOÀN TRẢ TOÀN BỘ ĐIỂM THIÊN PHÚ (RESET TALENTS & REFUND 100%)
        // ====================================================================
        resetAllTalents: function () {
            if (!confirm('Bạn có chắc chắn muốn TẨY ĐIỂM toàn bộ Cây Thiên Phú? Toàn bộ Vàng và Mảnh Thời Không 💎 đã dùng sẽ được hoàn trả 100%!')) {
                return;
            }

            let totalRefundGold = 0;
            let totalRefundShards = 0;

            Object.keys(this.TALENTS_CONFIG).forEach((talentId) => {
                const config = this.TALENTS_CONFIG[talentId];
                const allocatedLvl = window.Game.state.talents[talentId] || 0;

                for (let lvl = 0; lvl < allocatedLvl; lvl++) {
                    const multiplier = Math.pow(config.costMultiplier, lvl);
                    const g = Math.round(config.costGoldPerLevel * multiplier);
                    const s = config.costShardsPerLevel > 0 
                        ? Math.round(config.costShardsPerLevel + lvl * 1.2) 
                        : 0;
                    totalRefundGold += g;
                    totalRefundShards += s;
                }

                window.Game.state.talents[talentId] = 0;
            });

            window.Game.state.gold = (window.Game.state.gold || 0) + totalRefundGold;
            window.Game.state.timeShards = (window.Game.state.timeShards || 0) + totalRefundShards;

            if (window.Game.Systems && typeof window.Game.Systems.saveGame === 'function') {
                window.Game.Systems.saveGame();
            }

            this.applyAllTalentsToPlayer();
            this.renderTalentsTree();

            if (window.Game.Systems && typeof window.Game.Systems.updateLobbyUI === 'function') {
                window.Game.Systems.updateLobbyUI();
            }

            if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                window.Game.Systems.showToastNotification(
                    `♻️ Tẩy điểm thành công! Đã hoàn trả: +${totalRefundGold.toLocaleString('vi-VN')} G và +${totalRefundShards} 💎.`,
                    'info'
                );
            }
        },

        // ====================================================================
        // TÍNH TOÁN & ÁP DỤNG CHỈ SỐ THIÊN PHÚ VÀO PLAYER VĨNH VIỄN
        // ====================================================================
        applyAllTalentsToPlayer: function () {
            const player = window.Game.player;
            const state = window.Game.state;
            if (!state || !state.talents) return;

            const bonuses = {
                meleeDamagePercent: 0,
                rangedDamagePercent: 0,
                critRate: 0,
                critDamage: 0,
                lifeStealPercent: 0,
                armorPenetrationPercent: 0,
                swordWaveSpeedPercent: 0,
                swordWaveDamagePercent: 0,
                parryReflectBonusPercent: 0,
                parryRageGain: 0,
                executeThreshold: 0,
                slaughterBonusAttack: 0,

                maxHpBonus: 0,
                maxShieldBonus: 0,
                baseArmor: 0,
                hpRegenPerSecond: 0,
                thornReflectDamagePercent: 0,
                damageReductionPercent: 0,
                shieldBreakStunSeconds: 0,
                shieldBreakAoeDamage: 0,
                lowHpArmorBoostPercent: 0,
                lowHpDamageBoostPercent: 0,
                cheatDeathCooldownSec: 0,
                cheatDeathInvulnerableSec: 0,

                moveSpeedBonus: 0,
                magnetRadiusBonus: 0,
                doubleGoldExpChance: 0,
                cooldownReductionPercent: 0,
                heatCooldownRateBonus: 0,
                dashCostRageDiscount: 0,
                bonusShardDropChance: 0,
                orbSpawnMultiplier: 1.0,
                freezeDurationBonusSec: 0,
                slowEffectBoostPercent: 0,
                globalVacuumEvery20s: false,
                allItemBuffDurationSec: 0
            };

            Object.keys(this.TALENTS_CONFIG).forEach((talentId) => {
                const lvl = state.talents[talentId] || 0;
                if (lvl <= 0) return;

                const config = this.TALENTS_CONFIG[talentId];
                const stats = config.statsPerLevel;

                Object.keys(stats).forEach((statKey) => {
                    const val = stats[statKey];
                    if (typeof val === 'number') {
                        if (bonuses[statKey] !== undefined) {
                            bonuses[statKey] += val * lvl;
                        }
                    } else if (typeof val === 'boolean') {
                        bonuses[statKey] = val;
                    }
                });
            });

            state.talentBonuses = bonuses;

            if (player) {
                const baseHp = player.characterBaseHp || 100;
                player.maxHp = baseHp + bonuses.maxHpBonus;
                if (player.hp > player.maxHp) player.hp = player.maxHp;

                const baseShield = player.characterBaseShield || 50;
                player.maxShield = baseShield + bonuses.maxShieldBonus;

                player.armor = (player.characterBaseArmor || 0) + bonuses.baseArmor;

                const baseSpeed = player.characterBaseSpeed || 190;
                player.speed = baseSpeed + bonuses.moveSpeedBonus;

                player.critChance = 0.05 + bonuses.critRate;
                player.critMultiplier = 1.5 + bonuses.critDamage;

                // Giới hạn bán kính nam châm tối đa 450px
                player.pickupRadius = Math.min(450, 120 + bonuses.magnetRadiusBonus);
                player.hpRegenRate = bonuses.hpRegenPerSecond;
                player.doubleDropChance = bonuses.doubleGoldExpChance;
                player.cooldownReduction = Math.min(0.60, bonuses.cooldownReductionPercent / 100);
                player.armorPenetration = bonuses.armorPenetrationPercent;
                player.lifeSteal = bonuses.lifeStealPercent;
                player.heatCoolBonus = bonuses.heatCooldownRateBonus;
            }
        },

        applyEquippedTitleStats: function () {
            const state = window.Game.state;
            const player = window.Game.player;
            if (!state || !state.equippedTitle) return;

            const titleConfig = this.TITLES_CONFIG[state.equippedTitle];
            if (!titleConfig) return;

            state.activeTitleStats = titleConfig.stats || {};
            state.activeTitleAura = titleConfig.auraType || null;

            if (player && state.activeTitleStats.allStatsPercent) {
                const bonusRatio = 1 + (state.activeTitleStats.allStatsPercent / 100);
                player.maxHp = Math.round(player.maxHp * bonusRatio);
                player.maxShield = Math.round(player.maxShield * bonusRatio);
                player.speed = Math.round(player.speed * bonusRatio);
            }
        },

        renderTalentsTree: function () {
            const modalBody = document.querySelector('#talent-tree-modal .modal-body') || 
                              document.getElementById('talent-tree-container');
            if (!modalBody) return;

            const state = window.Game.state;
            const currentGold = state.gold || 0;
            const currentShards = state.timeShards || 0;

            let html = `
                <div class="talents-header-bar">
                    <div class="talents-currency-display">
                        <span class="currency-badge gold-badge">💰 ${currentGold.toLocaleString('vi-VN')} G</span>
                        <span class="currency-badge shard-badge">💎 ${currentShards.toLocaleString('vi-VN')} Mảnh</span>
                    </div>
                    <div class="talents-branch-tabs">
                        <button class="branch-tab-btn ${this.activeTab === 'berserk' ? 'active red-glow' : ''}" 
                                onclick="window.Game.TalentsAndTitles.switchBranchTab('berserk')">
                            ⚔️ Cuồng Chiến
                        </button>
                        <button class="branch-tab-btn ${this.activeTab === 'bulwark' ? 'active blue-glow' : ''}" 
                                onclick="window.Game.TalentsAndTitles.switchBranchTab('bulwark')">
                            🛡️ Pháo Đài Thời Không
                        </button>
                        <button class="branch-tab-btn ${this.activeTab === 'utility' ? 'active green-glow' : ''}" 
                                onclick="window.Game.TalentsAndTitles.switchBranchTab('utility')">
                            🧲 Thần Tốc Thu Hoạch
                        </button>
                    </div>
                    <button class="btn-cyber-outline btn-reset-talents" onclick="window.Game.TalentsAndTitles.resetAllTalents()">
                        ♻️ Tẩy Điểm (100% Hoàn Lại)
                    </button>
                </div>
                <div class="talents-nodes-grid branch-${this.activeTab}">
            `;

            const talentsInBranch = Object.values(this.TALENTS_CONFIG).filter(
                (item) => item.branch === this.activeTab
            );
            talentsInBranch.sort((a, b) => a.tier - b.tier);

            talentsInBranch.forEach((talent) => {
                const currentLvl = state.talents[talent.id] || 0;
                const isMaxed = currentLvl >= talent.maxLevel;
                const check = this.canUpgradeTalent(talent.id);
                const cost = this.getTalentCost(talent.id);

                let statusClass = 'locked';
                if (isMaxed) {
                    statusClass = 'maxed';
                } else if (check.canUpgrade) {
                    statusClass = 'available';
                }

                let reqHtml = '';
                if (talent.requires) {
                    const parentConfig = this.TALENTS_CONFIG[talent.requires];
                    const parentLvl = state.talents[talent.requires] || 0;
                    const isMet = parentLvl >= (talent.reqLevel || 1);
                    reqHtml = `
                        <div class="talent-requirement ${isMet ? 'met' : 'unmet'}">
                            ${isMet ? '✔' : '🔒'} Cần ${parentConfig.name} (Lv.${talent.reqLevel})
                        </div>
                    `;
                }

                html += `
                    <div class="talent-card ${statusClass} tier-${talent.tier}">
                        <div class="talent-card-header">
                            <span class="talent-icon">${talent.icon}</span>
                            <div class="talent-title-wrap">
                                <h4 class="talent-name">${talent.name}</h4>
                                <span class="talent-tier-badge">Bậc ${talent.tier}</span>
                            </div>
                            <div class="talent-level-badge ${isMaxed ? 'level-maxed' : ''}">
                                ${currentLvl} / ${talent.maxLevel}
                            </div>
                        </div>

                        <p class="talent-desc">${talent.description}</p>
                        ${reqHtml}

                        <div class="talent-card-footer">
                            ${isMaxed ? `
                                <div class="talent-status-maxed">✨ ĐÃ ĐẠT TỐI ĐA</div>
                            ` : `
                                <div class="talent-cost-display">
                                    <span class="cost-gold ${currentGold < cost.gold ? 'cost-short' : ''}">
                                        💰 ${cost.gold.toLocaleString('vi-VN')}
                                    </span>
                                    ${cost.shards > 0 ? `
                                        <span class="cost-shard ${currentShards < cost.shards ? 'cost-short' : ''}">
                                            💎 ${cost.shards}
                                        </span>
                                    ` : ''}
                                </div>
                                <button class="btn-upgrade-talent ${check.canUpgrade ? 'btn-can-upgrade' : 'btn-disabled'}" 
                                        ${!check.canUpgrade ? 'disabled' : ''}
                                        onclick="window.Game.TalentsAndTitles.upgradeTalent('${talent.id}')">
                                    Nâng Cấp
                                </button>
                            `}
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            modalBody.innerHTML = html;
        },

        switchBranchTab: function (branch) {
            this.activeTab = branch;
            this.renderTalentsTree();
        },

        openTalentsModal: function () {
            this.renderTalentsTree();
            const modal = document.getElementById('talent-tree-modal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
            }
        },

        closeTalentsModal: function () {
            const modal = document.getElementById('talent-tree-modal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        },

        // ====================================================================
        // V. HỆ THỐNG DANH HIỆU: KIỂM TRA MỞ KHÓA, TRANG BỊ & RENDER MODAL
        // ====================================================================
        checkTitleUnlocks: function () {
            const state = window.Game.state;
            if (!state || !state.achievementStats) return;

            if (!Array.isArray(state.unlockedTitles)) {
                state.unlockedTitles = ['title_swordmaster'];
            }

            const stats = state.achievementStats;
            let newlyUnlocked = [];

            Object.keys(this.TITLES_CONFIG).forEach((titleId) => {
                if (!state.unlockedTitles.includes(titleId)) {
                    const config = this.TITLES_CONFIG[titleId];
                    if (config && typeof config.checkUnlock === 'function') {
                        if (config.checkUnlock(stats)) {
                            state.unlockedTitles.push(titleId);
                            newlyUnlocked.push(config);
                        }
                    }
                }
            });

            if (newlyUnlocked.length > 0) {
                newlyUnlocked.forEach((title) => {
                    if (window.Game.Systems && typeof window.Game.Systems.showToastNotification === 'function') {
                        window.Game.Systems.showToastNotification(
                            `🏆 VINH DANH! Đã mở khóa Danh Hiệu Mới: [${title.name}]!`,
                            'legendary'
                        );
                    }
                    if (window.Game.Systems && typeof window.Game.Systems.playSound === 'function') {
                        window.Game.Systems.playSound('title_unlocked');
                    }
                });

                if (window.Game.Systems && typeof window.Game.Systems.saveGame === 'function') {
                    window.Game.Systems.saveGame();
                }

                this.renderTitlesModal();
            }
        },

        equipTitle: function (titleId) {
            const state = window.Game.state;
            if (!state || !state.unlockedTitles) return false;

            if (!state.unlockedTitles.includes(titleId)) {
                if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                    window.Game.Systems.showToastNotification('🔒 Danh hiệu này chưa được mở khóa!', 'warning');
                }
                return false;
            }

            state.equippedTitle = titleId;
            this.applyEquippedTitleStats();

            if (window.Game.Systems && typeof window.Game.Systems.saveGame === 'function') {
                window.Game.Systems.saveGame();
            }

            const config = this.TITLES_CONFIG[titleId];
            if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                window.Game.Systems.showToastNotification(
                    `🎖️ Đã trang bị Danh Hiệu: [${config.name}]!`,
                    'success'
                );
            }
            if (window.Game.Systems && typeof window.Game.Systems.playSound === 'function') {
                window.Game.Systems.playSound('equip_title');
            }

            this.renderTitlesModal();
            return true;
        },

        unequipTitle: function () {
            const state = window.Game.state;
            if (!state) return;

            state.equippedTitle = null;
            state.activeTitleStats = {};
            state.activeTitleAura = null;

            if (window.Game.Systems && typeof window.Game.Systems.saveGame === 'function') {
                window.Game.Systems.saveGame();
            }

            if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                window.Game.Systems.showToastNotification('Đã tháo Danh Hiệu.', 'info');
            }

            this.renderTitlesModal();
        },

        renderTitlesModal: function () {
            const modalBody = document.querySelector('#titles-modal .modal-body') || 
                              document.getElementById('titles-container');
            if (!modalBody) return;

            const state = window.Game.state;
            const equippedId = state.equippedTitle || null;
            const unlockedList = state.unlockedTitles || [];

            let html = `
                <div class="titles-header-summary">
                    <div class="titles-equipped-display">
                        <span class="label">Danh hiệu đang đeo:</span>
                        ${equippedId && this.TITLES_CONFIG[equippedId] ? `
                            <span class="current-title-badge" style="color: ${this.TITLES_CONFIG[equippedId].color}; text-shadow: 0 0 10px ${this.TITLES_CONFIG[equippedId].color};">
                                ${this.TITLES_CONFIG[equippedId].icon} ${this.TITLES_CONFIG[equippedId].name}
                            </span>
                            <button class="btn-unequip-title" onclick="window.Game.TalentsAndTitles.unequipTitle()">Tháo</button>
                        ` : `
                            <span class="no-title-badge">(Chưa trang bị danh hiệu nào)</span>
                        `}
                    </div>
                    <div class="titles-count-stat">
                        Đã sở hữu: <strong>${unlockedList.length} / ${Object.keys(this.TITLES_CONFIG).length}</strong>
                    </div>
                </div>
                <div class="titles-grid-container">
            `;

            Object.values(this.TITLES_CONFIG).forEach((title) => {
                const isUnlocked = unlockedList.includes(title.id);
                const isEquipped = (equippedId === title.id);

                let statsBuffText = [];
                if (title.stats.meleeDamagePercent) statsBuffText.push(`+${title.stats.meleeDamagePercent}% Cận chiến`);
                if (title.stats.swordWaveSpeedPercent) statsBuffText.push(`+${title.stats.swordWaveSpeedPercent}% Tốc độ kiếm khí`);
                if (title.stats.parryDamageBonusPercent) statsBuffText.push(`+${title.stats.parryDamageBonusPercent}% Đạn phản xạ`);
                if (title.stats.parryRageGain) statsBuffText.push(`+${title.stats.parryRageGain} Nộ khi Parry`);
                if (title.stats.lifeStealPercent) statsBuffText.push(`+${title.stats.lifeStealPercent}% Hút máu`);
                if (title.stats.scytheRadiusPercent) statsBuffText.push(`+${title.stats.scytheRadiusPercent}% Phạm vi Lưỡi Hái`);
                if (title.stats.moveSpeedPercent) statsBuffText.push(`+${title.stats.moveSpeedPercent}% Tốc chạy`);
                if (title.stats.perfectDodgeRageGain) statsBuffText.push(`+${title.stats.perfectDodgeRageGain} Nộ khi né chuẩn`);
                if (title.stats.maxShieldPercent) statsBuffText.push(`+${title.stats.maxShieldPercent}% Khiên tối đa`);
                if (title.stats.reflectLightningDamage) statsBuffText.push(`Phản sét ${title.stats.reflectLightningDamage} DMG`);
                if (title.stats.allStatsPercent) statsBuffText.push(`+${title.stats.allStatsPercent}% Toàn bộ chỉ số`);
                if (title.stats.timeFreezeDurationSec) statsBuffText.push(`+${title.stats.timeFreezeDurationSec}s Đóng băng`);
                if (title.stats.rangedDamagePercent) statsBuffText.push(`+${title.stats.rangedDamagePercent}% Sát thương xa`);
                if (title.stats.laserPierceChance) statsBuffText.push(`+${Math.round(title.stats.laserPierceChance * 100)}% Xuyên thấu`);
                if (title.stats.cannonAoeRadiusPercent) statsBuffText.push(`+${title.stats.cannonAoeRadiusPercent}% Bán kính nổ`);
                if (title.stats.cannonBurnDamagePercent) statsBuffText.push(`+${title.stats.cannonBurnDamagePercent}% Thiêu đốt`);
                if (title.stats.goldDropMultiplier) statsBuffText.push(`+${Math.round((title.stats.goldDropMultiplier - 1) * 100)}% Vàng rơi`);
                if (title.stats.expDropMultiplier) statsBuffText.push(`+${Math.round((title.stats.expDropMultiplier - 1) * 100)}% EXP nhận`);
                if (title.stats.damageToBossesPercent) statsBuffText.push(`+${title.stats.damageToBossesPercent}% Sát thương Boss`);
                if (title.stats.abyssResistancePercent) statsBuffText.push(`+${title.stats.abyssResistancePercent}% Kháng Vực Thẳm`);
                if (title.stats.damageToMiniBossPercent) statsBuffText.push(`+${title.stats.damageToMiniBossPercent}% Sát thương Mini-Boss`);
                if (title.stats.miniBossLootChance) statsBuffText.push(`+${Math.round(title.stats.miniBossLootChance * 100)}% Rơi đồ Mini-Boss`);
                if (title.stats.evasionChance) statsBuffText.push(`+${Math.round(title.stats.evasionChance * 100)}% Tỉ lệ né tránh`);
                if (title.stats.attackSpeedPercent) statsBuffText.push(`+${title.stats.attackSpeedPercent}% Tốc đánh`);
                if (title.stats.critRate) statsBuffText.push(`+${Math.round(title.stats.critRate * 100)}% Tỉ lệ Crit`);
                if (title.stats.critDamage) statsBuffText.push(`+${Math.round(title.stats.critDamage * 100)}% Sát thương Crit`);
                if (title.stats.petAttackCooldownDiscountPercent) statsBuffText.push(`-${title.stats.petAttackCooldownDiscountPercent}% Hồi chiêu Pet`);
                if (title.stats.petShieldBoostPercent) statsBuffText.push(`+${title.stats.petShieldBoostPercent}% Khiên Pet`);
                if (title.stats.quantumRewindHealBonusPercent) statsBuffText.push(`+${title.stats.quantumRewindHealBonusPercent}% Hồi máu tua lại`);
                if (title.stats.cooldownReductionPercent) statsBuffText.push(`-${title.stats.cooldownReductionPercent}% Hồi chiêu`);

                html += `
                    <div class="title-badge-card ${isUnlocked ? 'unlocked' : 'locked'} ${isEquipped ? 'equipped-border' : ''}">
                        <div class="title-card-top">
                            <span class="title-rarity-pill rarity-${title.rarity.toLowerCase()}">${title.rarity}</span>
                            <span class="title-card-icon">${title.icon}</span>
                        </div>
                        <h4 class="title-card-name" style="color: ${isUnlocked ? title.color : '#888'};">
                            ${title.name}
                        </h4>
                        <div class="title-card-buffs">
                            ${statsBuffText.map(b => `<span class="buff-chip">⭐ ${b}</span>`).join('')}
                        </div>
                        <div class="title-card-requirement">
                            <span class="req-title">Điều kiện:</span> ${title.reqDescription}
                        </div>
                        <div class="title-card-action">
                            ${isEquipped ? `
                                <button class="btn-title-action btn-is-equipped" disabled>Đang Trang Bị</button>
                            ` : isUnlocked ? `
                                <button class="btn-title-action btn-equip" onclick="window.Game.TalentsAndTitles.equipTitle('${title.id}')">
                                    Trang Bị
                                </button>
                            ` : `
                                <button class="btn-title-action btn-locked" disabled>🔒 Chưa Đạt</button>
                            `}
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            modalBody.innerHTML = html;
        },

        openTitlesModal: function () {
            this.checkTitleUnlocks();
            this.renderTitlesModal();
            const modal = document.getElementById('titles-modal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
            }
        },

        closeTitlesModal: function () {
            const modal = document.getElementById('titles-modal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        },

        // ====================================================================
        // VI. HIỆU ỨNG HÀO QUANG THỰC CHIẾN (CANVAS AURA VFX - 120HZ OPTIMIZED)
        // ====================================================================
        renderPlayerTitleAura: function (ctx, player, camera) {
            const state = window.Game.state;
            if (!state || !state.equippedTitle || !player) return;

            const titleConfig = this.TITLES_CONFIG[state.equippedTitle];
            if (!titleConfig || !titleConfig.auraType) return;

            const px = ((player.x - (camera ? camera.x : 0)) | 0);
            const py = ((player.y - (camera ? camera.y : 0)) | 0);
            const time = performance.now() * 0.003;
            const isUltra = !!(window.Game.ultraPerformanceMode || (state && state.ultraPerformanceMode));

            ctx.save();

            switch (titleConfig.auraType) {
                case 'cyan_blades': { // Bậc Thầy Kiếm Khí: 3 lưỡi kiếm khí lục lam xoay quanh
                    const bladeCount = 3;
                    const orbitRadius = 38;
                    for (let i = 0; i < bladeCount; i++) {
                        const angle = time * 2.2 + (i * (Math.PI * 2 / bladeCount));
                        const bx = (px + Math.cos(angle) * orbitRadius) | 0;
                        const by = (py + Math.sin(angle) * orbitRadius) | 0;

                        ctx.save();
                        ctx.translate(bx, by);
                        ctx.rotate(angle + Math.PI / 2);
                        ctx.strokeStyle = '#00e5ff';
                        ctx.lineWidth = 2.5;
                        if (!isUltra) {
                            ctx.shadowColor = '#00e5ff';
                            ctx.shadowBlur = 8;
                        }
                        ctx.beginPath();
                        ctx.moveTo(0, -9);
                        ctx.lineTo(3, 7);
                        ctx.lineTo(-3, 7);
                        ctx.closePath();
                        ctx.stroke();
                        ctx.restore();
                    }
                    break;
                }

                case 'golden_sparks': { // Kẻ Phản Đòn Siêu Việt: Vòng tròn bảo hộ vàng kim phát tia sét
                    const r = 34 + Math.sin(time * 6) * 3;
                    ctx.strokeStyle = 'rgba(255, 234, 0, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([8, 6]);
                    ctx.lineDashOffset = -time * 25;
                    ctx.beginPath();
                    ctx.arc(px, py, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    const sparkAngle = (time * 8) % (Math.PI * 2);
                    const sx = px + Math.cos(sparkAngle) * (r + 4);
                    const sy = py + Math.sin(sparkAngle) * (r + 4);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect((sx - 2) | 0, (sy - 2) | 0, 4, 4);
                    break;
                }

                case 'crimson_mist': { // Huyết Nguyệt Tử Thần: Sương mù huyết sắc & lưỡi liềm đỏ
                    const pulse = (Math.sin(time * 3.5) + 1) * 0.5;
                    const grad = ctx.createRadialGradient(px, py, 15, px, py, 42);
                    grad.addColorStop(0, 'rgba(255, 23, 68, 0)');
                    grad.addColorStop(0.7, `rgba(255, 23, 68, ${0.15 + pulse * 0.15})`);
                    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(px, py, 42, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = 'rgba(255, 23, 68, 0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(px, py, 36, time * 2, time * 2 + Math.PI * 0.75);
                    ctx.stroke();
                    break;
                }

                case 'wind_afterimages': { // Bóng Ma Tốc Độ: Luồng gió lục bảo vần vũ
                    for (let j = 0; j < 4; j++) {
                        const a = time * 4 + j * (Math.PI / 2);
                        const dist = 28 + Math.cos(time * 3 + j) * 8;
                        const wx = (px + Math.cos(a) * dist) | 0;
                        const wy = (py + Math.sin(a) * (dist * 0.65)) | 0;
                        ctx.fillStyle = 'rgba(118, 255, 3, 0.45)';
                        ctx.beginPath();
                        ctx.arc(wx, wy, 3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }

                case 'electric_shield': { // Pháo Đài Bất Hoại: Lồng khiên lục giác điện tử
                    const sides = 6;
                    const hexR = 36;
                    ctx.strokeStyle = 'rgba(41, 121, 255, 0.75)';
                    ctx.lineWidth = 2.2;
                    if (!isUltra) {
                        ctx.shadowColor = '#2979ff';
                        ctx.shadowBlur = 10;
                    }
                    ctx.beginPath();
                    for (let s = 0; s < sides; s++) {
                        const ang = (s * (Math.PI * 2 / sides)) + (time * 0.5);
                        const hx = (px + Math.cos(ang) * hexR) | 0;
                        const hy = (py + Math.sin(ang) * hexR) | 0;
                        if (s === 0) ctx.moveTo(hx, hy);
                        else ctx.lineTo(hx, hy);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    break;
                }

                case 'quantum_halo': { // Chúa Tể Thời Không: Vòng Halo lượng tử cực đại 2 tầng
                    const haloR1 = 44;
                    const haloR2 = 30;

                    ctx.strokeStyle = 'rgba(213, 0, 249, 0.85)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(px, py, haloR1, time * 1.5, time * 1.5 + Math.PI * 1.3);
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    ctx.arc(px, py, haloR2, -time * 2, -time * 2 + Math.PI * 1.3);
                    ctx.stroke();

                    const qx = (px + Math.cos(time * 3) * haloR1) | 0;
                    const qy = (py + Math.sin(time * 3) * haloR1) | 0;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(qx - 2, qy - 2, 4, 4);
                    break;
                }

                case 'laser_crosshair': { // Xạ Thủ Lượng Tử: Tâm nhắm laser xoay quanh chân
                    ctx.strokeStyle = 'rgba(0, 230, 118, 0.6)';
                    ctx.lineWidth = 1.5;
                    const cr = 32;
                    ctx.beginPath();
                    ctx.arc(px, py, cr, 0, Math.PI * 2);
                    ctx.stroke();

                    for (let k = 0; k < 4; k++) {
                        const kang = (k * Math.PI / 2) + (time * 0.8);
                        ctx.beginPath();
                        ctx.moveTo(px + Math.cos(kang) * (cr - 6), py + Math.sin(kang) * (cr - 6));
                        ctx.lineTo(px + Math.cos(kang) * (cr + 6), py + Math.sin(kang) * (cr + 6));
                        ctx.stroke();
                    }
                    break;
                }

                case 'ember_flames': { // Chuyên Gia Oanh Tạc: Tàn lửa cam bay lượn
                    for (let e = 0; e < 5; e++) {
                        const eAng = time * 3 + e * 1.25;
                        const eDist = 22 + (e * 4);
                        const ex = px + Math.cos(eAng) * eDist;
                        const ey = py - 10 + Math.sin(time * 4 + e) * 16;
                        ctx.fillStyle = (e % 2 === 0) ? '#ff9100' : '#ff3d00';
                        ctx.fillRect((ex | 0), (ey | 0), 3, 3);
                    }
                    break;
                }

                case 'gold_glitter': { // Đại Phú Hào Thời Gian: Tiền vàng & ánh kim lấp lánh
                    for (let g = 0; g < 4; g++) {
                        const gang = time * 2 + g * (Math.PI / 2);
                        const gx = (px + Math.cos(gang) * 35) | 0;
                        const gy = (py + Math.sin(gang) * 28) | 0;
                        ctx.fillStyle = '#ffd700';
                        ctx.beginPath();
                        ctx.arc(gx, gy, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }

                case 'void_portal_swirl': { // Kẻ Chinh Phục Vực Thẳm: Vòng xoáy hư không
                    ctx.strokeStyle = 'rgba(224, 64, 251, 0.7)';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    for (let a = 0; a < Math.PI * 3; a += 0.3) {
                        const rad = 14 + a * 5;
                        const vx = px + Math.cos(a + time * 3) * rad;
                        const vy = py + Math.sin(a + time * 3) * rad * 0.7;
                        if (a === 0) ctx.moveTo(vx, vy);
                        else ctx.lineTo(vx, vy);
                    }
                    ctx.stroke();
                    break;
                }

                case 'skull_sigil': { // Khắc Tinh Thủ Lĩnh: Huyết phù đầu lâu
                    ctx.fillStyle = 'rgba(255, 82, 82, 0.2)';
                    ctx.beginPath();
                    ctx.arc(px, py + 14, 26, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ff5252';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    break;
                }

                case 'prismatic_feather': { // Tuyệt Đối Vô Thương: Hào quang bạch kim
                    const pR = 36 + Math.sin(time * 4) * 4;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(px, py, pR, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }

                case 'berserk_flame_pillar': { // Cuồng Đế Diệt Thế: Cột lửa đỏ bốc cháy
                    for (let f = 0; f < 6; f++) {
                        const fx = px + ((Math.sin(time * 5 + f) * 20) | 0);
                        const fy = py + 10 - ((time * 40 + f * 12) % 45);
                        ctx.fillStyle = (f % 2 === 0) ? '#ff3d00' : '#ffea00';
                        ctx.beginPath();
                        ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }

                case 'fairy_dust': { // Bậc Thầy Tinh Linh: Bụi tiên xanh ngọc rải rác
                    for (let d = 0; d < 5; d++) {
                        const dang = time * 2.5 + d * 1.3;
                        const dx = px + Math.cos(dang) * 32;
                        const dy = py + Math.sin(dang * 0.8) * 25;
                        ctx.fillStyle = 'rgba(24, 255, 255, 0.75)';
                        ctx.fillRect((dx | 0), (dy | 0), 3, 3);
                    }
                    break;
                }

                case 'quantum_singularity': { // Nghịch Lý Bất Hoại: Lỗ đen lượng tử nghịch đảo
                    ctx.strokeStyle = 'rgba(101, 31, 255, 0.9)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(px, py, 38, -time * 4, -time * 4 + Math.PI * 1.5);
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(px, py, 24, time * 5, time * 5 + Math.PI);
                    ctx.stroke();
                    break;
                }

                default:
                    break;
            }

            ctx.restore();
        },

        // ====================================================================
        // VII. NHÁNH KỸ NĂNG NHÂN VẬT (CHARACTER SKILLS III.1 -> III.10)
        // ====================================================================
        hasSkill: function (skillId) {
            const state = window.Game.state;
            if (!state || !Array.isArray(state.unlockedSkills)) return false;
            return state.unlockedSkills.includes(skillId);
        },

        canUnlockSkill: function (skillId) {
            const config = this.SKILLS_CONFIG[skillId];
            if (!config) return { canUnlock: false, reason: 'Kỹ năng không tồn tại!' };

            const state = window.Game.state;
            if (this.hasSkill(skillId)) {
                return { canUnlock: false, reason: 'Kỹ năng này đã được mở khóa!' };
            }

            if (config.characterReq !== 'all') {
                const currentHero = state.selectedCharacterId || (window.Game.player && window.Game.player.characterId);
                if (currentHero && currentHero !== config.characterReq) {
                    return {
                        canUnlock: false,
                        reason: `Kỹ năng này chỉ dành riêng cho hệ phái [${config.characterReq}]!`
                    };
                }
            }

            const curGold = state.gold || 0;
            const curShards = state.timeShards || 0;

            if (curGold < config.goldCost) {
                return { canUnlock: false, reason: `Cần ${config.goldCost.toLocaleString('vi-VN')} Vàng!` };
            }
            if (curShards < config.shardsCost) {
                return { canUnlock: false, reason: `Cần ${config.shardsCost} Mảnh Thời Không 💎!` };
            }

            return { canUnlock: true, config: config };
        },

        unlockSkill: function (skillId) {
            const check = this.canUnlockSkill(skillId);
            if (!check.canUnlock) {
                if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                    window.Game.Systems.showToastNotification(`⚠️ ${check.reason}`, 'warning');
                }
                return false;
            }

            const config = check.config;
            const state = window.Game.state;

            state.gold -= config.goldCost;
            state.timeShards -= config.shardsCost;
            state.unlockedSkills.push(skillId);

            if (window.Game.player && config.effectKey) {
                window.Game.player[config.effectKey] = true;
            }

            if (window.Game.Systems && typeof window.Game.Systems.saveGame === 'function') {
                window.Game.Systems.saveGame();
            }

            if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                window.Game.Systems.showToastNotification(
                    `⚡ Đã giác ngộ Kỹ Năng: [${config.name}]!`,
                    'success'
                );
            }
            if (window.Game.Systems && typeof window.Game.Systems.playSound === 'function') {
                window.Game.Systems.playSound('skill_unlocked');
            }

            this.renderSkillsModal();
            return true;
        },

        renderSkillsModal: function () {
            const container = document.getElementById('character-skills-container') || 
                              document.querySelector('#skills-modal .modal-body');
            if (!container) return;

            let html = `
                <div class="skills-modal-header">
                    <h3>Cổ Thư Kỹ Năng Tuyệt Học (III.1 - III.10)</h3>
                    <p class="subtitle">Khai phá tiềm năng tối thượng của từng hệ phái Thời Không</p>
                </div>
                <div class="skills-grid-list">
            `;

            Object.values(this.SKILLS_CONFIG).forEach((sk) => {
                const isUnlocked = this.hasSkill(sk.id);
                const check = this.canUnlockSkill(sk.id);

                html += `
                    <div class="skill-item-row ${isUnlocked ? 'skill-learned' : 'skill-locked'}">
                        <div class="skill-slot-number">#${sk.slotIndex}</div>
                        <div class="skill-icon-badge">${sk.icon}</div>
                        <div class="skill-details">
                            <div class="skill-name-row">
                                <span class="skill-title">${sk.name}</span>
                                <span class="skill-class-badge">${sk.characterReq.toUpperCase()}</span>
                            </div>
                            <div class="skill-desc-text">${sk.description}</div>
                        </div>
                        <div class="skill-action-col">
                            ${isUnlocked ? `
                                <span class="skill-badge-active">✔ ĐÃ THÀNH THỤC</span>
                            ` : `
                                <div class="skill-cost-tags">
                                    <span class="cost-tag gold">💰 ${sk.goldCost.toLocaleString('vi-VN')}</span>
                                    <span class="cost-tag shard">💎 ${sk.shardsCost}</span>
                                </div>
                                <button class="btn-learn-skill ${check.canUnlock ? 'btn-can-learn' : 'btn-disabled'}"
                                        ${!check.canUnlock ? 'disabled' : ''}
                                        onclick="window.Game.TalentsAndTitles.unlockSkill('${sk.id}')">
                                    Học Kỹ Năng
                                </button>
                            `}
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            container.innerHTML = html;
        },

        // ====================================================================
        // VIII. TIẾN HÓA TINH LINH & LOOT COMPANION (PET EVOLUTION - V.1, V.2)
        // ====================================================================
        getPetCurrentConfig: function () {
            const state = window.Game.state;
            const stageIndex = ((state ? state.petEvolutionStage : 1) || 1) - 1;
            return this.PET_EVOLUTION_STAGES[stageIndex] || this.PET_EVOLUTION_STAGES[0];
        },

        canEvolvePet: function () {
            const state = window.Game.state;
            const curStage = (state && state.petEvolutionStage) ? state.petEvolutionStage : 1;
            if (curStage >= 3) {
                return { canEvolve: false, reason: 'Tinh Linh đã đạt Bậc 3 Tối Thượng (Apex)!' };
            }

            const nextConfig = this.PET_EVOLUTION_STAGES[curStage];
            const curGold = state.gold || 0;
            const curShards = state.timeShards || 0;

            if (curGold < nextConfig.goldCost) {
                return { canEvolve: false, reason: `Cần ${nextConfig.goldCost.toLocaleString('vi-VN')} Vàng!` };
            }
            if (curShards < nextConfig.shardsCost) {
                return { canEvolve: false, reason: `Cần ${nextConfig.shardsCost} Mảnh Thời Không 💎!` };
            }

            return { canEvolve: true, nextConfig: nextConfig };
        },

        evolvePet: function () {
            const check = this.canEvolvePet();
            if (!check.canEvolve) {
                if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                    window.Game.Systems.showToastNotification(`⚠️ ${check.reason}`, 'warning');
                }
                return false;
            }

            const state = window.Game.state;
            const nextConfig = check.nextConfig;

            state.gold -= nextConfig.goldCost;
            state.timeShards -= nextConfig.shardsCost;
            state.petEvolutionStage += 1;

            if (window.Game.Systems && typeof window.Game.Systems.saveGame === 'function') {
                window.Game.Systems.saveGame();
            }

            this.checkTitleUnlocks();

            if (window.Game.Systems && window.Game.Systems.showToastNotification) {
                window.Game.Systems.showToastNotification(
                    `✨ CHÚC MỪNG! Tinh Linh Thời Không đã tiến hóa lên [${nextConfig.name}]!`,
                    'legendary'
                );
            }
            if (window.Game.Systems && typeof window.Game.Systems.playSound === 'function') {
                window.Game.Systems.playSound('pet_evolve');
            }

            this.renderPetEvolutionUI();
            return true;
        },

        renderPetEvolutionUI: function () {
            const container = document.getElementById('pet-evolution-container') || 
                              document.querySelector('#shop-modal .pet-evolution-tab');
            if (!container) return;

            const state = window.Game.state;
            const curStage = state.petEvolutionStage || 1;
            const curConfig = this.getPetCurrentConfig();
            const check = this.canEvolvePet();

            let html = `
                <div class="pet-evolution-card stage-${curStage}">
                    <div class="pet-hero-banner">
                        <div class="pet-avatar-circle">
                            <span class="pet-big-icon">${curConfig.icon}</span>
                        </div>
                        <div class="pet-hero-info">
                            <span class="pet-stage-tag">BẬC ${curStage} / 3</span>
                            <h3 class="pet-hero-name">${curConfig.name}</h3>
                            <p class="pet-hero-desc">${curConfig.description}</p>
                        </div>
                    </div>

                    <div class="pet-features-matrix">
                        <div class="pet-feature-row">
                            <span class="feat-name">💚 Hồi máu chủ nhân:</span>
                            <span class="feat-val">+${curConfig.features.baseHeal} HP mỗi ${curConfig.features.healIntervalSec}s</span>
                        </div>
                        <div class="pet-feature-row">
                            <span class="feat-name">🛡️ Khiên Lượng Tử:</span>
                            <span class="feat-val">${curConfig.features.hasShieldProjection ? `Hấp thụ ${curConfig.features.shieldAmount} sát thương (Hồi ${curConfig.features.shieldCooldownSec}s)` : 'Chưa mở khóa (Bậc 2)'}</span>
                        </div>
                        <div class="pet-feature-row">
                            <span class="feat-name">🧲 Tinh Linh Nhặt Đồ Xa (Loot Companion):</span>
                            <span class="feat-val">${curConfig.features.lootCompanion ? `Tự động bay bán kính ${curConfig.features.lootDistance}px nhặt đồ` : 'Chưa mở khóa (Bậc 3 Apex)'}</span>
                        </div>
                    </div>

                    <div class="pet-upgrade-footer">
                        ${curStage >= 3 ? `
                            <div class="pet-max-level-alert">👑 TINH LINH ĐÃ ĐẠT BẬC TỐI THƯỢNG APEX</div>
                        ` : `
                            <div class="pet-next-cost">
                                <span>Tiến hóa lên Bậc ${curStage + 1}:</span>
                                <span class="cost-gold">💰 ${check.nextConfig.goldCost.toLocaleString('vi-VN')} G</span>
                                <span class="cost-shard">💎 ${check.nextConfig.shardsCost} Mảnh</span>
                            </div>
                            <button class="btn-cyber-primary btn-evolve-pet ${check.canEvolve ? 'ready' : 'disabled'}"
                                    ${!check.canEvolve ? 'disabled' : ''}
                                    onclick="window.Game.TalentsAndTitles.evolvePet()">
                                ⚡ TIẾN HÓA TINH LINH
                            </button>
                        `}
                    </div>
                </div>
            `;

            container.innerHTML = html;
        },

        // ====================================================================
        // IX. LOGIC BAY & HÀNH VI TINH LINH TRONG TRẬN ĐẤU (PET COMPANION AI)
        // ====================================================================
        petEntity: {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            vx: 0,
            vy: 0,
            healTimer: 0,
            shieldTimer: 0,
            isLooting: false,
            targetDrop: null,
            floatingAngle: 0
        },

        updatePetCompanion: function (dt) {
            const player = window.Game.player;
            if (!player || player.hp <= 0) return;

            const petConfig = this.getPetCurrentConfig();
            const pet = this.petEntity;

            if (pet.x === 0 && pet.y === 0) {
                pet.x = player.x - 30;
                pet.y = player.y - 30;
            }

            pet.floatingAngle += dt * 3;

            // 1. Logic hồi máu
            pet.healTimer += dt;
            if (pet.healTimer >= petConfig.features.healIntervalSec) {
                pet.healTimer = 0;
                if (player.hp < player.maxHp) {
                    player.hp = Math.min(player.maxHp, player.hp + petConfig.features.baseHeal);
                    if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                        window.Game.Combat.spawnFloatingText(
                            player.x, 
                            player.y - 20, 
                            `+${petConfig.features.baseHeal} HP`, 
                            '#00e676'
                        );
                    }
                }
            }

            // 2. Logic phóng khiên lượng tử (Bậc 2+)
            if (petConfig.features.hasShieldProjection) {
                pet.shieldTimer += dt;
                if (pet.shieldTimer >= petConfig.features.shieldCooldownSec) {
                    if ((player.shield || 0) < petConfig.features.shieldAmount) {
                        player.shield = petConfig.features.shieldAmount;
                        pet.shieldTimer = 0;
                        if (window.Game.Combat && typeof window.Game.Combat.spawnFloatingText === 'function') {
                            window.Game.Combat.spawnFloatingText(
                                player.x, 
                                player.y - 35, 
                                `🛡️ KHIÊN TINH LINH +${petConfig.features.shieldAmount}`, 
                                '#2979ff'
                            );
                        }
                    }
                }
            }

            // 3. Logic nhặt đồ xa (Loot Companion - Bậc 3 Apex bán kính 650px)
            let targetFound = false;

            if (petConfig.features.lootCompanion) {
                const drops = window.Game.state.activeDrops || 
                              (window.Game.world && window.Game.world.drops) || [];
                const maxLootDistSq = petConfig.features.lootDistance * petConfig.features.lootDistance;

                let closestDrop = null;
                let minDistSq = maxLootDistSq;

                for (let i = 0; i < drops.length; i++) {
                    const drop = drops[i];
                    if (!drop || drop.collected) continue;

                    const dx = drop.x - player.x;
                    const dy = drop.y - player.y;
                    const distToPlayerSq = dx * dx + dy * dy;

                    // Chỉ bay đi nhặt đồ ở ngoài tầm với bình thường của player
                    if (distToPlayerSq > 16900 && distToPlayerSq <= maxLootDistSq) {
                        const pdx = drop.x - pet.x;
                        const pdy = drop.y - pet.y;
                        const distToPetSq = pdx * pdx + pdy * pdy;

                        if (distToPetSq < minDistSq) {
                            minDistSq = distToPetSq;
                            closestDrop = drop;
                        }
                    }
                }

                if (closestDrop) {
                    targetFound = true;
                    pet.isLooting = true;
                    pet.targetDrop = closestDrop;

                    const flySpeed = petConfig.features.petFlySpeed || 420;
                    const angle = Math.atan2(closestDrop.y - pet.y, closestDrop.x - pet.x);
                    pet.x += Math.cos(angle) * flySpeed * dt;
                    pet.y += Math.sin(angle) * flySpeed * dt;

                    const collectDx = closestDrop.x - pet.x;
                    const collectDy = closestDrop.y - pet.y;
                    if (collectDx * collectDx + collectDy * collectDy < 625) { // < 25px
                        if (window.Game.Systems && typeof window.Game.Systems.collectDropItem === 'function') {
                            window.Game.Systems.collectDropItem(closestDrop);
                        } else {
                            closestDrop.collected = true;
                        }
                        pet.targetDrop = null;
                    }
                }
            }

            // Bay lơ lửng hộ tống cạnh player khi rảnh rỗi
            if (!targetFound) {
                pet.isLooting = false;
                pet.targetDrop = null;

                const hoverOffsetX = Math.cos(pet.floatingAngle) * 35 - 32;
                const hoverOffsetY = Math.sin(pet.floatingAngle) * 20 - 38;
                const idealX = player.x + hoverOffsetX;
                const idealY = player.y + hoverOffsetY;

                pet.x += (idealX - pet.x) * 6.5 * dt;
                pet.y += (idealY - pet.y) * 6.5 * dt;
            }
        },

        renderPetCompanion: function (ctx, camera) {
            const player = window.Game.player;
            if (!player || player.hp <= 0) return;

            const pet = this.petEntity;
            const petConfig = this.getPetCurrentConfig();

            const screenX = ((pet.x - (camera ? camera.x : 0)) | 0);
            const screenY = ((pet.y - (camera ? camera.y : 0)) | 0);
            const wingFlap = Math.sin(pet.floatingAngle * 4) * 8;

            ctx.save();

            // Vẽ tia dẫn hướng khi nhặt đồ xa
            if (pet.isLooting) {
                const playerScreenX = ((player.x - (camera ? camera.x : 0)) | 0);
                const playerScreenY = ((player.y - (camera ? camera.y : 0)) | 0);

                ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(playerScreenX, playerScreenY - 20);
                ctx.lineTo(screenX, screenY);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Hào quang Tinh Linh
            const auraGrad = ctx.createRadialGradient(screenX, screenY, 3, screenX, screenY, 18);
            if (petConfig.stage === 1) {
                auraGrad.addColorStop(0, 'rgba(0, 230, 118, 0.8)');
                auraGrad.addColorStop(1, 'rgba(0, 230, 118, 0)');
            } else if (petConfig.stage === 2) {
                auraGrad.addColorStop(0, 'rgba(41, 121, 255, 0.85)');
                auraGrad.addColorStop(1, 'rgba(41, 121, 255, 0)');
            } else {
                auraGrad.addColorStop(0, 'rgba(213, 0, 249, 0.9)');
                auraGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
            }
            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 18, 0, Math.PI * 2);
            ctx.fill();

            // Đôi cánh tinh linh
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.ellipse(screenX - 7, screenY - 2, 7, Math.abs(wingFlap) + 2, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.ellipse(screenX + 7, screenY - 2, 7, Math.abs(wingFlap) + 2, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();

            // Thân thể tinh linh
            ctx.fillStyle = (petConfig.stage === 3) ? '#ffd700' : '#ffffff';
            ctx.beginPath();
            ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
            ctx.fill();

            // Vương miện nhỏ Bậc 3 Tối Thượng
            if (petConfig.stage === 3) {
                ctx.fillStyle = '#ffea00';
                ctx.beginPath();
                ctx.moveTo(screenX - 4, screenY - 6);
                ctx.lineTo(screenX - 2, screenY - 10);
                ctx.lineTo(screenX, screenY - 7);
                ctx.lineTo(screenX + 2, screenY - 10);
                ctx.lineTo(screenX + 4, screenY - 6);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }
    };

    window.Game.TalentsAndTitles = TalentsAndTitles;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            TalentsAndTitles.init();
        });
    } else {
        TalentsAndTitles.init();
    }

})();