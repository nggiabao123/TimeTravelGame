/**
 * ============================================================================
 * TỰA GAME: KẺ DU HÀNH THỜI KHÔNG (CHRONO TRAVELER)
 * TẬP TIN: abyss_bounties.js
 * NAMESPACE: window.Game.AbyssAndBounties
 * VAI TRÒ: SENIOR GAMEPLAY & LIVEOPS SYSTEM
 * PHẠM VI: 
 *   - Mục V.4: Chế Độ Leo Tháp Vô Tận (Endless Abyss Mode 1 - 999+)
 *   - Mục V.5: Bảng Xếp Hạng Chiến Lực & Tháp Trực Tuyến (Firebase Realtime DB)
 *   - Mục V.6: Hệ Thống Thử Thách Hằng Ngày (Daily Bounties Engine & 25 Nhiệm Vụ)
 *   - Mục V.9: Bảng Thống Kê Sát Thương Cuối Trận & Canvas Combat Recap Chart
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Khởi tạo namespace toàn cục chuẩn kiến trúc trò chơi
  window.Game = window.Game || {};

  /**
   * Bộ hằng số cấu hình hệ thống Abyss & Bounties
   */
  const ABYSS_CONSTANTS = {
    MAX_FLOOR_CAP: 9999,
    BLESSING_INTERVAL: 3,       // Sau mỗi 3 tầng nhận 1 Bùa Lợi Thời Không
    MINI_BOSS_INTERVAL: 5,      // Mỗi 5 tầng gặp Mini-Boss Kỷ Nguyên
    OVERLORD_INTERVAL: 10,      // Mỗi 10 tầng gặp Chúa Tể Thời Không
    BASE_FLOOR_TIME_SECONDS: 90,// 90 giây cơ bản cho tầng 1
    MIN_FLOOR_TIME_SECONDS: 35, // Giới hạn thấp nhất thời gian vượt tầng
    BASE_GOLD_REWARD: 150,
    BASE_SHARD_REWARD: 5,       // Mảnh Thời Không (💎)
    BASE_EXP_REWARD: 300,
    LEADERBOARD_FETCH_LIMIT: 50,
    DAILY_BOUNTY_COUNT: 4,      // Số lượng nhiệm vụ kích hoạt mỗi ngày
    RECAP_DPS_SLICE_SECONDS: 5  // Mỗi sample DPS ghi lại sau 5 giây
  };

  /**
   * KHO DỮ LIỆU: 25 BÙA LỢI THỜI KHÔNG (TEMPORAL BLESSINGS)
   * Phân cấp: Common (Trắng), Rare (Xanh Lam), Epic (Tím), Legendary (Vàng Cam), Divine (Đỏ Thần)
   */
  const TEMPORAL_BLESSINGS_POOL = [
    {
      id: 'bless_chrono_blade',
      name: 'Lưỡi Kiếm Nghịch Đảo',
      rarity: 'Common',
      icon: '⚔️',
      description: 'Tăng 18% sát thương cận chiến, đòn đánh thứ 4 gây hiệu ứng Chậm Thời Gian 1.5s.',
      apply: (player) => {
        player.stats.meleeDamageMultiplier = (player.stats.meleeDamageMultiplier || 1) + 0.18;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.chronoBlade = true;
      }
    },
    {
      id: 'bless_flux_barrier',
      name: 'Màn Chắn Lượng Tử',
      rarity: 'Common',
      icon: '🛡️',
      description: 'Tăng vĩnh viễn 250 Giáp Ảo. Khi Giáp vỡ sẽ phát nổ đẩy lùi kẻ địch xung quanh.',
      apply: (player) => {
        player.stats.maxShield = (player.stats.maxShield || 0) + 250;
        player.stats.currentShield = player.stats.maxShield;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.quantumShieldPop = true;
      }
    },
    {
      id: 'bless_accelerated_step',
      name: 'Bộ Hành Gia Tốc',
      rarity: 'Common',
      icon: '👟',
      description: 'Tốc độ di chuyển tăng 15%. Sau khi Né Hoàn Hảo, tăng 40% tốc chạy trong 3 giây.',
      apply: (player) => {
        player.stats.moveSpeedMultiplier = (player.stats.moveSpeedMultiplier || 1) + 0.15;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.hasteOnDodge = true;
      }
    },
    {
      id: 'bless_spark_infusion',
      name: 'Hạt Tinh Thể Tia Lửa',
      rarity: 'Common',
      icon: '⚡',
      description: 'Đòn bắn tầm xa có 25% tỉ lệ phóng thêm 1 tia Sấm Sét Lan Truyền gây 65% sát thương.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.sparkInfusion = (player.passiveEffects.sparkInfusion || 0) + 0.25;
      }
    },
    {
      id: 'bless_alchemical_flask',
      name: 'Bình Dược Nhân Quả',
      rarity: 'Common',
      icon: '🧪',
      description: 'Mỗi khi tiêu diệt 10 quái, hồi phục ngay lập tức 8% Lượng Máu Tối Đa.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.healOnKillStreak = (player.passiveEffects.healOnKillStreak || 0) + 0.08;
      }
    },
    {
      id: 'bless_resonant_echo',
      name: 'Tiếng Vọng Cộng Hưởng',
      rarity: 'Rare',
      icon: '🔔',
      description: 'Giảm 20% thời gian hồi chiêu tất cả kỹ năng. Kỹ năng có 15% cơ hội hồi lập tức.',
      apply: (player) => {
        player.stats.cooldownReduction = Math.min(0.6, (player.stats.cooldownReduction || 0) + 0.20);
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.echoResetChance = (player.passiveEffects.echoResetChance || 0) + 0.15;
      }
    },
    {
      id: 'bless_vitality_dilation',
      name: 'Giãn Nở Sinh Lực',
      rarity: 'Rare',
      icon: '❤️',
      description: 'Tăng 35% Máu tối đa và hồi phục 2.5% Máu mỗi giây khi Máu tụt dưới 40%.',
      apply: (player) => {
        const oldMax = player.stats.maxHealth || 1000;
        player.stats.maxHealth = Math.floor(oldMax * 1.35);
        player.stats.currentHealth += Math.floor(oldMax * 0.35);
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
      description: 'Bùng Nổ Tro Tàn tăng 40% bán kính nổ và gắn hiệu ứng Thiêu Đốt gây sát thương theo 5% máu tối đa quái.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.ashBlastRadiusBuff = (player.passiveEffects.ashBlastRadiusBuff || 1) * 1.4;
        player.passiveEffects.ashBlastBurnMaxHp = true;
      }
    },
    {
      id: 'bless_arcane_focus',
      name: 'Tụ Tiêu Ma Lực Cổ Đại',
      rarity: 'Rare',
      icon: '🔮',
      description: 'Tỉ lệ Bạo Kích tăng 15%, Sát Thương Bạo Kích tăng thêm 45%.',
      apply: (player) => {
        player.stats.critRate = (player.stats.critRate || 0.05) + 0.15;
        player.stats.critMultiplier = (player.stats.critMultiplier || 1.5) + 0.45;
      }
    },
    {
      id: 'bless_chain_lightning_matrix',
      name: 'Ma Trận Sấm Sét Quá Tải',
      rarity: 'Epic',
      icon: '🌩️',
      description: 'Sấm Sét Lan Truyền có thể nảy thêm 4 mục tiêu và giảm 30% giáp vật lý của mục tiêu bị giật.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.chainLightningExtraBounces = (player.passiveEffects.chainLightningExtraBounces || 0) + 4;
        player.passiveEffects.chainLightningArmorShred = 0.30;
      }
    },
    {
      id: 'bless_temporal_clone',
      name: 'Phân Thân Thời Không',
      rarity: 'Epic',
      icon: '👥',
      description: 'Mỗi khi Lướt (Dash), để lại một ảnh ảo chiến đấu kế thừa 40% chỉ số công kích tồn tại trong 6s.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.dashLeavesClone = true;
        player.passiveEffects.cloneDamageRatio = 0.40;
      }
    },
    {
      id: 'bless_familiar_empowerment',
      name: 'Thần Uy Tinh Linh Hộ Mệnh',
      rarity: 'Epic',
      icon: '🧚',
      description: 'Tinh Linh gây thêm 85% sát thương và định kỳ mỗi 8s bắn luồng sáng hồi máu cho chủ nhân.',
      apply: (player) => {
        player.stats.familiarDamageMultiplier = (player.stats.familiarDamageMultiplier || 1) + 0.85;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.familiarHealsPlayer = true;
      }
    },
    {
      id: 'bless_executioner_momentum',
      name: 'Nhịp Hành Quyết Vô Tận',
      rarity: 'Epic',
      icon: '🪓',
      description: 'Đòn đánh trực diện tiêu diệt ngay quái thường có máu dưới 18%. Hạ gục quái tăng 5% công trong 10s (cộng dồn 10 lần).',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.executeThreshold = 0.18;
        player.passiveEffects.rampageStackBonus = 0.05;
      }
    },
    {
      id: 'bless_bullet_hell_mastery',
      name: 'Tuyệt Cương Phản Pháo',
      rarity: 'Epic',
      icon: '💫',
      description: 'Phản đạn thành công khuếch đại viên đạn phản xạ lên 300% sát thương gốc và xuyên qua mọi quái trên đường bay.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.parryDamageScale = 3.0;
        player.passiveEffects.parryPenetration = true;
      }
    },
    {
      id: 'bless_chronos_judgment',
      name: 'Phán Quyết Chronos',
      rarity: 'Legendary',
      icon: '⏳',
      description: 'Mỗi 15 giây, đóng băng toàn bộ thời gian của quái vật trên sàn trong 3 giây. Sát thương nhận thêm 50% trong trạng thái này.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.chronosJudgment = true;
        player.passiveEffects.chronosJudgmentInterval = 15;
        player.passiveEffects.chronosJudgmentDuration = 3;
      }
    },
    {
      id: 'bless_phoenix_rebirth',
      name: 'Niết Bàn Phượng Hoàng Cổ',
      rarity: 'Legendary',
      icon: '🔥',
      description: 'Khi nhận sát thương chí tử, không chết mà phát nổ thiêu rụi toàn map, miễn nhiễm sát thương 4s và hồi phục 60% Máu (1 lần/run).',
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
      description: 'Tốc đánh tăng 50%, số lượng đạn bắn ra tăng gấp đôi nhưng góc tản xạ tăng nhẹ 5 độ.',
      apply: (player) => {
        player.stats.attackSpeedMultiplier = (player.stats.attackSpeedMultiplier || 1) + 0.50;
        player.stats.projectileCountBonus = (player.stats.projectileCountBonus || 0) + 1;
        player.stats.spreadAngleSpread = (player.stats.spreadAngleSpread || 0) + 5;
      }
    },
    {
      id: 'bless_infinite_mana_spring',
      name: 'Suối Nguồn Năng Lượng Vũ Trụ',
      rarity: 'Legendary',
      icon: '🌌',
      description: 'Kỹ năng không còn tiêu hao Nội Lực/Mana. Khi thi triển kỹ năng, tăng 25% Giáp Ảo tương ứng năng lượng tiêu thụ cũ.',
      apply: (player) => {
        player.stats.noManaCost = true;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.shieldFromManaSkill = true;
      }
    },
    {
      id: 'bless_curse_eater',
      name: 'Thực Ma Vực Thẳm',
      rarity: 'Legendary',
      icon: '🧿',
      description: 'Mỗi lời nguyền hoặc bùa bất lợi trên quái vật tăng 12% sát thương tổng của bạn tác dụng lên chúng.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.damagePerDebuff = 0.12;
      }
    },
    {
      id: 'bless_epoch_singularity',
      name: 'Điểm Kỳ Dị Đa Kỷ Nguyên',
      rarity: 'Divine',
      icon: '☸️',
      description: 'Hòa hợp cả 3 Kỷ Nguyên: Quá Khứ (Hút Máu 12%), Hiện Tại (Bạo Kích +30%), Tương Lai (Bắn Laser phụ trợ tự động).',
      apply: (player) => {
        player.stats.lifeSteal = (player.stats.lifeSteal || 0) + 0.12;
        player.stats.critRate = (player.stats.critRate || 0.05) + 0.30;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.epochLaserSatellite = true;
      }
    },
    {
      id: 'bless_reality_warp',
      name: 'Bẻ Cong Thực Tại Tuyệt Đối',
      rarity: 'Divine',
      icon: '👁️',
      description: '100% đòn đánh kích hoạt hiệu ứng Bùng Nổ Hư Không, triệt tiêu 100% đạn địch chạm vào người khi đứng yên.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.stationaryBulletImmunity = true;
        player.passiveEffects.alwaysVoidExplosion = true;
      }
    },
    {
      id: 'bless_god_of_speed',
      name: 'Thần Tốc Quang Minh Quy Cực',
      rarity: 'Divine',
      icon: '✨',
      description: 'Né Hoàn Hảo làm chậm quái xung quanh 90% trong 4 giây. Thời gian hồi Dash về 0.',
      apply: (player) => {
        player.stats.dashCooldown = 0.05;
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.superTimeSlowOnDodge = true;
      }
    },
    {
      id: 'bless_omniscience_matrix',
      name: 'Ma Trận Toàn Tri Kỷ Nguyên',
      rarity: 'Divine',
      icon: '☀️',
      description: 'Sát thương tăng tỉ lệ thuận với số tầng Tháp Vô Tận đã vượt qua (+2% tổng sát thương trên mỗi tầng đã clear).',
      apply: (player, floor) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.omniscienceFloorScaling = 0.02;
      }
    },
    {
      id: 'bless_entropy_reversal',
      name: 'Đảo Ngược Entropy Vũ Trụ',
      rarity: 'Divine',
      icon: '♾️',
      description: 'Toàn bộ sát thương nhận vào chuyển hóa thành hồi máu trong 2 giây đầu tiên của mỗi đợt sát thương lớn.',
      apply: (player) => {
        player.passiveEffects = player.passiveEffects || {};
        player.passiveEffects.entropyDamageReversal = true;
      }
    }
  ];

  /**
   * KHO DỮ LIỆU: 25 NHIỆM VỤ THỬ THÁCH HẰNG NGÀY (DAILY BOUNTIES POOL)
   * Phục vụ Mục V.6: Đa dạng lối chơi, tự động phân phối 4 nhiệm vụ/ngày.
   */
  const DAILY_BOUNTIES_POOL = [
    {
      id: 'bounty_parry_master',
      title: 'Kiếm Thuật Phản Xạ',
      description: 'Dùng đòn chém cận chiến để chém phản hồi đạn đạo của kẻ thù 20 lần.',
      icon: '⚔️',
      category: 'combat',
      eventType: 'ON_PARRY_BULLET',
      targetValue: 20,
      reward: { gold: 1200, shards: 15, exp: 800 }
    },
    {
      id: 'bounty_slay_minibosses',
      title: 'Kẻ Săn Quái Thú Kỷ Nguyên',
      description: 'Hạ gục thành công 3 Mini-Boss Kỷ Nguyên trong Tháp Vô Tận hoặc Chiến Dịch.',
      icon: '👹',
      category: 'boss',
      eventType: 'ON_MINIBOSS_KILLED',
      targetValue: 3,
      reward: { gold: 2000, shards: 25, exp: 1500 }
    },
    {
      id: 'bounty_activate_altars',
      title: 'Lời Khẩn Cầu Cổ Xưa',
      description: 'Kích hoạt thành công 3 Đài Cầu Nguyện Nhân Quả rải rác trong các ải.',
      icon: '⛩️',
      category: 'exploration',
      eventType: 'ON_ALTAR_ACTIVATED',
      targetValue: 3,
      reward: { gold: 1500, shards: 20, exp: 1000 }
    },
    {
      id: 'bounty_cursed_zone_survival',
      title: 'Vượt Qua Vực Tử Địa',
      description: 'Sống sót tổng cộng 180 giây bên trong Vùng Đất Bị Nguyền Rủa.',
      icon: '☣️',
      category: 'survival',
      eventType: 'ON_CURSED_ZONE_TICK',
      targetValue: 180,
      reward: { gold: 1800, shards: 20, exp: 1200 }
    },
    {
      id: 'bounty_chain_lightning_dmg',
      title: 'Bão Tố Sấm Sét Lan Truyền',
      description: 'Gây tổng cộng 50.000 điểm sát thương lên quái bằng Sấm Sét Lan Truyền.',
      icon: '⚡',
      category: 'damage',
      eventType: 'ON_LIGHTNING_DAMAGE_DEALT',
      targetValue: 50000,
      reward: { gold: 2500, shards: 30, exp: 1800 }
    },
    {
      id: 'bounty_perfect_dodges',
      title: 'Bóng Ma Thoát Xác',
      description: 'Thực hiện 25 lần Né Hoàn Hảo (Perfect Dodge) ngay sát trước khi dính sát thương.',
      icon: '💨',
      category: 'combat',
      eventType: 'ON_PERFECT_DODGE',
      targetValue: 25,
      reward: { gold: 1400, shards: 18, exp: 900 }
    },
    {
      id: 'bounty_abyss_floor_rush',
      title: 'Chinh Phạt Tầng Sâu',
      description: 'Vượt qua 15 tầng Tháp Vô Tận trong một hoặc nhiều lượt leo tháp.',
      icon: '🗼',
      category: 'abyss',
      eventType: 'ON_ABYSS_FLOOR_CLEARED',
      targetValue: 15,
      reward: { gold: 3000, shards: 35, exp: 2200 }
    },
    {
      id: 'bounty_ash_blast_kills',
      title: 'Tro Tàn Diệt Tuyệt',
      description: 'Tiêu diệt 40 kẻ địch bằng sát thương từ Bùng Nổ Tro Tàn.',
      icon: '💥',
      category: 'combat',
      eventType: 'ON_ASH_BLAST_KILL',
      targetValue: 40,
      reward: { gold: 1600, shards: 20, exp: 1100 }
    },
    {
      id: 'bounty_shield_block_damage',
      title: 'Khiên Bất Hoại',
      description: 'Chặn đứng tổng cộng 30.000 sát thương bằng Khiên Ảo Lượng Tử.',
      icon: '🛡️',
      category: 'survival',
      eventType: 'ON_DAMAGE_BLOCKED_BY_SHIELD',
      targetValue: 30000,
      reward: { gold: 2200, shards: 25, exp: 1400 }
    },
    {
      id: 'bounty_ranged_headshots',
      title: 'Xạ Thủ Xuyên Tâm',
      description: 'Hạ gục 50 kẻ thù bằng đòn bắn tầm xa hoặc vũ khí công nghệ tương lai.',
      icon: '🎯',
      category: 'combat',
      eventType: 'ON_RANGED_KILL',
      targetValue: 50,
      reward: { gold: 1300, shards: 15, exp: 850 }
    },
    {
      id: 'bounty_kill_overlord',
      title: 'Trảm Sát Chúa Tể Thời Không',
      description: 'Đánh bại ít nhất 1 Chúa Tể Thời Không (Tầng 10, 20, 30...) trong Tháp Vô Tận.',
      icon: '👑',
      category: 'boss',
      eventType: 'ON_OVERLORD_KILLED',
      targetValue: 1,
      reward: { gold: 4000, shards: 50, exp: 3000 }
    },
    {
      id: 'bounty_skill_executions',
      title: 'Uy Lực Kỹ Năng Kỷ Nguyên',
      description: 'Thi triển Kỹ Năng Tối Thượng hoặc Kỹ Năng Chủ Động 35 lần.',
      icon: '🔮',
      category: 'combat',
      eventType: 'ON_SKILL_CAST',
      targetValue: 35,
      reward: { gold: 1250, shards: 15, exp: 750 }
    },
    {
      id: 'bounty_familiar_damage',
      title: 'Sức Mạnh Linh Hồn Hộ Trợ',
      description: 'Để Tinh Linh Hộ Mệnh gây ra tổng cộng 20.000 sát thương lên kẻ thù.',
      icon: '🧚',
      category: 'damage',
      eventType: 'ON_FAMILIAR_DAMAGE_DEALT',
      targetValue: 20000,
      reward: { gold: 1750, shards: 22, exp: 1150 }
    },
    {
      id: 'bounty_melee_combo_strikes',
      title: 'Bão Tố Kiếm Vũ',
      description: 'Đạt chuỗi Combo cận chiến chạm mốc 50 hits liên tiếp không bị ngắt quãng 3 lần.',
      icon: '🗡️',
      category: 'combat',
      eventType: 'ON_COMBO_50_REACHED',
      targetValue: 3,
      reward: { gold: 2000, shards: 25, exp: 1300 }
    },
    {
      id: 'bounty_collect_shards',
      title: 'Thu Thập Mảnh Thời Không',
      description: 'Thu nhặt tổng cộng 40 Mảnh Thời Không (💎) rơi ra trong chiến trận.',
      icon: '💎',
      category: 'exploration',
      eventType: 'ON_SHARD_LOOTED',
      targetValue: 40,
      reward: { gold: 2400, shards: 30, exp: 1600 }
    },
    {
      id: 'bounty_speedrun_floor',
      title: 'Tốc Chiến Tốc Thắng',
      description: 'Dọn sạch một tầng Tháp Vô Tận trong thời gian dưới 25 giây 2 lần.',
      icon: '⏱️',
      category: 'abyss',
      eventType: 'ON_FLOOR_SPEEDRUN_SUCCESS',
      targetValue: 2,
      reward: { gold: 2800, shards: 35, exp: 1900 }
    },
    {
      id: 'bounty_void_breach_destroy',
      title: 'Vá Lỗ Hổng Hư Không',
      description: 'Phá hủy 4 Cổng Triệu Hồi Hư Không trước khi chúng sinh hết quái.',
      icon: '🕳️',
      category: 'exploration',
      eventType: 'ON_PORTAL_DESTROYED',
      targetValue: 4,
      reward: { gold: 2100, shards: 25, exp: 1450 }
    },
    {
      id: 'bounty_slay_elite_mobs',
      title: 'Huyết Chiến Tinh Anh',
      description: 'Hạ gục 12 quái vật Tinh Anh mang từ 2 Affixes trở lên.',
      icon: '🔱',
      category: 'combat',
      eventType: 'ON_ELITE_KILLED',
      targetValue: 12,
      reward: { gold: 2600, shards: 30, exp: 1700 }
    },
    {
      id: 'bounty_critical_strikes',
      title: 'Điểm Chết Bạo Phát',
      description: 'Gây ra 80 đòn đánh Bạo Kích (Critical Hit) chính xác lên kẻ thù.',
      icon: '💢',
      category: 'combat',
      eventType: 'ON_CRIT_HIT',
      targetValue: 80,
      reward: { gold: 1500, shards: 18, exp: 950 }
    },
    {
      id: 'bounty_flawless_floor',
      title: 'Thân Pháp Vô Vết',
      description: 'Hoàn thành 1 tầng Tháp Vô Tận mà hoàn toàn KHÔNG dính bất kỳ sát thương nào vào Máu.',
      icon: '🛡️',
      category: 'abyss',
      eventType: 'ON_FLAWLESS_FLOOR',
      targetValue: 1,
      reward: { gold: 3500, shards: 45, exp: 2500 }
    },
    {
      id: 'bounty_spend_gold_shop',
      title: 'Đầu Tư Kỷ Nguyên',
      description: 'Tiêu xài ít nhất 5.000 Vàng tại Thương Nhân Thời Không hoặc Nâng Cấp Trang Bị.',
      icon: '💰',
      category: 'economy',
      eventType: 'ON_GOLD_SPENT',
      targetValue: 5000,
      reward: { gold: 1000, shards: 40, exp: 1200 }
    },
    {
      id: 'bounty_freeze_enemies',
      title: 'Đông Cứng Thời Gian',
      description: 'Khiến kẻ địch rơi vào trạng thái Đóng Băng hoặc Làm Chậm tổng cộng 60 lần.',
      icon: '❄️',
      category: 'combat',
      eventType: 'ON_ENEMY_FROZEN',
      targetValue: 60,
      reward: { gold: 1700, shards: 20, exp: 1050 }
    },
    {
      id: 'bounty_past_era_purify',
      title: 'Thanh Tẩy Kỷ Quá Khứ',
      description: 'Hạ gục 60 quái vật thuộc Kỷ Nguyên Quá Khứ (Khủng Long, Bộ Lạc Cổ Xưa).',
      icon: '🦖',
      category: 'era',
      eventType: 'ON_PAST_MOB_KILLED',
      targetValue: 60,
      reward: { gold: 1900, shards: 22, exp: 1250 }
    },
    {
      id: 'bounty_future_mech_destroy',
      title: 'Hủy Diệt Cỗ Máy Tương Lai',
      description: 'Hạ gục 60 cỗ máy Cyber hoặc Drone thuộc Kỷ Nguyên Tương Lai.',
      icon: '🤖',
      category: 'era',
      eventType: 'ON_FUTURE_MOB_KILLED',
      targetValue: 60,
      reward: { gold: 1900, shards: 22, exp: 1250 }
    },
    {
      id: 'bounty_legendary_blessing_find',
      title: 'Phước Lành Vĩ Đại',
      description: 'Chọn được ít nhất 1 Bùa Lợi Thời Không bậc Legendary hoặc Divine trong Tháp Vô Tận.',
      icon: '🌟',
      category: 'abyss',
      eventType: 'ON_HIGH_BLESSING_CHOSEN',
      targetValue: 1,
      reward: { gold: 3000, shards: 40, exp: 2000 }
    }
  ];

  /**
   * Danh sách Quái Affixes (Thuộc tính đột biến ngẫu nhiên trong Tháp Vô Tận)
   */
  const ABYSS_MOB_AFFIXES = [
    { id: 'vampiric', name: 'Hút Máu', color: '#ff3333', apply: (m) => { m.lifeSteal = 0.25; } },
    { id: 'swift', name: 'Thần Tốc', color: '#ffea00', apply: (m) => { m.speed *= 1.35; } },
    { id: 'shielded', name: 'Khiên Cứng', color: '#00d0ff', apply: (m) => { m.shield = m.maxHp * 0.4; } },
    { id: 'explosive', name: 'Tử Bộc', color: '#ff7700', apply: (m) => { m.onDeathExplosion = true; } },
    { id: 'berserker', name: 'Cuồng Nộ', color: '#d500f9', apply: (m) => { m.lowHpRage = true; } },
    { id: 'teleporter', name: 'Dịch Chuyển', color: '#00e676', apply: (m) => { m.canTeleport = true; } },
    { id: 'bullet_spammer', name: 'Đạn Vũ Môn', color: '#ff1744', apply: (m) => { m.extraProjectiles = 2; } },
    { id: 'void_touched', name: 'Nhiễm Hư Không', color: '#7c4dff', apply: (m) => { m.voidTrail = true; } }
  ];

  /**
   * ==========================================================================
   * LỚP QUẢN LÝ CHÍNH: AbyssAndBountiesManager
   * ==========================================================================
   */
  class AbyssAndBountiesManager {
    constructor() {
      // Trạng thái vận hành Tháp Vô Tận (Endless Abyss)
      this.abyssState = {
        isActive: false,
        currentFloor: 1,
        floorTimer: 0,
        floorTimeLimit: ABYSS_CONSTANTS.BASE_FLOOR_TIME_SECONDS,
        mobsRemaining: 0,
        totalMobsSpawned: 0,
        currentEra: 'PAST', // PAST, PRESENT, FUTURE, VOID
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

      // Trạng thái Bảng Xếp Hạng & Firebase
      this.leaderboardData = {
        combatPowerList: [],
        abyssFloorList: [],
        activeTab: 'abyss', // 'abyss' hoặc 'combat_power'
        isFetching: false,
        lastFetchTimestamp: 0
      };

      // Trạng thái Thử Thách Hằng Ngày (Daily Bounties)
      this.dailyBountiesState = {
        currentDateKey: '',
        activeBounties: [], // 4 nhiệm vụ được kích hoạt hôm nay
        listenersBound: false
      };

      // Trạng thái Thống Kê Sát Thương Cuối Trận (Combat Recap)
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
          dots: 0
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
        dpsTimeline: [], // Array các mốc { second, dps, damageDealtInSlice }
        sliceTimer: 0,
        sliceDamageAccumulator: 0,
        cycleStartTime: 0,
        cycleDurationSeconds: 0
      };

      // Tự động kiểm tra liên kết Firebase DB
      this.db = window.db || null;
    }

    /**
     * KHỞI TẠO TỔNG THỂ HỆ THỐNG
     * Được gọi khi trò chơi khởi động (Game boot phase)
     */
    init() {
      console.log('%c[Chrono Traveler] Đang khởi tạo hệ thống Abyss & Bounties...', 'color: #00ffff; font-weight: bold;');
      
      this._bindCombatRecapHooks();
      this._initDailyBounties();
      this._setupUIListeners();

      // Kiểm tra kết nối Firebase
      if (window.db) {
        this.db = window.db;
        this.fetchGlobalLeaderboard();
      } else {
        console.warn('[LiveOps] Firebase Database (window.db) chưa sẵn sàng. Chế độ ngoại tuyến được áp dụng.');
      }
    }

    /**
     * ========================================================================
     * PHẦN 1: HỆ THỐNG ENDLESS ABYSS MODE (MỤC V.4)
     * ========================================================================
     */

    /**
     * Bắt đầu một lượt Leo Tháp Vô Tận mới hoặc tiếp tục từ tầng đã lưu
     * @param {number} startFloor Tầng bắt đầu (Mặc định: 1)
     */
    startAbyssRun(startFloor = 1) {
      const state = window.Game.state;
      const player = state ? state.player : null;

      if (!player) {
        console.error('[Abyss] Lỗi: Không tìm thấy thực thể người chơi trong window.Game.state!');
        return;
      }

      this.abyssState.isActive = true;
      this.abyssState.currentFloor = Math.max(1, Math.min(startFloor, ABYSS_CONSTANTS.MAX_FLOOR_CAP));
      this.abyssState.chosenBlessings = [];
      this.abyssState.runStartTime = Date.now();
      this.abyssState.totalGoldAccumulated = 0;
      this.abyssState.totalShardsAccumulated = 0;
      this.abyssState.totalExpAccumulated = 0;

      // Khởi tạo/Đặt lại bộ ghi nhận Combat Recap cho lượt leo tháp này
      this.resetCombatRecap();

      console.log(`%c[Abyss] Bắt đầu hành trình Leo Tháp Vô Tận - Tầng ${this.abyssState.currentFloor}`, 'color: #ffd700; font-size: 14px; font-weight: bold;');

      this._loadFloor(this.abyssState.currentFloor);
    }

    /**
     * Tải và thiết lập môi trường, quái, affixes cho tầng hiện tại
     * @param {number} floor Số thứ tự tầng
     */
    _loadFloor(floor) {
      this.abyssState.floorDamageTaken = 0;
      this.abyssState.isBossFloor = (floor % ABYSS_CONSTANTS.OVERLORD_INTERVAL === 0);
      this.abyssState.isMiniBossFloor = (!this.abyssState.isBossFloor && floor % ABYSS_CONSTANTS.MINI_BOSS_INTERVAL === 0);

      // Phân chia Kỷ Nguyên ngẫu nhiên hoặc tuần hoàn theo tầng
      if (floor % 10 <= 3) {
        this.abyssState.currentEra = 'PAST';
      } else if (floor % 10 <= 7) {
        this.abyssState.currentEra = 'PRESENT';
      } else if (floor % 10 <= 9) {
        this.abyssState.currentEra = 'FUTURE';
      } else {
        this.abyssState.currentEra = 'VOID'; // Tầng Boss là Vực Thẳm Hư Không
      }

      // Tính toán thời gian giới hạn vượt tầng (Giảm dần theo độ sâu, tối thiểu 35s)
      this.abyssState.floorTimeLimit = Math.max(
        ABYSS_CONSTANTS.MIN_FLOOR_TIME_SECONDS,
        ABYSS_CONSTANTS.BASE_FLOOR_TIME_SECONDS - Math.floor(floor * 0.45)
      );
      this.abyssState.floorTimer = this.abyssState.floorTimeLimit;

      // Áp dụng Affixes ngẫu nhiên theo bậc thang độ sâu
      this.abyssState.activeAffixes = this._rollFloorAffixes(floor);

      // Sinh danh sách quái cho tầng
      this._generateFloorEnemies(floor);

      // Thông báo HUD giao diện
      if (window.Game.Systems && window.Game.Systems.UI) {
        window.Game.Systems.UI.showFloorNotification({
          floor: floor,
          era: this.abyssState.currentEra,
          isBoss: this.abyssState.isBossFloor,
          isMiniBoss: this.abyssState.isMiniBossFloor,
          affixes: this.abyssState.activeAffixes
        });
      }
    }

    /**
     * Quay ngẫu nhiên các đặc tính Affixes dựa theo độ sâu tầng tháp
     * @param {number} floor 
     * @returns {Array} Danh sách Affixes được kích hoạt
     */
    _rollFloorAffixes(floor) {
      if (floor < 5) return [];

      let count = 1;
      if (floor >= 20) count = 2;
      if (floor >= 50) count = 3;
      if (floor >= 100) count = 4;

      const shuffled = [...ABYSS_MOB_AFFIXES].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    }

    /**
     * Thuật toán sinh quái vật theo tầng với độ khó scale toán học (HP, Sát thương, Tốc độ)
     * @param {number} floor 
     */
    _generateFloorEnemies(floor) {
      const enemiesEngine = window.Game.Enemies;
      if (!enemiesEngine || typeof enemiesEngine.spawnEnemy !== 'function') {
        console.warn('[Abyss] Module Enemies chưa tải đầy đủ.');
        return;
      }

      // Xóa quái cũ khỏi sàn đấu
      if (typeof enemiesEngine.clearAllEnemies === 'function') {
        enemiesEngine.clearAllEnemies();
      }

      // Công thức Scale lũy tiến phi tuyến tính: 
      // Base * (1 + 0.15 * floor + 0.002 * floor^1.8)
      const hpMultiplier = 1 + (0.16 * floor) + (0.0018 * Math.pow(floor, 1.75));
      const dmgMultiplier = 1 + (0.11 * floor) + (0.0012 * Math.pow(floor, 1.65));
      const speedMultiplier = Math.min(1.75, 1 + (0.008 * floor));

      let totalMobs = 0;

      if (this.abyssState.isBossFloor) {
        // TẦNG CHÚA TỂ THỜI KHÔNG (CHRONO OVERLORD)
        this._spawnChronoOverlord(floor, hpMultiplier, dmgMultiplier);
        totalMobs = 1;

        // Đi kèm 2 Vệ Binh Hư Không bảo vệ
        if (floor >= 30) {
          this._spawnBossAddMinion(floor, hpMultiplier * 0.4, dmgMultiplier * 0.5);
          this._spawnBossAddMinion(floor, hpMultiplier * 0.4, dmgMultiplier * 0.5);
          totalMobs += 2;
        }
      } else if (this.abyssState.isMiniBossFloor) {
        // TẦNG MINI-BOSS KỶ NGUYÊN
        this._spawnEpochMiniBoss(floor, hpMultiplier, dmgMultiplier);
        totalMobs = 1;

        // Kèm theo 4 lính tinh anh
        const eliteCount = Math.min(8, 2 + Math.floor(floor / 10));
        for (let i = 0; i < eliteCount; i++) {
          this._spawnScaledMob(floor, 'elite', hpMultiplier, dmgMultiplier, speedMultiplier);
        }
        totalMobs += eliteCount;
      } else {
        // TẦNG TIÊU CHUẨN: Lính thường + Quái Tinh Anh
        const mobCount = Math.min(35, 10 + Math.floor(floor * 0.75));
        const eliteChance = Math.min(0.5, 0.1 + (floor * 0.005));

        for (let i = 0; i < mobCount; i++) {
          const isElite = Math.random() < eliteChance;
          this._spawnScaledMob(
            floor,
            isElite ? 'elite' : 'normal',
            hpMultiplier * (isElite ? 2.5 : 1.0),
            dmgMultiplier * (isElite ? 1.6 : 1.0),
            speedMultiplier
          );
        }
        totalMobs = mobCount;
      }

      this.abyssState.mobsRemaining = totalMobs;
      this.abyssState.totalMobsSpawned = totalMobs;
    }

    /**
     * Triệu hồi quái thường hoặc quái tinh anh đã áp dụng Affixes và Scale chỉ số
     */
    _spawnScaledMob(floor, tier, hpMult, dmgMult, spdMult) {
      const enemiesEngine = window.Game.Enemies;
      const mobData = {
        tier: tier,
        era: this.abyssState.currentEra,
        hpMultiplier: hpMult,
        damageMultiplier: dmgMult,
        speedMultiplier: spdMult,
        affixes: tier === 'elite' ? this.abyssState.activeAffixes : []
      };

      enemiesEngine.spawnEnemy(mobData);
    }

    /**
     * Sinh Mini-Boss Kỷ Nguyên (Xuất hiện mỗi 5 tầng: 5, 15, 25, 35...)
     */
    _spawnEpochMiniBoss(floor, hpMult, dmgMult) {
      const enemiesEngine = window.Game.Enemies;
      const miniBossNames = {
        PAST: 'Bạo Long Cổ Đại - Chúa Tể Nham Thạch',
        PRESENT: 'Đại Hộ Pháp Cơ Khí Tự Hành',
        FUTURE: 'Cơ Giáp Tác Chiến Cyber-09',
        VOID: 'Kẻ Gác Đền Vực Sâu Hư Ảo'
      };

      const bossConfig = {
        name: miniBossNames[this.abyssState.currentEra] || 'Hộ Vệ Kỷ Nguyên',
        tier: 'miniboss',
        era: this.abyssState.currentEra,
        hpMultiplier: hpMult * 5.5,
        damageMultiplier: dmgMult * 2.2,
        speedMultiplier: 1.15,
        specialSkills: ['EPOCH_SLAM', 'CHRONO_BULLET_FAN'],
        affixes: this.abyssState.activeAffixes
      };

      enemiesEngine.spawnMiniBoss(bossConfig);
    }

    /**
     * Sinh Chúa Tể Thời Không (Xuất hiện mỗi 10 tầng: 10, 20, 30...)
     */
    _spawnChronoOverlord(floor, hpMult, dmgMult) {
      const enemiesEngine = window.Game.Enemies;
      const overlordConfig = {
        name: `Chúa Tể Thời Không (Biến Thể Tầng ${floor})`,
        tier: 'overlord',
        era: 'VOID',
        floor: floor,
        hpMultiplier: hpMult * 12.0,
        damageMultiplier: dmgMult * 3.5,
        speedMultiplier: 1.25,
        phases: 3,
        specialSkills: [
          'VOID_SINGULARITY_VORTEX',
          'TIMELINE_SHATTER_BEAM',
          'PARRY_PUNISHER_MISSILES',
          'TEMPORAL_CLONE_ARMY'
        ],
        affixes: this.abyssState.activeAffixes
      };

      enemiesEngine.spawnChronoOverlord(overlordConfig);
    }

    /**
     * Sinh quái phụ trợ đi kèm Chúa Tể Thời Không
     */
    _spawnBossAddMinion(floor, hpMult, dmgMult) {
      const enemiesEngine = window.Game.Enemies;
      enemiesEngine.spawnEnemy({
        name: 'Tàn Dư Hư Không Vô Tận',
        tier: 'elite',
        era: 'VOID',
        hpMultiplier: hpMult,
        damageMultiplier: dmgMult,
        speedMultiplier: 1.2,
        affixes: [{ id: 'bullet_spammer', name: 'Đạn Vũ Môn' }]
      });
    }

    /**
     * Vòng lặp cập nhật đếm giờ và kiểm tra trạng thái vượt tầng (Gọi mỗi frame từ Game Loop)
     * @param {number} deltaTime Thời gian trôi qua giữa 2 frame tính bằng giây (thường ~0.016s)
     */
    update(deltaTime) {
      if (!this.abyssState.isActive) return;

      // 1. Cập nhật đồng hồ đếm ngược tầng
      this.abyssState.floorTimer -= deltaTime;

      // Cập nhật thống kê Recap DPS Timeline
      this._updateCombatRecapTick(deltaTime);

      // Kiểm tra thất bại do hết thời gian
      if (this.abyssState.floorTimer <= 0) {
        this._handleFloorFailure('Hết thời gian vượt ải!');
        return;
      }

      // 2. Kiểm tra nếu quái trên sàn đã bị tiêu diệt hết
      if (this.abyssState.mobsRemaining <= 0) {
        this._handleFloorSuccess();
      }
    }

    /**
     * Ghi nhận sự kiện một quái vật trong tầng bị tiêu diệt
     * @param {Object} enemy Thực thể quái vật bị diệt
     */
    onEnemyKilledInAbyss(enemy) {
      if (!this.abyssState.isActive) return;

      this.abyssState.mobsRemaining = Math.max(0, this.abyssState.mobsRemaining - 1);

      // Cập nhật số liệu recap
      this.combatRecap.totalKills++;
      if (enemy.tier === 'overlord') {
        this.combatRecap.killsByTier.overlord++;
        this.triggerBountyEvent('ON_OVERLORD_KILLED', 1);
      } else if (enemy.tier === 'miniboss') {
        this.combatRecap.killsByTier.miniboss++;
        this.triggerBountyEvent('ON_MINIBOSS_KILLED', 1);
      } else if (enemy.tier === 'elite') {
        this.combatRecap.killsByTier.elite++;
        this.triggerBountyEvent('ON_ELITE_KILLED', 1);
      } else {
        this.combatRecap.killsByTier.normal++;
      }

      // Kích hoạt tiến độ nhiệm vụ Kỷ Nguyên
      if (enemy.era === 'PAST') {
        this.triggerBountyEvent('ON_PAST_MOB_KILLED', 1);
      } else if (enemy.era === 'FUTURE') {
        this.triggerBountyEvent('ON_FUTURE_MOB_KILLED', 1);
      }
    }

    /**
     * Xử lý khi người chơi hoàn thành xuất sắc tầng hiện tại
     */
    _handleFloorSuccess() {
      const currentFloor = this.abyssState.currentFloor;
      const timeSpent = this.abyssState.floorTimeLimit - this.abyssState.floorTimer;

      console.log(`%c[Abyss] Đã dọn sạch Tầng ${currentFloor} trong ${timeSpent.toFixed(1)} giây!`, 'color: #00ff88; font-weight: bold;');

      // Kiểm tra thành tích Speedrun (< 25s)
      if (timeSpent < 25) {
        this.triggerBountyEvent('ON_FLOOR_SPEEDRUN_SUCCESS', 1);
      }

      // Kiểm tra thành tích Hoàn Hảo (Không mất giọt máu nào)
      if (this.abyssState.floorDamageTaken === 0) {
        this.triggerBountyEvent('ON_FLAWLESS_FLOOR', 1);
      }

      // Kích hoạt tiến độ nhiệm vụ dọn tầng
      this.triggerBountyEvent('ON_ABYSS_FLOOR_CLEARED', 1);

      // Tính thưởng tầng
      const rewards = this._calculateFloorRewards(currentFloor);
      this._distributeFloorRewards(rewards);

      // Cập nhật kỷ lục tầng tối đa (maxAbyssFloor)
      this._updateMaxFloorRecord(currentFloor);

      // Kiểm tra mốc chọn Bùa Lợi Thời Không (mỗi 3 tầng: 3, 6, 9, 12...)
      if (currentFloor % ABYSS_CONSTANTS.BLESSING_INTERVAL === 0) {
        this._prepareBlessingSelection(currentFloor);
      } else {
        // Tự động chuyển tiếp tầng sau 2 giây nghỉ
        this._scheduleNextFloor(2.0);
      }
    }

    /**
     * Tính toán lượng Vàng, Mảnh Thời Không (💎) và EXP thưởng sau mỗi tầng
     * @param {number} floor 
     */
    _calculateFloorRewards(floor) {
      // Hệ số cấp số nhân nhẹ theo độ sâu
      const multiplier = 1 + (floor * 0.12);
      const gold = Math.floor(ABYSS_CONSTANTS.BASE_GOLD_REWARD * multiplier);
      const shards = Math.floor(ABYSS_CONSTANTS.BASE_SHARD_REWARD * (1 + floor * 0.08)) + (floor % 10 === 0 ? 25 : 0);
      const exp = Math.floor(ABYSS_CONSTANTS.BASE_EXP_REWARD * multiplier);

      return { gold, shards, exp };
    }

    /**
     * Trao thưởng trực tiếp vào kho đồ người chơi và state
     * @param {Object} rewards 
     */
    _distributeFloorRewards(rewards) {
      const state = window.Game.state;
      if (!state) return;

      state.gold = (state.gold || 0) + rewards.gold;
      state.chronoShards = (state.chronoShards || 0) + rewards.shards;
      state.exp = (state.exp || 0) + rewards.exp;

      this.abyssState.totalGoldAccumulated += rewards.gold;
      this.abyssState.totalShardsAccumulated += rewards.shards;
      this.abyssState.totalExpAccumulated += rewards.exp;

      // Kích hoạt sự kiện nhặt mảnh để hoàn thành nhiệm vụ
      this.triggerBountyEvent('ON_SHARD_LOOTED', rewards.shards);

      // Hiển thị Popup thưởng nhanh
      if (window.Game.Systems && window.Game.Systems.UI) {
        window.Game.Systems.UI.showFloatingRewardBanner(rewards);
      }
    }

    /**
     * Cập nhật kỷ lục maxAbyssFloor vào local state và đồng bộ Firebase
     * @param {number} currentFloor 
     */
    _updateMaxFloorRecord(currentFloor) {
      const state = window.Game.state;
      if (!state) return;

      const previousMax = state.maxAbyssFloor || 0;
      if (currentFloor > previousMax) {
        state.maxAbyssFloor = currentFloor;
        console.log(`%c[Abyss] KỶ LỤC MỚI ĐƯỢC XÁC LẬP: TẦNG ${currentFloor}!`, 'color: #ff00ff; font-weight: bold;');

        // Đồng bộ trực tiếp lên Firebase Realtime Database
        this.syncPlayerScoreToFirebase();
      }
    }

    /**
     * Chuẩn bị danh sách 3 Bùa Lợi Thời Không ngẫu nhiên theo trọng số tỉ lệ phẩm cấp
     * @param {number} floor 
     */
    _prepareBlessingSelection(floor) {
      // Tỉ lệ phẩm cấp: Floor càng sâu thì tỉ lệ ra Epic/Legendary/Divine càng cao
      const weights = {
        Common: Math.max(15, 60 - floor * 0.8),
        Rare: Math.min(40, 25 + floor * 0.4),
        Epic: Math.min(30, 10 + floor * 0.35),
        Legendary: Math.min(15, 4 + floor * 0.15),
        Divine: Math.min(8, 1 + floor * 0.08)
      };

      // Chọn 3 bùa không trùng lặp
      const pool = [...TEMPORAL_BLESSINGS_POOL];
      const selected = [];

      while (selected.length < 3 && pool.length > 0) {
        const pickedRarity = this._rollRarityByWeight(weights);
        const candidates = pool.filter(b => b.rarity === pickedRarity);

        if (candidates.length > 0) {
          const randomIndex = Math.floor(Math.random() * candidates.length);
          const chosen = candidates[randomIndex];
          selected.push(chosen);
          // Loại bỏ để không trùng lặp
          const poolIdx = pool.findIndex(item => item.id === chosen.id);
          if (poolIdx > -1) pool.splice(poolIdx, 1);
        } else {
          // Nếu hết phẩm cấp đó, bốc đại 1 cái từ pool
          const randomIdx = Math.floor(Math.random() * pool.length);
          selected.push(pool.splice(randomIdx, 1)[0]);
        }
      }

      this.abyssState.pendingBlessingPicks = selected;

      // Render Modal giao diện chọn Bùa Lợi Thời Không
      this._renderBlessingSelectionModal(selected);
    }

    /**
     * Bốc ngẫu nhiên độ hiếm dựa theo trọng số
     */
    _rollRarityByWeight(weights) {
      const totalWeight = weights.Common + weights.Rare + weights.Epic + weights.Legendary + weights.Divine;
      let rand = Math.random() * totalWeight;

      for (const [rarity, weight] of Object.entries(weights)) {
        if (rand < weight) return rarity;
        rand -= weight;
      }
      return 'Common';
    }

    /**
     * Render giao diện chọn Bùa Lợi Thời Không trên Canvas/DOM
     * @param {Array} blessings Danh sách 3 bùa lợi
     */
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
            <p>Hoàn thành Tầng ${this.abyssState.currentFloor}. Hãy chọn 1 Bùa Lợi để cường hóa bản thân:</p>
          </div>
          <div class="blessing-cards-grid">
            ${blessings.map((b, idx) => `
              <div class="blessing-card rarity-${b.rarity.toLowerCase()}" data-blessing-index="${idx}">
                <div class="blessing-rarity-badge">${b.rarity.toUpperCase()}</div>
                <div class="blessing-icon">${b.icon}</div>
                <div class="blessing-title">${b.name}</div>
                <div class="blessing-desc">${b.description}</div>
                <button class="blessing-pick-btn" data-pick="${idx}">HẤP THỤ</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      modal.style.display = 'flex';

      // Gắn sự kiện click chọn bùa
      const buttons = modal.querySelectorAll('.blessing-pick-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.getAttribute('data-pick'), 10);
          this.applySelectedBlessing(index);
          modal.style.display = 'none';
        });
      });
    }

    /**
     * Áp dụng Bùa Lợi người chơi đã bấm chọn
     * @param {number} index Thứ tự lựa chọn (0, 1 hoặc 2)
     */
    applySelectedBlessing(index) {
      const blessing = this.abyssState.pendingBlessingPicks[index];
      if (!blessing) return;

      const player = window.Game.state ? window.Game.state.player : null;
      if (!player) return;

      // Thi triển logic cộng chỉ số
      blessing.apply(player, this.abyssState.currentFloor);
      this.abyssState.chosenBlessings.push(blessing);

      console.log(`%c[Abyss] Đã hấp thụ thành công Bùa Lợi: [${blessing.rarity}] ${blessing.name}`, 'color: #ffaa00; font-weight: bold;');

      // Kích hoạt nhiệm vụ nếu nhặt được bùa xịn
      if (blessing.rarity === 'Legendary' || blessing.rarity === 'Divine') {
        this.triggerBountyEvent('ON_HIGH_BLESSING_CHOSEN', 1);
      }

      // Tiếp tục sang tầng kế tiếp
      this._scheduleNextFloor(1.5);
    }

    /**
     * Lập lịch chuyển sang tầng kế tiếp
     * @param {number} delaySeconds Thời gian trễ tính bằng giây
     */
    _scheduleNextFloor(delaySeconds) {
      setTimeout(() => {
        if (!this.abyssState.isActive) return;
        this.abyssState.currentFloor++;
        this._loadFloor(this.abyssState.currentFloor);
      }, delaySeconds * 1000);
    }

    /**
     * Xử lý khi thất bại tại một tầng (Hết giờ hoặc Người chơi chết)
     * @param {string} reason Lý do thất bại
     */
    _handleFloorFailure(reason) {
      console.warn(`%c[Abyss] KẾT THÚC LƯỢT LEO THÁP TẠI TẦNG ${this.abyssState.currentFloor}: ${reason}`, 'color: #ff3333; font-weight: bold;');

      this.abyssState.isActive = false;

      // Dừng và finalize số liệu Combat Recap
      this.finalizeCombatRecap();

      // Mở Modal Báo Cáo Chiến Tích & Recap trực quan
      this.openCombatRecapModal();
    }
/**
     * ========================================================================
     * PHẦN 2: BẢNG XẾP HẠNG CHIẾN LỰC & THÁP VÔ TẬN TRỰC TUYẾN (MỤC V.5)
     * Kết nối trực tiếp với Firebase Realtime Database (window.db.ref('leaderboards'))
     * ========================================================================
     */

    /**
     * Tính toán tổng điểm Chiến Lực (Combat Power) của người chơi dựa trên
     * toàn bộ thuộc tính cơ bản, trang bị, vũ khí, cổ vật và kỹ năng đã mở khóa.
     * @returns {number} Điểm chiến lực chuẩn hóa
     */
    calculateCombatPower() {
      const state = window.Game.state;
      if (!state || !state.player) return 1000;

      const player = state.player;
      const stats = player.stats || {};

      // 1. Chỉ số sinh tồn & phòng thủ
      const hpPower = (stats.maxHealth || 1000) * 1.2;
      const shieldPower = (stats.maxShield || 0) * 1.5;
      const defensePower = (stats.defense || 0) * 8.5;

      // 2. Chỉ số tấn công & sát thương
      const attackPower = (stats.baseAttack || 100) * 12.0;
      const critMultiplier = (stats.critMultiplier || 1.5);
      const critRate = Math.min(1.0, stats.critRate || 0.05);
      const offensiveScore = attackPower * (1 + (critRate * critMultiplier));

      // 3. Hệ số bổ trợ từ tốc đánh, hồi chiêu và né tránh
      const attackSpeedScore = ((stats.attackSpeedMultiplier || 1.0) - 1.0) * 3500;
      const cdrScore = (stats.cooldownReduction || 0) * 4500;
      const moveSpeedScore = ((stats.moveSpeedMultiplier || 1.0) - 1.0) * 1200;

      // 4. Giá trị phẩm cấp vũ khí và cổ vật trang bị
      let gearScore = 0;
      if (player.equippedWeapon) {
        const weaponTierMultipliers = { Common: 500, Rare: 1200, Epic: 2800, Legendary: 6500, Divine: 15000 };
        gearScore += weaponTierMultipliers[player.equippedWeapon.rarity] || 500;
        gearScore += (player.equippedWeapon.upgradeLevel || 0) * 450;
      }

      if (Array.isArray(player.equippedArtifacts)) {
        player.equippedArtifacts.forEach(art => {
          if (!art) return;
          const artTiers = { Common: 300, Rare: 800, Epic: 1800, Legendary: 4000, Divine: 9500 };
          gearScore += artTiers[art.rarity] || 300;
        });
      }

      // 5. Cấp độ nhân vật và tầng tháp tối đa đạt được
      const levelScore = (state.level || 1) * 850;
      const floorBonus = (state.maxAbyssFloor || 0) * 350;

      const totalPower = Math.floor(
        hpPower + shieldPower + defensePower + offensiveScore +
        attackSpeedScore + cdrScore + moveSpeedScore + gearScore +
        levelScore + floorBonus
      );

      state.combatPower = Math.max(1000, totalPower);
      return state.combatPower;
    }

    /**
     * Xác định danh hiệu Kỷ Nguyên dựa theo Tầng Tháp và Chiến Lực
     * @param {number} floor 
     * @param {number} combatPower 
     * @returns {string} Danh hiệu hiển thị
     */
    getPlayerTitle(floor, combatPower) {
      if (floor >= 100 || combatPower >= 500000) return 'Chúa Tể Thời Không Chi Phối';
      if (floor >= 70 || combatPower >= 250000) return 'Đại Hiệp Sĩ Hư Không';
      if (floor >= 50 || combatPower >= 120000) return 'Kẻ Phá Vỡ Dòng Thời Gian';
      if (floor >= 30 || combatPower >= 60000) return 'Chiến Binh Kỷ Nguyên Cyber';
      if (floor >= 15 || combatPower >= 25000) return 'Nhà Thám Hiểm Cổ Đại';
      return 'Kẻ Du Hành Tập Sự';
    }

    /**
     * Đồng bộ số liệu nhân vật lên Firebase Realtime Database
     * Cập nhật đồng thời 2 nhánh bảng xếp hạng: 'abyss_floor' và 'combat_power'
     */
    syncPlayerScoreToFirebase() {
      if (!this.db && window.db) {
        this.db = window.db;
      }

      if (!this.db) {
        console.warn('[Leaderboard] Không tìm thấy window.db. Bỏ qua đồng bộ Firebase.');
        return;
      }

      const state = window.Game.state;
      if (!state || !state.player) return;

      const playerId = state.playerId || ('player_' + (state.playerName || 'Traveler').toLowerCase().replace(/\s+/g, '_'));
      const playerName = state.playerName || 'Kẻ Du Hành Thời Không';
      const combatPower = this.calculateCombatPower();
      const maxFloor = state.maxAbyssFloor || 1;
      const title = this.getPlayerTitle(maxFloor, combatPower);
      const equippedWeapon = state.player.equippedWeapon ? {
        id: state.player.equippedWeapon.id || 'chrono_blade',
        name: state.player.equippedWeapon.name || 'Thanh Kiếm Thời Không',
        rarity: state.player.equippedWeapon.rarity || 'Epic',
        upgradeLevel: state.player.equippedWeapon.upgradeLevel || 0
      } : {
        id: 'novice_blade',
        name: 'Đoản Kiếm Rỉ Sét',
        rarity: 'Common',
        upgradeLevel: 0
      };

      const payload = {
        playerId: playerId,
        displayName: playerName,
        avatarBadge: state.avatarBadge || 'temporal_wanderer_badge',
        combatPower: combatPower,
        maxAbyssFloor: maxFloor,
        playerTitle: title,
        equippedWeapon: equippedWeapon,
        currentEraAffinity: this.abyssState.currentEra || 'PRESENT',
        lastUpdated: Date.now()
      };

      try {
        // Ghi dữ liệu vào nhánh chính người chơi
        const userRef = this.db.ref('leaderboards/users/' + playerId);
        userRef.set(payload, (error) => {
          if (error) {
            console.error('[Leaderboard] Lỗi khi đồng bộ hồ sơ người chơi lên Firebase:', error);
          } else {
            console.log('%c[Leaderboard] Đã đồng bộ thành tích người chơi lên Firebase thành công!', 'color: #00e676;');
          }
        });

        // Đẩy vào bảng chỉ số leo tháp
        this.db.ref('leaderboards/by_abyss_floor/' + playerId).set({
          displayName: playerName,
          maxAbyssFloor: maxFloor,
          combatPower: combatPower,
          title: title,
          equippedWeapon: equippedWeapon,
          lastUpdated: Date.now()
        });

        // Đẩy vào bảng chỉ số chiến lực
        this.db.ref('leaderboards/by_combat_power/' + playerId).set({
          displayName: playerName,
          combatPower: combatPower,
          maxAbyssFloor: maxFloor,
          title: title,
          equippedWeapon: equippedWeapon,
          lastUpdated: Date.now()
        });
      } catch (err) {
        console.error('[Leaderboard] Ngoại lệ khi kết nối Firebase Realtime Database:', err);
      }
    }

    /**
     * Truy xuất dữ liệu Bảng Xếp Hạng từ Firebase Realtime Database theo thời gian thực
     * @param {boolean} forceRefresh Có bỏ qua thời gian cache hay không
     */
    fetchGlobalLeaderboard(forceRefresh = false) {
      if (!this.db && window.db) {
        this.db = window.db;
      }

      const now = Date.now();
      // Cache 30 giây để tránh flood request liên tục
      if (!forceRefresh && (now - this.leaderboardData.lastFetchTimestamp < 30000)) {
        this._renderLeaderboardUI();
        return;
      }

      if (!this.db) {
        console.warn('[Leaderboard] Offline: Tạo bảng xếp hạng giả lập cục bộ do thiếu window.db.');
        this._generateMockLeaderboardData();
        this._renderLeaderboardUI();
        return;
      }

      this.leaderboardData.isFetching = true;

      // 1. Lắng nghe/Truy vấn Top Tầng Tháp Vô Tận
      const abyssQuery = this.db.ref('leaderboards/by_abyss_floor')
        .orderByChild('maxAbyssFloor')
        .limitToLast(ABYSS_CONSTANTS.LEADERBOARD_FETCH_LIMIT);

      abyssQuery.once('value', (snapshot) => {
        const list = [];
        snapshot.forEach((child) => {
          list.push(Object.assign({ id: child.key }, child.val()));
        });
        // Firebase order tăng dần, cần đảo ngược để lấy từ Top 1 xuống
        list.reverse();
        this.leaderboardData.abyssFloorList = list;

        // 2. Truy vấn Top Chiến Lực
        const cpQuery = this.db.ref('leaderboards/by_combat_power')
          .orderByChild('combatPower')
          .limitToLast(ABYSS_CONSTANTS.LEADERBOARD_FETCH_LIMIT);

        cpQuery.once('value', (cpSnapshot) => {
          const cpList = [];
          cpSnapshot.forEach((child) => {
            cpList.push(Object.assign({ id: child.key }, child.val()));
          });
          cpList.reverse();
          this.leaderboardData.combatPowerList = cpList;
          this.leaderboardData.isFetching = false;
          this.leaderboardData.lastFetchTimestamp = Date.now();

          this._renderLeaderboardUI();
        }, (error) => {
          console.error('[Leaderboard] Lỗi đọc bảng Chiến Lực Firebase:', error);
          this.leaderboardData.isFetching = false;
        });

      }, (error) => {
        console.error('[Leaderboard] Lỗi đọc bảng Tầng Tháp Firebase:', error);
        this.leaderboardData.isFetching = false;
        this._generateMockLeaderboardData();
        this._renderLeaderboardUI();
      });
    }

    /**
     * Dữ liệu giả lập chuẩn khi offline hoặc Firebase chưa kết nối
     */
    _generateMockLeaderboardData() {
      const state = window.Game.state || {};
      const myPower = this.calculateCombatPower();
      const myFloor = state.maxAbyssFloor || 12;

      this.leaderboardData.abyssFloorList = [
        { id: 'p_1', displayName: 'Chrono_Zero', maxAbyssFloor: 388, combatPower: 980400, title: 'Chúa Tể Thời Không Chi Phối', equippedWeapon: { name: 'Thần Kiếm Vĩnh Cửu', rarity: 'Divine', upgradeLevel: 15 } },
        { id: 'p_2', displayName: 'ShadowWalker_VN', maxAbyssFloor: 295, combatPower: 765200, title: 'Chúa Tể Thời Không Chi Phối', equippedWeapon: { name: 'Trọng Kiếm Hư Vô', rarity: 'Legendary', upgradeLevel: 12 } },
        { id: 'p_3', displayName: 'Bảo_ChronoKnight', maxAbyssFloor: Math.max(120, myFloor), combatPower: Math.max(340000, myPower), title: 'Đại Hiệp Sĩ Hư Không', equippedWeapon: { name: 'Lưỡi Hái Lượng Tử', rarity: 'Epic', upgradeLevel: 10 } },
        { id: 'p_4', displayName: 'CyberValkyrie', maxAbyssFloor: 110, combatPower: 310500, title: 'Đại Hiệp Sĩ Hư Không', equippedWeapon: { name: 'Súng Điện Từ Raygun', rarity: 'Epic', upgradeLevel: 8 } },
        { id: 'p_5', displayName: 'Nguyen_Hoang_99', maxAbyssFloor: 84, combatPower: 220100, title: 'Kẻ Phá Vỡ Dòng Thời Gian', equippedWeapon: { name: 'Song Đao Nham Thạch', rarity: 'Rare', upgradeLevel: 7 } },
        { id: 'p_6', displayName: 'PastGladiator', maxAbyssFloor: 65, combatPower: 165000, title: 'Kẻ Phá Vỡ Dòng Thời Gian', equippedWeapon: { name: 'Rìu Đại Cổ Sinh', rarity: 'Rare', upgradeLevel: 6 } },
        { id: 'p_7', displayName: state.playerName || 'Bảo (Bạn)', maxAbyssFloor: myFloor, combatPower: myPower, title: this.getPlayerTitle(myFloor, myPower), equippedWeapon: state.player?.equippedWeapon || { name: 'Lưỡi Kiếm Nghịch Đảo', rarity: 'Epic', upgradeLevel: 5 } }
      ].sort((a, b) => b.maxAbyssFloor - a.maxAbyssFloor);

      this.leaderboardData.combatPowerList = [...this.leaderboardData.abyssFloorList].sort((a, b) => b.combatPower - a.combatPower);
    }

    /**
     * Mở và hiển thị Modal Bảng Xếp Hạng Trực Tuyến
     */
    openLeaderboardModal() {
      this.fetchGlobalLeaderboard(true);
      const modal = document.getElementById('leaderboard-modal');
      if (modal) {
        modal.style.display = 'flex';
      }
    }

    /**
     * Đóng Modal Bảng Xếp Hạng
     */
    closeLeaderboardModal() {
      const modal = document.getElementById('leaderboard-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    }

    /**
     * Render bảng xếp hạng chi tiết vào phần tử `#leaderboard-modal`
     */
    _renderLeaderboardUI() {
      let modal = document.getElementById('leaderboard-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'leaderboard-modal';
        modal.className = 'chrono-modal-overlay';
        document.body.appendChild(modal);
      }

      const activeTab = this.leaderboardData.activeTab;
      const dataList = activeTab === 'abyss' ? this.leaderboardData.abyssFloorList : this.leaderboardData.combatPowerList;
      const state = window.Game.state || {};
      const myPlayerName = state.playerName || 'Kẻ Du Hành';

      modal.innerHTML = `
        <div class="leaderboard-window">
          <div class="leaderboard-header">
            <div class="header-title">
              <span class="header-icon">🏆</span>
              <h2>BẢNG VINH DANH THỜI KHÔNG</h2>
            </div>
            <button class="modal-close-btn" id="close-leaderboard-btn">&times;</button>
          </div>

          <div class="leaderboard-tabs">
            <button class="tab-btn ${activeTab === 'abyss' ? 'active' : ''}" id="tab-abyss-rank">
              🗼 Tháp Vô Tận (Tầng Cao Nhất)
            </button>
            <button class="tab-btn ${activeTab === 'combat_power' ? 'active' : ''}" id="tab-cp-rank">
              ⚡ Bảng Chiến Lực (Combat Power)
            </button>
          </div>

          <div class="leaderboard-content-wrapper">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th style="width: 10%;">HẠNG</th>
                  <th style="width: 32%;">NGƯỜI CHƠI & DANH HIỆU</th>
                  <th style="width: 28%;">VŨ KHÍ ĐANG DÙNG</th>
                  <th style="width: 15%; text-align: center;">TẦNG THÁP</th>
                  <th style="width: 15%; text-align: right;">CHIẾN LỰC</th>
                </tr>
              </thead>
              <tbody>
                ${dataList.length === 0 ? `
                  <tr><td colspan="5" class="empty-text">Đang đồng bộ dữ liệu máy chủ Thời Không...</td></tr>
                ` : dataList.map((item, index) => {
                  const rank = index + 1;
                  let rankBadge = rank;
                  if (rank === 1) rankBadge = '🥇';
                  else if (rank === 2) rankBadge = '🥈';
                  else if (rank === 3) rankBadge = '🥉';

                  const isMe = (item.displayName === myPlayerName);
                  const weapon = item.equippedWeapon || { name: 'Đoản Kiếm', rarity: 'Common', upgradeLevel: 0 };
                  const weaponRarityClass = (weapon.rarity || 'Common').toLowerCase();

                  return `
                    <tr class="leaderboard-row rank-${rank} ${isMe ? 'my-rank-highlight' : ''}">
                      <td class="rank-col">${rankBadge}</td>
                      <td class="player-col">
                        <div class="player-info-container">
                          <div class="player-name-wrapper">
                            <span class="player-name">${item.displayName}</span>
                            ${isMe ? '<span class="you-badge">(Bạn)</span>' : ''}
                          </div>
                          <span class="player-title-tag">${item.title || 'Kẻ Du Hành'}</span>
                        </div>
                      </td>
                      <td class="weapon-col">
                        <span class="weapon-tag rarity-${weaponRarityClass}">
                          ${weapon.name} ${weapon.upgradeLevel > 0 ? `+${weapon.upgradeLevel}` : ''}
                        </span>
                      </td>
                      <td class="floor-col" style="text-align: center;">
                        <span class="floor-badge">Tầng ${item.maxAbyssFloor || 1}</span>
                      </td>
                      <td class="cp-col" style="text-align: right;">
                        <span class="cp-value">${(item.combatPower || 0).toLocaleString()}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="leaderboard-footer">
            <span class="firebase-status-indicator">
              ● Trạng thái kết nối: ${this.db ? '<b style="color:#00ff88;">Firebase Realtime Online</b>' : '<b style="color:#ffbb00;">Ngoại Tuyến (Local Cache)</b>'}
            </span>
            <button class="refresh-leaderboard-btn" id="refresh-leaderboard-btn">🔄 Làm mới ngay</button>
          </div>
        </div>
      `;

      // Gắn sự kiện chuyển tab và đóng modal
      const closeBtn = document.getElementById('close-leaderboard-btn');
      if (closeBtn) closeBtn.onclick = () => this.closeLeaderboardModal();

      const tabAbyss = document.getElementById('tab-abyss-rank');
      if (tabAbyss) tabAbyss.onclick = () => {
        this.leaderboardData.activeTab = 'abyss';
        this._renderLeaderboardUI();
      };

      const tabCP = document.getElementById('tab-cp-rank');
      if (tabCP) tabCP.onclick = () => {
        this.leaderboardData.activeTab = 'combat_power';
        this._renderLeaderboardUI();
      };

      const refreshBtn = document.getElementById('refresh-leaderboard-btn');
      if (refreshBtn) refreshBtn.onclick = () => this.fetchGlobalLeaderboard(true);
    }

    /**
     * ========================================================================
     * PHẦN 3: HỆ THỐNG THỬ THÁCH HẰNG NGÀY (DAILY BOUNTIES ENGINE - MỤC V.6)
     * ========================================================================
     */

    /**
     * Khởi tạo bộ máy Daily Bounties: Kiểm tra ngày mới và sinh 4 nhiệm vụ
     */
    _initDailyBounties() {
      const todayKey = this._getTodayDateString();
      this.dailyBountiesState.currentDateKey = todayKey;

      const savedData = localStorage.getItem('chrono_daily_bounties_' + todayKey);
      if (savedData) {
        try {
          this.dailyBountiesState.activeBounties = JSON.parse(savedData);
        } catch (e) {
          this._rollNewDailyBounties(todayKey);
        }
      } else {
        this._rollNewDailyBounties(todayKey);
      }

      this._bindBountyEventListeners();
    }

    /**
     * Lấy chuỗi định danh ngày dạng YYYY-MM-DD theo múi giờ địa phương
     */
    _getTodayDateString() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    /**
     * Thuật toán bốc 4 nhiệm vụ ngẫu nhiên từ kho 25 DAILY_BOUNTIES_POOL dựa theo seed ngày
     * @param {string} dateKey 
     */
    _rollNewDailyBounties(dateKey) {
      // Dùng hàm băm chuỗi ngày để người chơi có chung bộ nhiệm vụ công bằng theo ngày
      let seed = 0;
      for (let i = 0; i < dateKey.length; i++) {
        seed = ((seed << 5) - seed) + dateKey.charCodeAt(i);
        seed |= 0;
      }
      seed = Math.abs(seed);

      const poolCopy = [...DAILY_BOUNTIES_POOL];
      const picked = [];

      for (let i = 0; i < ABYSS_CONSTANTS.DAILY_BOUNTY_COUNT; i++) {
        const index = (seed + i * 7) % poolCopy.length;
        const template = poolCopy.splice(index, 1)[0];

        picked.push({
          id: template.id,
          title: template.title,
          description: template.description,
          icon: template.icon,
          eventType: template.eventType,
          currentValue: 0,
          targetValue: template.targetValue,
          reward: template.reward,
          isCompleted: false,
          isClaimed: false
        });
      }

      this.dailyBountiesState.activeBounties = picked;
      this._saveDailyBountiesState();
      console.log(`%c[Bounties] Đã làm mới 4 Thử Thách Hằng Ngày cho ngày: ${dateKey}`, 'color: #00e5ff; font-weight: bold;');
    }

    /**
     * Lưu trạng thái tiến độ thử thách vào LocalStorage
     */
    _saveDailyBountiesState() {
      const key = 'chrono_daily_bounties_' + this.dailyBountiesState.currentDateKey;
      localStorage.setItem(key, JSON.stringify(this.dailyBountiesState.activeBounties));
    }

    /**
     * Lắng nghe sự kiện từ toàn bộ hệ sinh thái Game (Combat, Enemies, Systems)
     */
    _bindBountyEventListeners() {
      if (this.dailyBountiesState.listenersBound) return;

      // Event Bus toàn cục nếu có sẵn
      window.addEventListener('chrono_game_event', (e) => {
        if (!e.detail) return;
        this.triggerBountyEvent(e.detail.eventType, e.detail.amount || 1);
      });

      this.dailyBountiesState.listenersBound = true;
    }

    /**
     * Kích hoạt và gia tăng tiến độ một sự kiện nhiệm vụ theo thời gian thực
     * @param {string} eventType Mã loại sự kiện
     * @param {number} amount Giá trị gia tăng
     */
    triggerBountyEvent(eventType, amount = 1) {
      // Kiểm tra sang ngày mới trong lúc game vẫn đang mở
      const todayKey = this._getTodayDateString();
      if (todayKey !== this.dailyBountiesState.currentDateKey) {
        this._initDailyBounties();
      }

      let hasProgress = false;

      this.dailyBountiesState.activeBounties.forEach(bounty => {
        if (!bounty.isCompleted && bounty.eventType === eventType) {
          bounty.currentValue = Math.min(bounty.targetValue, bounty.currentValue + amount);
          hasProgress = true;

          // Kiểm tra đạt mốc hoàn thành
          if (bounty.currentValue >= bounty.targetValue) {
            bounty.isCompleted = true;
            this._notifyBountyCompleted(bounty);
          }
        }
      });

      if (hasProgress) {
        this._saveDailyBountiesState();
        // Cập nhật giao diện nếu đang mở
        this._updateDailyBountiesUIRealtime();
      }
    }

    /**
     * Hiển thị thông báo trên màn hình khi hoàn thành nhiệm vụ
     * @param {Object} bounty 
     */
    _notifyBountyCompleted(bounty) {
      console.log(`%c[Bounty Hoàn Thành] ${bounty.title} (${bounty.currentValue}/${bounty.targetValue})!`, 'color: #76ff03; font-weight: bold;');
      if (window.Game.Systems && window.Game.Systems.UI && typeof window.Game.Systems.UI.showToast === 'function') {
        window.Game.Systems.UI.showToast(`🎯 Hoàn thành Thử Thách: ${bounty.title}! Nhận thưởng ngay.`, 'success');
      }
    }

    /**
     * Người chơi bấm nhận thưởng nóng trên giao diện Daily Bounties
     * @param {string} bountyId 
     */
    claimBountyReward(bountyId) {
      const bounty = this.dailyBountiesState.activeBounties.find(b => b.id === bountyId);
      if (!bounty || !bounty.isCompleted || bounty.isClaimed) {
        console.warn('[Bounties] Nhiệm vụ chưa hoàn thành hoặc đã nhận thưởng rồi.');
        return;
      }

      const state = window.Game.state;
      if (!state) return;

      // Cộng tài nguyên vào túi đồ
      state.gold = (state.gold || 0) + bounty.reward.gold;
      state.chronoShards = (state.chronoShards || 0) + bounty.reward.shards;
      state.exp = (state.exp || 0) + bounty.reward.exp;

      bounty.isClaimed = true;
      this._saveDailyBountiesState();

      console.log(`%c[Bounty] Đã nhận thưởng nhiệm vụ ${bounty.title}: +${bounty.reward.gold} Vàng, +${bounty.reward.shards} Mảnh, +${bounty.reward.exp} EXP!`, 'color: #ffd700; font-weight: bold;');

      // Hiệu ứng nhận thưởng
      if (window.Game.Systems && window.Game.Systems.UI) {
        window.Game.Systems.UI.showFloatingRewardBanner(bounty.reward);
      }

      // Re-render UI
      this.renderDailyBountiesModal();
    }

    /**
     * Mở Modal Thử Thách Hằng Ngày
     */
    openDailyBountiesModal() {
      this.renderDailyBountiesModal();
      const modal = document.getElementById('daily-bounties-modal');
      if (modal) {
        modal.style.display = 'flex';
      }
    }

    /**
     * Render giao diện Thử Thách Hằng Ngày vào `#daily-bounties-modal`
     */
    renderDailyBountiesModal() {
      let modal = document.getElementById('daily-bounties-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daily-bounties-modal';
        modal.className = 'chrono-modal-overlay';
        document.body.appendChild(modal);
      }

      const bounties = this.dailyBountiesState.activeBounties;

      modal.innerHTML = `
        <div class="bounties-window">
          <div class="bounties-header">
            <div class="header-title">
              <span class="header-icon">📜</span>
              <h2>THỬ THÁCH HẰNG NGÀY (DAILY BOUNTIES)</h2>
            </div>
            <button class="modal-close-btn" id="close-bounties-btn">&times;</button>
          </div>
          <div class="bounties-subheader">
            <span>Tự động làm mới mỗi ngày vào 00:00 (Múi giờ máy chủ). Hoàn thành để tích lũy Mảnh Thời Không 💎 nâng cấp vũ khí.</span>
          </div>

          <div class="bounties-list-container">
            ${bounties.map(b => {
              const progressPct = Math.min(100, Math.floor((b.currentValue / b.targetValue) * 100));
              let statusBtn = '';

              if (b.isClaimed) {
                statusBtn = `<button class="bounty-action-btn claimed" disabled>ĐÃ NHẬN</button>`;
              } else if (b.isCompleted) {
                statusBtn = `<button class="bounty-action-btn claimable" data-bounty-id="${b.id}">NHẬN THƯỞNG</button>`;
              } else {
                statusBtn = `<button class="bounty-action-btn in-progress" disabled>${b.currentValue}/${b.targetValue}</button>`;
              }

              return `
                <div class="bounty-card ${b.isCompleted ? 'completed' : ''} ${b.isClaimed ? 'claimed' : ''}">
                  <div class="bounty-icon-box">${b.icon}</div>
                  <div class="bounty-details">
                    <div class="bounty-card-title">${b.title}</div>
                    <div class="bounty-card-desc">${b.description}</div>
                    <div class="bounty-progress-bar-bg">
                      <div class="bounty-progress-bar-fill" style="width: ${progressPct}%;"></div>
                    </div>
                  </div>
                  <div class="bounty-rewards-box">
                    <span class="reward-tag gold">+${b.reward.gold} 🪙</span>
                    <span class="reward-tag shards">+${b.reward.shards} 💎</span>
                    <span class="reward-tag exp">+${b.reward.exp} EXP</span>
                  </div>
                  <div class="bounty-action-box">
                    ${statusBtn}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      // Gắn sự kiện đóng
      const closeBtn = document.getElementById('close-bounties-btn');
      if (closeBtn) {
        closeBtn.onclick = () => { modal.style.display = 'none'; };
      }

      // Gắn sự kiện các nút nhận thưởng
      const claimButtons = modal.querySelectorAll('.bounty-action-btn.claimable');
      claimButtons.forEach(btn => {
        btn.onclick = (e) => {
          const id = e.target.getAttribute('data-bounty-id');
          this.claimBountyReward(id);
        };
      });
    }

    /**
     * Cập nhật nhanh thanh tiến độ nếu modal đang mở trên DOM
     */
    _updateDailyBountiesUIRealtime() {
      const modal = document.getElementById('daily-bounties-modal');
      if (modal && modal.style.display !== 'none') {
        this.renderDailyBountiesModal();
      }
    }

    /**
     * ========================================================================
     * PHẦN 4: BẢNG THỐNG KÊ SÁT THƯƠNG CUỐI TRẬN (COMBAT RECAP & CANVAS CHART - MỤC V.9)
     * ========================================================================
     */

    /**
     * Liên kết tự động móc nối (Hooks) vào hệ thống Game.Combat
     */
    _bindCombatRecapHooks() {
      const combat = window.Game.Combat;
      if (!combat) return;

      // Lưu trữ hàm gốc để bọc (wrap) mà không phá vỡ logic cũ
      const originalApplyDamage = combat.applyDamage;
      if (typeof originalApplyDamage === 'function') {
        combat.applyDamage = (target, amount, damageType, source) => {
          const result = originalApplyDamage.apply(combat, [target, amount, damageType, source]);
          if (source && source.isPlayer) {
            this.recordDamageDealt(damageType, amount);
          }
          return result;
        };
      }

      const originalPlayerTakeDamage = combat.onPlayerTakeDamage;
      if (typeof originalPlayerTakeDamage === 'function') {
        combat.onPlayerTakeDamage = (amount, isBlockedByShield) => {
          if (isBlockedByShield) {
            this.recordShieldBlock(amount);
          } else {
            this.recordDamageTaken(amount);
          }
          return originalPlayerTakeDamage.apply(combat, [amount, isBlockedByShield]);
        };
      }
    }

    /**
     * Đặt lại toàn bộ số liệu thống kê trận đấu
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
          dots: 0
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
        cycleStartTime: Date.now(),
        cycleDurationSeconds: 0
      };
    }

    /**
     * Ghi nhận sát thương người chơi gây ra theo từng nguồn
     * @param {string} type Loại sát thương ('melee', 'ranged', 'skill', 'chainLightning', 'ashBlast', 'familiar', 'parryCounter')
     * @param {number} amount Lượng sát thương thực tế
     */
    recordDamageDealt(type, amount) {
      const validAmount = Math.max(0, amount || 0);
      this.combatRecap.totalDamageDealt += validAmount;
      this.combatRecap.sliceDamageAccumulator += validAmount;

      if (this.combatRecap.damageBreakdown.hasOwnProperty(type)) {
        this.combatRecap.damageBreakdown[type] += validAmount;
      } else {
        this.combatRecap.damageBreakdown.skill += validAmount;
      }

      // Kích hoạt tiến độ nhiệm vụ Sấm Sét Lan Truyền
      if (type === 'chainLightning') {
        this.triggerBountyEvent('ON_LIGHTNING_DAMAGE_DEALT', validAmount);
      }
      // Kích hoạt tiến độ nhiệm vụ Tinh Linh
      if (type === 'familiar') {
        this.triggerBountyEvent('ON_FAMILIAR_DAMAGE_DEALT', validAmount);
      }
    }

    /**
     * Ghi nhận sát thương người chơi nhận vào người
     * @param {number} amount 
     */
    recordDamageTaken(amount) {
      const val = Math.max(0, amount || 0);
      this.combatRecap.damageTaken += val;
      this.abyssState.floorDamageTaken += val;
    }

    /**
     * Ghi nhận lượng sát thương đã triệt tiêu bằng Khiên Lượng Tử
     * @param {number} amount 
     */
    recordShieldBlock(amount) {
      const val = Math.max(0, amount || 0);
      this.combatRecap.damageBlockedByShield += val;
      this.triggerBountyEvent('ON_DAMAGE_BLOCKED_BY_SHIELD', val);
    }

    /**
     * Ghi nhận phản xạ đạn (Parry) thành công
     */
    recordParry() {
      this.combatRecap.bulletsParried++;
      this.triggerBountyEvent('ON_PARRY_BULLET', 1);
    }

    /**
     * Ghi nhận né hoàn hảo (Perfect Dodge) thành công
     */
    recordPerfectDodge() {
      this.combatRecap.perfectDodges++;
      this.triggerBountyEvent('ON_PERFECT_DODGE', 1);
    }

    /**
     * Cập nhật lát cắt DPS theo thời gian
     * @param {number} deltaTime Giây
     */
    _updateCombatRecapTick(deltaTime) {
      this.combatRecap.sliceTimer += deltaTime;

      if (this.combatRecap.sliceTimer >= ABYSS_CONSTANTS.RECAP_DPS_SLICE_SECONDS) {
        const sliceSec = ABYSS_CONSTANTS.RECAP_DPS_SLICE_SECONDS;
        const currentDPS = Math.round(this.combatRecap.sliceDamageAccumulator / sliceSec);
        const secondElapsed = Math.round((Date.now() - this.combatRecap.cycleStartTime) / 1000);

        this.combatRecap.dpsTimeline.push({
          second: secondElapsed,
          dps: currentDPS,
          damageInSlice: this.combatRecap.sliceDamageAccumulator
        });

        // Reset bộ đếm lát cắt
        this.combatRecap.sliceTimer = 0;
        this.combatRecap.sliceDamageAccumulator = 0;
      }
    }

    /**
     * Chốt số liệu chiến đấu khi kết thúc tầng hoặc kết thúc toàn bộ lượt leo tháp
     */
    finalizeCombatRecap() {
      this.combatRecap.cycleDurationSeconds = Math.max(1, Math.round((Date.now() - this.combatRecap.cycleStartTime) / 1000));
      
      // Đẩy mốc cuối cùng nếu còn sót lại
      if (this.combatRecap.sliceDamageAccumulator > 0) {
        const dps = Math.round(this.combatRecap.sliceDamageAccumulator / Math.max(1, this.combatRecap.sliceTimer));
        this.combatRecap.dpsTimeline.push({
          second: this.combatRecap.cycleDurationSeconds,
          dps: dps,
          damageInSlice: this.combatRecap.sliceDamageAccumulator
        });
      }
    }

    /**
     * Mở Modal Báo Cáo Chiến Tích & Thống Kê Sát Thương Cuối Trận
     */
    openCombatRecapModal() {
      let modal = document.getElementById('combat-recap-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'combat-recap-modal';
        modal.className = 'chrono-modal-overlay';
        document.body.appendChild(modal);
      }

      const recap = this.combatRecap;
      const duration = recap.cycleDurationSeconds || 1;
      const avgDPS = Math.round(recap.totalDamageDealt / duration);
      let maxDPS = 0;
      recap.dpsTimeline.forEach(point => {
        if (point.dps > maxDPS) maxDPS = point.dps;
      });

      modal.innerHTML = `
        <div class="recap-window">
          <div class="recap-header">
            <div class="header-title">
              <span class="header-icon">📊</span>
              <h2>BÁO CÁO THỐNG KÊ CHIẾN TÍCH (COMBAT RECAP)</h2>
            </div>
            <button class="modal-close-btn" id="close-recap-btn">&times;</button>
          </div>

          <div class="recap-summary-grid">
            <div class="summary-metric-card">
              <span class="metric-label">Tổng Sát Thương Gây Ra</span>
              <span class="metric-value highlight-cyan">${recap.totalDamageDealt.toLocaleString()}</span>
            </div>
            <div class="summary-metric-card">
              <span class="metric-label">DPS Trung Bình / Giây</span>
              <span class="metric-value highlight-yellow">${avgDPS.toLocaleString()}</span>
            </div>
            <div class="summary-metric-card">
              <span class="metric-label">DPS Cao Nhất (Peak)</span>
              <span class="metric-value highlight-orange">${maxDPS.toLocaleString()}</span>
            </div>
            <div class="summary-metric-card">
              <span class="metric-label">Thời Gian Chiến Đấu</span>
              <span class="metric-value">${Math.floor(duration / 60)}m ${duration % 60}s</span>
            </div>
          </div>

          <div class="recap-charts-container">
            <!-- Canvas 1: Biểu đồ đường biến thiên DPS theo thời gian -->
            <div class="chart-box">
              <div class="chart-title">📈 BIẾN THIÊN DPS THEO THỜI GIAN</div>
              <canvas id="recap-dps-canvas" width="460" height="220"></canvas>
            </div>

            <!-- Canvas 2: Biểu đồ hình tròn tỉ trọng nguồn sát thương -->
            <div class="chart-box">
              <div class="chart-title">🍩 TỈ TRỌNG NGUỒN SÁT THƯƠNG</div>
              <canvas id="recap-breakdown-canvas" width="460" height="220"></canvas>
            </div>
          </div>

          <div class="recap-kpi-footer">
            <div class="kpi-item">🛡️ Đã Chặn Bằng Khiên: <b>${recap.damageBlockedByShield.toLocaleString()}</b></div>
            <div class="kpi-item">🩸 Sát Thương Nhận: <b>${recap.damageTaken.toLocaleString()}</b></div>
            <div class="kpi-item">⚔️ Chém Phản Đạn: <b>${recap.bulletsParried}</b> lần</div>
            <div class="kpi-item">💨 Né Hoàn Hảo: <b>${recap.perfectDodges}</b> lần</div>
            <div class="kpi-item">💀 Tổng Số Diệt: <b>${recap.totalKills}</b> (Boss: <b>${recap.killsByTier.overlord + recap.killsByTier.miniboss}</b>)</div>
          </div>

          <div class="recap-buttons">
            <button class="recap-confirm-btn" id="recap-confirm-btn">XÁC NHẬN & QUAY VỀ</button>
          </div>
        </div>
      `;

      modal.style.display = 'flex';

      // Vẽ 2 biểu đồ Canvas chi tiết
      this._drawDPSLineChart('recap-dps-canvas');
      this._drawDamagePieChart('recap-breakdown-canvas');

      const closeBtn = document.getElementById('close-recap-btn');
      if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };

      const confirmBtn = document.getElementById('recap-confirm-btn');
      if (confirmBtn) confirmBtn.onclick = () => { modal.style.display = 'none'; };
    }

    /**
     * Vẽ Biểu đồ đường biến thiên DPS theo trục tọa độ (Line Chart Canvas)
     * @param {string} canvasId 
     */
    _drawDPSLineChart(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      // Xóa khung vẽ
      ctx.clearRect(0, 0, w, h);

      const timeline = this.combatRecap.dpsTimeline;
      if (!timeline || timeline.length === 0) {
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Không có dữ liệu DPS trong trận.', w / 2, h / 2);
        return;
      }

      const paddingLeft = 55;
      const paddingBottom = 30;
      const paddingTop = 20;
      const paddingRight = 20;

      const graphW = w - paddingLeft - paddingRight;
      const graphH = h - paddingTop - paddingBottom;

      // Tìm giá trị cực đại
      let maxDPS = 100;
      let maxTime = Math.max(1, timeline[timeline.length - 1].second);
      timeline.forEach(p => { if (p.dps > maxDPS) maxDPS = p.dps; });
      maxDPS = Math.ceil(maxDPS * 1.15); // Đệm trần 15%

      // 1. Vẽ lưới tọa độ (Grid lines)
      ctx.strokeStyle = '#223344';
      ctx.lineWidth = 1;
      const gridRows = 4;
      for (let i = 0; i <= gridRows; i++) {
        const y = paddingTop + (graphH / gridRows) * i;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(w - paddingRight, y);
        ctx.stroke();

        // Label giá trị trục Y
        const val = Math.round(maxDPS - (maxDPS / gridRows) * i);
        ctx.fillStyle = '#78909c';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val, paddingLeft - 8, y + 3);
      }

      // 2. Vẽ vùng Gradient dưới đường cong DPS
      const gradient = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
      gradient.addColorStop(0, 'rgba(0, 229, 255, 0.45)');
      gradient.addColorStop(1, 'rgba(0, 229, 255, 0.0)');

      ctx.beginPath();
      timeline.forEach((point, idx) => {
        const x = paddingLeft + (point.second / maxTime) * graphW;
        const y = paddingTop + graphH - (point.dps / maxDPS) * graphH;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      // Đóng vùng để tô gradient
      const lastX = paddingLeft + (timeline[timeline.length - 1].second / maxTime) * graphW;
      ctx.lineTo(lastX, paddingTop + graphH);
      ctx.lineTo(paddingLeft, paddingTop + graphH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // 3. Vẽ đường biểu diễn chính (Stroke)
      ctx.beginPath();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      timeline.forEach((point, idx) => {
        const x = paddingLeft + (point.second / maxTime) * graphW;
        const y = paddingTop + graphH - (point.dps / maxDPS) * graphH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 4. Vẽ các chấm điểm mốc (Nodes)
      timeline.forEach(point => {
        const x = paddingLeft + (point.second / maxTime) * graphW;
        const y = paddingTop + graphH - (point.dps / maxDPS) * graphH;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0091ea';
        ctx.stroke();
      });

      // Trục X label
      ctx.fillStyle = '#78909c';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('0s', paddingLeft, h - 10);
      ctx.fillText(`${maxTime}s (Thời gian)`, paddingLeft + graphW / 2, h - 10);
    }

    /**
     * Vẽ Biểu đồ hình vành khuyên (Donut Chart) phân bổ tỉ trọng nguồn sát thương
     * @param {string} canvasId 
     */
    _drawDamagePieChart(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const bd = this.combatRecap.damageBreakdown;
      const total = this.combatRecap.totalDamageDealt;

      if (total <= 0) {
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chưa gây sát thương nào.', w / 2, h / 2);
        return;
      }

      // Nhãn và màu chuẩn của từng loại
      const categories = [
        { label: 'Cận Chiến', value: bd.melee, color: '#ff5252' },
        { label: 'Tầm Xa', value: bd.ranged, color: '#ffab00' },
        { label: 'Kỹ Năng', value: bd.skill, color: '#7c4dff' },
        { label: 'Sấm Sét Lan', value: bd.chainLightning, color: '#00e5ff' },
        { label: 'Bùng Nổ Tro', value: bd.ashBlast, color: '#ff6d00' },
        { label: 'Tinh Linh', value: bd.familiar, color: '#00e676' },
        { label: 'Phản Đạn', value: bd.parryCounter, color: '#e040fb' }
      ].filter(c => c.value > 0);

      const centerX = 120;
      const centerY = h / 2;
      const outerRadius = 75;
      const innerRadius = 45;

      let startAngle = -Math.PI / 2;

      // 1. Vẽ các lát cắt Donut
      categories.forEach(item => {
        const sliceAngle = (item.value / total) * (Math.PI * 2);
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
        ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();

        startAngle = endAngle;
      });

      // 2. Chữ chính giữa Donut
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('100%', centerX, centerY - 2);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#80deea';
      ctx.fillText('Sát Thương', centerX, centerY + 12);

      // 3. Vẽ Legend danh sách bên phải
      const legendX = 225;
      let legendY = 30;
      const lineSpacing = 24;

      categories.forEach(item => {
        const pct = ((item.value / total) * 100).toFixed(1);

        // Chấm màu
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY - 8, 12, 12);

        // Tên mục
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.label, legendX + 18, legendY + 2);

        // Giá trị & %
        ctx.fillStyle = '#90a4ae';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${pct}% (${item.value.toLocaleString()})`, w - 20, legendY + 2);

        legendY += lineSpacing;
      });
    }

    /**
     * ========================================================================
     * CSS STYLES & GẮN SỰ KIỆN GIAO DIỆN (LIVEOPS DOM INTEGRATION)
     * ========================================================================
     */

    /**
     * Tự động tiêm (Inject) toàn bộ CSS cần thiết cho các Modal Tháp, Xếp Hạng, Bounties và Recap
     */
    _injectCSS() {
      if (document.getElementById('chrono-abyss-bounties-styles')) return;

      const styleEl = document.createElement('style');
      styleEl.id = 'chrono-abyss-bounties-styles';
      styleEl.innerHTML = `
        /* Overlay chung */
        .abyss-modal-overlay, .chrono-modal-overlay {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(4, 7, 16, 0.88);
          backdrop-filter: blur(8px);
          display: none;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #fff;
          box-sizing: border-box;
        }

        /* 1. Modal Bùa Lợi Thời Không */
        .blessing-container {
          background: linear-gradient(145deg, #0d1b2a, #1b263b);
          border: 2px solid #00f0ff;
          border-radius: 14px;
          padding: 24px;
          width: 860px;
          max-width: 95vw;
          box-shadow: 0 0 35px rgba(0, 240, 255, 0.35);
          text-align: center;
        }
        .blessing-header h2 {
          color: #00f0ff;
          margin-bottom: 6px;
          letter-spacing: 1px;
          text-shadow: 0 0 12px #00f0ff;
        }
        .blessing-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-top: 24px;
        }
        .blessing-card {
          background: #09111e;
          border-radius: 10px;
          padding: 18px 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px solid #334;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .blessing-card:hover {
          transform: translateY(-5px);
        }
        .blessing-card.rarity-common { border-color: #9e9e9e; box-shadow: 0 0 10px rgba(158,158,158,0.2); }
        .blessing-card.rarity-rare { border-color: #29b6f6; box-shadow: 0 0 14px rgba(41,182,246,0.3); }
        .blessing-card.rarity-epic { border-color: #ab47bc; box-shadow: 0 0 18px rgba(171,71,188,0.4); }
        .blessing-card.rarity-legendary { border-color: #ffa726; box-shadow: 0 0 24px rgba(255,167,38,0.5); }
        .blessing-card.rarity-divine { border-color: #ff1744; box-shadow: 0 0 30px rgba(255,23,68,0.7); }
        
        .blessing-rarity-badge {
          font-size: 11px;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 12px;
          margin-bottom: 12px;
          background: rgba(255,255,255,0.1);
        }
        .blessing-icon { font-size: 42px; margin-bottom: 10px; }
        .blessing-title { font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #fff; }
        .blessing-desc { font-size: 12px; color: #b0bec5; line-height: 1.4; flex-grow: 1; margin-bottom: 16px; }
        .blessing-pick-btn {
          width: 100%;
          background: linear-gradient(90deg, #00b4d8, #0077b6);
          border: none;
          color: #fff;
          font-weight: bold;
          padding: 10px 0;
          border-radius: 6px;
          cursor: pointer;
        }
        .blessing-pick-btn:hover { background: #0096c7; }

        /* 2. Modal Bảng Xếp Hạng Leaderboard */
        .leaderboard-window, .bounties-window, .recap-window {
          background: #0b1320;
          border: 1px solid #1e3a5f;
          border-radius: 12px;
          width: 820px;
          max-width: 95vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 15px 40px rgba(0,0,0,0.8);
          overflow: hidden;
        }
        .leaderboard-header, .bounties-header, .recap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 22px;
          background: #0f1c2e;
          border-bottom: 1px solid #1b3554;
        }
        .header-title { display: flex; align-items: center; gap: 10px; }
        .header-title h2 { font-size: 18px; color: #00f0ff; margin: 0; }
        .modal-close-btn {
          background: none; border: none; color: #78909c; font-size: 26px; cursor: pointer;
        }
        .modal-close-btn:hover { color: #fff; }

        .leaderboard-tabs {
          display: flex;
          background: #080f1a;
          border-bottom: 1px solid #1b3554;
        }
        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          padding: 12px 0;
          color: #90a4ae;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .tab-btn.active {
          color: #00f0ff;
          border-bottom: 2px solid #00f0ff;
          background: rgba(0,240,255,0.06);
        }

        .leaderboard-content-wrapper {
          padding: 12px 20px;
          overflow-y: auto;
          flex-grow: 1;
        }
        .leaderboard-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .leaderboard-table th {
          color: #78909c;
          padding: 10px 8px;
          border-bottom: 1px solid #1b3554;
          text-align: left;
        }
        .leaderboard-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #102238;
        }
        .leaderboard-row:hover { background: rgba(0,240,255,0.04); }
        .leaderboard-row.my-rank-highlight {
          background: rgba(0, 229, 255, 0.12);
          border-left: 3px solid #00e5ff;
        }
        .player-name-wrapper { display: flex; align-items: center; gap: 6px; }
        .player-name { font-weight: bold; color: #fff; }
        .you-badge { color: #00e5ff; font-size: 11px; }
        .player-title-tag { font-size: 11px; color: #90a4ae; }
        .weapon-tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #162438; }
        .floor-badge { background: #004d40; color: #80cbc4; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
        .cp-value { color: #ffb74d; font-family: monospace; font-weight: bold; font-size: 13px; }
        .leaderboard-footer {
          padding: 12px 20px;
          background: #080f1a;
          border-top: 1px solid #1b3554;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }
        .refresh-leaderboard-btn {
          background: #1e3a5f; border: none; color: #fff; padding: 6px 14px; border-radius: 4px; cursor: pointer;
        }
        .refresh-leaderboard-btn:hover { background: #2a5285; }

        /* 3. Modal Bounties */
        .bounties-subheader {
          padding: 10px 22px;
          font-size: 12px;
          color: #90a4ae;
          background: #080f1a;
          border-bottom: 1px solid #16293f;
        }
        .bounties-list-container {
          padding: 16px 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }
        .bounty-card {
          background: #0d1a2d;
          border: 1px solid #1e3758;
          border-radius: 8px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .bounty-card.completed { border-color: #00e676; }
        .bounty-card.claimed { opacity: 0.6; }
        .bounty-icon-box { font-size: 28px; }
        .bounty-details { flex-grow: 1; }
        .bounty-card-title { font-weight: bold; color: #fff; font-size: 14px; margin-bottom: 4px; }
        .bounty-card-desc { font-size: 12px; color: #90a4ae; margin-bottom: 8px; }
        .bounty-progress-bar-bg {
          width: 100%; height: 6px; background: #16263b; border-radius: 3px; overflow: hidden;
        }
        .bounty-progress-bar-fill {
          height: 100%; background: linear-gradient(90deg, #00b4d8, #00f0ff); border-radius: 3px;
        }
        .bounty-rewards-box { display: flex; flex-direction: column; gap: 4px; }
        .reward-tag { font-size: 11px; font-weight: bold; }
        .reward-tag.gold { color: #ffd54f; }
        .reward-tag.shards { color: #80d8ff; }
        .reward-tag.exp { color: #b388ff; }
        .bounty-action-btn {
          border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;
        }
        .bounty-action-btn.claimable { background: #00e676; color: #000; box-shadow: 0 0 10px rgba(0,230,118,0.5); }
        .bounty-action-btn.claimable:hover { background: #69f0ae; }
        .bounty-action-btn.in-progress { background: #1e3046; color: #78909c; cursor: default; }
        .bounty-action-btn.claimed { background: #263238; color: #546e7a; cursor: default; }

        /* 4. Modal Combat Recap */
        .recap-window { width: 960px; }
        .recap-summary-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px 22px; background: #080f1a;
        }
        .summary-metric-card {
          background: #0f1c2e; border: 1px solid #1b3554; border-radius: 8px; padding: 12px; text-align: center;
        }
        .metric-label { font-size: 11px; color: #78909c; display: block; margin-bottom: 6px; }
        .metric-value { font-size: 18px; font-weight: bold; font-family: monospace; }
        .highlight-cyan { color: #00e5ff; }
        .highlight-yellow { color: #ffd54f; }
        .highlight-orange { color: #ff9100; }

        .recap-charts-container {
          display: flex; gap: 16px; padding: 16px 22px; background: #0b1320;
        }
        .chart-box {
          flex: 1; background: #080f1a; border: 1px solid #16293f; border-radius: 8px; padding: 12px; text-align: center;
        }
        .chart-title { font-size: 12px; font-weight: bold; color: #00f0ff; margin-bottom: 8px; text-align: left; }
        .chart-box canvas { width: 100%; height: auto; display: block; }

        .recap-kpi-footer {
          padding: 12px 22px; background: #0d1a2d; display: flex; justify-content: space-between; font-size: 12px; border-top: 1px solid #1b3554;
        }
        .recap-buttons {
          padding: 14px 22px; background: #080f1a; text-align: right; border-top: 1px solid #1b3554;
        }
        .recap-confirm-btn {
          background: linear-gradient(90deg, #00b4d8, #0077b6); border: none; color: #fff; font-weight: bold; padding: 10px 24px; border-radius: 6px; cursor: pointer;
        }
        .recap-confirm-btn:hover { background: #0096c7; }
      `;
      document.head.appendChild(styleEl);
    }

    /**
     * Gắn phím tắt hoặc các nút HUD mở nhanh hệ thống
     */
    _setupUIListeners() {
      this._injectCSS();

      window.addEventListener('keydown', (e) => {
        // Phím 'L': Mở Leaderboard
        if (e.key === 'l' || e.key === 'L') {
          if (!this._isInputFocused()) {
            const modal = document.getElementById('leaderboard-modal');
            if (modal && modal.style.display === 'flex') {
              this.closeLeaderboardModal();
            } else {
              this.openLeaderboardModal();
            }
          }
        }
        // Phím 'B': Mở Daily Bounties
        if (e.key === 'b' || e.key === 'B') {
          if (!this._isInputFocused()) {
            const modal = document.getElementById('daily-bounties-modal');
            if (modal && modal.style.display === 'flex') {
              modal.style.display = 'none';
            } else {
              this.openDailyBountiesModal();
            }
          }
        }
      });
    }

    /**
     * Kiểm tra người chơi có đang gõ văn bản vào thẻ input nào không
     */
    _isInputFocused() {
      const activeEl = document.activeElement;
      return activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    }
  }

  // ==========================================================================
  // KHỞI TẠO SINGLETON & EXPORT RA WINDOW.GAME
  // ==========================================================================
  window.Game.AbyssAndBounties = new AbyssAndBountiesManager();

  // Tự động khởi chạy khi DOM tải xong
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.Game.AbyssAndBounties.init();
    });
  } else {
    window.Game.AbyssAndBounties.init();
  }

})(window);