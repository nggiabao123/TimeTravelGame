/**
 * ============================================================================
 * TỰA GAME: KẺ DU HÀNH THỜI KHÔNG (CHRONO TRAVELER 2D ARPG)
 * TẬP TIN: abyss_bounties.js (ĐÃ FIX TOÀN DIỆN LỖI ĐƠ KHI KHIÊU CHIẾN)
 * NAMESPACE: window.Game.AbyssAndBounties
 * VAI TRÒ: SENIOR GAMEPLAY SYSTEMS & LIVEOPS ENGINE
 * PHẠM VI NÂNG CẤP:
 *   - Mục V.4: Chế Độ Leo Tháp Vô Tận (Endless Abyss Mode 1 - 9999+)
 *   - Kho 25 Bùa Lợi Thời Không (Temporal Blessings: Common -> Divine)
 *   - Kho 25 Thử Thách Hằng Ngày (Daily Bounties Pool)
 *   - Bộ Affixes đột biến quái & Công thức Scale độ khó phi tuyến tính
 *   - Dynamic Entity Injector tích hợp trực tiếp vào Game.Enemies.list
 *   - Sửa lỗi kẹt phím, lỗi bất đồng bộ Cooldown và bổ sung onEnemyKilledInAbyss
 * ============================================================================
 */

(function (window) {
  'use strict';

  window.Game = window.Game || {};

  /**
   * HẰNG SỐ CẤU HÌNH HỆ THỐNG ABYSS & BOUNTIES
   */
  const ABYSS_CONSTANTS = {
    MAX_FLOOR_CAP: 9999,
    BLESSING_INTERVAL: 3,        // Mỗi 3 tầng mở Modal chọn 1 trong 3 Bùa Lợi
    MINI_BOSS_INTERVAL: 5,       // Tầng 5, 15, 25... gặp Mini-Boss Kỷ Nguyên
    OVERLORD_INTERVAL: 10,       // Tầng 10, 20, 30... gặp Chúa Tể Thời Không
    BASE_FLOOR_TIME_SECONDS: 90, // Tầng 1 có 90s đếm ngược
    MIN_FLOOR_TIME_SECONDS: 35,  // Giới hạn thời gian tối thiểu của tầng sâu
    BASE_GOLD_REWARD: 150,
    BASE_SHARD_REWARD: 5,        // Mảnh Thời Không (💎)
    BASE_EXP_REWARD: 320,
    LEADERBOARD_FETCH_LIMIT: 50,
    DAILY_BOUNTY_COUNT: 4,       // Bốc 4 nhiệm vụ/ngày
    RECAP_DPS_SLICE_SECONDS: 2   // Ghi nhận mẫu DPS mỗi 2 giây
  };

  /**
   * KHO 25 BÙA LỢI THỜI KHÔNG (TEMPORAL BLESSINGS POOL)
   * Phân cấp: Common (6), Rare (6), Epic (5), Legendary (5), Divine (3)
   */
  const TEMPORAL_BLESSINGS_POOL = [
    // --- COMMON (BẬC TRẮNG) ---
    {
      id: 'bless_chrono_blade',
      name: 'Lưỡi Kiếm Nghịch Đảo',
      rarity: 'Common',
      icon: '⚔️',
      description: 'Tăng 18% sát thương cận chiến, đòn đánh thứ 3 gây hiệu ứng Chậm Thời Gian 1.5s.',
      apply: (player) => {
        player.baseDamageBonus = (player.baseDamageBonus || 0) + 18;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.chronoBlade = true;
      }
    },
    {
      id: 'bless_flux_barrier',
      name: 'Màn Chắn Lượng Tử',
      rarity: 'Common',
      icon: '🛡️',
      description: 'Tăng vĩnh viễn +35 Khiên tối đa. Khi Khiên vỡ phát nổ đẩy lùi kẻ địch xung quanh.',
      apply: (player) => {
        player.maxShield = (player.maxShield || 50) + 35;
        player.shield = player.maxShield;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.shieldExplosion = true;
      }
    },
    {
      id: 'bless_accelerated_step',
      name: 'Bộ Hành Gia Tốc',
      rarity: 'Common',
      icon: '👟',
      description: 'Tốc độ di chuyển tăng 15%. Sau khi Né Hoàn Hảo, tăng 40% tốc chạy trong 3 giây.',
      apply: (player) => {
        player.baseSpeed = (player.baseSpeed || 240) + 36;
        player.speed = player.baseSpeed;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.hasteOnDodge = true;
      }
    },
    {
      id: 'bless_spark_infusion',
      name: 'Hạt Tinh Thể Tia Lửa',
      rarity: 'Common',
      icon: '⚡',
      description: 'Đòn bắn tầm xa có 30% tỉ lệ phóng thêm 1 tia Sấm Sét Lan Truyền gây 65% sát thương.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.sparkInfusion = (player.passiveEffects.sparkInfusion || 0) + 0.30;
      }
    },
    {
      id: 'bless_alchemical_flask',
      name: 'Bình Dược Nhân Quả',
      rarity: 'Common',
      icon: '🧪',
      description: 'Mỗi khi tiêu diệt 8 quái vật, hồi phục ngay lập tức 8% Lượng Máu Tối Đa.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.healOnKillStreak = (player.passiveEffects.healOnKillStreak || 0) + 0.08;
      }
    },
    {
      id: 'bless_sturdy_core',
      name: 'Lõi Năng Lượng Bền Bỉ',
      rarity: 'Common',
      icon: '💠',
      description: 'Giảm 10% toàn bộ sát thương nhận vào từ quái thường và đạn đạo.',
      apply: (player) => {
        player.stats = player.stats || {};
        player.stats.damageReduction = (player.stats.damageReduction || 0) + 0.10;
      }
    },

    // --- RARE (BẬC XANH LAM) ---
    {
      id: 'bless_resonant_echo',
      name: 'Tiếng Vọng Cộng Hưởng',
      rarity: 'Rare',
      icon: '🔔',
      description: 'Giảm 20% thời gian hồi chiêu tất cả kỹ năng. Kỹ năng có 15% cơ hội hồi lập tức.',
      apply: (player) => {
        player.stats = player.stats || {};
        player.stats.cdrBonus = (player.stats.cdrBonus || 0) + 0.20;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.echoResetChance = (player.passiveEffects.echoResetChance || 0) + 0.15;
      }
    },
    {
      id: 'bless_vitality_dilation',
      name: 'Giãn Nở Sinh Lực',
      rarity: 'Rare',
      icon: '❤️',
      description: 'Tăng 35% Máu tối đa và hồi phục 3% Máu mỗi giây khi Máu tụt dưới 40%.',
      apply: (player) => {
        const oldMax = player.maxHp || 100;
        player.maxHp = Math.floor(oldMax * 1.35);
        player.hp += Math.floor(oldMax * 0.35);
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.lowHealthRegen = true;
      }
    },
    {
      id: 'bless_parry_singularity',
      name: 'Điểm Dị Thường Phản Xạ',
      rarity: 'Rare',
      icon: '🌀',
      description: 'Chém Phản Đạn thành công tạo hố đen nhỏ hút mục tiêu và gây 2.500 sát thương Thời Không.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.parryBlackHole = true;
      }
    },
    {
      id: 'bless_ash_overdrive',
      name: 'Quá Tải Bùng Nổ Tro Tàn',
      rarity: 'Rare',
      icon: '💥',
      description: 'Bùng Nổ Tro Tàn tăng 40% bán kính nổ và gắn hiệu ứng Thiêu Đốt gây sát thương 5% máu quái.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.ashBlastRadiusBuff = (player.passiveEffects.ashBlastRadiusBuff || 1) * 1.4;
        player.passiveEffects.ashBlastBurn = true;
      }
    },
    {
      id: 'bless_arcane_focus',
      name: 'Tụ Tiêu Ma Lực Cổ Đại',
      rarity: 'Rare',
      icon: '🔮',
      description: 'Tỉ lệ Bạo Kích tăng 15%, Sát Thương Bạo Kích tăng thêm 45%.',
      apply: (player) => {
        player.stats = player.stats || {};
        player.stats.critRate = (player.stats.critRate || 0.18) + 0.15;
        player.stats.critDmgMultiplier = (player.stats.critDmgMultiplier || 1.65) + 0.45;
      }
    },
    {
      id: 'bless_magnetic_overload',
      name: 'Quá Tải Từ Trường',
      rarity: 'Rare',
      icon: '🧲',
      description: 'Tự động hút toàn bộ ngọc và tài nguyên trên sàn. Nhặt mỗi ngọc tăng 2% sát thương trong 6s.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.magnetOverload = true;
      }
    },

    // --- EPIC (BẬC TÍM) ---
    {
      id: 'bless_chain_lightning_matrix',
      name: 'Ma Trận Sấm Sét Quá Tải',
      rarity: 'Epic',
      icon: '🌩️',
      description: 'Sấm Sét Lan Truyền nảy thêm 4 mục tiêu và giảm 35% giáp của kẻ thù bị giật.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.extraLightningBounces = 4;
        player.passiveEffects.lightningArmorShred = 0.35;
      }
    },
    {
      id: 'bless_temporal_clone',
      name: 'Ảnh Ảo Không Gian',
      rarity: 'Epic',
      icon: '👥',
      description: 'Mỗi khi Lướt (Dash), để lại một Phân Thân Thời Gian kế thừa 60% chỉ số công kích tồn tại 5s.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.dashSpawnsSuperClone = true;
      }
    },
    {
      id: 'bless_familiar_empowerment',
      name: 'Thần Uy Tinh Linh Hộ Mệnh',
      rarity: 'Epic',
      icon: '🧚',
      description: 'Tinh Linh gây thêm 100% sát thương và định kỳ mỗi 6s hồi phục 15 Khiên cho chủ nhân.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.familiarDamageMultiplier = 2.0;
        player.passiveEffects.familiarHealsShield = true;
      }
    },
    {
      id: 'bless_executioner_momentum',
      name: 'Nhịp Hành Quyết Vô Tận',
      rarity: 'Epic',
      icon: '🪓',
      description: 'Tiêu diệt ngay quái thường dưới 20% máu. Mỗi điểm hạ gục tăng 6% công (cộng dồn 10 lần).',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.executeThreshold = 0.20;
        player.passiveEffects.rampageStack = true;
      }
    },
    {
      id: 'bless_bullet_hell_mastery',
      name: 'Tuyệt Cương Phản Pháo',
      rarity: 'Epic',
      icon: '💫',
      description: 'Đạn phản xạ được khuếch đại lên 400% sát thương chí mạng và xuyên qua mọi kẻ địch trên đường bay.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.parryDamageScale = 4.0;
        player.passiveEffects.parryPenetration = true;
      }
    },

    // --- LEGENDARY (BẬC VÀNG CAM) ---
    {
      id: 'bless_chronos_judgment',
      name: 'Phán Quyết Chronos',
      rarity: 'Legendary',
      icon: '⏳',
      description: 'Mỗi 15 giây, đóng băng toàn bộ thời gian của quái vật trên sàn đấu trong 3 giây.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.autoChronoJudgment = true;
        player.passiveEffects.autoChronoTimer = 15;
      }
    },
    {
      id: 'bless_phoenix_rebirth',
      name: 'Niết Bàn Phượng Hoàng',
      rarity: 'Legendary',
      icon: '🔥',
      description: 'Khi nhận sát thương chí tử, không chết mà phát nổ thiêu rụi sàn đấu, hồi phục 70% Máu (1 lần/lượt).',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.hasPhoenixRebirth = true;
        player.passiveEffects.phoenixUsed = false;
      }
    },
    {
      id: 'bless_unlimited_void_arms',
      name: 'Kho Vũ Khí Vô Hạn Tận',
      rarity: 'Legendary',
      icon: '🗡️',
      description: 'Tốc độ tấn công tăng 50%, số lượng đạn đạo hoặc kiếm khí bắn ra tăng gấp đôi.',
      apply: (player) => {
        player.stats = player.stats || {};
        player.stats.attackSpeedMultiplier = (player.stats.attackSpeedMultiplier || 1.0) + 0.50;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.doubleProjectiles = true;
      }
    },
    {
      id: 'bless_infinite_mana_spring',
      name: 'Suối Nguồn Vũ Trụ',
      rarity: 'Legendary',
      icon: '🌌',
      description: 'Thanh Nộ Thời Không tự động hồi phục 5 điểm mỗi giây. Thi triển kỹ năng hồi phục 10% Khiên.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.passiveRageRegen = 5;
        player.passiveEffects.skillHealsShield = true;
      }
    },
    {
      id: 'bless_curse_eater',
      name: 'Thực Ma Vực Thẳm',
      rarity: 'Legendary',
      icon: '🧿',
      description: 'Mỗi lời nguyền hoặc bùa bất lợi trên quái vật tăng 15% tổng sát thương bạn gây ra lên chúng.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.damagePerDebuff = 0.15;
      }
    },

    // --- DIVINE (BẬC THẦN THOẠI ĐỎ) ---
    {
      id: 'bless_epoch_singularity',
      name: 'Điểm Kỳ Dị Đa Kỷ Nguyên',
      rarity: 'Divine',
      icon: '☸️',
      description: 'Hòa hợp 3 Kỷ Nguyên: Quá Khứ (Hút Máu 15%), Hiện Tại (Bạo Kích +35%), Tương Lai (Vệ Tinh Laser tự bắn).',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.epochSingularity = true;
        player.stats = player.stats || {};
        player.stats.critRate = (player.stats.critRate || 0.18) + 0.35;
      }
    },
    {
      id: 'bless_reality_warp',
      name: 'Bẻ Cong Thực Tại',
      rarity: 'Divine',
      icon: '👁️',
      description: '100% đòn đánh kích hoạt Bùng Nổ Hư Không. Triệt tiêu 100% đạn địch chạm vào người khi đứng yên.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.alwaysVoidExplosion = true;
        player.passiveEffects.stationaryBulletImmunity = true;
      }
    },
    {
      id: 'bless_god_of_speed',
      name: 'Thần Tốc Quang Minh Quy Cực',
      rarity: 'Divine',
      icon: '✨',
      description: 'Né Hoàn Hảo làm chậm quái xung quanh 90% trong 4 giây. Thời gian hồi Dash giảm còn 0.2s.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.superTimeSlowOnDodge = true;
        player.passiveEffects.infiniteDash = true;
      }
    }
  ];

  /**
   * KHO 25 NHIỆM VỤ THỬ THÁCH HẰNG NGÀY (DAILY BOUNTIES POOL)
   */
  const DAILY_BOUNTIES_POOL = [
    {
      id: 'bounty_parry_master',
      title: 'Kiếm Thuật Phản Xạ',
      description: 'Chém phản hồi đạn đạo của kẻ thù 20 lần.',
      icon: '⚔️',
      eventType: 'ON_PARRY_BULLET',
      targetValue: 20,
      reward: { gold: 1200, shards: 15, exp: 800 }
    },
    {
      id: 'bounty_slay_minibosses',
      title: 'Kẻ Săn Quái Thú Kỷ Nguyên',
      description: 'Hạ gục thành công 3 Mini-Boss Kỷ Nguyên.',
      icon: '👹',
      eventType: 'ON_MINIBOSS_KILLED',
      targetValue: 3,
      reward: { gold: 2000, shards: 25, exp: 1500 }
    },
    {
      id: 'bounty_activate_altars',
      title: 'Lời Khẩn Cầu Cổ Xưa',
      description: 'Kích hoạt 3 Đài Cầu Nguyện Nhân Quả.',
      icon: '⛩️',
      eventType: 'ON_ALTAR_ACTIVATED',
      targetValue: 3,
      reward: { gold: 1500, shards: 20, exp: 1000 }
    },
    {
      id: 'bounty_cursed_zone_survival',
      title: 'Vượt Qua Vực Tử Địa',
      description: 'Sống sót tổng cộng 180 giây bên trong Vùng Đất Bị Nguyền Rủa.',
      icon: '☣️',
      eventType: 'ON_CURSED_ZONE_TICK',
      targetValue: 180,
      reward: { gold: 1800, shards: 20, exp: 1200 }
    },
    {
      id: 'bounty_chain_lightning_dmg',
      title: 'Bão Tố Sấm Sét Lan Truyền',
      description: 'Gây tổng cộng 50.000 sát thương bằng Sấm Sét Lan Truyền.',
      icon: '⚡',
      eventType: 'ON_LIGHTNING_DAMAGE_DEALT',
      targetValue: 50000,
      reward: { gold: 2500, shards: 30, exp: 1800 }
    },
    {
      id: 'bounty_perfect_dodges',
      title: 'Bóng Ma Thoát Xác',
      description: 'Thực hiện 25 lần Né Hoàn Hảo (Perfect Dodge).',
      icon: '💨',
      eventType: 'ON_PERFECT_DODGE',
      targetValue: 25,
      reward: { gold: 1400, shards: 18, exp: 900 }
    },
    {
      id: 'bounty_abyss_floor_rush',
      title: 'Chinh Phạt Tầng Sâu',
      description: 'Vượt qua 15 tầng Tháp Vô Tận trong một hoặc nhiều lượt leo.',
      icon: '🗼',
      eventType: 'ON_ABYSS_FLOOR_CLEARED',
      targetValue: 15,
      reward: { gold: 3000, shards: 35, exp: 2200 }
    },
    {
      id: 'bounty_ash_blast_kills',
      title: 'Tro Tàn Diệt Tuyệt',
      description: 'Tiêu diệt 40 kẻ địch bằng sát thương Bùng Nổ Tro Tàn.',
      icon: '💥',
      eventType: 'ON_ASH_BLAST_KILL',
      targetValue: 40,
      reward: { gold: 1600, shards: 20, exp: 1100 }
    },
    {
      id: 'bounty_shield_block_damage',
      title: 'Khiên Bất Hoại',
      description: 'Chặn đứng tổng cộng 30.000 sát thương bằng Khiên Lượng Tử.',
      icon: '🛡️',
      eventType: 'ON_DAMAGE_BLOCKED_BY_SHIELD',
      targetValue: 30000,
      reward: { gold: 2200, shards: 25, exp: 1400 }
    },
    {
      id: 'bounty_ranged_kills',
      title: 'Xạ Thủ Xuyên Không',
      description: 'Hạ gục 50 kẻ thù bằng đòn bắn tầm xa hoặc vũ khí tương lai.',
      icon: '🎯',
      eventType: 'ON_RANGED_KILL',
      targetValue: 50,
      reward: { gold: 1300, shards: 15, exp: 850 }
    },
    {
      id: 'bounty_kill_overlord',
      title: 'Trảm Sát Chúa Tể Thời Không',
      description: 'Đánh bại ít nhất 1 Chúa Tể Thời Không trong Tháp Vô Tận.',
      icon: '👑',
      eventType: 'ON_OVERLORD_KILLED',
      targetValue: 1,
      reward: { gold: 4000, shards: 50, exp: 3000 }
    },
    {
      id: 'bounty_skill_executions',
      title: 'Uy Lực Kỹ Năng Kỷ Nguyên',
      description: 'Thi triển Kỹ Năng Chủ Động hoặc Tối Thượng 35 lần.',
      icon: '🔮',
      eventType: 'ON_SKILL_CAST',
      targetValue: 35,
      reward: { gold: 1250, shards: 15, exp: 750 }
    },
    {
      id: 'bounty_familiar_damage',
      title: 'Sức Mạnh Linh Hồn Hộ Trợ',
      description: 'Để Tinh Linh gây ra tổng cộng 20.000 sát thương.',
      icon: '🧚',
      eventType: 'ON_FAMILIAR_DAMAGE_DEALT',
      targetValue: 20000,
      reward: { gold: 1750, shards: 22, exp: 1150 }
    },
    {
      id: 'bounty_melee_combo_strikes',
      title: 'Bão Tố Kiếm Vũ',
      description: 'Đạt chuỗi Combo cận chiến chạm mốc 50 hits 3 lần.',
      icon: '🗡️',
      eventType: 'ON_COMBO_50_REACHED',
      targetValue: 3,
      reward: { gold: 2000, shards: 25, exp: 1300 }
    },
    {
      id: 'bounty_collect_shards',
      title: 'Thu Thập Mảnh Thời Không',
      description: 'Thu nhặt tổng cộng 30 Mảnh Thời Không (💎) rơi trong chiến trường.',
      icon: '💎',
      eventType: 'ON_SHARD_LOOTED',
      targetValue: 30,
      reward: { gold: 2400, shards: 30, exp: 1600 }
    },
    {
      id: 'bounty_speedrun_floor',
      title: 'Tốc Chiến Tốc Thắng',
      description: 'Dọn sạch một tầng Tháp Vô Tận trong thời gian dưới 25 giây 2 lần.',
      icon: '⏱️',
      eventType: 'ON_FLOOR_SPEEDRUN_SUCCESS',
      targetValue: 2,
      reward: { gold: 2800, shards: 35, exp: 1900 }
    },
    {
      id: 'bounty_void_portal_destroy',
      title: 'Vá Lỗ Hổng Hư Không',
      description: 'Tiêu diệt 4 quái vật tinh anh thuộc Kỷ Nguyên Hư Không.',
      icon: '🕳️',
      eventType: 'ON_VOID_MOB_KILLED',
      targetValue: 4,
      reward: { gold: 2100, shards: 25, exp: 1450 }
    },
    {
      id: 'bounty_slay_elite_mobs',
      title: 'Huyết Chiến Tinh Anh',
      description: 'Hạ gục 12 quái vật Tinh Anh mang từ 2 Affixes trở lên.',
      icon: '🔱',
      eventType: 'ON_ELITE_KILLED',
      targetValue: 12,
      reward: { gold: 2600, shards: 30, exp: 1700 }
    },
    {
      id: 'bounty_critical_strikes',
      title: 'Điểm Chết Bạo Phát',
      description: 'Gây ra 80 đòn đánh Bạo Kích (Critical Hit) lên kẻ thù.',
      icon: '💢',
      eventType: 'ON_CRIT_HIT',
      targetValue: 80,
      reward: { gold: 1500, shards: 18, exp: 950 }
    },
    {
      id: 'bounty_flawless_floor',
      title: 'Thân Pháp Vô Vết',
      description: 'Hoàn thành 1 tầng Tháp Vô Tận mà không mất giọt máu nào.',
      icon: '🛡️',
      eventType: 'ON_FLAWLESS_FLOOR',
      targetValue: 1,
      reward: { gold: 3500, shards: 45, exp: 2500 }
    },
    {
      id: 'bounty_spend_gold_shop',
      title: 'Đầu Tư Kỷ Nguyên',
      description: 'Tiêu xài ít nhất 5.000 Vàng tại Cửa Hàng Thời Không.',
      icon: '💰',
      eventType: 'ON_GOLD_SPENT',
      targetValue: 5000,
      reward: { gold: 1000, shards: 40, exp: 1200 }
    },
    {
      id: 'bounty_freeze_enemies',
      title: 'Đông Cứng Thời Gian',
      description: 'Làm chậm hoặc đóng băng kẻ địch tổng cộng 60 lần.',
      icon: '❄️',
      eventType: 'ON_ENEMY_FROZEN',
      targetValue: 60,
      reward: { gold: 1700, shards: 20, exp: 1050 }
    },
    {
      id: 'bounty_past_era_purify',
      title: 'Thanh Tẩy Kỷ Quá Khứ',
      description: 'Hạ gục 50 quái vật thuộc Kỷ Nguyên Quá Khứ.',
      icon: '🦖',
      eventType: 'ON_PAST_MOB_KILLED',
      targetValue: 50,
      reward: { gold: 1900, shards: 22, exp: 1250 }
    },
    {
      id: 'bounty_future_mech_destroy',
      title: 'Hủy Diệt Cỗ Máy Tương Lai',
      description: 'Hạ gục 50 cỗ máy Cyber hoặc Drone thuộc Kỷ Nguyên Tương Lai.',
      icon: '🤖',
      eventType: 'ON_FUTURE_MOB_KILLED',
      targetValue: 50,
      reward: { gold: 1900, shards: 22, exp: 1250 }
    },
    {
      id: 'bounty_high_blessing_find',
      title: 'Phước Lành Vĩ Đại',
      description: 'Chọn được ít nhất 1 Bùa Lợi bậc Legendary hoặc Divine.',
      icon: '🌟',
      eventType: 'ON_HIGH_BLESSING_CHOSEN',
      targetValue: 1,
      reward: { gold: 3000, shards: 40, exp: 2000 }
    }
  ];

  /**
   * DANH SÁCH QUÁI AFFIXES ĐỘT BIẾN NGẪU NHIÊN
   */
  const ABYSS_MOB_AFFIXES = [
    { id: 'vampiric', name: 'Hút Máu', color: '#ff3333', apply: (m) => { m.damage = Math.round(m.damage * 1.15); m.lifeSteal = 0.25; } },
    { id: 'swift', name: 'Thần Tốc', color: '#ffea00', apply: (m) => { m.speed = Math.round(m.speed * 1.35); } },
    { id: 'shielded', name: 'Khiên Cứng', color: '#00d0ff', apply: (m) => { m.isTanker = true; m.shieldActive = true; } },
    { id: 'explosive', name: 'Tử Bộc', color: '#ff7700', apply: (m) => { m.kamikazeActive = true; m.kamikazeMaxTimer = 2.0; } },
    { id: 'berserker', name: 'Cuồng Nộ', color: '#d500f9', apply: (m) => { m.damage = Math.round(m.damage * 1.3); m.maxHp = Math.round(m.maxHp * 1.2); } },
    { id: 'teleporter', name: 'Dịch Chuyển', color: '#00e676', apply: (m) => { m.canEvade = true; } },
    { id: 'bullet_spammer', name: 'Đạn Vũ Môn', color: '#ff1744', apply: (m) => { m.shootCd = Math.max(0.6, (m.shootCd || 1.5) * 0.5); } },
    { id: 'void_touched', name: 'Nhiễm Hư Không', color: '#7c4dff', apply: (m) => { m.timeline = 'ALL'; m.maxHp = Math.round(m.maxHp * 1.4); } }
  ];

  /**
   * ==========================================================================
   * CLASS CHÍNH: AbyssAndBountiesManager
   * ==========================================================================
   */
  class AbyssAndBountiesManager {
    constructor() {
      // Trạng thái vận hành Endless Abyss
      this.abyssState = {
        isActive: false,
        currentFloor: 1,
        floorTimer: 0,
        floorTimeLimit: ABYSS_CONSTANTS.BASE_FLOOR_TIME_SECONDS,
        mobsRemaining: 0,
        totalMobsSpawned: 0,
        currentEra: 'PAST',
        activeAffixes: [],
        chosenBlessings: [],
        pendingBlessingPicks: [],
        isBossFloor: false,
        isMiniBossFloor: false,
        floorDamageTaken: 0,
        runStartTime: 0,
        totalGoldAccumulated: 0,
        totalShardsAccumulated: 0,
        totalExpAccumulated: 0
      };

      // Trạng thái Leaderboard
      this.leaderboardData = {
        combatPowerList: [],
        abyssFloorList: [],
        activeTab: 'abyss',
        isFetching: false,
        lastFetchTimestamp: 0
      };

      // Trạng thái Daily Bounties
      this.dailyBountiesState = {
        currentDateKey: '',
        activeBounties: [],
        listenersBound: false
      };

      // Trạng thái Combat Recap
      this.combatRecap = {
        totalDamageDealt: 0,
        damageBreakdown: {
          melee: 0,
          ranged: 0,
          skill: 0,
          chainLightning: 0,
          ashBlast: 0,
          familiar: 0,
          parryCounter: 0,
          passiveAura: 0
        },
        damageTaken: 0,
        damageBlockedByShield: 0,
        bulletsParried: 0,
        perfectDodges: 0,
        totalKills: 0,
        killsByTier: {
          normal: 0,
          elite: 0,
          miniboss: 0,
          overlord: 0
        },
        dpsTimeline: [],
        sliceTimer: 0,
        sliceDamageAccumulator: 0,
        cycleStartTime: 0,
        cycleDurationSeconds: 0
      };

      this.db = null;
    }

    /**
     * KHỞI TẠO TỔNG THỂ HỆ THỐNG
     */
    init() {
      console.log('%c[Chrono Traveler] Khởi tạo Abyss & Bounties Systems...', 'color: #00ffff; font-weight: bold;');
      
      this._hookIntoCombatEngine();
      this._hookIntoEnemiesEngine();
      this._initDailyBounties();
      this._bridgeWithGameSystems();
      this._injectCustomStyles();

      // Kiểm tra liên kết Firebase Realtime DB
      if (window.firebase && window.firebase.database) {
        try {
          this.db = window.firebase.database();
          console.log('%c[LiveOps] Firebase Database kết nối thành công!', 'color: #00ff88;');
        } catch (e) {
          console.warn('[LiveOps] Firebase chưa được config hoặc offline:', e);
        }
      }
    }

    /**
     * ========================================================================
     * PHẦN 1: HỆ THỐNG LEO THÁP VÔ TẬN (ENDLESS ABYSS MODE 1 - 9999+)
     * ========================================================================
     */

    /**
     * Bắt đầu một lượt leo tháp mới
     * @param {number} startFloor Tầng bắt đầu (Mặc định: 1 hoặc checkpoint đã lưu)
     */
    startAbyssRun(startFloor = 1) {
      const state = window.Game.state;
      const player = window.Game.player;

      if (!player || player.hp <= 0) {
        if (window.Game.UI && window.Game.UI.showToast) {
          window.Game.UI.showToast('⚠️ Nhân vật chưa sẵn sàng để leo tháp!');
        }
        return;
      }

      // 1. Mở khóa Game Loop & giải phóng toàn bộ input đang giữ
      if (state) state.isPaused = false;
      if (window.Game.Controls && typeof window.Game.Controls.releaseAllInputs === 'function') {
        window.Game.Controls.releaseAllInputs();
      }

      // 2. Dịch chuyển nhân vật về vị trí trung tâm sàn đấu
      player.x = 1920;
      player.y = 2020;
      player.vx = 0;
      player.vy = 0;

      this.abyssState.isActive = true;
      this.abyssState.currentFloor = Math.max(1, Math.min(startFloor, ABYSS_CONSTANTS.MAX_FLOOR_CAP));
      this.abyssState.chosenBlessings = [];
      this.abyssState.runStartTime = Date.now();
      this.abyssState.totalGoldAccumulated = 0;
      this.abyssState.totalShardsAccumulated = 0;
      this.abyssState.totalExpAccumulated = 0;

      // Đặt lại bộ đo Combat Recap cho lượt này
      this.resetCombatRecap();

      console.log(`%c[Abyss] Bắt đầu leo Tháp Vô Tận - Tầng ${this.abyssState.currentFloor}`, 'color: #ffd700; font-weight: bold;');
      if (window.Game.UI && window.Game.UI.showToast) {
        window.Game.UI.showToast(`🌀 BẮT ĐẦU VỰC THẲM VÔ TẬN - TẦNG ${this.abyssState.currentFloor}!`);
      }

      this._loadFloor(this.abyssState.currentFloor);
    }

    /**
     * Tải và thiết lập tầng tháp với Scale chỉ số toán học
     */
    _loadFloor(floor) {
      this.abyssState.floorDamageTaken = 0;
      this.abyssState.isBossFloor = (floor % ABYSS_CONSTANTS.OVERLORD_INTERVAL === 0);
      this.abyssState.isMiniBossFloor = (!this.abyssState.isBossFloor && floor % ABYSS_CONSTANTS.MINI_BOSS_INTERVAL === 0);

      // Luân chuyển Kỷ Nguyên theo tầng
      if (floor % 10 <= 3) {
        this.abyssState.currentEra = 'PAST';
      } else if (floor % 10 <= 6) {
        this.abyssState.currentEra = 'PRESENT';
      } else if (floor % 10 <= 9) {
        this.abyssState.currentEra = 'FUTURE';
      } else {
        this.abyssState.currentEra = 'VOID';
      }

      // Ép Kỷ nguyên đồng bộ trực tiếp, xóa Cooldown để quái không bị ẩn
      const eraTarget = this.abyssState.currentEra === 'VOID' ? 'PRESENT' : this.abyssState.currentEra;
      if (window.Game.state) {
        window.Game.state.timeline = eraTarget;
        window.Game.state.timeShiftCooldown = 0;
      }
      if (window.Game.World && typeof window.Game.World.setEra === 'function') {
        window.Game.World.setEra(eraTarget);
      } else if (window.Game.Systems && typeof window.Game.Systems.switchTimeline === 'function') {
        window.Game.Systems.switchTimeline(eraTarget);
      }

      // Giới hạn thời gian tầng: Giảm phi tuyến tính theo độ sâu, tối thiểu 35s
      this.abyssState.floorTimeLimit = Math.max(
        ABYSS_CONSTANTS.MIN_FLOOR_TIME_SECONDS,
        Math.round(ABYSS_CONSTANTS.BASE_FLOOR_TIME_SECONDS - Math.pow(floor, 0.42) * 5)
      );
      this.abyssState.floorTimer = this.abyssState.floorTimeLimit;

      // Sinh Affixes ngẫu nhiên theo bậc thang độ sâu
      this.abyssState.activeAffixes = this._rollFloorAffixes(floor);

      // Sinh quái vật và tiêm vào Game.Enemies.list
      this._generateAndInjectAbyssEnemies(floor);

      // Cập nhật giao diện HUD nếu có
      this._renderAbyssFloorHUD();
    }

    /**
     * Bốc ngẫu nhiên số lượng Affixes tùy theo độ sâu của tầng
     */
    _rollFloorAffixes(floor) {
      if (floor < 4) return [];

      let count = 1;
      if (floor >= 15) count = 2;
      if (floor >= 35) count = 3;
      if (floor >= 70) count = 4;
      if (floor >= 150) count = 5;

      const shuffled = [...ABYSS_MOB_AFFIXES].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    }

    /**
     * BỘ MÁY DYNAMIC SPAWNER: TIÊM TRỰC TIẾP QUÁI VẬT VÀO Game.Enemies.list
     */
    _generateAndInjectAbyssEnemies(floor) {
      const enemiesEngine = window.Game.Enemies;
      if (!enemiesEngine || !Array.isArray(enemiesEngine.list)) {
        console.error('[Abyss] Không tìm thấy Game.Enemies.list!');
        return;
      }

      // 1. Dọn dẹp quái cũ trên sàn
      enemiesEngine.list = [];
      if (Array.isArray(enemiesEngine.projectiles)) enemiesEngine.projectiles = [];
      if (Array.isArray(enemiesEngine.telegraphs)) enemiesEngine.telegraphs = [];

      // 2. CÔNG THỨC SCALE TOÁN HỌC PHI TUYẾN TÍNH (1 -> 9999+)
      const hpMultiplier = 1 + (0.18 * floor) + (0.0022 * Math.pow(floor, 1.72));
      const dmgMultiplier = 1 + (0.12 * floor) + (0.0014 * Math.pow(floor, 1.48));
      const speedMultiplier = Math.min(1.70, 1 + (0.006 * floor));

      const centerSpawnX = 1920;
      const centerSpawnY = 1920;
      let totalSpawned = 0;

      if (this.abyssState.isBossFloor) {
        // --- TẦNG CHÚA TỂ THỜI KHÔNG (OVERLORD) ---
        const overlordHp = Math.round(28000 * hpMultiplier);
        const overlordDmg = Math.round(48 * dmgMultiplier);

        const overlord = {
          id: `abyss_overlord_f${floor}`,
          timeline: 'ALL',
          type: 'boss',
          subType: 'boss',
          role: 'boss',
          baseName: `Chúa Tể Thời Không (Tầng ${floor})`,
          name: `Chúa Tể Thời Không (Tầng ${floor})`,
          isBoss: true,
          isMiniBoss: false,
          isElite: true,
          isTanker: false,
          isKiter: false,
          x: centerSpawnX,
          y: centerSpawnY - 250,
          spawnX: centerSpawnX,
          spawnY: centerSpawnY - 250,
          baseHp: overlordHp,
          hp: overlordHp,
          maxHp: overlordHp,
          baseSpeed: Math.round(115 * speedMultiplier),
          speed: Math.round(115 * speedMultiplier),
          baseRadius: 52,
          radius: 52,
          baseDamage: overlordDmg,
          damage: overlordDmg,
          baseGoldReward: 1500,
          goldReward: Math.round(1500 * (1 + floor * 0.1)),
          baseExpReward: 800,
          expReward: Math.round(800 * (1 + floor * 0.08)),
          shieldTimeline: this.abyssState.currentEra === 'VOID' ? 'PRESENT' : this.abyssState.currentEra,
          nextShieldTimeline: null,
          phaseShiftTimer: 7.0,
          phaseShiftWarningActive: false,
          shatterAvailable: true,
          stunTimer: 0,
          spiralOffset: 0,
          shootCd: 1.2,
          radialCd: 2.5,
          dashCd: 4.8,
          isDashing: false,
          dashTimer: 0,
          satelliteAngle: 0,
          phase: floor >= 30 ? 3 : 2,
          dead: false,
          respawnTimer: 0,
          facingAngle: Math.PI / 2
        };

        this.abyssState.activeAffixes.forEach(affix => affix.apply(overlord));
        enemiesEngine.list.push(overlord);
        totalSpawned = 1;

        if (floor >= 20) {
          for (let k = 0; k < 2; k++) {
            const addMob = this._createScaledMobEntity(
              `abyss_boss_add_${k}`,
              centerSpawnX + (k === 0 ? -180 : 180),
              centerSpawnY - 150,
              'elite',
              hpMultiplier * 0.45,
              dmgMultiplier * 0.55,
              speedMultiplier
            );
            enemiesEngine.list.push(addMob);
            totalSpawned++;
          }
        }
      } else if (this.abyssState.isMiniBossFloor) {
        // --- TẦNG MINI-BOSS KỶ NGUYÊN ---
        const miniBossNames = {
          PAST: 'Cự Thạch Hộ Pháp (Vực Thẳm)',
          PRESENT: 'Mẫu Hoàng Độc Tố (Vực Thẳm)',
          FUTURE: 'Chiến Giáp Phản Quang (Vực Thẳm)',
          VOID: 'Dị Nhân Hư Không (Vực Thẳm)'
        };

        const mbHp = Math.round(3500 * hpMultiplier);
        const mbDmg = Math.round(38 * dmgMultiplier);

        const miniBoss = {
          id: `abyss_miniboss_f${floor}`,
          timeline: this.abyssState.currentEra === 'VOID' ? 'PRESENT' : this.abyssState.currentEra,
          type: this.abyssState.currentEra === 'PAST' ? 'ancient' : this.abyssState.currentEra === 'PRESENT' ? 'mutant' : 'robot',
          subType: this.abyssState.currentEra === 'PAST' ? 'ancient_miniboss' : this.abyssState.currentEra === 'PRESENT' ? 'mutant_miniboss' : 'robot_miniboss',
          role: 'miniboss',
          baseName: miniBossNames[this.abyssState.currentEra] || 'Hộ Vệ Vực Thẳm',
          name: miniBossNames[this.abyssState.currentEra] || 'Hộ Vệ Vực Thẳm',
          isBoss: false,
          isMiniBoss: true,
          isElite: true,
          isTanker: false,
          isKiter: false,
          x: centerSpawnX,
          y: centerSpawnY - 200,
          spawnX: centerSpawnX,
          spawnY: centerSpawnY - 200,
          baseHp: mbHp,
          hp: mbHp,
          maxHp: mbHp,
          baseSpeed: Math.round(110 * speedMultiplier),
          speed: Math.round(110 * speedMultiplier),
          baseRadius: 36,
          radius: 36,
          baseDamage: mbDmg,
          damage: mbDmg,
          baseGoldReward: 500,
          goldReward: Math.round(500 * (1 + floor * 0.08)),
          baseExpReward: 300,
          expReward: Math.round(300 * (1 + floor * 0.06)),
          slamComboCd: 4.0,
          acidBarrageCd: 2.2,
          summonBroodCd: 8.0,
          mirrorShieldActive: false,
          mirrorShieldTimer: 0,
          mirrorShieldCd: 4.5,
          dead: false,
          respawnTimer: 0,
          facingAngle: Math.PI / 2
        };

        this.abyssState.activeAffixes.forEach(affix => affix.apply(miniBoss));
        enemiesEngine.list.push(miniBoss);
        totalSpawned = 1;

        const escortCount = Math.min(6, 2 + Math.floor(floor / 8));
        for (let i = 0; i < escortCount; i++) {
          const angle = (i * Math.PI * 2) / escortCount;
          const ex = centerSpawnX + Math.cos(angle) * 220;
          const ey = centerSpawnY + Math.sin(angle) * 220;
          const escortMob = this._createScaledMobEntity(`abyss_escort_${i}`, ex, ey, 'elite', hpMultiplier * 0.5, dmgMultiplier * 0.65, speedMultiplier);
          enemiesEngine.list.push(escortMob);
          totalSpawned++;
        }
      } else {
        // --- TẦNG TIÊU CHUẨN ---
        const mobCount = Math.min(32, 8 + Math.floor(floor * 0.65));
        const eliteChance = Math.min(0.55, 0.15 + (floor * 0.006));

        for (let i = 0; i < mobCount; i++) {
          const isElite = Math.random() < eliteChance;
          const spawnRadius = 180 + Math.random() * 280;
          const angle = (i * Math.PI * 2) / mobCount + (Math.random() - 0.5) * 0.3;
          const mx = centerSpawnX + Math.cos(angle) * spawnRadius;
          const my = centerSpawnY + Math.sin(angle) * spawnRadius;

          const mob = this._createScaledMobEntity(
            `abyss_mob_f${floor}_${i}`,
            mx,
            my,
            isElite ? 'elite' : 'normal',
            hpMultiplier * (isElite ? 2.4 : 1.0),
            dmgMultiplier * (isElite ? 1.5 : 1.0),
            speedMultiplier
          );
          enemiesEngine.list.push(mob);
          totalSpawned++;
        }
      }

      this.abyssState.mobsRemaining = totalSpawned;
      this.abyssState.totalMobsSpawned = totalSpawned;
    }

    _createScaledMobEntity(id, x, y, tier, hpMult, dmgMult, spdMult) {
      const era = this.abyssState.currentEra === 'VOID' ? 'PRESENT' : this.abyssState.currentEra;
      let baseHp = 160;
      let baseDmg = 20;
      let baseSpeed = 135;
      let baseRadius = 18;
      let subType = 'goblin';
      let role = 'melee';
      let name = 'Quái Vật Vực Thẳm';

      if (era === 'PAST') {
        subType = Math.random() < 0.4 ? 'golem' : 'shaman';
        role = subType === 'golem' ? 'tanker' : 'kiter';
        baseHp = subType === 'golem' ? 320 : 110;
        baseRadius = subType === 'golem' ? 26 : 18;
        name = subType === 'golem' ? 'Golem Đá Vực Thẳm' : 'Pháp Sư Cổ Đại Vực Thẳm';
      } else if (era === 'FUTURE') {
        subType = Math.random() < 0.4 ? 'shield_robot' : 'sniper_robot';
        role = subType === 'shield_robot' ? 'tanker' : 'kiter';
        baseHp = subType === 'shield_robot' ? 340 : 120;
        baseRadius = subType === 'shield_robot' ? 25 : 18;
        name = subType === 'shield_robot' ? 'Robot Khiên Vực Thẳm' : 'Xạ Thủ Cyber Vực Thẳm';
      } else {
        subType = 'mutant';
        role = 'melee';
        baseHp = 180;
        name = 'Dị Nhân Đột Biến Vực Thẳm';
      }

      const isElite = (tier === 'elite');
      const finalHp = Math.round(baseHp * hpMult);
      const finalDmg = Math.round(baseDmg * dmgMult);
      const finalSpeed = Math.round(baseSpeed * spdMult);

      const entity = {
        id: id,
        timeline: era,
        type: era === 'PAST' ? 'ancient' : era === 'FUTURE' ? 'robot' : 'mutant',
        subType: subType,
        role: role,
        baseName: name,
        name: isElite ? `[TINH ANH] ${name}` : name,
        isBoss: false,
        isMiniBoss: false,
        isElite: isElite,
        isTanker: role === 'tanker',
        isKiter: role === 'kiter',
        x: x,
        y: y,
        spawnX: x,
        spawnY: y,
        baseHp: finalHp,
        hp: finalHp,
        maxHp: finalHp,
        baseSpeed: finalSpeed,
        speed: finalSpeed,
        baseRadius: isElite ? Math.round(baseRadius * 1.3) : baseRadius,
        radius: isElite ? Math.round(baseRadius * 1.3) : baseRadius,
        baseDamage: finalDmg,
        damage: finalDmg,
        goldReward: Math.round((isElite ? 75 : 35) * (1 + this.abyssState.currentFloor * 0.05)),
        expReward: Math.round((isElite ? 55 : 25) * (1 + this.abyssState.currentFloor * 0.04)),
        attackCd: 0,
        shootCd: 1.2,
        healCd: 3.0,
        groundSlamCd: 0,
        shieldActive: role === 'tanker',
        kamikazeActive: false,
        kamikazeTimer: 0,
        freezeTimer: 0,
        burnTimer: 0,
        hitFlash: 0,
        dead: false,
        respawnTimer: 0,
        facingAngle: 0
      };

      if (isElite) {
        this.abyssState.activeAffixes.forEach(affix => affix.apply(entity));
      }

      return entity;
    }

    /**
     * Bổ sung hàm xử lý sự kiện tiêu diệt quái vật từ Game.Systems để chống văng Game Loop
     */
    onEnemyKilledInAbyss(data) {
      if (!this.abyssState.isActive) return;

      const tier = data?.tier || 'normal';
      if (tier === 'overlord') {
        this.triggerBountyEvent('ON_OVERLORD_KILLED', 1);
      } else if (tier === 'miniboss') {
        this.triggerBountyEvent('ON_MINIBOSS_KILLED', 1);
      } else if (tier === 'elite') {
        this.triggerBountyEvent('ON_ELITE_KILLED', 1);
      }
    }

    /**
     * Vòng lặp Frame: Cập nhật đếm ngược thời gian tầng & điều kiện vượt ải
     */
    update(deltaTime) {
      if (!this.abyssState.isActive) return;

      const dt = typeof deltaTime === 'number' ? deltaTime : 0.016;

      this.abyssState.floorTimer -= dt;
      this._updateRecapTimelineTick(dt);

      if (this.abyssState.floorTimer <= 0) {
        this._handleFloorFailure('Hết thời gian vượt tầng!');
        return;
      }

      const player = window.Game.player;
      if (player && player.hp <= 0) {
        this._handleFloorFailure('Nhân vật tử trận!');
        return;
      }

      const enemiesEngine = window.Game.Enemies;
      if (enemiesEngine && Array.isArray(enemiesEngine.list)) {
        let aliveCount = 0;
        for (let i = 0; i < enemiesEngine.list.length; i++) {
          const e = enemiesEngine.list[i];
          if (e && !e.dead && e.hp > 0) aliveCount++;
        }
        this.abyssState.mobsRemaining = aliveCount;

        if (aliveCount === 0 && this.abyssState.totalMobsSpawned > 0) {
          this._handleFloorSuccess();
        }
      }
    }

    _handleFloorSuccess() {
      const currentFloor = this.abyssState.currentFloor;
      const timeSpent = this.abyssState.floorTimeLimit - this.abyssState.floorTimer;

      console.log(`%c[Abyss] Vượt Tầng ${currentFloor} thành công (${timeSpent.toFixed(1)}s)!`, 'color: #00ff88; font-weight: bold;');

      if (timeSpent < 25) {
        this.triggerBountyEvent('ON_FLOOR_SPEEDRUN_SUCCESS', 1);
      }

      if (this.abyssState.floorDamageTaken === 0) {
        this.triggerBountyEvent('ON_FLAWLESS_FLOOR', 1);
      }

      this.triggerBountyEvent('ON_ABYSS_FLOOR_CLEARED', 1);

      const rewards = this._calculateFloorRewards(currentFloor);
      this._distributeFloorRewards(rewards);
      this._updateMaxFloorRecord(currentFloor);

      if (currentFloor % ABYSS_CONSTANTS.BLESSING_INTERVAL === 0) {
        this._prepareBlessingSelection(currentFloor);
      } else {
        if (window.Game.UI && window.Game.UI.showToast) {
          window.Game.UI.showToast(`✨ VƯỢT TẦNG ${currentFloor}! Chuẩn bị sang Tầng ${currentFloor + 1}...`);
        }
        this._scheduleNextFloor(1.8);
      }
    }

    _calculateFloorRewards(floor) {
      const mult = 1 + (floor * 0.12);
      const gold = Math.floor(ABYSS_CONSTANTS.BASE_GOLD_REWARD * mult);
      const shards = Math.floor(ABYSS_CONSTANTS.BASE_SHARD_REWARD * (1 + floor * 0.08)) + (floor % 10 === 0 ? 30 : 0);
      const exp = Math.floor(ABYSS_CONSTANTS.BASE_EXP_REWARD * mult);

      return { gold, shards, exp };
    }

    _distributeFloorRewards(rewards) {
      const state = window.Game.state;
      if (!state) return;

      state.gold = (state.gold || 0) + rewards.gold;
      state.timeShards = (state.timeShards || 0) + rewards.shards;
      if (window.Game.Systems && typeof window.Game.Systems.addExp === 'function') {
        window.Game.Systems.addExp(rewards.exp);
      }

      this.abyssState.totalGoldAccumulated += rewards.gold;
      this.abyssState.totalShardsAccumulated += rewards.shards;
      this.abyssState.totalExpAccumulated += rewards.exp;

      this.triggerBountyEvent('ON_SHARD_LOOTED', rewards.shards);
    }

    _updateMaxFloorRecord(floor) {
      const state = window.Game.state;
      if (!state) return;

      const prevMax = state.maxAbyssFloor || 1;
      if (floor > prevMax) {
        state.maxAbyssFloor = floor;
        localStorage.setItem('chrono_max_abyss_floor', floor.toString());

        const highEl = document.getElementById('abyss-highest-floor');
        if (highEl) highEl.textContent = `Tầng ${floor}`;

        this.syncPlayerScoreToFirebase();
      }
    }

    _prepareBlessingSelection(floor) {
      const weights = {
        Common: Math.max(12, 60 - floor * 0.75),
        Rare: Math.min(38, 25 + floor * 0.35),
        Epic: Math.min(32, 10 + floor * 0.30),
        Legendary: Math.min(16, 4 + floor * 0.12),
        Divine: Math.min(8, 1 + floor * 0.06)
      };

      const pool = [...TEMPORAL_BLESSINGS_POOL];
      const selected = [];

      while (selected.length < 3 && pool.length > 0) {
        const pickedRarity = this._rollRarityByWeight(weights);
        const candidates = pool.filter(b => b.rarity === pickedRarity);

        if (candidates.length > 0) {
          const randIdx = Math.floor(Math.random() * candidates.length);
          const picked = candidates[randIdx];
          selected.push(picked);
          const idxInPool = pool.findIndex(b => b.id === picked.id);
          if (idxInPool > -1) pool.splice(idxInPool, 1);
        } else {
          const randIdx = Math.floor(Math.random() * pool.length);
          selected.push(pool.splice(randIdx, 1)[0]);
        }
      }

      this.abyssState.pendingBlessingPicks = selected;
      this._renderBlessingSelectionModal(selected);
    }

    _rollRarityByWeight(weights) {
      const total = weights.Common + weights.Rare + weights.Epic + weights.Legendary + weights.Divine;
      let rand = Math.random() * total;
      for (const [rarity, weight] of Object.entries(weights)) {
        if (rand < weight) return rarity;
        rand -= weight;
      }
      return 'Common';
    }

    _renderBlessingSelectionModal(blessings) {
      let modal = document.getElementById('abyss-blessing-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'abyss-blessing-modal';
        modal.className = 'abyss-modal-overlay';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="blessing-container">
          <div class="blessing-header">
            <h2>✨ TIẾP NHẬN PHƯỚC LÀNH THỜI KHÔNG ✨</h2>
            <p>Vượt qua Tầng ${this.abyssState.currentFloor}! Hãy chọn 1 Bùa Lợi Thời Không để cường hóa sức mạnh:</p>
          </div>
          <div class="blessing-cards-grid">
            ${blessings.map((b, idx) => `
              <div class="blessing-card rarity-${b.rarity.toLowerCase()}" data-pick-index="${idx}">
                <div class="blessing-rarity-badge">${b.rarity.toUpperCase()}</div>
                <div class="blessing-icon">${b.icon}</div>
                <div class="blessing-title">${b.name}</div>
                <div class="blessing-desc">${b.description}</div>
                <button type="button" class="blessing-pick-btn" data-btn-idx="${idx}">HẤP THỤ</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      modal.style.display = 'flex';

      const buttons = modal.querySelectorAll('.blessing-pick-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const pickIdx = parseInt(e.target.getAttribute('data-btn-idx'), 10);
          this.applySelectedBlessing(pickIdx);
          modal.style.display = 'none';
        });
      });
    }

    applySelectedBlessing(index) {
      const blessing = this.abyssState.pendingBlessingPicks[index];
      if (!blessing) return;

      const player = window.Game.player;
      if (!player) return;

      blessing.apply(player, this.abyssState.currentFloor);
      this.abyssState.chosenBlessings.push(blessing);

      console.log(`%c[Abyss] Đã hấp thụ: [${blessing.rarity}] ${blessing.name}`, 'color: #ffaa00; font-weight: bold;');
      if (window.Game.UI && window.Game.UI.showToast) {
        window.Game.UI.showToast(`✨ HẤP THỤ THÀNH CÔNG: [${blessing.rarity}] ${blessing.name}!`);
      }

      if (blessing.rarity === 'Legendary' || blessing.rarity === 'Divine') {
        this.triggerBountyEvent('ON_HIGH_BLESSING_CHOSEN', 1);
      }

      this._scheduleNextFloor(1.5);
    }

    _scheduleNextFloor(delaySeconds) {
      setTimeout(() => {
        if (!this.abyssState.isActive) return;
        this.abyssState.currentFloor++;
        this._loadFloor(this.abyssState.currentFloor);
      }, delaySeconds * 1000);
    }

    _handleFloorFailure(reason) {
      console.warn(`%c[Abyss] Kết thúc leo tháp tại Tầng ${this.abyssState.currentFloor}: ${reason}`, 'color: #ff3333; font-weight: bold;');
      this.abyssState.isActive = false;

      this.finalizeCombatRecap();

      if (window.Game.UI && window.Game.UI.showToast) {
        window.Game.UI.showToast(`💀 KẾT THÚC LƯỢT LEO THÁP: ${reason}`);
      }

      this.openCombatRecapModal();
    }

    /**
     * ========================================================================
     * PHẦN 2: BẢNG XẾP HẠNG CHIẾN LỰC & THÁP VÔ TẬN TRỰC TUYẾN
     * ========================================================================
     */
    calculateCombatPower() {
      const state = window.Game.state || {};
      const player = window.Game.player || {};
      const combat = window.Game.Combat || {};

      const maxHp = player.maxHp || 100;
      const maxShield = player.maxShield || 50;
      const hpPower = maxHp * 2.8;
      const shieldPower = maxShield * 3.5;

      const weaponKey = state.currentWeapon || 'iron_sword';
      const weaponCfg = (combat.weapons && combat.weapons[weaponKey]) ? combat.weapons[weaponKey] : { damage: 25 };
      const weaponLvl = (state.weaponLevels && state.weaponLevels[weaponKey]) || 0;
      const baseDmg = (weaponCfg.damage + (player.baseDamageBonus || 0)) * (1 + weaponLvl * 0.12);
      const critRate = (player.stats && player.stats.critRate) || 0.18;
      const critDmg = (player.stats && player.stats.critDmgMultiplier) || 1.65;
      const offensivePower = (baseDmg * 24.0) * (1 + (critRate * critDmg));

      const speed = player.speed || player.baseSpeed || 240;
      const speedPower = (speed - 200) * 8.5;
      let relicPower = 0;
      if (Array.isArray(state.equippedRelics)) {
        relicPower = state.equippedRelics.length * 1500;
      }

      const levelPower = (state.level || 1) * 950;
      const floorPower = (state.maxAbyssFloor || 1) * 650;

      const totalPower = Math.floor(hpPower + shieldPower + offensivePower + speedPower + relicPower + levelPower + floorPower);
      state.combatPower = Math.max(1000, totalPower);

      const cpEl = document.getElementById('combat-power-text');
      if (cpEl) cpEl.textContent = state.combatPower.toLocaleString();
      const shopCpEl = document.getElementById('shop-combat-power');
      if (shopCpEl) shopCpEl.textContent = state.combatPower.toLocaleString();

      return state.combatPower;
    }

    getPlayerTitle(floor, combatPower) {
      if (floor >= 100 || combatPower >= 500000) return 'Chúa Tể Thời Không Chi Phối';
      if (floor >= 70 || combatPower >= 250000) return 'Đại Hiệp Sĩ Hư Không';
      if (floor >= 50 || combatPower >= 120000) return 'Kẻ Phá Vỡ Dòng Thời Gian';
      if (floor >= 30 || combatPower >= 60000) return 'Chiến Binh Kỷ Nguyên Cyber';
      if (floor >= 15 || combatPower >= 25000) return 'Nhà Thám Hiểm Cổ Đại';
      return 'Kẻ Du Hành Tập Sự';
    }

    syncPlayerScoreToFirebase() {
      if (!this.db && window.firebase && window.firebase.database) {
        try { this.db = window.firebase.database(); } catch (e) {}
      }

      const state = window.Game.state || {};
      const playerId = state.playerId || ('player_' + (state.playerName || 'Traveler').toLowerCase().replace(/\s+/g, '_'));
      const playerName = state.playerName || 'Kẻ Du Hành Thời Không';
      const combatPower = this.calculateCombatPower();
      const maxFloor = state.maxAbyssFloor || 1;
      const title = this.getPlayerTitle(maxFloor, combatPower);
      const weaponKey = state.currentWeapon || 'iron_sword';
      const weaponLvl = (state.weaponLevels && state.weaponLevels[weaponKey]) || 0;

      const payload = {
        playerId: playerId,
        displayName: playerName,
        combatPower: combatPower,
        maxAbyssFloor: maxFloor,
        playerTitle: title,
        equippedWeapon: { id: weaponKey, upgradeLevel: weaponLvl },
        currentEra: this.abyssState.currentEra || 'PRESENT',
        lastUpdated: Date.now()
      };

      if (!this.db) {
        console.warn('[Leaderboard] Firebase Database chưa sẵn sàng, lưu cục bộ.');
        this._saveLocalScoreRecord(payload);
        return;
      }

      try {
        this.db.ref('leaderboards/by_abyss_floor/' + playerId).set({
          displayName: playerName,
          maxAbyssFloor: maxFloor,
          combatPower: combatPower,
          title: title,
          weaponKey: weaponKey,
          weaponLevel: weaponLvl,
          lastUpdated: Date.now()
        });

        this.db.ref('leaderboards/by_combat_power/' + playerId).set({
          displayName: playerName,
          combatPower: combatPower,
          maxAbyssFloor: maxFloor,
          title: title,
          weaponKey: weaponKey,
          weaponLevel: weaponLvl,
          lastUpdated: Date.now()
        });

        console.log('%c[LiveOps] Đã đồng bộ thành tích lên Firebase Realtime Database!', 'color: #00ff88;');
      } catch (err) {
        console.error('[Leaderboard] Lỗi khi ghi Firebase:', err);
        this._saveLocalScoreRecord(payload);
      }
    }

    _saveLocalScoreRecord(payload) {
      let localList = [];
      try {
        localList = JSON.parse(localStorage.getItem('chrono_local_leaderboard') || '[]');
      } catch (e) { localList = []; }
      const idx = localList.findIndex(p => p.playerId === payload.playerId);
      if (idx > -1) localList[idx] = payload;
      else localList.push(payload);
      localStorage.setItem('chrono_local_leaderboard', JSON.stringify(localList));
    }

    fetchGlobalLeaderboard(forceRefresh = false) {
      if (!this.db && window.firebase && window.firebase.database) {
        try { this.db = window.firebase.database(); } catch (e) {}
      }

      const now = Date.now();
      if (!forceRefresh && (now - this.leaderboardData.lastFetchTimestamp < 20000)) {
        this.renderLeaderboardDOM();
        return;
      }

      if (!this.db) {
        this._generateMockLeaderboardData();
        this.renderLeaderboardDOM();
        return;
      }

      this.leaderboardData.isFetching = true;

      this.db.ref('leaderboards/by_abyss_floor')
        .orderByChild('maxAbyssFloor')
        .limitToLast(ABYSS_CONSTANTS.LEADERBOARD_FETCH_LIMIT)
        .once('value', (snapshot) => {
          const floorList = [];
          snapshot.forEach(child => {
            floorList.push(Object.assign({ id: child.key }, child.val()));
          });
          floorList.reverse();
          this.leaderboardData.abyssFloorList = floorList;

          this.db.ref('leaderboards/by_combat_power')
            .orderByChild('combatPower')
            .limitToLast(ABYSS_CONSTANTS.LEADERBOARD_FETCH_LIMIT)
            .once('value', (cpSnap) => {
              const cpList = [];
              cpSnap.forEach(child => {
                cpList.push(Object.assign({ id: child.key }, child.val()));
              });
              cpList.reverse();
              this.leaderboardData.combatPowerList = cpList;
              this.leaderboardData.isFetching = false;
              this.leaderboardData.lastFetchTimestamp = Date.now();
              this.renderLeaderboardDOM();
            }, (err) => {
              this.leaderboardData.isFetching = false;
              this._generateMockLeaderboardData();
              this.renderLeaderboardDOM();
            });
        }, (err) => {
          this.leaderboardData.isFetching = false;
          this._generateMockLeaderboardData();
          this.renderLeaderboardDOM();
        });
    }

    _generateMockLeaderboardData() {
      const state = window.Game.state || {};
      const myPower = this.calculateCombatPower();
      const myFloor = state.maxAbyssFloor || 1;
      const myName = state.playerName || 'Kẻ Du Hành';

      const mockFloor = [
        { displayName: 'Chrono_Zero', maxAbyssFloor: 420, combatPower: 980400, title: 'Chúa Tể Thời Không Chi Phối', weaponKey: 'void_scythe', weaponLevel: 15 },
        { displayName: 'ShadowWalker_VN', maxAbyssFloor: 312, combatPower: 765200, title: 'Chúa Tể Thời Không Chi Phối', weaponKey: 'cyber_sword', weaponLevel: 12 },
        { displayName: 'Valkyrie_Ray', maxAbyssFloor: 145, combatPower: 340000, title: 'Đại Hiệp Sĩ Hư Không', weaponKey: 'laser_gun', weaponLevel: 10 },
        { displayName: 'Nguyen_Hoang_99', maxAbyssFloor: 88, combatPower: 220100, title: 'Kẻ Phá Vỡ Dòng Thời Gian', weaponKey: 'iron_sword', weaponLevel: 8 },
        { displayName: 'CyberKnight_X', maxAbyssFloor: 45, combatPower: 95000, title: 'Chiến Binh Kỷ Nguyên Cyber', weaponKey: 'chrono_cannon', weaponLevel: 6 },
        { displayName: `${myName} (Bạn)`, maxAbyssFloor: myFloor, combatPower: myPower, title: this.getPlayerTitle(myFloor, myPower), weaponKey: state.currentWeapon || 'iron_sword', weaponLevel: 1 }
      ].sort((a, b) => b.maxAbyssFloor - a.maxAbyssFloor);

      this.leaderboardData.abyssFloorList = mockFloor;
      this.leaderboardData.combatPowerList = [...mockFloor].sort((a, b) => b.combatPower - a.combatPower);
    }

    renderLeaderboardDOM() {
      const tbody = document.getElementById('leaderboard-tbody');
      if (!tbody) return;

      const activeList = this.leaderboardData.activeTab === 'abyss' 
        ? this.leaderboardData.abyssFloorList 
        : this.leaderboardData.combatPowerList;

      if (!activeList || activeList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 18px; color: #a0aec0;">Đang nạp dữ liệu máy chủ Thời Không...</td></tr>`;
        return;
      }

      const state = window.Game.state || {};
      const myName = state.playerName || 'Kẻ Du Hành';

      tbody.innerHTML = activeList.map((item, index) => {
        const rank = index + 1;
        let rankBadge = `${rank}`;
        if (rank === 1) rankBadge = '🥇';
        else if (rank === 2) rankBadge = '🥈';
        else if (rank === 3) rankBadge = '🥉';

        const isMe = item.displayName.includes(myName);

        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); ${isMe ? 'background: rgba(0, 242, 254, 0.12);' : ''}">
            <td style="padding: 8px; font-weight: bold; text-align: center;">${rankBadge}</td>
            <td style="padding: 8px;">
              <div style="font-weight: bold; color: ${isMe ? '#00f2fe' : '#fff'};">${item.displayName}</div>
              <small style="color: #94a3b8; font-size: 11px;">${item.title || 'Chiến Binh'}</small>
            </td>
            <td style="padding: 8px; color: #facc15; font-family: monospace; font-weight: bold;">
              ${(item.combatPower || 0).toLocaleString()}
            </td>
            <td style="padding: 8px; text-align: center; color: #38bdf8; font-weight: bold;">
              Tầng ${item.maxAbyssFloor || 1}
            </td>
          </tr>
        `;
      }).join('');
    }

    /**
     * ========================================================================
     * PHẦN 3: BỘ MÁY THỬ THÁCH HẰNG NGÀY (DAILY BOUNTIES ENGINE)
     * ========================================================================
     */
    _initDailyBounties() {
      const todayKey = this._getTodayDateString();
      this.dailyBountiesState.currentDateKey = todayKey;

      const storageKey = 'chrono_daily_bounties_' + todayKey;
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        try {
          this.dailyBountiesState.activeBounties = JSON.parse(saved);
        } catch (e) {
          this._rollDailyBountiesByDate(todayKey);
        }
      } else {
        this._rollDailyBountiesByDate(todayKey);
      }
    }

    _getTodayDateString() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _rollDailyBountiesByDate(dateKey) {
      let seed = 0;
      for (let i = 0; i < dateKey.length; i++) {
        seed = ((seed << 5) - seed) + dateKey.charCodeAt(i);
        seed |= 0;
      }
      seed = Math.abs(seed);

      const poolCopy = [...DAILY_BOUNTIES_POOL];
      const selected = [];

      for (let i = 0; i < ABYSS_CONSTANTS.DAILY_BOUNTY_COUNT; i++) {
        const pickIdx = (seed + i * 11) % poolCopy.length;
        const item = poolCopy.splice(pickIdx, 1)[0];

        selected.push({
          id: item.id,
          title: item.title,
          description: item.description,
          icon: item.icon,
          eventType: item.eventType,
          currentValue: 0,
          targetValue: item.targetValue,
          reward: item.reward,
          isCompleted: false,
          isClaimed: false
        });
      }

      this.dailyBountiesState.activeBounties = selected;
      this._saveDailyBounties();
    }

    _saveDailyBounties() {
      const key = 'chrono_daily_bounties_' + this.dailyBountiesState.currentDateKey;
      localStorage.setItem(key, JSON.stringify(this.dailyBountiesState.activeBounties));
    }

    triggerBountyEvent(eventType, amount = 1) {
      const todayKey = this._getTodayDateString();
      if (todayKey !== this.dailyBountiesState.currentDateKey) {
        this._initDailyBounties();
      }

      let changed = false;
      this.dailyBountiesState.activeBounties.forEach(b => {
        if (!b.isCompleted && b.eventType === eventType) {
          b.currentValue = Math.min(b.targetValue, b.currentValue + amount);
          changed = true;

          if (b.currentValue >= b.targetValue) {
            b.isCompleted = true;
            if (window.Game.UI && window.Game.UI.showToast) {
              window.Game.UI.showToast(`🎯 HOÀN THÀNH NHIỆM VỤ: ${b.title}!`);
            }
          }
        }
      });

      if (changed) {
        this._saveDailyBounties();
        this.renderDailyBountiesDOM();
      }
    }

    claimBountyReward(bountyId) {
      const bounty = this.dailyBountiesState.activeBounties.find(b => b.id === bountyId);
      if (!bounty || !bounty.isCompleted || bounty.isClaimed) return;

      const state = window.Game.state;
      if (!state) return;

      state.gold = (state.gold || 0) + bounty.reward.gold;
      state.timeShards = (state.timeShards || 0) + bounty.reward.shards;
      if (window.Game.Systems && typeof window.Game.Systems.addExp === 'function') {
        window.Game.Systems.addExp(bounty.reward.exp);
      }

      bounty.isClaimed = true;
      this._saveDailyBounties();

      if (window.Game.UI && window.Game.UI.showToast) {
        window.Game.UI.showToast(`🎁 ĐÃ NHẬN: +${bounty.reward.gold}G, +${bounty.reward.shards}💎, +${bounty.reward.exp} EXP!`);
      }

      this.renderDailyBountiesDOM();
    }

    renderDailyBountiesDOM() {
      const container = document.getElementById('daily-bounties-list');
      if (!container) return;

      const bounties = this.dailyBountiesState.activeBounties;
      container.innerHTML = bounties.map(b => {
        const pct = Math.min(100, Math.floor((b.currentValue / b.targetValue) * 100));
        let btnHtml = '';

        if (b.isClaimed) {
          btnHtml = `<button type="button" class="btn-action" style="background: rgba(255,255,255,0.1); color: #888; border: none; cursor: default;" disabled>ĐÃ NHẬN</button>`;
        } else if (b.isCompleted) {
          btnHtml = `<button type="button" class="btn-action" style="background: linear-gradient(135deg, #00f2fe, #4facfe); color: #050811; font-weight: bold;" onclick="Game.AbyssAndBounties.claimBountyReward('${b.id}')">NHẬN THƯỞNG</button>`;
        } else {
          btnHtml = `<span style="font-size: 12px; color: #94a3b8; font-weight: bold;">${b.currentValue}/${b.targetValue}</span>`;
        }

        return `
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 26px;">${b.icon}</div>
            <div style="flex: 1;">
              <div style="font-weight: bold; color: #fff; font-size: 14px;">${b.title}</div>
              <div style="font-size: 11px; color: #94a3b8; margin: 2px 0 6px 0;">${b.description}</div>
              <div style="width: 100%; height: 5px; background: rgba(0,0,0,0.4); border-radius: 3px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: #00f2fe;"></div>
              </div>
            </div>
            <div style="text-align: right; min-width: 90px;">
              <div style="font-size: 11px; color: #facc15; font-weight: bold; margin-bottom: 4px;">
                +${b.reward.gold}G | +${b.reward.shards}💎
              </div>
              ${btnHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    /**
     * ========================================================================
     * PHẦN 4: CANVAS COMBAT RECAP & CHARTS
     * ========================================================================
     */
    resetCombatRecap() {
      this.combatRecap = {
        totalDamageDealt: 0,
        damageBreakdown: {
          melee: 0,
          ranged: 0,
          skill: 0,
          chainLightning: 0,
          ashBlast: 0,
          familiar: 0,
          parryCounter: 0,
          passiveAura: 0
        },
        damageTaken: 0,
        damageBlockedByShield: 0,
        bulletsParried: 0,
        perfectDodges: 0,
        totalKills: 0,
        killsByTier: { normal: 0, elite: 0, miniboss: 0, overlord: 0 },
        dpsTimeline: [],
        sliceTimer: 0,
        sliceDamageAccumulator: 0,
        cycleStartTime: Date.now(),
        cycleDurationSeconds: 0
      };
    }

    recordDamageDealt(category, amount) {
      const val = Math.max(0, amount || 0);
      this.combatRecap.totalDamageDealt += val;
      this.combatRecap.sliceDamageAccumulator += val;

      if (this.combatRecap.damageBreakdown.hasOwnProperty(category)) {
        this.combatRecap.damageBreakdown[category] += val;
      } else {
        this.combatRecap.damageBreakdown.melee += val;
      }
    }

    recordDamageTaken(amount, wasShield) {
      const val = Math.max(0, amount || 0);
      if (wasShield) {
        this.combatRecap.damageBlockedByShield += val;
        this.triggerBountyEvent('ON_DAMAGE_BLOCKED_BY_SHIELD', val);
      } else {
        this.combatRecap.damageTaken += val;
        this.abyssState.floorDamageTaken += val;
      }
    }

    _updateRecapTimelineTick(dt) {
      this.combatRecap.sliceTimer += dt;
      if (this.combatRecap.sliceTimer >= ABYSS_CONSTANTS.RECAP_DPS_SLICE_SECONDS) {
        const elapsed = Math.round((Date.now() - this.combatRecap.cycleStartTime) / 1000);
        const dps = Math.round(this.combatRecap.sliceDamageAccumulator / this.combatRecap.sliceTimer);

        this.combatRecap.dpsTimeline.push({ second: elapsed, dps: dps });
        this.combatRecap.sliceTimer = 0;
        this.combatRecap.sliceDamageAccumulator = 0;
      }
    }

    finalizeCombatRecap() {
      this.combatRecap.cycleDurationSeconds = Math.max(1, Math.round((Date.now() - this.combatRecap.cycleStartTime) / 1000));
      if (this.combatRecap.sliceDamageAccumulator > 0) {
        const dps = Math.round(this.combatRecap.sliceDamageAccumulator / Math.max(0.5, this.combatRecap.sliceTimer));
        this.combatRecap.dpsTimeline.push({
          second: this.combatRecap.cycleDurationSeconds,
          dps: dps
        });
      }
    }

    openCombatRecapModal() {
      this.finalizeCombatRecap();

      const modal = document.getElementById('combat-recap-modal');
      const container = document.getElementById('combat-recap-content');
      if (!modal || !container) return;

      const recap = this.combatRecap;
      const duration = recap.cycleDurationSeconds || 1;
      const avgDPS = Math.round(recap.totalDamageDealt / duration);

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px;">
          <div class="stat-pill" style="flex-direction: column; align-items: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
            <span style="font-size: 11px; color: #a0aec0;">TỔNG SÁT THƯƠNG</span>
            <strong style="font-size: 16px; color: #00f2fe;">${recap.totalDamageDealt.toLocaleString()}</strong>
          </div>
          <div class="stat-pill" style="flex-direction: column; align-items: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
            <span style="font-size: 11px; color: #a0aec0;">DPS TRUNG BÌNH</span>
            <strong style="font-size: 16px; color: #facc15;">${avgDPS.toLocaleString()}</strong>
          </div>
          <div class="stat-pill" style="flex-direction: column; align-items: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
            <span style="font-size: 11px; color: #a0aec0;">KHIÊN CHẶN ĐƯỢC</span>
            <strong style="font-size: 16px; color: #4ade80;">${recap.damageBlockedByShield.toLocaleString()}</strong>
          </div>
          <div class="stat-pill" style="flex-direction: column; align-items: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
            <span style="font-size: 11px; color: #a0aec0;">PHẢN ĐẠN / NÉ</span>
            <strong style="font-size: 16px; color: #ec4899;">${recap.bulletsParried} / ${recap.perfectDodges}</strong>
          </div>
        </div>

        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
          <div style="flex: 1; min-width: 260px; background: rgba(0,0,0,0.35); border-radius: 8px; padding: 10px;">
            <div style="font-size: 12px; font-weight: bold; color: #38bdf8; margin-bottom: 6px;">📈 BIẾN THIÊN DPS THEO THỜI GIAN</div>
            <canvas id="recap-line-chart-canvas" width="300" height="150" style="width: 100%; height: auto; display: block;"></canvas>
          </div>
          <div style="flex: 1; min-width: 260px; background: rgba(0,0,0,0.35); border-radius: 8px; padding: 10px;">
            <div style="font-size: 12px; font-weight: bold; color: #f43f5e; margin-bottom: 6px;">🍩 TỈ TRỌNG NGUỒN SÁT THƯƠNG</div>
            <canvas id="recap-donut-chart-canvas" width="300" height="150" style="width: 100%; height: auto; display: block;"></canvas>
          </div>
        </div>
      `;

      modal.classList.remove('hidden');

      setTimeout(() => {
        this._renderLineChartOnCanvas('recap-line-chart-canvas');
        this._renderDonutChartOnCanvas('recap-donut-chart-canvas');
      }, 50);
    }

    _renderLineChartOnCanvas(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const timeline = this.combatRecap.dpsTimeline;
      if (!timeline || timeline.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chưa đủ dữ liệu thời gian.', w / 2, h / 2);
        return;
      }

      const pLeft = 40, pBottom = 22, pTop = 15, pRight = 15;
      const graphW = w - pLeft - pRight;
      const graphH = h - pTop - pBottom;

      let maxDps = 100;
      let maxSec = Math.max(1, timeline[timeline.length - 1].second);
      timeline.forEach(p => { if (p.dps > maxDps) maxDps = p.dps; });
      maxDps = Math.ceil(maxDps * 1.2);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        const y = pTop + (graphH / 3) * i;
        ctx.beginPath();
        ctx.moveTo(pLeft, y);
        ctx.lineTo(w - pRight, y);
        ctx.stroke();

        const labelVal = Math.round(maxDps - (maxDps / 3) * i);
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(labelVal >= 1000 ? (labelVal / 1000).toFixed(1) + 'k' : labelVal, pLeft - 5, y + 3);
      }

      const grad = ctx.createLinearGradient(0, pTop, 0, h - pBottom);
      grad.addColorStop(0, 'rgba(0, 242, 254, 0.45)');
      grad.addColorStop(1, 'rgba(0, 242, 254, 0.0)');

      ctx.beginPath();
      timeline.forEach((pt, idx) => {
        const x = pLeft + (pt.second / maxSec) * graphW;
        const y = pTop + graphH - (pt.dps / maxDps) * graphH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      const lastX = pLeft + (timeline[timeline.length - 1].second / maxSec) * graphW;
      ctx.lineTo(lastX, pTop + graphH);
      ctx.lineTo(pLeft, pTop + graphH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      timeline.forEach((pt, idx) => {
        const x = pLeft + (pt.second / maxSec) * graphW;
        const y = pTop + graphH - (pt.dps / maxDps) * graphH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    _renderDonutChartOnCanvas(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bd = this.combatRecap.damageBreakdown;
      const total = this.combatRecap.totalDamageDealt;

      if (total <= 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chưa gây sát thương nào.', w / 2, h / 2);
        return;
      }

      const sources = [
        { label: 'Cận Chiến', value: bd.melee, color: '#ef4444' },
        { label: 'Tầm Xa', value: bd.ranged, color: '#f59e0b' },
        { label: 'Kỹ Năng', value: bd.skill, color: '#8b5cf6' },
        { label: 'Sấm Sét', value: bd.chainLightning, color: '#00f2fe' },
        { label: 'Bùng Nổ Tro', value: bd.ashBlast, color: '#ea580c' },
        { label: 'Phản Đạn', value: bd.parryCounter, color: '#ec4899' },
        { label: 'Hào Quang', value: bd.passiveAura, color: '#10b981' }
      ].filter(s => s.value > 0);

      const centerX = 80;
      const centerY = h / 2;
      const outerR = 55;
      const innerR = 32;
      let startAngle = -Math.PI / 2;

      sources.forEach(s => {
        const sliceAngle = (s.value / total) * (Math.PI * 2);
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerR, startAngle, endAngle);
        ctx.arc(centerX, centerY, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();

        startAngle = endAngle;
      });

      const legendX = 150;
      let legendY = 25;
      sources.slice(0, 5).forEach(s => {
        const pct = ((s.value / total) * 100).toFixed(1);
        ctx.fillStyle = s.color;
        ctx.fillRect(legendX, legendY - 8, 10, 10);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${s.label}: ${pct}%`, legendX + 16, legendY);
        legendY += 22;
      });
    }

    /**
     * ========================================================================
     * LIÊN KẾT ĐỒNG BỘ ENGINE: HOOKS VÀO COMBAT, ENEMIES & SYSTEMS
     * ========================================================================
     */
    _hookIntoCombatEngine() {
      const combat = window.Game.Combat;
      if (!combat) return;

      const originalDamageEnemy = combat._applyDamageToEnemy;
      if (typeof originalDamageEnemy === 'function') {
        combat._applyDamageToEnemy = (enemy, rawAmount, hitAngle, knockback, hitColor, weaponKey, sourceSkill) => {
          originalDamageEnemy.apply(combat, [enemy, rawAmount, hitAngle, knockback, hitColor, weaponKey, sourceSkill]);

          const cat = (sourceSkill === 'storm' || sourceSkill === 'dash') ? 'skill' 
            : (weaponKey === 'laser_gun' || weaponKey === 'chrono_cannon') ? 'ranged' : 'melee';
          this.recordDamageDealt(cat, rawAmount);
        };
      }

      const originalParry = combat.recordBulletDeflected;
      if (typeof originalParry === 'function') {
        combat.recordBulletDeflected = (isParryCounter) => {
          originalParry.apply(combat, [isParryCounter]);
          this.combatRecap.bulletsParried++;
          this.triggerBountyEvent('ON_PARRY_BULLET', 1);
        };
      }

      const originalDodge = combat._checkPerfectDodge;
      if (typeof originalDodge === 'function') {
        combat._checkPerfectDodge = (player, radiusBonus) => {
          const count = originalDodge.apply(combat, [player, radiusBonus]);
          if (count > 0) {
            this.combatRecap.perfectDodges += count;
            this.triggerBountyEvent('ON_PERFECT_DODGE', count);
          }
          return count;
        };
      }
    }

    _hookIntoEnemiesEngine() {
      const enemies = window.Game.Enemies;
      if (!enemies) return;

      const originalDeath = enemies._handleEnemyDeath;
      if (typeof originalDeath === 'function') {
        enemies._handleEnemyDeath = (enemy) => {
          originalDeath.apply(enemies, [enemy]);

          this.combatRecap.totalKills++;
          if (enemy.isBoss) {
            this.combatRecap.killsByTier.overlord++;
            this.triggerBountyEvent('ON_OVERLORD_KILLED', 1);
          } else if (enemy.isMiniBoss) {
            this.combatRecap.killsByTier.miniboss++;
            this.triggerBountyEvent('ON_MINIBOSS_KILLED', 1);
          } else if (enemy.isElite) {
            this.combatRecap.killsByTier.elite++;
            this.triggerBountyEvent('ON_ELITE_KILLED', 1);
          } else {
            this.combatRecap.killsByTier.normal++;
          }

          if (enemy.timeline === 'PAST') this.triggerBountyEvent('ON_PAST_MOB_KILLED', 1);
          else if (enemy.timeline === 'FUTURE') this.triggerBountyEvent('ON_FUTURE_MOB_KILLED', 1);
        };
      }

      const originalPlayerDmg = enemies._applyDamageToPlayer;
      if (typeof originalPlayerDmg === 'function') {
        enemies._applyDamageToPlayer = (rawAmount, sourceEnemy) => {
          const player = window.Game.player;
          const hadShield = player && player.shield > 0;
          originalPlayerDmg.apply(enemies, [rawAmount, sourceEnemy]);
          this.recordDamageTaken(rawAmount, hadShield);
        };
      }
    }

    _bridgeWithGameSystems() {
      const systems = window.Game.Systems = window.Game.Systems || {};

      systems.startAbyssRun = () => {
        const floor = (window.Game.state && window.Game.state.maxAbyssFloor) || 1;
        this.startAbyssRun(floor);
      };

      systems.renderAbyss = () => {
        const container = document.getElementById('abyss-container');
        if (!container) return;
        const maxFloor = (window.Game.state && window.Game.state.maxAbyssFloor) || 1;

        container.innerHTML = `
          <div style="background: rgba(255,255,255,0.04); border-radius: 12px; padding: 16px; border: 1px solid rgba(177, 118, 255, 0.3);">
            <div style="font-size: 14px; color: #fff; margin-bottom: 8px;">
              🌀 <strong>Tiến Trình Leo Tháp Hiện Tại: Tầng ${maxFloor}</strong>
            </div>
            <p style="font-size: 12px; color: #a0aec0; line-height: 1.5; margin-bottom: 12px;">
              - Cứ mỗi 3 tầng: Nhận 1 Bùa Lợi Thời Không vĩnh viễn trong lượt leo.<br>
              - Cứ mỗi 5 tầng: Đối đầu với Mini-Boss Kỷ Nguyên canh giữ cửa.<br>
              - Cứ mỗi 10 tầng: Thách thức Chúa Tể Thời Không (Chrono Overlord) 3 giai đoạn.
            </p>
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #ffd700;">
              <span>Vàng tích lũy: +${this.abyssState.totalGoldAccumulated} 🪙</span>
              <span>Mảnh thu được: +${this.abyssState.totalShardsAccumulated} 💎</span>
            </div>
          </div>
        `;
      };

      systems.refreshLeaderboard = () => {
        this.fetchGlobalLeaderboard(true);
      };
      systems.fetchLeaderboard = () => {
        this.fetchGlobalLeaderboard(false);
      };

      systems.renderBounties = () => {
        this.renderDailyBountiesDOM();
      };

      systems.updateRecapData = () => {
        this.openCombatRecapModal();
      };
    }

    _renderAbyssFloorHUD() {
      if (window.Game.UI && window.Game.UI.showToast) {
        const eraName = this.abyssState.currentEra === 'PAST' ? 'Quá Khứ' : this.abyssState.currentEra === 'FUTURE' ? 'Tương Lai' : 'Hiện Tại';
        window.Game.UI.showToast(`🗼 TẦNG ${this.abyssState.currentFloor} [${eraName}] - Quái: ${this.abyssState.mobsRemaining}`);
      }
    }

    _injectCustomStyles() {
      if (document.getElementById('chrono-abyss-modal-css')) return;
      const st = document.createElement('style');
      st.id = 'chrono-abyss-modal-css';
      st.innerHTML = `
        .abyss-modal-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(4, 7, 16, 0.88); backdrop-filter: blur(8px);
          display: none; justify-content: center; align-items: center;
          z-index: 10000; font-family: sans-serif; color: #fff;
        }
        .blessing-container {
          background: linear-gradient(145deg, #0d1b2a, #1b263b);
          border: 2px solid #00f0ff; border-radius: 14px; padding: 22px;
          width: 820px; max-width: 95vw; box-shadow: 0 0 35px rgba(0, 240, 255, 0.35); text-align: center;
        }
        .blessing-cards-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 20px;
        }
        .blessing-card {
          background: #09111e; border-radius: 10px; padding: 16px 12px;
          display: flex; flex-direction: column; align-items: center; border: 1px solid #334;
        }
        .blessing-card.rarity-common { border-color: #9e9e9e; }
        .blessing-card.rarity-rare { border-color: #29b6f6; }
        .blessing-card.rarity-epic { border-color: #ab47bc; }
        .blessing-card.rarity-legendary { border-color: #ffa726; }
        .blessing-card.rarity-divine { border-color: #ff1744; }
        .blessing-rarity-badge { font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,0.1); margin-bottom: 8px; }
        .blessing-icon { font-size: 38px; margin-bottom: 8px; }
        .blessing-title { font-size: 15px; font-weight: bold; margin-bottom: 6px; }
        .blessing-desc { font-size: 11px; color: #94a3b8; flex-grow: 1; margin-bottom: 12px; line-height: 1.4; }
        .blessing-pick-btn {
          width: 100%; background: linear-gradient(90deg, #00b4d8, #0077b6); border: none;
          color: #fff; font-weight: bold; padding: 8px 0; border-radius: 6px; cursor: pointer;
        }
        .blessing-pick-btn:hover { background: #0096c7; }
      `;
      document.head.appendChild(st);
    }
  }

  // Khởi tạo Singleton toàn cục
  window.Game.AbyssAndBounties = new AbyssAndBountiesManager();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.Game.AbyssAndBounties.init());
  } else {
    window.Game.AbyssAndBounties.init();
  }

})(window);