/**
 * ============================================================================
 * TỰA GAME: KẺ DU HÀNH THỜI KHÔNG (TIME TRAVELER 2D ARPG)
 * MODULE: systems.js - FULLSTACK CORE ENGINE & CLOUD SYNC (PHẦN 1 / 2)
 * ============================================================================
 * KIẾN TRÚC & TÍNH NĂNG ĐỒNG BỘ:
 * 1. FIREBASE REALTIME DATABASE & AUTH:
 *    - Xác thực đăng nhập/đăng ký với salted hash, tài khoản Admin 'bao2010'.
 *    - Live Presence (Online/Offline/Disconnect listener), Cloud Save tự động.
 *    - Bảng xếp hạng Chiến Lực Realtime (Combat Power) cập nhật trực tiếp.
 *    - Bảng điều khiển Server Realtime: Giám sát người chơi, Ban/Unban, Tặng quà.
 * 2. OBJECT POOLS & ZERO-GC OPTIMIZATION:
 *    - Audio Engine WebAudio API có bộ đệm throttle 75ms chống nghẽn luồng.
 *    - FloatingTextPool tái sử dụng mảng tĩnh.
 *    - ChronoRewind snapshot 5 giây đảo ngược thời gian và Hồi sinh lượng tử.
 * ============================================================================
 */

// Dọn dẹp cache dữ liệu phiên cũ để tránh xung đột cấu trúc
try {
    if (typeof window !== 'undefined') {
        if (window.localStorage) window.localStorage.clear();
        if (window.sessionStorage) window.sessionStorage.clear();
    }
} catch (e) {
    console.warn('[Cache] Bỏ qua dọn dẹp storage:', e);
}

window.Game = window.Game || {};

// ============================================================================
// CẤU HÌNH FIREBASE REALTIME DATABASE CHÍNH THỨC
// ============================================================================
const firebaseConfig = {
    apiKey: "AIzaSyAjyxbdkwmhCl2uUIrAY2yEL7n7LTOuUp8",
    authDomain: "timetravelgame-41a62.firebaseapp.com",
    projectId: "timetravelgame-41a62",
    storageBucket: "timetravelgame-41a62.firebasestorage.app",
    messagingSenderId: "39957941518",
    appId: "1:39957941518:web:72135a1558ccbdae441b5f",
    databaseURL: "https://timetravelgame-41a62-default-rtdb.asia-southeast1.firebasedatabase.app"
};

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        window.db = firebase.database();
        console.log('[Firebase] Realtime Database kết nối thành công.');
    } else {
        console.warn('[Firebase] SDK Firebase chưa nạp trên HTML.');
    }
} catch (err) {
    console.error('[Firebase] Lỗi khởi tạo Firebase:', err);
}

// ============================================================================
// 1. CẤU HÌNH NHÂN VẬT TIÊU CHUẨN
// ============================================================================
Game.charactersConfig = {
    time_traveler: {
        id: 'time_traveler',
        name: 'Kẻ Du Hành Thời Không',
        title: 'Bậc Thầy Không Gian',
        role: 'Cận Chiến / Cơ Động',
        avatar: '⚔️',
        description: 'Cân bằng giữa tấn công cơ động, tạo khiên chắn và kiểm soát nhịp độ trận đấu.',
        spriteColor: '#2563eb',
        accentColor: '#38bdf8',
        radius: 20,
        baseHp: 100,
        baseShield: 50,
        baseSpeed: 240,
        hpRegen: 2.5,
        shieldRegenRate: 0.05,
        ccResistance: 0.10,
        skills: [
            { id: 'attack', name: 'Trảm Thời Không', cd: 0, maxCd: 0.42, color: '#f39c12', icon: '⚔️', type: 'WEAPON_DRIVEN' },
            { id: 'dash', name: 'Tốc Biến Thời Không', cd: 0, maxCd: 4.5, color: '#00f2fe', icon: '⚡', type: 'RECT_DASH', range: 240 },
            { id: 'storm', name: 'Vòng Xoáy Hỗn Độn', cd: 0, maxCd: 10.0, color: '#ff0844', icon: '🌀', type: 'AOE_SELF', aoeRadius: 250 },
            { id: 'freeze', name: 'Ngưng Đọng Thời Gian', cd: 0, maxCd: 20.0, color: '#a855f7', icon: '⏳', type: 'FULL_SCREEN' }
        ]
    },
    shadow_assassin: {
        id: 'shadow_assassin',
        name: 'Nữ Sát Thủ Bóng Đêm',
        title: 'Bóng Ma Tốc Độ',
        role: 'Sát Thủ / Tốc Độ Cao',
        avatar: '🗡️',
        description: 'Tốc chạy cực cao, chí mạng khủng nhưng lượng máu và khiên mỏng.',
        spriteColor: '#6d28d9',
        accentColor: '#f43f5e',
        radius: 17,
        baseHp: 80,
        baseShield: 35,
        baseSpeed: 295,
        hpRegen: 1.5,
        shieldRegenRate: 0.085,
        ccResistance: 0.15,
        skills: [
            { id: 'attack', name: 'Chém Quang Ảnh', cd: 0, maxCd: 0.30, color: '#00f2fe', icon: '🗡️', type: 'WEAPON_DRIVEN' },
            { id: 'blink', name: 'Bộ Pháp Vô Ảnh', cd: 0, maxCd: 3.5, color: '#ec4899', icon: '🚀', type: 'RECT_DASH', range: 280 },
            { id: 'shuriken', name: 'Phi Đao Ma Quái', cd: 0, maxCd: 7.0, color: '#f59e0b', icon: '☄️', type: 'SECTOR', range: 410, arc: Math.PI * 0.65 },
            { id: 'overdrive', name: 'Án Tử Hư Vô', cd: 0, maxCd: 18.0, color: '#f43f5e', icon: '🌌', type: 'FULL_SCREEN' }
        ]
    },
    iron_juggernaut: {
        id: 'iron_juggernaut',
        name: 'Hộ Vệ Tinh Vân',
        title: 'Pháo Đài Bất Hoại',
        role: 'Đỡ Đòn / Hồi Phục Cao',
        avatar: '🛡️',
        description: 'Máu và giáp cực lớn, kháng khống chế cao, áp đảo cận chiến diện rộng.',
        spriteColor: '#78350f',
        accentColor: '#f59e0b',
        radius: 24,
        baseHp: 175,
        baseShield: 110,
        baseSpeed: 205,
        hpRegen: 4.5,
        shieldRegenRate: 0.06,
        ccResistance: 0.65,
        skills: [
            { id: 'attack', name: 'Búa Chấn Động', cd: 0, maxCd: 0.46, color: '#f59e0b', icon: '🔨', type: 'WEAPON_DRIVEN' },
            { id: 'warp', name: 'Khiên Đột Kích', cd: 0, maxCd: 5.0, color: '#eab308', icon: '🛡️', type: 'RECT_DASH', range: 230 },
            { id: 'singularity', name: 'Địa Chấn Hủy Diệt', cd: 0, maxCd: 9.5, color: '#ea580c', icon: '🌋', type: 'AOE_SELF', aoeRadius: 260 },
            { id: 'abyss', name: 'Pháo Đài Bất Diệt', cd: 0, maxCd: 22.0, color: '#3b82f6', icon: '🌟', type: 'FULL_SCREEN' }
        ]
    }
};

// ============================================================================
// 2. KHỞI TẠO BỘ TRẠNG THÁI TIÊU CHUẨN (STATE STRUCTS)
// ============================================================================
const DEFAULT_CHARACTER_STATS = {
    time_traveler: { level: 1, exp: 0, maxExp: 100, bonusDamage: 0, bonusHp: 0, bonusShield: 0, bonusSpeed: 0 },
    shadow_assassin: { level: 1, exp: 0, maxExp: 100, bonusDamage: 0, bonusHp: 0, bonusShield: 0, bonusSpeed: 0 },
    iron_juggernaut: { level: 1, exp: 0, maxExp: 100, bonusDamage: 0, bonusHp: 0, bonusShield: 0, bonusSpeed: 0 }
};

const DEFAULT_GAME_STATE = {
    timeline: 'PRESENT',
    gold: 200,
    level: 1,
    exp: 0,
    maxExp: 100,
    potentialPoints: 0,
    rage: 0,
    maxRage: 100,
    chronoFreezeTimer: 0,
    loopLevel: 1,
    timeShards: 0,
    timeShiftCooldown: 0,
    timeShiftMaxCd: 4.0,
    potionCooldown: 0,
    bonusMaxShield: 0,
    bonusSpeed: 0,
    bonusMaxHp: 0,
    isPaused: false,
    minimapExpanded: false,
    adminUnlocked: false,
    adminNoCd: false,
    hasSeed: false,
    isTreePlanted: false,
    chestOiled: false,
    chestOpened: false,
    unlockedWaypoints: [true, false, false],
    currentWeapon: 'iron_sword',
    ownedWeapons: ['iron_sword'],
    weaponLevels: {
        iron_sword: 0,
        cyber_sword: 0,
        laser_gun: 0,
        void_scythe: 0,
        chrono_cannon: 0
    },
    // ĐỒNG BỘ CHÍNH XÁC 10 HIỆU ỨNG VŨ KHÍ TƯƠNG ỨNG VỚI GIAO DIỆN NÂNG CẤP
    weaponEffectLevels: {
        poison: 0,
        burn: 0,
        freeze: 0,
        chain_lightning: 0,
        armor_break: 0,
        gravity_stun: 0,
        dark_drain: 0,
        reactive_blast: 0,
        crit_sniper: 0,
        sonic_wave: 0
    },
    upgradeLevels: {
        hp: 0,
        speed: 0,
        damage: 0
    },
    equippedRelics: [], // Tối đa 4 Cổ Vật đang trang bị
    ownedRelics: [],    // Danh sách toàn bộ Cổ Vật đang sở hữu (Kho Balo)
    hasPet: false,
    petEvolutionLevel: 0,
    petShieldCooldown: 0,
    secondChanceAvailable: true,
    lastStandCooldown: 0,
    lastEmergencyReliefTimestamp: 0,
    achievements: [],
    currentTitle: 'Kẻ Du Hành Tân Thủ',
    usedGiftcodes: [],
    godMode: false,
    unlockedCharacters: ['time_traveler', 'shadow_assassin', 'iron_juggernaut'],
    selectedCharacter: 'time_traveler',
    characterStats: JSON.parse(JSON.stringify(DEFAULT_CHARACTER_STATS))
};

const DEFAULT_PLAYER_STATE = {
    x: 1920,
    y: 1920,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 240,
    hp: 100,
    maxHp: 100,
    radius: 20,
    baseDamageBonus: 0,
    shield: 50,
    maxShield: 50,
    shieldCooldown: 0,
    dashTime: 0,
    hitStopTimer: 0,
    screenShake: 0,
    characterId: 'time_traveler',
    ccResistance: 0.10,
    hpRegen: 2.5,
    shieldRegenRate: 0.05,
    skills: []
};

Game.state = Object.assign({}, DEFAULT_GAME_STATE, Game.state || {});
Game.player = Object.assign({}, DEFAULT_PLAYER_STATE, Game.player || {});
Game.camera = Game.camera || { x: 0, y: 0, width: 800, height: 600, zoom: 1.0 };

// ============================================================================
// 3. AUDIO ENGINE VỚI THROTTLING CHỐNG DROP FPS
// ============================================================================
Game.Audio = {
    ctx: null,
    muted: false,
    _lastPlayTimestamps: {},
    AUDIO_THROTTLE_MS: 75,

    getContext: function () {
        if (this.muted) return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    },

    canPlaySound: function (soundKey) {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const last = this._lastPlayTimestamps[soundKey] || 0;
        if (now - last < this.AUDIO_THROTTLE_MS) return false;
        this._lastPlayTimestamps[soundKey] = now;
        return true;
    },

    playSlash: function () {
        if (!this.canPlaySound('slash')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    },

    playLaser: function () {
        if (!this.canPlaySound('laser')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
    },

    playExplosion: function () {
        if (!this.canPlaySound('explosion')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const bufferSize = Math.floor(ctx.sampleRate * 0.35);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(420, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + 0.34);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.35);
    },

    playCoin: function () {
        if (!this.canPlaySound('coin')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.07);
        gain.gain.setValueAtTime(0.20, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
    },

    playTimeShift: function () {
        if (!this.canPlaySound('timeShift')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(220, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.28);
        osc1.frequency.exponentialRampToValueAtTime(440, now + 0.45);
        osc2.frequency.setValueAtTime(110, now);
        osc2.frequency.exponentialRampToValueAtTime(660, now + 0.45);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.46);
        osc2.stop(now + 0.46);
    },

    playRewind: function () {
        if (!this.canPlaySound('rewind')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.30);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.55);
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.58);
    },

    playShieldPulse: function () {
        if (!this.canPlaySound('shieldPulse')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
    },

    playLevelUp: function () {
        if (!this.canPlaySound('levelUp')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            const startTime = now + idx * 0.08;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.22, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.26);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.26);
        });
    },

    playFreeze: function () {
        if (!this.canPlaySound('freeze')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.55);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.56);
    }
};

// ============================================================================
// 4. FLOATING TEXT POOLING (ZERO ALLOCATION RUNTIME)
// ============================================================================
Game.FloatingTextPool = {
    MAX_TEXTS: 30,
    pool: [],

    init: function () {
        this.pool = [];
        for (let i = 0; i < this.MAX_TEXTS; i++) {
            this.pool.push({
                active: false,
                x: 0,
                y: 0,
                vy: -35,
                text: '',
                color: '#ffffff',
                alpha: 1.0,
                life: 0,
                maxLife: 0.85
            });
        }
    },

    spawn: function (x, y, text, color = '#ffffff') {
        if (this.pool.length === 0) this.init();

        let item = this.pool.find(t => !t.active);
        if (!item) {
            let maxLifeVal = -1;
            for (let i = 0; i < this.pool.length; i++) {
                if (this.pool[i].life > maxLifeVal) {
                    maxLifeVal = this.pool[i].life;
                    item = this.pool[i];
                }
            }
        }

        if (item) {
            item.active = true;
            item.x = x + (Math.random() * 16 - 8);
            item.y = y;
            item.vy = -45 - Math.random() * 20;
            item.text = String(text);
            item.color = color;
            item.alpha = 1.0;
            item.life = 0;
            item.maxLife = 0.85;
        }
    },

    update: function (dt) {
        for (let i = 0; i < this.pool.length; i++) {
            const item = this.pool[i];
            if (!item.active) continue;

            item.life += dt;
            if (item.life >= item.maxLife) {
                item.active = false;
                continue;
            }

            item.y += item.vy * dt;
            item.vy += 20 * dt;
            item.alpha = Math.max(0, 1 - (item.life / item.maxLife));
        }
    },

    render: function (ctx, camera) {
        if (!ctx) return;
        const camX = (camera && camera.x) ? camera.x : 0;
        const camY = (camera && camera.y) ? camera.y : 0;

        let hasActive = false;
        for (let i = 0; i < this.pool.length; i++) {
            if (this.pool[i].active) {
                hasActive = true;
                break;
            }
        }
        if (!hasActive) return;

        ctx.save();
        ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < this.pool.length; i++) {
            const item = this.pool[i];
            if (!item.active) continue;

            const screenX = item.x - camX;
            const screenY = item.y - camY;

            ctx.globalAlpha = item.alpha;
            ctx.fillStyle = '#000000';
            ctx.fillText(item.text, screenX + 1, screenY + 1);

            ctx.fillStyle = item.color;
            ctx.fillText(item.text, screenX, screenY);
        }

        ctx.restore();
    }
};
Game.FloatingTextPool.init();

// ============================================================================
// 5. KỸ NĂNG QUAY NGƯỢC THỜI GIAN & HỒI SINH LƯỢNG TỬ
// ============================================================================
Game.ChronoRewind = {
    BUFFER_SECONDS: 5.0,
    SAMPLE_RATE: 60,
    maxCapacity: 300,
    buffer: [],
    head: 0,
    totalRecorded: 0,
    rewindCooldown: 0,
    maxCooldown: 12.0,

    init: function () {
        this.maxCapacity = Math.round(this.BUFFER_SECONDS * this.SAMPLE_RATE);
        this.buffer = new Array(this.maxCapacity);
        for (let i = 0; i < this.maxCapacity; i++) {
            this.buffer[i] = {
                x: 1920,
                y: 1920,
                hp: 100,
                shield: 50,
                rage: 0,
                timeline: 'PRESENT',
                valid: false
            };
        }
        this.head = 0;
        this.totalRecorded = 0;
        this.rewindCooldown = 0;
    },

    recordSnapshot: function (dt) {
        if (!Game.player || Game.state.isPaused) return;

        if (this.rewindCooldown > 0) {
            this.rewindCooldown = Math.max(0, this.rewindCooldown - dt);
        }

        const slot = this.buffer[this.head];
        slot.x = Game.player.x;
        slot.y = Game.player.y;
        slot.hp = Game.player.hp;
        slot.shield = Game.player.shield;
        slot.rage = Game.state.rage || 0;
        slot.timeline = Game.state.timeline || 'PRESENT';
        slot.valid = true;

        this.head = (this.head + 1) % this.maxCapacity;
        if (this.totalRecorded < this.maxCapacity) {
            this.totalRecorded++;
        }
    },

    activate: function () {
        if (this.rewindCooldown > 0) {
            Game.Systems.notify(`Quay Ngược Hồi Chiêu: ${this.rewindCooldown.toFixed(1)}s`, '#f87171');
            return false;
        }
        if (this.totalRecorded < 15) {
            Game.Systems.notify('Chưa đủ dữ liệu thời gian để quay ngược!', '#94a3b8');
            return false;
        }

        const targetIndex = (this.head - this.totalRecorded + this.maxCapacity) % this.maxCapacity;
        const targetSnapshot = this.buffer[targetIndex];

        if (!targetSnapshot || !targetSnapshot.valid) {
            Game.Systems.notify('Dòng thời gian bị gián đoạn!', '#ef4444');
            return false;
        }

        let maxRecordedHp = Game.player.hp;
        let maxRecordedShield = Game.player.shield;
        for (let i = 0; i < this.totalRecorded; i++) {
            const snap = this.buffer[i];
            if (snap && snap.valid) {
                if (snap.hp > maxRecordedHp) maxRecordedHp = snap.hp;
                if (snap.shield > maxRecordedShield) maxRecordedShield = snap.shield;
            }
        }

        Game.player.x = targetSnapshot.x;
        Game.player.y = targetSnapshot.y;
        Game.player.vx = 0;
        Game.player.vy = 0;
        Game.player.hp = Math.min(Game.player.maxHp, Math.max(Game.player.hp, maxRecordedHp));
        Game.player.shield = Math.min(Game.player.maxShield, Math.max(Game.player.shield, maxRecordedShield));

        this.rewindCooldown = this.maxCooldown;
        this.totalRecorded = 0;

        if (Game.Audio && typeof Game.Audio.playRewind === 'function') {
            Game.Audio.playRewind();
        }

        const flashEl = document.getElementById('time-flash');
        if (flashEl) {
            flashEl.classList.remove('flash-active');
            void flashEl.offsetWidth;
            flashEl.classList.add('flash-active');
            setTimeout(() => flashEl.classList.remove('flash-active'), 450);
        }

        Game.Systems.notify('⏳ QUAY NGƯỢC THỜI GIAN 5 GIÂY!', '#38bdf8');
        Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 20, 'CHRONO REWIND 5s!', '#38bdf8');

        if (Game.World && typeof Game.World.ensureSafePlayerPosition === 'function') {
            Game.World.ensureSafePlayerPosition();
        }

        Game.Systems.updateUI();
        return true;
    },

    triggerSecondChance: function () {
        if (!Game.state.secondChanceAvailable) return false;

        const targetIndex = (this.head - this.totalRecorded + this.maxCapacity) % this.maxCapacity;
        const targetSnapshot = this.buffer[targetIndex] || { x: 1920, y: 1920 };

        Game.state.secondChanceAvailable = false;

        Game.player.x = targetSnapshot.x || 1920;
        Game.player.y = targetSnapshot.y || 1920;
        Game.player.vx = 0;
        Game.player.vy = 0;
        Game.player.hp = Math.round(Game.player.maxHp * 0.50);
        Game.player.shield = Game.player.maxShield;

        this.totalRecorded = 0;
        this.rewindCooldown = this.maxCooldown;

        if (Game.Audio && typeof Game.Audio.playRewind === 'function') {
            Game.Audio.playRewind();
        }
        if (Game.Audio && typeof Game.Audio.playShieldPulse === 'function') {
            Game.Audio.playShieldPulse();
        }

        const flashEl = document.getElementById('time-flash');
        if (flashEl) {
            flashEl.classList.remove('flash-active');
            void flashEl.offsetWidth;
            flashEl.classList.add('flash-active');
            setTimeout(() => flashEl.classList.remove('flash-active'), 600);
        }

        Game.Systems.notify('⚡ HỒI SINH LƯỢNG TỬ KÍCH HOẠT! (50% HP Tối Đa)', '#ffd740');
        Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 45, '✨ SECOND CHANCE!', '#ffd740');

        if (Game.World && typeof Game.World.ensureSafePlayerPosition === 'function') {
            Game.World.ensureSafePlayerPosition();
        }

        Game.Systems.updateUI();
        Game.Systems.saveGame();
        return true;
    }
};
Game.ChronoRewind.init();

// ============================================================================
// 6. BẢNG XẾP HẠNG CHIẾN LỰC REALTIME
// ============================================================================
Game.Leaderboard = {
    _leaderboardListenerRef: null,

    syncCombatPowerToLeaderboard: function () {
        if (!window.db || !Game.Auth.currentUser || Game.Auth.currentUser.role === 'GUEST') return;

        const uid = Game.Auth.currentUser.uid;
        const username = Game.Auth.currentUser.username || uid;
        const combatPower = Game.Systems.calculateCombatPower();
        const level = Game.state.level || 1;
        const characterId = Game.state.selectedCharacter || 'time_traveler';
        const characterName = (Game.charactersConfig[characterId] && Game.charactersConfig[characterId].name) || 'Kẻ Du Hành';

        const payload = {
            uid: uid,
            username: username,
            combatPower: combatPower,
            level: level,
            characterName: characterName,
            timeline: Game.state.timeline || 'PRESENT',
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        window.db.ref('leaderboards/' + uid).set(payload).catch(err => {
            console.warn('[Leaderboard] Lỗi đồng bộ chiến lực:', err);
        });
    },

    listenTopLeaderboard: function (callback) {
        if (!window.db) return;
        if (this._leaderboardListenerRef) {
            this._leaderboardListenerRef.off();
        }

        this._leaderboardListenerRef = window.db.ref('leaderboards').orderByChild('combatPower').limitToLast(20);
        this._leaderboardListenerRef.on('value', snap => {
            const list = [];
            snap.forEach(child => {
                list.push(child.val());
            });
            list.sort((a, b) => (b.combatPower || 0) - (a.combatPower || 0));
            if (typeof callback === 'function') {
                callback(list);
            }
            this.renderLeaderboardUI(list);
        }, err => {
            console.error('[Leaderboard] Lỗi tải bảng xếp hạng:', err);
        });
    },

    renderLeaderboardUI: function (list) {
        const tbody = document.getElementById('leaderboard-tbody');
        if (!tbody) return;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 12px;">Chưa có dữ liệu Chiến Lực.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map((item, idx) => {
            const rank = idx + 1;
            const rankBadge = rank === 1 ? '🥇 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `#${rank}`;
            const rankColor = rank === 1 ? '#ffd740' : rank === 2 ? '#e2e8f0' : rank === 3 ? '#ea580c' : '#94a3b8';
            const isMe = Game.Auth.currentUser && Game.Auth.currentUser.uid === item.uid;

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); ${isMe ? 'background: rgba(56, 189, 248, 0.12);' : ''}">
                    <td style="padding: 8px 6px; font-weight: bold; color: ${rankColor}; text-align: center;">${rankBadge}</td>
                    <td style="padding: 8px 6px; font-weight: bold; color: ${isMe ? '#38bdf8' : '#ffffff'};">
                        ${item.username || 'Chiến Binh'} ${isMe ? '<span style="font-size:10px; color:#38bdf8;">(Bạn)</span>' : ''}
                    </td>
                    <td style="padding: 8px 6px; text-align: center; color: #fde047;">${item.level || 1}</td>
                    <td style="padding: 8px 6px; text-align: center; color: #a5b4fc;">${item.characterName || 'Chiến Binh'}</td>
                    <td style="padding: 8px 6px; text-align: right; font-weight: bold; color: #00e5ff;">
                        ${(item.combatPower || 0).toLocaleString()} ⚡
                    </td>
                </tr>
            `;
        }).join('');
    },

    toggleLeaderboardModal: function (forceShow) {
        let modal = document.getElementById('leaderboard-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'leaderboard-modal';
            modal.className = 'modal-backdrop hidden';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(8, 10, 20, 0.90); backdrop-filter: blur(8px);
                z-index: 99998; display: none; justify-content: center; align-items: center;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            `;
            modal.innerHTML = `
                <div style="background: rgba(18, 24, 38, 0.96); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 12px; padding: 22px; width: 92%; max-width: 580px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        <h2 style="color: #ffd740; margin: 0; font-size: 18px; letter-spacing: 1px;">🏆 BẢNG XẾP HẠNG CHIẾN LỰC TOÀN SERVER</h2>
                        <button type="button" onclick="Game.Leaderboard.toggleLeaderboardModal(false)" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
                    </div>
                    <div style="max-height: 380px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                            <thead>
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.2); color: #94a3b8; font-size: 11px;">
                                    <th style="padding: 6px; text-align: center;">Hạng</th>
                                    <th style="padding: 6px;">Chiến Binh</th>
                                    <th style="padding: 6px; text-align: center;">Cấp</th>
                                    <th style="padding: 6px; text-align: center;">Tướng</th>
                                    <th style="padding: 6px; text-align: right;">Chiến Lực</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-tbody">
                                <tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 12px;">Đang nạp dữ liệu...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const shouldShow = typeof forceShow === 'boolean' ? forceShow : modal.classList.contains('hidden');
        if (shouldShow) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            this.syncCombatPowerToLeaderboard();
            this.listenTopLeaderboard();
        } else {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }
};

// ============================================================================
// 7. MODULE XÁC THỰC BẢO MẬT & ĐỒNG BỘ ĐÁM MÂY (Game.Auth & Game.Cloud)
// ============================================================================
Game.Auth = {
    currentUser: null,
    isAdmin: false,
    isLoggedIn: false,

    hashPassword: function (password) {
        let hash = 0x811c9dc5;
        const salt = "TIME_TRAVEL_AUTH_SECURE_2026";
        const str = String(password) + salt;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
            hash = ((hash << 5) | (hash >>> 27)) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    },

    closeAllAuthModals: function () {
        const modals = ['auth-modal', 'login-modal'];
        modals.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        });
        document.querySelectorAll('.modal-backdrop').forEach(el => {
            if (el.id && el.id.includes('auth')) {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        });
        Game.state.isPaused = false;
    },

    openAuthModal: function () {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.remove('hidden');
            authModal.style.display = 'flex';
        } else {
            Game.Cloud.showLoginModal();
        }
        Game.state.isPaused = true;
    },

    setAuthError: function (msg) {
        if (Game.UI && typeof Game.UI.setAuthError === 'function') {
            Game.UI.setAuthError(msg);
        }
        const errEl = document.getElementById('auth-error-msg') || document.getElementById('auth-error');
        if (errEl) {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
            errEl.style.display = 'block';
        }
        Game.Systems.notify(msg, '#ef4444');
    },

    clearAuthError: function () {
        if (Game.UI && typeof Game.UI.setAuthError === 'function') {
            Game.UI.setAuthError('');
        }
        const errEl = document.getElementById('auth-error-msg') || document.getElementById('auth-error');
        if (errEl) {
            errEl.textContent = '';
            errEl.classList.add('hidden');
            errEl.style.display = 'none';
        }
    },

    register: async function (username, password) {
        this.clearAuthError();
        if (typeof username !== 'string' || typeof password !== 'string') {
            const uInput = document.getElementById('auth-username') || document.querySelector('#auth-modal input[type="text"]');
            const pInput = document.getElementById('auth-password') || document.querySelector('#auth-modal input[type="password"]');
            username = uInput ? uInput.value : '';
            password = pInput ? pInput.value : '';
        }

        const u = (username || '').trim();
        const p = (password || '').trim();

        if (!u || !p) {
            this.setAuthError('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu!');
            return false;
        }
        if (u.length < 3) {
            this.setAuthError('Tên tài khoản phải có ít nhất 3 ký tự!');
            return false;
        }
        if (p.length < 4) {
            this.setAuthError('Mật khẩu phải có ít nhất 4 ký tự!');
            return false;
        }
        if (u.toLowerCase() === 'bao2010') {
            this.setAuthError('Tài khoản này là định danh Quản trị viên, không thể đăng ký mới!');
            return false;
        }

        const sanitizedUid = u.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const passHash = this.hashPassword(p);

        if (!window.db) {
            this.setAuthError('Không có kết nối Firebase Database! Vui lòng kiểm tra mạng.');
            return false;
        }

        try {
            const userRef = window.db.ref('users/' + sanitizedUid);
            const snapshot = await userRef.once('value');

            if (snapshot.exists() && snapshot.val() !== null) {
                this.setAuthError('Tên tài khoản này đã có người sử dụng!');
                return false;
            }

            const initialSave = {
                gold: 200,
                level: 1,
                timeline: 'PRESENT',
                timeShards: 0,
                weaponLevels: { iron_sword: 0, cyber_sword: 0, laser_gun: 0, void_scythe: 0, chrono_cannon: 0 },
                weaponEffectLevels: Object.assign({}, DEFAULT_GAME_STATE.weaponEffectLevels),
                currentWeapon: 'iron_sword',
                ownedWeapons: ['iron_sword'],
                characterStats: JSON.parse(JSON.stringify(DEFAULT_CHARACTER_STATS)),
                selectedCharacter: 'time_traveler',
                upgradeLevels: { hp: 0, speed: 0, damage: 0 },
                equippedRelics: [],
                ownedRelics: [],
                hasPet: false,
                petEvolutionLevel: 0,
                secondChanceAvailable: true,
                loopLevel: 1,
                unlockedWaypoints: [true, false, false],
                hasSeed: false,
                isTreePlanted: false,
                chestOiled: false,
                chestOpened: false,
                usedGiftcodes: [],
                quests: [
                    { id: 1, title: 'Diệt 5 Quái Cổ Đại ở Quá Khứ', cur: 0, target: 5, reward: 300, expReward: 60, done: false },
                    { id: 2, title: 'Nhặt hạt giống (Hiện Tại) & Trồng cây cạnh vực (Quá Khứ)', cur: 0, target: 1, reward: 500, expReward: 100, done: false },
                    { id: 3, title: 'Mua Vũ khí Tương Lai & Hạ Boss Thời Không', cur: 0, target: 1, reward: 2000, expReward: 300, done: false },
                    { id: 4, title: 'Hạ gục 3 Boss Phụ Kỷ Nguyên (Quá Khứ/Hiện Tại/Tương Lai)', cur: 0, target: 3, reward: 1500, expReward: 250, done: false }
                ],
                sideQuestCounter: 0,
                activeSideQuest: null,
                playerPos: { x: 1920, y: 1920 }
            };

            const newUserData = {
                uid: sanitizedUid,
                username: u,
                passwordHash: passHash,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
                role: 'PLAYER',
                isBanned: false,
                banReason: '',
                isOnline: true,
                gold: 200,
                level: 1,
                timeline: 'PRESENT',
                timeShards: 0,
                currentWeapon: 'iron_sword',
                combatPower: 500,
                saveData: initialSave
            };

            await userRef.set(newUserData);

            this.isAdmin = false;
            this.isLoggedIn = true;
            this.currentUser = { uid: sanitizedUid, username: u, role: 'PLAYER' };
            Game.state.adminUnlocked = false;

            Game.Systems.applyLoadedSaveData(initialSave);
            Game.Cloud.setupPresence(sanitizedUid);
            Game.Cloud.initUserSync(sanitizedUid);
            Game.Leaderboard.syncCombatPowerToLeaderboard();

            Game.Systems.notify(`🎉 Đăng ký thành công! Chào mừng ${u}!`, '#4ade80');
            this.closeAllAuthModals();
            return true;
        } catch (err) {
            console.error('[Register Error]', err);
            this.setAuthError('Lỗi máy chủ khi đăng ký tài khoản!');
            return false;
        }
    },

    login: async function (username, password) {
        this.clearAuthError();
        if (typeof username !== 'string' || typeof password !== 'string') {
            const uInput = document.getElementById('auth-username') || document.querySelector('#auth-modal input[type="text"]');
            const pInput = document.getElementById('auth-password') || document.querySelector('#auth-modal input[type="password"]');
            username = uInput ? uInput.value : '';
            password = pInput ? pInput.value : '';
        }

        const u = (username || '').trim();
        const p = (password || '').trim();

        if (!u || !p) {
            this.setAuthError('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu!');
            return false;
        }

        // TÀI KHOẢN ADMIN BẢO 2010 ĐỘC QUYỀN
        if (u.toLowerCase() === 'bao2010') {
            if (p === 'Bao28102010') {
                this.isAdmin = true;
                this.isLoggedIn = true;
                this.currentUser = { uid: 'admin_bao2010', username: 'bao2010', role: 'ADMIN' };
                Game.state.adminUnlocked = true;

                const btnOpenAdmin = document.getElementById('btn-open-admin-panel');
                if (btnOpenAdmin) {
                    btnOpenAdmin.classList.remove('hidden');
                    btnOpenAdmin.style.display = 'block';
                }
                const adminEl = document.getElementById('admin-panel');
                if (adminEl) adminEl.classList.remove('hidden');

                Game.Systems.ensureAdminDrawerShortcut();
                Game.Systems.syncAdminInputs();
                Game.Cloud.startAdminPresenceMonitoring();

                Game.Systems.notify('⚡ CHỦ TỂ ADMIN BẢO 2010 ĐÃ XÁC THỰC THÀNH CÔNG!', '#ffd740');
                this.closeAllAuthModals();
                return true;
            } else {
                this.setAuthError('Sai mật khẩu Admin Bao 2010!');
                return false;
            }
        }

        this.isAdmin = false;
        Game.state.adminUnlocked = false;

        const btnOpenAdmin = document.getElementById('btn-open-admin-panel');
        if (btnOpenAdmin) {
            btnOpenAdmin.classList.add('hidden');
            btnOpenAdmin.style.display = 'none';
        }
        const adminEl = document.getElementById('admin-panel');
        if (adminEl) adminEl.classList.add('hidden');
        const adminShortcut = document.getElementById('drawer-admin-shortcut');
        if (adminShortcut) adminShortcut.remove();

        const sanitizedUid = u.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const passHash = this.hashPassword(p);

        if (!window.db) {
            this.setAuthError('Chưa kết nối Firebase Database! Không thể đăng nhập.');
            return false;
        }

        try {
            const userRef = window.db.ref('users/' + sanitizedUid);
            const snapshot = await userRef.once('value');

            if (!snapshot.exists() || snapshot.val() === null) {
                this.setAuthError('Tài khoản không tồn tại! Vui lòng bấm Đăng Ký.');
                return false;
            }

            const data = snapshot.val();
            if (data.passwordHash && data.passwordHash !== passHash) {
                this.setAuthError('Sai mật khẩu! Vui lòng thử lại.');
                return false;
            }

            if (data.isBanned) {
                this.setAuthError('Tài khoản này hiện đang bị đóng băng!');
                Game.Cloud.handleBannedState(data.banReason);
                return false;
            }

            this.isLoggedIn = true;
            this.currentUser = { uid: sanitizedUid, username: u, role: 'PLAYER' };

            if (data.saveData && typeof data.saveData === 'object') {
                Game.Systems.applyLoadedSaveData(data.saveData);
            } else {
                Game.state.gold = typeof data.gold === 'number' ? data.gold : Game.state.gold;
                Game.state.level = typeof data.level === 'number' ? data.level : Game.state.level;
                Game.state.timeShards = typeof data.timeShards === 'number' ? data.timeShards : Game.state.timeShards;
                if (data.currentWeapon) Game.state.currentWeapon = data.currentWeapon;
                Game.Systems.recalculateMaxStats();
            }

            Game.Cloud.setupPresence(sanitizedUid);
            Game.Cloud.initUserSync(sanitizedUid);
            Game.Leaderboard.syncCombatPowerToLeaderboard();

            Game.Systems.notify(`Chào mừng chiến binh [${u}] trở lại!`, '#38bdf8');
            this.closeAllAuthModals();
            Game.Systems.updateUI();
            Game.Systems.saveGame();
            return true;
        } catch (err) {
            console.error('[Login Error]', err);
            this.setAuthError('Lỗi máy chủ trong quá trình đăng nhập!');
            return false;
        }
    },

    loginAsGuest: function () {
        this.clearAuthError();
        const guestId = 'guest_' + Math.floor(Math.random() * 89999 + 10000);
        this.isAdmin = false;
        this.isLoggedIn = true;
        Game.state.adminUnlocked = false;
        this.currentUser = { uid: guestId, username: 'Khách ' + guestId.slice(-4), role: 'GUEST' };

        Game.Systems.notify('Chơi dạng Khách! Dữ liệu không lưu lên Cloud Firebase.', '#94a3b8');
        this.closeAllAuthModals();
        return true;
    },

    logout: async function () {
        if (this.currentUser && !this.isAdmin && this.currentUser.role === 'PLAYER') {
            await Game.Systems.saveGame();
        }

        if (window.db && this.currentUser && !this.isAdmin) {
            try {
                await window.db.ref('users/' + this.currentUser.uid).update({
                    isOnline: false,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (e) {
                console.warn('[Logout Presence Update Failed]', e);
            }
        }

        if (Game.Cloud._userListenerRef && Game.Cloud._userListenerHandler) {
            Game.Cloud._userListenerRef.off('value', Game.Cloud._userListenerHandler);
            Game.Cloud._userListenerRef = null;
            Game.Cloud._userListenerHandler = null;
        }
        if (Game.Cloud._presenceRef) {
            Game.Cloud._presenceRef.off();
            Game.Cloud._presenceRef = null;
        }
        if (Game.Cloud._adminUsersRef && Game.Cloud._adminUsersHandler) {
            Game.Cloud._adminUsersRef.off('value', Game.Cloud._adminUsersHandler);
            Game.Cloud._adminUsersRef = null;
            Game.Cloud._adminUsersHandler = null;
        }
        if (Game.Leaderboard._leaderboardListenerRef) {
            Game.Leaderboard._leaderboardListenerRef.off();
            Game.Leaderboard._leaderboardListenerRef = null;
        }

        Game.state = Object.assign({}, DEFAULT_GAME_STATE);
        Game.state.weaponLevels = Object.assign({}, DEFAULT_GAME_STATE.weaponLevels);
        Game.state.weaponEffectLevels = Object.assign({}, DEFAULT_GAME_STATE.weaponEffectLevels);
        Game.state.upgradeLevels = Object.assign({}, DEFAULT_GAME_STATE.upgradeLevels);
        Game.state.characterStats = JSON.parse(JSON.stringify(DEFAULT_CHARACTER_STATS));
        Game.player = Object.assign({}, DEFAULT_PLAYER_STATE);

        this.currentUser = null;
        this.isAdmin = false;
        this.isLoggedIn = false;
        Game.state.adminUnlocked = false;
        Game.state.isPaused = true;

        const btnOpenAdmin = document.getElementById('btn-open-admin-panel');
        if (btnOpenAdmin) {
            btnOpenAdmin.classList.add('hidden');
            btnOpenAdmin.style.display = 'none';
        }
        const adminEl = document.getElementById('admin-panel');
        if (adminEl) adminEl.classList.add('hidden');
        const adminShortcut = document.getElementById('drawer-admin-shortcut');
        if (adminShortcut) adminShortcut.remove();

        const shopModal = document.getElementById('shop-modal');
        if (shopModal) shopModal.classList.add('hidden');

        this.openAuthModal();
        Game.Systems.updateUI();
        Game.Systems.notify('Đã đăng xuất tài khoản an toàn.', '#38bdf8');
    }
};

// ============================================================================
// 8. HỆ THỐNG ĐỒNG BỘ ĐÁM MÂY & REALTIME PRESENCE
// ============================================================================
Game.Cloud = {
    _userListenerRef: null,
    _userListenerHandler: null,
    _presenceRef: null,
    _adminUsersRef: null,
    _adminUsersHandler: null,

    setupPresence: function (uid) {
        if (!window.db || !uid) return;
        const userRef = window.db.ref('users/' + uid);
        const connectedRef = window.db.ref('.info/connected');

        if (this._presenceRef) this._presenceRef.off();

        this._presenceRef = connectedRef;
        this._presenceRef.on('value', snap => {
            if (snap.val() === true) {
                userRef.onDisconnect().update({
                    isOnline: false,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });

                userRef.update({
                    isOnline: true,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        });
    },

    initUserSync: function (uid) {
        if (!window.db || !uid) return;
        this.listenUserChanges(uid);
    },

    handleBannedState: function (banReason) {
        Game.state.isPaused = true;
        let banOverlay = document.getElementById('banned-overlay');
        if (!banOverlay) {
            banOverlay = document.createElement('div');
            banOverlay.id = 'banned-overlay';
            banOverlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 5, 20, 0.96); z-index: 999999;
                display: flex; flex-direction: column; justify-content: center;
                align-items: center; color: #ff3366; text-align: center; font-family: 'Segoe UI', Tahoma, sans-serif;
            `;
            document.body.appendChild(banOverlay);
        }
        const reason = banReason || 'Vi phạm điều khoản không gian thời gian.';
        banOverlay.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 15px;">🚫</div>
            <h1 style="font-size: 30px; letter-spacing: 2px; color: #ff3860;">TÀI KHOẢN ĐÃ BỊ ĐÓNG BĂNG</h1>
            <p style="font-size: 16px; color: #cbd5e1; margin-top: 10px; max-width: 500px;">Lý do: <strong>${reason}</strong></p>
            <p style="font-size: 14px; color: #64748b; margin-top: 20px;">Vui lòng liên hệ Admin Bảo 2010 để được giải quyết.</p>
        `;
        banOverlay.classList.remove('hidden');
        banOverlay.style.display = 'flex';
    },

    listenUserChanges: function (uid) {
        if (!window.db || !uid) return;
        if (this._userListenerRef && this._userListenerHandler) {
            this._userListenerRef.off('value', this._userListenerHandler);
        }

        this._userListenerRef = window.db.ref('users/' + uid);
        this._userListenerHandler = this._userListenerRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;

            if (data.isBanned === true) {
                this.handleBannedState(data.banReason);
                return;
            } else {
                const banOverlay = document.getElementById('banned-overlay');
                if (banOverlay) {
                    banOverlay.classList.add('hidden');
                    banOverlay.style.display = 'none';
                }
            }

            if (data.pendingGift) {
                const gift = data.pendingGift;
                let rewardDesc = [];

                if (typeof gift.gold === 'number' && gift.gold > 0) {
                    Game.state.gold = (Game.state.gold || 0) + gift.gold;
                    rewardDesc.push(`+${gift.gold.toLocaleString()}G`);
                }
                if (typeof gift.shards === 'number' && gift.shards > 0) {
                    Game.state.timeShards = (Game.state.timeShards || 0) + gift.shards;
                    rewardDesc.push(`+${gift.shards}💎 Mảnh Thời Không`);
                }
                if (gift.weapon && Game.Systems.weaponsConfig && Game.Systems.weaponsConfig[gift.weapon]) {
                    if (!Game.state.ownedWeapons.includes(gift.weapon)) {
                        Game.state.ownedWeapons.push(gift.weapon);
                    }
                    if (typeof gift.weaponLevel === 'number' && gift.weaponLevel > 0) {
                        Game.state.weaponLevels[gift.weapon] = (Game.state.weaponLevels[gift.weapon] || 0) + gift.weaponLevel;
                    }
                    rewardDesc.push(`Vũ khí [${Game.Systems.weaponsConfig[gift.weapon].name}]`);
                }

                this._userListenerRef.child('pendingGift').remove();

                if (rewardDesc.length > 0) {
                    Game.Systems.notify(`🎁 QUÀ TẶNG ADMIN BẢO: ${rewardDesc.join(' | ')}!`, '#00e5ff');
                    if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
                    Game.Systems.recalculateMaxStats();
                    Game.Systems.updateShopButtons();
                    Game.Systems.updateUI();
                    Game.Systems.saveGame();
                }
            }
        });
    },

    syncSaveDataToCloud: function () {
        if (!window.db || !Game.Auth.currentUser || Game.Auth.isAdmin || Game.Auth.currentUser.role !== 'PLAYER') {
            return;
        }

        const uid = Game.Auth.currentUser.uid;
        const currentCombatPower = Game.Systems.calculateCombatPower();
        const saveDataPayload = {
            gold: Game.state.gold || 0,
            level: Game.state.level || 1,
            exp: Game.state.exp || 0,
            maxExp: Game.state.maxExp || 100,
            timeline: Game.state.timeline || 'PRESENT',
            timeShards: Game.state.timeShards || 0,
            loopLevel: Game.state.loopLevel || 1,
            currentWeapon: Game.state.currentWeapon || 'iron_sword',
            ownedWeapons: Game.state.ownedWeapons || ['iron_sword'],
            weaponLevels: Game.state.weaponLevels || {},
            weaponEffectLevels: Game.state.weaponEffectLevels || {},
            upgradeLevels: Game.state.upgradeLevels || {},
            characterStats: Game.state.characterStats || {},
            selectedCharacter: Game.state.selectedCharacter || 'time_traveler',
            equippedRelics: Game.state.equippedRelics || [],
            ownedRelics: Game.state.ownedRelics || [],
            hasPet: !!Game.state.hasPet,
            petEvolutionLevel: Game.state.petEvolutionLevel || 0,
            secondChanceAvailable: !!Game.state.secondChanceAvailable,
            unlockedWaypoints: Game.state.unlockedWaypoints || [true, false, false],
            hasSeed: !!Game.state.hasSeed,
            isTreePlanted: !!Game.state.isTreePlanted,
            chestOiled: !!Game.state.chestOiled,
            chestOpened: !!Game.state.chestOpened,
            currentTitle: Game.state.currentTitle || 'Kẻ Du Hành Tân Thủ',
            achievements: Game.state.achievements || [],
            usedGiftcodes: Game.state.usedGiftcodes || [],
            quests: Game.Systems.quests || [],
            sideQuestCounter: Game.Systems.sideQuestCounter || 0,
            activeSideQuest: Game.Systems.activeSideQuest || null,
            playerPos: {
                x: Math.round(Game.player.x || 1920),
                y: Math.round(Game.player.y || 1920)
            },
            combatPower: currentCombatPower,
            lastSaved: firebase.database.ServerValue.TIMESTAMP
        };

        const rootUpdate = {
            gold: Game.state.gold || 0,
            level: Game.state.level || 1,
            timeline: Game.state.timeline || 'PRESENT',
            timeShards: Game.state.timeShards || 0,
            currentWeapon: Game.state.currentWeapon || 'iron_sword',
            combatPower: currentCombatPower,
            lastSeen: firebase.database.ServerValue.TIMESTAMP,
            isOnline: true,
            saveData: saveDataPayload
        };

        window.db.ref('users/' + uid).update(rootUpdate).catch(err => {
            console.warn('[Cloud Sync Error]', err);
        });

        Game.Leaderboard.syncCombatPowerToLeaderboard();
    },

    startAdminPresenceMonitoring: function () {
        if (!window.db || !Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;

        if (this._adminUsersRef && this._adminUsersHandler) {
            this._adminUsersRef.off('value', this._adminUsersHandler);
        }

        this._adminUsersRef = window.db.ref('users');
        this._adminUsersHandler = this._adminUsersRef.on('value', snap => {
            const data = snap.val() || {};
            this.renderAdminServerList(data);
        }, err => {
            console.error('[Admin Presence Error]', err);
        });

        this.renderAdminServerTab();
    },

    renderAdminServerList: function (users) {
        const tbody = document.getElementById('server-players-tbody');
        const countEl = document.getElementById('admin-online-count');
        const userKeys = Object.keys(users);

        let onlineCount = 0;
        userKeys.forEach(k => {
            if (users[k] && users[k].isOnline === true) {
                onlineCount++;
            }
        });

        if (countEl) countEl.textContent = onlineCount.toString();
        if (!tbody) return;

        if (userKeys.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 12px;">Chưa có dữ liệu người chơi trên Firebase.</td></tr>`;
            return;
        }

        tbody.innerHTML = userKeys.map(k => {
            const u = users[k];
            const isOnline = !!u.isOnline;
            const isBanned = !!u.isBanned;
            const level = u.level || (u.saveData && u.saveData.level) || 1;
            const timeline = u.timeline || (u.saveData && u.saveData.timeline) || 'PRESENT';
            const timelineText = timeline === 'PAST' ? 'Quá Khứ' : timeline === 'FUTURE' ? 'Tương Lai' : 'Hiện Tại';

            let lastSeenStr = 'Chưa rõ';
            if (u.lastSeen) {
                const date = new Date(u.lastSeen);
                lastSeenStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' +
                              date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            }

            const statusDot = isOnline
                ? `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e; box-shadow: 0 0 6px #22c55e;"></span> Online`
                : `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#64748b;"></span> Offline`;

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <td style="padding: 8px 6px; font-weight: bold; color: ${isBanned ? '#ef4444' : '#38bdf8'};">
                        ${u.username || k} ${isBanned ? '<span style="font-size:10px; color:#ef4444;">[ĐÃ KHÓA]</span>' : ''}
                    </td>
                    <td style="padding: 8px 6px; text-align: center; color: #fde047;">${level}</td>
                    <td style="padding: 8px 6px; text-align: center; color: #a5b4fc;">${timelineText}</td>
                    <td style="padding: 8px 6px; text-align: center; font-size: 11px; color: #94a3b8;">${lastSeenStr}</td>
                    <td style="padding: 8px 6px; text-align: center; font-size: 11px;">${statusDot}</td>
                    <td style="padding: 8px 6px; text-align: center;">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            ${isBanned
                                ? `<button type="button" class="btn-action" style="background:#22c55e; color:#fff; font-size:10px; padding:3px 6px;" onclick="Game.Cloud.adminUnbanUser('${k}')">Mở Khóa</button>`
                                : `<button type="button" class="btn-action" style="background:#ef4444; color:#fff; font-size:10px; padding:3px 6px;" onclick="Game.Cloud.promptBan('${k}')">Khóa</button>`
                            }
                            <button type="button" class="btn-action" style="background:#0284c7; color:#fff; font-size:10px; padding:3px 6px;" onclick="Game.Cloud.promptGift('${k}')">Tặng Quà</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    adminBanUser: function (targetUid, reason) {
        if (!window.db || !Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;
        const banMsg = reason || 'Vi phạm điều khoản game.';
        window.db.ref('users/' + targetUid).update({
            isBanned: true,
            banReason: banMsg
        }).then(() => {
            Game.Systems.notify(`🚫 Đã Khóa Người Chơi: ${targetUid}`, '#ef4444');
        });
    },

    adminUnbanUser: function (targetUid) {
        if (!window.db || !Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;
        window.db.ref('users/' + targetUid).update({
            isBanned: false,
            banReason: ''
        }).then(() => {
            Game.Systems.notify(`✅ Đã Mở Khóa Người Chơi: ${targetUid}`, '#4ade80');
        });
    },

    adminSendGift: function (targetUid, giftData) {
        if (!window.db || !Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;
        window.db.ref('users/' + targetUid + '/pendingGift').set(giftData).then(() => {
            Game.Systems.notify(`🎁 Đã gửi quà tới [${targetUid}] thành công!`, '#00e5ff');
        });
    },

    promptBan: function (targetUid) {
        if (!Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;
        const reason = prompt(`Nhập lý do khóa tài khoản [${targetUid}]:`, 'Vi phạm quy định game');
        if (reason !== null) {
            this.adminBanUser(targetUid, reason);
        }
    },

    promptGift: function (targetUid) {
        if (!Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;
        const goldStr = prompt(`Nhập số VÀNG muốn tặng [${targetUid}]:`, '10000');
        if (goldStr === null) return;
        const shardsStr = prompt(`Nhập số MẢNH THỜI KHÔNG (💎) muốn tặng:`, '10');
        if (shardsStr === null) return;

        const gold = parseInt(goldStr, 10) || 0;
        const shards = parseInt(shardsStr, 10) || 0;

        this.adminSendGift(targetUid, { gold: gold, shards: shards });
    },

    renderAdminServerTab: function () {
        if (!Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;
        const adminPanel = document.getElementById('admin-panel');
        if (!adminPanel) return;

        let serverTab = document.getElementById('admin-server-remote-tab');
        if (!serverTab) {
            serverTab = document.createElement('div');
            serverTab.id = 'admin-server-remote-tab';
            serverTab.style.cssText = `
                margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(255, 215, 64, 0.4);
            `;
            serverTab.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: bold; color: #ffd740; font-size: 13px;">🌐 BẢNG GIÁM SÁT MÁY CHỦ THỜI GIAN THỰC</span>
                    <span style="font-size: 11px; color: #38bdf8;">Online: <strong id="admin-online-count" style="color:#22c55e;">0</strong></span>
                </div>
                <div style="max-height: 240px; overflow-y: auto; background: rgba(0,0,0,0.65); border-radius: 6px; padding: 4px; font-size: 11px; border: 1px solid rgba(255,255,255,0.1);">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.2); color: #94a3b8; font-size: 10px;">
                                <th style="padding: 4px;">Người Chơi</th>
                                <th style="padding: 4px; text-align:center;">Cấp</th>
                                <th style="padding: 4px; text-align:center;">Kỷ Nguyên</th>
                                <th style="padding: 4px; text-align:center;">Hoạt Động</th>
                                <th style="padding: 4px; text-align:center;">Trạng Thái</th>
                                <th style="padding: 4px; text-align:center;">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody id="server-players-tbody">
                            <tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 12px;">Đang tải danh sách người chơi...</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
            adminPanel.appendChild(serverTab);
        }
    },

    showLoginModal: function () {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.remove('hidden');
            authModal.style.display = 'flex';
            return;
        }

        let modal = document.getElementById('login-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'login-modal';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(8, 10, 20, 0.92); backdrop-filter: blur(8px);
                z-index: 99999; display: flex; justify-content: center; align-items: center;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            `;
            modal.innerHTML = `
                <div style="background: rgba(18, 24, 38, 0.96); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 12px; padding: 26px; width: 340px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); text-align: center;">
                    <h2 style="color: #38bdf8; margin-bottom: 6px; font-size: 20px; letter-spacing: 1px;">⚔️ KẺ DU HÀNH THỜI KHÔNG</h2>
                    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 14px;">Xác thực tài khoản để kích hoạt dữ liệu Cloud</p>
                    <div id="auth-error-msg" style="display:none; color: #ef4444; font-size: 12px; margin-bottom: 10px; background: rgba(239,68,68,0.1); padding: 6px; border-radius: 4px;"></div>
                    <input type="text" id="auth-username" placeholder="Tên tài khoản..." style="width: 100%; box-sizing: border-box; padding: 10px 12px; margin-bottom: 10px; background: rgba(0,0,0,0.5); border: 1px solid #334155; border-radius: 6px; color: #fff; font-size: 14px;" />
                    <input type="password" id="auth-password" placeholder="Mật khẩu..." style="width: 100%; box-sizing: border-box; padding: 10px 12px; margin-bottom: 16px; background: rgba(0,0,0,0.5); border: 1px solid #334155; border-radius: 6px; color: #fff; font-size: 14px;" />
                    <div style="display: flex; gap: 8px;">
                        <button type="button" id="auth-login-btn" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #0284c7, #38bdf8); border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer; font-size: 13px;">
                            ĐĂNG NHẬP
                        </button>
                        <button type="button" id="auth-register-btn" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #059669, #10b981); border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer; font-size: 13px;">
                            ĐĂNG KÝ
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('auth-login-btn').addEventListener('click', () => Game.Auth.login());
            document.getElementById('auth-register-btn').addEventListener('click', () => Game.Auth.register());

            const pInput = document.getElementById('auth-password');
            if (pInput) {
                pInput.addEventListener('keydown', e => {
                    if (e.key === 'Enter') Game.Auth.login();
                });
            }
        }
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
};
// (Kết thúc Phần 1 - Xem tiếp tục tại Phần 2 với Game.Systems, Cổ Vật, Balo, 10 Hiệu Ứng Vũ Khí & Shop Buttons)
// ============================================================================
// 9. HỆ THỐNG QUẢN LÝ DỮ LIỆU & LOGIC TOÀN CỤC (Game.Systems)
// ============================================================================
Game.Systems = {
    quests: [],
    sideQuestCounter: 0,
    activeSideQuest: null,
    goldClickTimestamps: [],
    _autoSaveInterval: null,

    waypointsConfig: [
        { index: 0, name: 'Trụ Khởi Nguyên', shortName: 'Khởi Nguyên', x: 1920, y: 1920 },
        { index: 1, name: 'Bờ Vực Thẳm', shortName: 'Vực Thẳm', x: 1850, y: 1680 },
        { index: 2, name: 'Điện Thờ Boss', shortName: 'Điện Boss', x: 1920, y: 1320 }
    ],

    weaponsConfig: {
        iron_sword: { id: 'iron_sword', name: 'Kiếm Sắt', icon: '⚔️', price: 0, baseEnhanceCost: 100, futureOnly: false },
        cyber_sword: { id: 'cyber_sword', name: 'Kiếm Điện Tử', icon: '🗡️', price: 300, baseEnhanceCost: 200, futureOnly: true },
        laser_gun: { id: 'laser_gun', name: 'Súng Quang Tuyến', icon: '🔫', price: 600, baseEnhanceCost: 350, futureOnly: true },
        void_scythe: { id: 'void_scythe', name: 'Lưỡi Hái Hư Không', icon: '🌙', price: 1200, baseEnhanceCost: 600, futureOnly: true },
        chrono_cannon: { id: 'chrono_cannon', name: 'Pháo Năng Lượng Thời Không', icon: '☄️', price: 2500, baseEnhanceCost: 1000, futureOnly: true }
    },

    // 10 CỔ VẬT CHUẨN HÓA VỚI THUỘC TÍNH domId ÁNH XẠ CHÍNH XÁC NÚT BẤM TRÊN DOM
    relicsConfig: {
        relic_magnet: {
            id: 'relic_magnet',
            domId: 'loot_magnet',
            name: 'Nam Châm Hút Vật Phẩm',
            icon: '🧲',
            price: 650,
            desc: 'Mở rộng bán kính hút Vàng & Ngọc từ 120px lên 450px.'
        },
        relic_greed: {
            id: 'relic_greed',
            domId: 'greed_relic',
            name: 'Ngọc Nhân Đôi Thu Hoạch',
            icon: '💰',
            price: 800,
            desc: '25% xác suất nhân đôi toàn bộ Vàng và EXP nhận được khi hạ quái.'
        },
        relic_aero_boots: {
            id: 'relic_aero_boots',
            domId: 'aero_boots',
            name: 'Giày Lướt Phản Lực',
            icon: '🥾',
            price: 750,
            desc: '+25% Tốc độ di chuyển và để lại vệt lửa làm chậm quái truy đuổi.'
        },
        relic_regen_ring: {
            id: 'relic_regen_ring',
            domId: 'regen_ring',
            name: 'Nhẫn Hồi Phục Sinh Mệnh',
            icon: '💍',
            price: 850,
            desc: 'Hồi phục 2% Máu tối đa mỗi giây liên tục ngay cả trong giao tranh.'
        },
        relic_frost_heart: {
            id: 'relic_frost_heart',
            domId: 'frost_heart',
            name: 'Trái Tim Băng Giá',
            icon: '❄️',
            price: 900,
            desc: 'Khi nhận sát thương nặng, đóng băng toàn bộ quái xung quanh 2 giây.'
        },
        relic_last_stand: {
            id: 'relic_last_stand',
            domId: 'last_stand_pendant',
            name: 'Mặt Dây Chuyền Bất Khuất',
            icon: '🛡️',
            price: 1100,
            desc: 'Máu dưới 25% tự kích hoạt Khiên Ảo bằng 50% HP tối đa trong 5s (Hồi chiêu 60s).'
        },
        relic_sniper_scope: {
            id: 'relic_sniper_scope',
            domId: 'sniper_scope',
            name: 'Kính Hồng Ngoại Cảnh Báo',
            icon: '🎯',
            price: 700,
            desc: 'Mở rộng góc ngắm tia súng và báo động đỏ quỹ đạo bắn tỉa của quái vật trước 0.65s.'
        },
        relic_quantum_battery: {
            id: 'relic_quantum_battery',
            domId: 'quantum_battery',
            name: 'Bộ Lưu Trữ Lượng Tử',
            icon: '🔋',
            price: 1200,
            desc: 'Mở rộng dung lượng Nộ lên 200 điểm, cho phép tung Chiêu Cuối 2 lần liên tiếp.'
        },
        relic_blood_claws: {
            id: 'relic_blood_claws',
            domId: 'blood_claws',
            name: 'Móng Vuốt Ma Cà Rồng',
            icon: '🩸',
            price: 950,
            desc: 'Hút 10% sát thương đòn cận chiến thành Máu và gây hiệu ứng Chảy Máu liên tục.'
        },
        relic_haste_matrix: {
            id: 'relic_haste_matrix',
            domId: 'haste_matrix',
            name: 'Lõi Gia Tốc Hồi Chiêu',
            icon: '⚡',
            price: 850,
            desc: 'Giảm 20% thời gian hồi chiêu của 3 kỹ năng cơ bản.'
        }
    },

    // 10 HIỆU ỨNG VŨ KHÍ CÂN BẰNG & ĐỒNG BỘ 100% VỚI INDEX.HTML
    weaponEffectsConfig: {
        poison: { id: 'poison', name: 'Độc Dược Ăn Mòn', icon: '🧪', baseCost: 150, maxLevel: 5, desc: 'Gây sát thương độc ăn mòn kéo dài trên mỗi đòn đánh' },
        burn: { id: 'burn', name: 'Thiêu Đốt Hỏa Ngục', icon: '🔥', baseCost: 200, maxLevel: 5, desc: 'Đốt cháy mục tiêu và phát nổ thiêu đốt xung quanh' },
        freeze: { id: 'freeze', name: 'Băng Hàn Cực Độ', icon: '❄️', baseCost: 250, maxLevel: 5, desc: 'Làm chậm tốc độ và giảm tần suất công kích của quái' },
        chain_lightning: { id: 'chain_lightning', name: 'Tia Sét Liên Hoàn', icon: '⚡', baseCost: 350, maxLevel: 5, desc: 'Phóng tia sét nảy qua chuỗi mục tiêu xung quanh' },
        armor_break: { id: 'armor_break', name: 'Phá Giáp Trọng Lực', icon: '🔨', baseCost: 220, maxLevel: 5, desc: 'Giảm 30% giáp tự nhiên của quái và boss' },
        gravity_stun: { id: 'gravity_stun', name: 'Chấn Động Đơ Cứng', icon: '💫', baseCost: 320, maxLevel: 5, desc: 'Xác suất làm choáng quái vật trong tích tắc' },
        dark_drain: { id: 'dark_drain', name: 'Hút Huyết Hư Không', icon: '🩸', baseCost: 300, maxLevel: 5, desc: 'Hồi phục một phần máu theo tỉ lệ sát thương gây ra' },
        reactive_blast: { id: 'reactive_blast', name: 'Nổ Tung Phản Kích', icon: '💥', baseCost: 380, maxLevel: 5, desc: 'Quái bị tiêu diệt sẽ phát nổ gây sát thương diện rộng' },
        crit_sniper: { id: 'crit_sniper', name: 'Chí Mạng Tuyệt Đối', icon: '🎯', baseCost: 280, maxLevel: 5, desc: 'Gia tăng tỉ lệ và sát thương đòn chí mạng' },
        sonic_wave: { id: 'sonic_wave', name: 'Sóng Siêu Âm Hủy Diệt', icon: '🌊', baseCost: 400, maxLevel: 5, desc: 'Tỏa sóng xung kích đẩy lùi quái và tăng phạm vi sát thương' }
    },

    upgradesConfig: {
        hp: { baseCost: 100, amount: 25, shieldBonus: 5, label: '+25 Máu Tối Đa' },
        speed: { baseCost: 120, amount: 15, label: '+15 Tốc Độ Chạy' },
        damage: { baseCost: 150, amount: 6, label: '+6 Sát Thương Cơ Bản' },
        heal: { baseCost: 50, amount: 100, label: 'Bình Hồi Phục' }
    },

    // BẢNG ÁNH XẠ ĐẢO 2 CHIỀU ĐẢM BẢO KHÔNG BAO GIỜ LỆCH KEY CỔ VẬT
    _resolveRelicKey: function (rawKey) {
        if (!rawKey) return '';
        const map = {
            'loot_magnet': 'relic_magnet',
            'relic_magnet': 'relic_magnet',
            'greed_relic': 'relic_greed',
            'relic_greed': 'relic_greed',
            'aero_boots': 'relic_aero_boots',
            'relic_aero_boots': 'relic_aero_boots',
            'regen_ring': 'relic_regen_ring',
            'relic_regen_ring': 'relic_regen_ring',
            'frost_heart': 'relic_frost_heart',
            'relic_frost_heart': 'relic_frost_heart',
            'last_stand_pendant': 'relic_last_stand',
            'relic_last_stand': 'relic_last_stand',
            'sniper_scope': 'relic_sniper_scope',
            'relic_sniper_scope': 'relic_sniper_scope',
            'quantum_battery': 'relic_quantum_battery',
            'relic_quantum_battery': 'relic_quantum_battery',
            'blood_claws': 'relic_blood_claws',
            'relic_blood_claws': 'relic_blood_claws',
            'haste_matrix': 'relic_haste_matrix',
            'relic_haste_matrix': 'relic_haste_matrix'
        };
        if (map[rawKey]) return map[rawKey];
        if (this.relicsConfig[rawKey]) return rawKey;
        const candidate = 'relic_' + rawKey;
        if (this.relicsConfig[candidate]) return candidate;
        return rawKey;
    },

    /**
     * Kiểm tra người chơi có đang trang bị Cổ Vật trong 4 ô Balo hay không.
     * Tự động chuẩn hóa ID và hỗ trợ cả key cũ lẫn canonical key.
     */
    hasEquippedRelic: function (rawRelicId) {
        if (!rawRelicId || !window.Game || !window.Game.state) {
            return false;
        }

        const equipped = window.Game.state.equippedRelics;
        if (!Array.isArray(equipped) || equipped.length === 0) {
            return false;
        }

        const targetCanonical = (typeof this._resolveRelicKey === 'function')
            ? this._resolveRelicKey(rawRelicId)
            : rawRelicId;

        for (let i = 0; i < equipped.length; i++) {
            const item = equipped[i];
            if (!item) continue;
            if (item === rawRelicId) return true;

            const itemCanonical = (typeof this._resolveRelicKey === 'function')
                ? this._resolveRelicKey(item)
                : item;

            if (itemCanonical === targetCanonical || item === targetCanonical || itemCanonical === rawRelicId) {
                return true;
            }
        }

        return false;
    },

    _syncCombatSkillsets: function () {
        if (!window.Game.Combat) return;
        window.Game.Combat.characterSkillsets = {
            time_traveler: Game.charactersConfig.time_traveler.skills,
            shadow_assassin: Game.charactersConfig.shadow_assassin.skills,
            iron_juggernaut: Game.charactersConfig.iron_juggernaut.skills
        };
        if (typeof window.Game.Combat.attack !== 'function') {
            window.Game.Combat.attack = function () {
                this.useSkill(0, { manualAim: false });
            };
        }
        if (typeof window.Game.Combat.spawnFloatingText !== 'function') {
            window.Game.Combat.spawnFloatingText = function (x, y, text, color) {
                Game.FloatingTextPool.spawn(x, y, text, color);
            };
        }
    },

    _ensureCharacterStateIntegrity: function () {
        const state = Game.state;
        if (!Array.isArray(state.unlockedCharacters) || state.unlockedCharacters.length === 0) {
            state.unlockedCharacters = ['time_traveler', 'shadow_assassin', 'iron_juggernaut'];
        }
        ['time_traveler', 'shadow_assassin', 'iron_juggernaut'].forEach(id => {
            if (!state.unlockedCharacters.includes(id)) {
                state.unlockedCharacters.push(id);
            }
        });

        if (!state.selectedCharacter || !Game.charactersConfig[state.selectedCharacter]) {
            state.selectedCharacter = 'time_traveler';
        }
        if (!state.characterStats || typeof state.characterStats !== 'object') {
            state.characterStats = JSON.parse(JSON.stringify(DEFAULT_CHARACTER_STATS));
        }
        Object.keys(Game.charactersConfig).forEach(charId => {
            if (!state.characterStats[charId] || typeof state.characterStats[charId] !== 'object') {
                state.characterStats[charId] = {
                    level: state.level || 1,
                    exp: state.exp || 0,
                    maxExp: state.maxExp || 100,
                    bonusDamage: 0,
                    bonusHp: 0,
                    bonusShield: 0,
                    bonusSpeed: 0
                };
            }
        });

        if (!state.weaponEffectLevels || typeof state.weaponEffectLevels !== 'object') {
            state.weaponEffectLevels = Object.assign({}, DEFAULT_GAME_STATE.weaponEffectLevels);
        }
    },

    selectCharacter: function (charId) {
        if (!Game.charactersConfig[charId]) return false;
        this._ensureCharacterStateIntegrity();

        const hpRatio = Game.player.maxHp > 0 ? Math.min(1, Math.max(0.2, Game.player.hp / Game.player.maxHp)) : 1;
        const shieldRatio = Game.player.maxShield > 0 ? Math.min(1, Math.max(0, Game.player.shield / Game.player.maxShield)) : 1;

        Game.state.selectedCharacter = charId;
        this.applyCharacterStats(charId);

        Game.player.hp = Math.max(1, Math.round(Game.player.maxHp * hpRatio));
        Game.player.shield = Math.round(Game.player.maxShield * shieldRatio);

        if (Game.World && typeof Game.World.ensureSafePlayerPosition === 'function') {
            Game.World.ensureSafePlayerPosition();
        }

        if (Game.Audio && typeof Game.Audio.playTimeShift === 'function') {
            Game.Audio.playTimeShift();
        }
        this.notify(`Đã chọn: ${Game.charactersConfig[charId].name}!`, '#4ade80');
        this.syncAdminInputs();
        this.saveGame();

        if (Game.UI && typeof Game.UI.renderCharacters === 'function') {
            Game.UI.renderCharacters();
        }

        if (Game.UI && typeof Game.UI.toggleCharModal === 'function') {
            Game.UI.toggleCharModal(false);
        } else {
            const charModal = document.getElementById('char-modal') || document.getElementById('character-modal');
            if (charModal) {
                charModal.classList.add('hidden');
                charModal.style.display = 'none';
            }
        }

        if (Game.Controls && typeof Game.Controls.releaseAllInputs === 'function') {
            Game.Controls.releaseAllInputs();
        } else if (Game.Controls) {
            Game.Controls.keys = {};
            Game.Controls.touchMove = { active: false, dx: 0, dy: 0 };
        }

        Game.state.isPaused = false;
        this.updateUI();
        return true;
    },

    unlockCharacter: function (charId) {
        if (!Game.charactersConfig[charId]) return false;
        this._ensureCharacterStateIntegrity();

        if (!Game.state.unlockedCharacters.includes(charId)) {
            Game.state.unlockedCharacters.push(charId);
            this.notify(`🎉 MỞ KHÓA NHÂN VẬT: ${Game.charactersConfig[charId].name}!`, '#00e5ff');
            if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') {
                Game.Audio.playLevelUp();
            }
            this.saveGame();
            if (Game.UI && typeof Game.UI.renderCharacters === 'function') {
                Game.UI.renderCharacters();
            }
            return true;
        }
        return false;
    },

    applyCharacterStats: function (charId) {
        this._ensureCharacterStateIntegrity();
        this._syncCombatSkillsets();

        const targetId = (charId && Game.charactersConfig[charId]) ? charId : Game.state.selectedCharacter;
        const cfg = Game.charactersConfig[targetId] || Game.charactersConfig.time_traveler;
        const player = Game.player;
        const state = Game.state;

        state.selectedCharacter = cfg.id;
        state.currentCharacter = cfg.id;
        player.characterId = cfg.id;
        player.name = cfg.name;
        player.radius = cfg.radius || 20;
        player.ccResistance = cfg.ccResistance || 0;
        player.hpRegen = cfg.hpRegen || 1.5;
        player.shieldRegenRate = cfg.shieldRegenRate || 0.05;

        const cStats = state.characterStats[cfg.id];
        if (cStats) {
            state.level = Math.max(state.level || 1, cStats.level || 1);
            cStats.level = state.level;
        }

        const hasHaste = this.hasEquippedRelic('relic_haste_matrix');
        const clonedSkills = cfg.skills.map((sk, sIdx) => {
            let finalMaxCd = Number(sk.maxCd) || 0;
            if (hasHaste && sIdx > 0 && sIdx < 3) {
                finalMaxCd = Math.round(finalMaxCd * 0.8 * 10) / 10;
            }
            return Object.assign({}, sk, { cd: Number(sk.cd) || 0, maxCd: finalMaxCd });
        });
        player.skills = clonedSkills;

        window.Game.Combat = window.Game.Combat || {};
        if (window.Game.Combat.characterSkillsets) {
            window.Game.Combat.characterSkillsets[cfg.id] = clonedSkills;
        }
        window.Game.Combat.skills = clonedSkills;

        this.recalculateMaxStats();
    },

    recalculateMaxStats: function () {
        this._ensureCharacterStateIntegrity();
        const state = Game.state;
        const player = Game.player;
        const charId = state.selectedCharacter || 'time_traveler';
        const cfg = Game.charactersConfig[charId] || Game.charactersConfig.time_traveler;

        const charSpecific = state.characterStats[charId] || {
            level: state.level || 1,
            bonusDamage: 0,
            bonusHp: 0,
            bonusShield: 0,
            bonusSpeed: 0
        };
        const charLevel = Math.max(state.level || 1, charSpecific.level || 1);

        const hpUpgrades = (state.upgradeLevels && state.upgradeLevels.hp) || 0;
        const speedUpgrades = (state.upgradeLevels && state.upgradeLevels.speed) || 0;
        const dmgUpgrades = (state.upgradeLevels && state.upgradeLevels.damage) || 0;

        const bonusHp = (state.bonusMaxHp || 0) + (charSpecific.bonusHp || 0);
        const bonusShield = (state.bonusMaxShield || 0) + (charSpecific.bonusShield || 0);
        const bonusSpd = (state.bonusSpeed || 0) + (charSpecific.bonusSpeed || 0);

        let expectedMaxHp = cfg.baseHp + (charLevel - 1) * 20 + hpUpgrades * 25 + bonusHp;
        let expectedMaxShield = cfg.baseShield + (charLevel - 1) * 6 + hpUpgrades * 5 + bonusShield;
        let effectiveSpeed = cfg.baseSpeed + speedUpgrades * 15 + bonusSpd;
        let effectiveBaseDamage = (charLevel - 1) * 5 + dmgUpgrades * 6 + (charSpecific.bonusDamage || 0);

        // Mốc thức tỉnh vũ khí (+5, +10, +15, +30)
        const currentWeaponKey = state.currentWeapon || 'iron_sword';
        const wLvl = (state.weaponLevels && state.weaponLevels[currentWeaponKey]) || 0;

        if (wLvl >= 30) {
            expectedMaxHp += 80;
            expectedMaxShield += 40;
            effectiveSpeed += 20;
            effectiveBaseDamage += 45;
        } else if (wLvl >= 15) {
            expectedMaxHp += 35;
            expectedMaxShield += 20;
            effectiveBaseDamage += 20;
        } else if (wLvl >= 10) {
            effectiveSpeed += 12;
            effectiveBaseDamage += 10;
        } else if (wLvl >= 5) {
            expectedMaxShield += 15;
            effectiveBaseDamage += 4;
        }

        // Tích hợp chỉ số từ 10 hiệu ứng phụ trợ vũ khí
        if (state.weaponEffectLevels) {
            effectiveBaseDamage += (state.weaponEffectLevels.crit_sniper || 0) * 5 + (state.weaponEffectLevels.sonic_wave || 0) * 4;
            expectedMaxHp += (state.weaponEffectLevels.dark_drain || 0) * 20;
            expectedMaxShield += (state.weaponEffectLevels.armor_break || 0) * 15;
        }

        // Áp dụng thuộc tính Cổ Vật qua hàm chuẩn hóa hasEquippedRelic
        player.lootMagnetRadius = this.hasEquippedRelic('relic_magnet') ? 450 : 120;

        if (this.hasEquippedRelic('relic_aero_boots')) {
            effectiveSpeed = Math.round(effectiveSpeed * 1.25);
        }

        if (this.hasEquippedRelic('relic_regen_ring')) {
            player.hpRegen = (cfg.hpRegen || 2.5) + (expectedMaxHp * 0.02);
        } else {
            player.hpRegen = cfg.hpRegen || 2.5;
        }

        state.maxRage = this.hasEquippedRelic('relic_quantum_battery') ? 200 : 100;
        player.lifestealPercent = this.hasEquippedRelic('relic_blood_claws') ? 0.10 : 0.0;
        player.hasSniperScope = this.hasEquippedRelic('relic_sniper_scope');
        player.hasLastStand = this.hasEquippedRelic('relic_last_stand');
        player.hasFrostHeart = this.hasEquippedRelic('relic_frost_heart');
        player.hasGreedRelic = this.hasEquippedRelic('relic_greed');
        player.hasHasteMatrix = this.hasEquippedRelic('relic_haste_matrix');

        player.maxHp = expectedMaxHp;
        player.maxShield = expectedMaxShield;
        player.speed = effectiveSpeed;
        player.baseDamageBonus = effectiveBaseDamage;

        if (typeof player.hp !== 'number' || isNaN(player.hp) || player.hp > player.maxHp) {
            player.hp = player.maxHp;
        }
        if (typeof player.shield !== 'number' || isNaN(player.shield) || player.shield > player.maxShield) {
            player.shield = player.maxShield;
        }

        return {
            maxHp: expectedMaxHp,
            maxShield: expectedMaxShield,
            speed: effectiveSpeed,
            baseDamageBonus: effectiveBaseDamage
        };
    },

    calculateCombatPower: function () {
        const player = Game.player;
        const state = Game.state;
        const currentWeaponKey = state.currentWeapon || 'iron_sword';
        const wLvl = (state.weaponLevels && state.weaponLevels[currentWeaponKey]) || 0;
        const relicCount = Array.isArray(state.equippedRelics) ? state.equippedRelics.length : 0;
        const petBonus = state.hasPet ? (400 + (state.petEvolutionLevel || 0) * 350) : 0;

        let effectBonus = 0;
        if (state.weaponEffectLevels) {
            Object.values(state.weaponEffectLevels).forEach(lvl => {
                effectBonus += (lvl || 0) * 45;
            });
        }

        const totalCp = (player.maxHp * 2.0) +
                        (player.maxShield * 2.5) +
                        (player.baseDamageBonus * 12) +
                        (player.speed * 1.5) +
                        (wLvl * 85) +
                        (relicCount * 280) +
                        petBonus +
                        effectBonus;

        return Math.round(totalCp);
    },

    saveGame: function () {
        if (Game.Cloud && typeof Game.Cloud.syncSaveDataToCloud === 'function') {
            Game.Cloud.syncSaveDataToCloud();
            return true;
        }
        return false;
    },

    applyLoadedSaveData: function (data) {
        if (!data || typeof data !== 'object') return;

        if (typeof data.gold === 'number') Game.state.gold = data.gold;
        if (typeof data.level === 'number') Game.state.level = data.level;
        if (typeof data.exp === 'number') Game.state.exp = data.exp;
        if (typeof data.maxExp === 'number') Game.state.maxExp = data.maxExp;
        if (typeof data.timeShards === 'number') Game.state.timeShards = data.timeShards;
        if (typeof data.loopLevel === 'number') Game.state.loopLevel = data.loopLevel;
        if (data.timeline) Game.state.timeline = data.timeline;
        if (data.currentWeapon) Game.state.currentWeapon = data.currentWeapon;
        if (Array.isArray(data.ownedWeapons)) Game.state.ownedWeapons = data.ownedWeapons;
        if (data.weaponLevels) Game.state.weaponLevels = Object.assign({}, DEFAULT_GAME_STATE.weaponLevels, data.weaponLevels);
        if (data.weaponEffectLevels) Game.state.weaponEffectLevels = Object.assign({}, DEFAULT_GAME_STATE.weaponEffectLevels, data.weaponEffectLevels);
        if (data.upgradeLevels) Game.state.upgradeLevels = Object.assign({}, DEFAULT_GAME_STATE.upgradeLevels, data.upgradeLevels);
        if (data.characterStats) Game.state.characterStats = Object.assign(JSON.parse(JSON.stringify(DEFAULT_CHARACTER_STATS)), data.characterStats);
        if (data.selectedCharacter) Game.state.selectedCharacter = data.selectedCharacter;
        if (Array.isArray(data.equippedRelics)) Game.state.equippedRelics = data.equippedRelics.map(r => this._resolveRelicKey(r));
        if (Array.isArray(data.ownedRelics)) Game.state.ownedRelics = data.ownedRelics.map(r => this._resolveRelicKey(r));
        if (typeof data.hasPet === 'boolean') Game.state.hasPet = data.hasPet;
        if (typeof data.petEvolutionLevel === 'number') Game.state.petEvolutionLevel = data.petEvolutionLevel;
        if (typeof data.secondChanceAvailable === 'boolean') Game.state.secondChanceAvailable = data.secondChanceAvailable;
        if (Array.isArray(data.unlockedWaypoints)) Game.state.unlockedWaypoints = data.unlockedWaypoints;
        if (typeof data.hasSeed === 'boolean') Game.state.hasSeed = data.hasSeed;
        if (typeof data.isTreePlanted === 'boolean') Game.state.isTreePlanted = data.isTreePlanted;
        if (typeof data.chestOiled === 'boolean') Game.state.chestOiled = data.chestOiled;
        if (typeof data.chestOpened === 'boolean') Game.state.chestOpened = data.chestOpened;
        if (data.currentTitle) Game.state.currentTitle = data.currentTitle;
        if (Array.isArray(data.achievements)) Game.state.achievements = data.achievements;
        if (Array.isArray(data.usedGiftcodes)) Game.state.usedGiftcodes = data.usedGiftcodes;

        if (Array.isArray(data.quests)) this.quests = data.quests;
        if (typeof data.sideQuestCounter === 'number') this.sideQuestCounter = data.sideQuestCounter;
        if (data.activeSideQuest) this.activeSideQuest = data.activeSideQuest;

        if (data.playerPos && typeof data.playerPos.x === 'number' && typeof data.playerPos.y === 'number') {
            Game.player.x = data.playerPos.x;
            Game.player.y = data.playerPos.y;
        }

        this._ensureCharacterStateIntegrity();
        this.applyCharacterStats(Game.state.selectedCharacter);
        this.renderQuestList();
        this.updateTimelineBadge();
        this.updateShopButtons();
        this.syncAdminInputs();
        this.updateUI();
    },

    loadGame: function () {
        return true;
    },

    logout: function () {
        return Game.Auth.logout();
    },

    adminSetStat: function (statType, value) {
        if (!Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') {
            this.notify('⛔ Chỉ Admin Bảo 2010 mới có quyền can thiệp chỉ số!', '#ef4444');
            return;
        }

        const val = Math.max(0, parseInt(value, 10));
        if (isNaN(val)) return;

        const p = Game.player;
        const s = Game.state;
        const charId = s.selectedCharacter || 'time_traveler';
        const cfg = Game.charactersConfig[charId] || Game.charactersConfig.time_traveler;

        if (!s.characterStats[charId]) {
            s.characterStats[charId] = { bonusDamage: 0, bonusHp: 0, bonusShield: 0, bonusSpeed: 0 };
        }
        const cStats = s.characterStats[charId];

        if (statType === 'hp') {
            const baseHpWithoutBonus = cfg.baseHp + ((s.level || 1) - 1) * 20 + ((s.upgradeLevels?.hp || 0) * 25);
            cStats.bonusHp = Math.max(0, val - baseHpWithoutBonus);
            this.recalculateMaxStats();
            p.hp = p.maxHp;
            this.notify(`❤️ Đã đặt Máu tối đa: ${p.maxHp.toLocaleString()}`, '#4ade80');
        } else if (statType === 'shield') {
            const baseShieldWithoutBonus = cfg.baseShield + ((s.level || 1) - 1) * 6 + ((s.upgradeLevels?.hp || 0) * 5);
            cStats.bonusShield = Math.max(0, val - baseShieldWithoutBonus);
            this.recalculateMaxStats();
            p.shield = p.maxShield;
            this.notify(`🛡️ Đã đặt Giáp tối đa: ${p.maxShield.toLocaleString()}`, '#38bdf8');
        } else if (statType === 'speed') {
            const baseSpeedWithoutBonus = cfg.baseSpeed + ((s.upgradeLevels?.speed || 0) * 15);
            cStats.bonusSpeed = Math.max(0, val - baseSpeedWithoutBonus);
            this.recalculateMaxStats();
            this.notify(`⚡ Đã đặt Tốc chạy: ${p.speed.toLocaleString()}`, '#fde047');
        } else if (statType === 'damage') {
            const baseDmgWithoutBonus = ((s.level || 1) - 1) * 5 + ((s.upgradeLevels?.damage || 0) * 6);
            cStats.bonusDamage = Math.max(0, val - baseDmgWithoutBonus);
            this.recalculateMaxStats();
            this.notify(`🔥 Đã đặt Sát thương: +${p.baseDamageBonus.toLocaleString()}`, '#f97316');
        }

        this.syncAdminInputs();
        this.updateUI();
        this.saveGame();
    },

    syncAdminInputs: function () {
        if (!Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;
        const p = Game.player;
        if (!p) return;
        const hpInput = document.getElementById('admin-input-hp');
        const shieldInput = document.getElementById('admin-input-shield');
        const speedInput = document.getElementById('admin-input-speed');
        const dmgInput = document.getElementById('admin-input-dmg');

        if (hpInput) hpInput.value = p.maxHp || 100;
        if (shieldInput) shieldInput.value = p.maxShield || 50;
        if (speedInput) speedInput.value = p.speed || 240;
        if (dmgInput) dmgInput.value = p.baseDamageBonus || 0;
    },

    adminAction: function (action) {
        if (!Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') {
            this.notify('⛔ Cảnh báo: Bạn không có quyền Admin Bảo 2010!', '#ef4444');
            return;
        }

        if (action === 'god') {
            Game.state.godMode = !Game.state.godMode;
            Game.player.godMode = Game.state.godMode;
            this.notify(Game.state.godMode ? '🛡️ Bất Tử: BẬT' : '🛡️ Bất Tử: TẮT', '#4ade80');
        } else if (action === 'rich') {
            Game.state.gold = (Game.state.gold || 0) + 100000;
            Game.state.timeShards = (Game.state.timeShards || 0) + 100;
            this.notify('💰 +100.000 Vàng & +100 💎 Mảnh Thời Không!', '#fde047');
        } else if (action === 'add99Weapon' || action === 'maxWeapon') {
            Object.keys(this.weaponsConfig).forEach(w => {
                if (!Game.state.ownedWeapons.includes(w)) Game.state.ownedWeapons.push(w);
                Game.state.weaponLevels[w] = (Game.state.weaponLevels[w] || 0) + 99;
            });
            const curW = Game.state.currentWeapon || 'iron_sword';
            const curLvl = Game.state.weaponLevels[curW];
            this.notify(`⚔️ Đã cộng +99 Cấp vũ khí! Hiện tại: +${curLvl} Lv!`, '#38bdf8');
        } else if (action === 'noCd') {
            Game.state.adminNoCd = !Game.state.adminNoCd;
            this.notify(Game.state.adminNoCd ? '⚡ Không Hồi Chiêu: BẬT' : '⚡ Không Hồi Chiêu: TẮT', '#06b6d4');
        } else if (action === 'killAll') {
            if (Game.Enemies && Array.isArray(Game.Enemies.list)) {
                Game.Enemies.list.forEach(e => {
                    if (!e.dead && e.hp > 0) {
                        Game.Enemies.damageEnemy(e, 99999999, true, false, true);
                    }
                });
            }
            this.notify('💀 Đã tiêu diệt toàn bộ Quái & Boss trên bản đồ!', '#ef4444');
        } else if (action === 'nextLoop') {
            Game.state.loopLevel = (Game.state.loopLevel || 1) + 1;
            if (Game.Enemies && typeof Game.Enemies.init === 'function') {
                Game.Enemies.init();
            }
            this.notify(`🌀 Đã chuyển sang Chu Kỳ ${Game.state.loopLevel}!`, '#a855f7');
        } else if (action === 'resetSecondChance') {
            Game.state.secondChanceAvailable = true;
            this.notify('⚡ Đã tái kích hoạt Hồi Sinh Lượng Tử!', '#ffd740');
        }

        this.recalculateMaxStats();
        this.syncAdminInputs();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    toggleAdminPanel: function (forceShow) {
        if (!Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') {
            const adminEl = document.getElementById('admin-panel');
            if (adminEl) adminEl.classList.add('hidden');
            this.notify('⛔ Bạn không có quyền Admin Bảo 2010!', '#ef4444');
            return;
        }

        const adminEl = document.getElementById('admin-panel');
        if (!adminEl) return;
        const shouldShow = typeof forceShow === 'boolean' ? forceShow : adminEl.classList.contains('hidden');
        adminEl.classList.toggle('hidden', !shouldShow);
        if (shouldShow) {
            this.syncAdminInputs();
            if (Game.UI && typeof Game.UI.toggleCompactDrawer === 'function') {
                Game.UI.toggleCompactDrawer(false);
            }
        }
    },

    ensureAdminDrawerShortcut: function () {
        if (!Game.Auth.isAdmin || Game.Auth.currentUser?.username !== 'bao2010') return;
        const drawer = document.getElementById('compact-info-drawer');
        if (!drawer || document.getElementById('drawer-admin-shortcut')) return;

        const section = document.createElement('div');
        section.id = 'drawer-admin-shortcut';
        section.className = 'drawer-section';
        section.innerHTML = `
            <button type="button" class="btn-action" style="width: 100%; border-color: #ffd740; background: linear-gradient(135deg, rgba(255, 215, 64, 0.25), rgba(213, 0, 249, 0.28)); color: #fde047;" onclick="Game.Systems.toggleAdminPanel()">
                ⚡ Mở / Đóng Bảng Admin
            </button>
        `;
        drawer.insertBefore(section, drawer.children[1] || null);
    },

    submitGiftcode: function (customCode) {
        const inputEl = document.getElementById('giftcode-input');
        const rawVal = typeof customCode === 'string' ? customCode.trim() : (inputEl ? inputEl.value.trim() : '');
        if (!rawVal) return false;

        const normalizedCode = rawVal.toUpperCase();
        if (!Array.isArray(Game.state.usedGiftcodes)) {
            Game.state.usedGiftcodes = [];
        }

        const normalizedHistory = Game.state.usedGiftcodes.map(c => String(c).toUpperCase());
        if (normalizedHistory.includes(normalizedCode)) {
            this.notify(`Mã "${normalizedCode}" đã được sử dụng trước đó!`, '#f87171');
            return false;
        }

        let isSuccess = false;
        let successMessage = '';

        switch (normalizedCode) {
            case 'UPDATE2026':
                Game.state.gold += 30000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 35;
                this._grantRelicFree('relic_magnet');
                this._grantRelicFree('relic_greed');
                this._grantRelicFree('relic_aero_boots');
                this.recalculateMaxStats();
                successMessage = '🚀 UPDATE2026: +30k Vàng, +35💎 & Nhận 3 Cổ Vật Tốc Độ / Thu Hoạch!';
                isSuccess = true;
                break;

            case 'MELEEKING':
                Game.state.gold += 20000;
                if (!Game.state.ownedWeapons.includes('cyber_sword')) Game.state.ownedWeapons.push('cyber_sword');
                if (!Game.state.ownedWeapons.includes('void_scythe')) Game.state.ownedWeapons.push('void_scythe');
                Game.state.weaponLevels.cyber_sword = Math.max((Game.state.weaponLevels.cyber_sword || 0), 10);
                Game.state.weaponLevels.void_scythe = Math.max((Game.state.weaponLevels.void_scythe || 0), 10);
                Game.state.currentWeapon = 'void_scythe';
                this._grantRelicFree('relic_blood_claws');
                this.recalculateMaxStats();
                successMessage = '👑 MELEEKING: +20k Vàng, Kiếm Điện Tử +10, Lưỡi Hái +10 & Móng Vuốt Ma Cà Rồng!';
                isSuccess = true;
                break;

            case 'BAODEPZAI':
                Game.state.gold += 5000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 5;
                successMessage = '🎁 BAODEPZAI: +5.000 Vàng & +5💎 Mảnh Thời Không!';
                isSuccess = true;
                break;

            case 'BAO28102010@@':
                Game.state.gold += 100000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 150;
                this.unlockCharacter('shadow_assassin');
                this.unlockCharacter('iron_juggernaut');
                this.unlockTitle('🔥 Chiến Binh Tinh Anh Thời Không');
                successMessage = '🎁 VIP GIFT: +100.000 Vàng, +150💎 & Mở Khóa Tướng!';
                isSuccess = true;
                break;

            case 'SHADOW2026':
            case 'ASSASSINVIP':
                this.unlockCharacter('shadow_assassin');
                Game.state.gold += 12000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 15;
                Game.state.bonusSpeed = (Game.state.bonusSpeed || 0) + 20;
                this._grantRelicFree('relic_haste_matrix');
                this.recalculateMaxStats();
                successMessage = '🗡️ Mở khóa Nữ Sát Thủ Bóng Đêm, +12k Vàng, +15💎 & Lõi Gia Tốc!';
                isSuccess = true;
                break;

            case 'JUGGERNAUT99':
            case 'TANKERPRO':
                this.unlockCharacter('iron_juggernaut');
                Game.state.gold += 15000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 20;
                Game.state.bonusMaxShield = (Game.state.bonusMaxShield || 0) + 60;
                this._grantRelicFree('relic_last_stand');
                this._grantRelicFree('relic_regen_ring');
                this.recalculateMaxStats();
                successMessage = '🛡️ Mở khóa Hộ Vệ Tinh Vân, +15k Vàng, +20💎, Nhẫn Hồi Sinh & Dây Chuyền Bất Khuất!';
                isSuccess = true;
                break;

            case 'ADMIN2026':
                Game.state.gold += 10000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 10;
                Game.state.bonusMaxShield = (Game.state.bonusMaxShield || 0) + 30;
                Game.state.bonusSpeed = (Game.state.bonusSpeed || 0) + 10;
                this._grantRelicFree('relic_sniper_scope');
                this.unlockTitle('🔥 Chiến Binh Sinh Tồn');
                this.recalculateMaxStats();
                successMessage = '🔥 ADMIN2026: +10k Vàng, +10💎 & Kính Hồng Ngoại Cảnh Báo!';
                isSuccess = true;
                break;

            case 'SIEUCAPVIP':
                Game.state.gold += 3500;
                Game.state.timeShards = (Game.state.timeShards || 0) + 30;
                Game.state.hasPet = true;
                Game.state.petEvolutionLevel = 2;
                this.unlockCharacter('shadow_assassin');
                this._grantRelicFree('relic_quantum_battery');
                this._grantRelicFree('relic_frost_heart');
                this.recalculateMaxStats();
                successMessage = '👑 SIEUCAPVIP: +3500 Vàng, Tinh Linh Bậc 2, Bộ Lưu Trữ 200 Nộ & Trái Tim Băng!';
                isSuccess = true;
                break;

            case 'THOIKHONG999':
                Game.state.gold += 9999;
                Game.state.timeShards = (Game.state.timeShards || 0) + 30;
                for (let i = 0; i < 3; i++) this.addExp(Game.state.maxExp || 100);
                Game.state.rage = Game.state.maxRage || 100;
                Game.state.secondChanceAvailable = true;
                successMessage = '⏳ THOIKHONG999: +9.999G, +30💎, Tăng 3 Cấp & Đầy Nộ!';
                isSuccess = true;
                break;

            case 'TANTHU2026':
                Game.state.gold += 8888;
                Game.state.timeShards = (Game.state.timeShards || 0) + 10;
                Game.state.bonusMaxShield = (Game.state.bonusMaxShield || 0) + 25;
                if (!Game.state.ownedWeapons.includes('cyber_sword')) {
                    Game.state.ownedWeapons.push('cyber_sword');
                }
                Game.state.weaponLevels.cyber_sword = Math.max(Game.state.weaponLevels.cyber_sword || 0, 5);
                Game.state.currentWeapon = 'cyber_sword';
                this.recalculateMaxStats();
                successMessage = '🗡️ TANTHU2026: +8.888G, +10💎 & Kiếm Điện Tử +5!';
                isSuccess = true;
                break;

            case 'SANBOSSMAX':
                Game.state.gold += 25000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 25;
                Game.state.unlockedWaypoints = [true, true, true];
                this.unlockCharacter('iron_juggernaut');
                this._grantRelicFree('relic_frost_heart');
                this._grantRelicFree('relic_haste_matrix');
                this.recalculateMaxStats();
                successMessage = '⚔️ SANBOSSMAX: +25k Vàng, +25💎, Mở Toàn Bộ Trụ & 2 Cổ Vật Cao Cấp!';
                isSuccess = true;
                break;

            default:
                this.notify('Mã Giftcode không hợp lệ hoặc đã hết hạn!', '#ef4444');
                return false;
        }

        if (isSuccess) {
            if (!normalizedHistory.includes(normalizedCode)) {
                Game.state.usedGiftcodes.push(normalizedCode);
            }
            if (inputEl) inputEl.value = '';
            if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') {
                Game.Audio.playLevelUp();
            }
            this.notify(successMessage, '#fde047');
            this.toggleGiftcodeModal(false);
            this.syncAdminInputs();
            this.updateShopButtons();
            this.updateUI();
            this.saveGame();
            return true;
        }
        return false;
    },

    _grantRelicFree: function (relicId) {
        const canonicalKey = this._resolveRelicKey(relicId);
        if (!this.relicsConfig[canonicalKey]) return;
        if (!Array.isArray(Game.state.ownedRelics)) Game.state.ownedRelics = [];
        if (!Array.isArray(Game.state.equippedRelics)) Game.state.equippedRelics = [];
        if (!Game.state.ownedRelics.includes(canonicalKey)) Game.state.ownedRelics.push(canonicalKey);
        if (Game.state.equippedRelics.length < 4 && !Game.state.equippedRelics.includes(canonicalKey)) {
            Game.state.equippedRelics.push(canonicalKey);
        }
    },

    checkEmergencyGoldRelief: function () {
        const currentGold = Game.state.gold || 0;
        const now = Date.now();
        const lastRelief = Game.state.lastEmergencyReliefTimestamp || 0;

        if (currentGold < 30 && (now - lastRelief > 45000)) {
            Game.state.gold += 150;
            Game.state.lastEmergencyReliefTimestamp = now;
            this.notify('✨ VIỆN TRỢ THỜI KHÔNG: +150G Trợ cấp tân thủ!', '#4ade80');
            if (Game.Audio && typeof Game.Audio.playCoin === 'function') {
                Game.Audio.playCoin();
            }
            this.updateShopButtons();
            this.updateUI();
            this.saveGame();
        }
    },

    bindAuthUiEvents: function () {
        const btnAuthLogin = document.getElementById('btn-auth-login');
        if (btnAuthLogin) {
            btnAuthLogin.onclick = () => Game.Auth.login();
        }

        const btnAuthRegister = document.getElementById('btn-auth-register');
        if (btnAuthRegister) {
            btnAuthRegister.onclick = () => Game.Auth.register();
        }

        const btnGuest = document.getElementById('btn-auth-guest');
        if (btnGuest) {
            btnGuest.onclick = () => Game.Auth.loginAsGuest();
        }

        const btnLogoutList = document.querySelectorAll('#btn-logout, .btn-logout, #hud-btn-logout');
        btnLogoutList.forEach(btn => {
            btn.onclick = () => Game.Auth.logout();
        });

        const btnOpenAdmin = document.getElementById('btn-open-admin-panel');
        if (btnOpenAdmin) {
            btnOpenAdmin.onclick = () => Game.Systems.toggleAdminPanel();
        }

        const btnLeaderboard = document.getElementById('btn-open-leaderboard') || document.getElementById('hud-btn-leaderboard');
        if (btnLeaderboard) {
            btnLeaderboard.onclick = () => Game.Leaderboard.toggleLeaderboardModal();
        }

        const pInputs = document.querySelectorAll('#auth-password, input[type="password"]');
        pInputs.forEach(input => {
            input.onkeydown = e => {
                if (e.key === 'Enter') Game.Auth.login();
            };
        });

        window.addEventListener('keydown', e => {
            if (e.key === 'r' || e.key === 'R') {
                if (!Game.state.isPaused && Game.Auth.isLoggedIn) {
                    this.triggerChronoRewind();
                }
            }
            if (e.key === 'b' || e.key === 'B') {
                if (Game.Auth.isLoggedIn) {
                    this.toggleBackpackModal();
                }
            }
        });
    },

    init: function () {
        this.quests = [
            { id: 1, title: 'Diệt 5 Quái Cổ Đại ở Quá Khứ', cur: 0, target: 5, reward: 300, expReward: 60, done: false },
            { id: 2, title: 'Nhặt hạt giống (Hiện Tại) & Trồng cây cạnh vực (Quá Khứ)', cur: 0, target: 1, reward: 500, expReward: 100, done: false },
            { id: 3, title: 'Mua Vũ khí Tương Lai & Hạ Boss Thời Không', cur: 0, target: 1, reward: 2000, expReward: 300, done: false },
            { id: 4, title: 'Hạ gục 3 Boss Phụ Kỷ Nguyên (Quá Khứ/Hiện Tại/Tương Lai)', cur: 0, target: 3, reward: 1500, expReward: 250, done: false }
        ];

        this._syncCombatSkillsets();
        this._ensureCharacterStateIntegrity();
        this.applyCharacterStats(Game.state.selectedCharacter);
        this.setupSecretGiftcodeTrigger();
        this.checkAndGenerateSideQuest();
        this.renderQuestList();
        this.updateTimelineBadge();
        this.updateShopButtons();
        this.syncAdminInputs();
        this.updateUI();

        this.bindAuthUiEvents();

        if (!Game.Auth.isLoggedIn) {
            Game.Auth.openAuthModal();
            Game.state.isPaused = true;
        }

        if (this._autoSaveInterval) clearInterval(this._autoSaveInterval);
        this._autoSaveInterval = setInterval(() => {
            if (Game.Auth.isLoggedIn && !Game.Auth.isAdmin) {
                this.saveGame();
            }
        }, 18000);
    },

    update: function (dt) {
        if (!Game.state.isPaused) {
            Game.ChronoRewind.recordSnapshot(dt);
            Game.FloatingTextPool.update(dt);

            if (Game.player && Game.player.hp <= 0 && !Game.player.godMode) {
                if (Game.state.secondChanceAvailable) {
                    Game.ChronoRewind.triggerSecondChance();
                }
            }

            if (Game.player && Game.player.hp > 0 && Game.player.hp < Game.player.maxHp) {
                if (Game.player.hpRegen > 0) {
                    Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + Game.player.hpRegen * dt);
                }
            }

            if (Game.player && Game.player.shield < Game.player.maxShield) {
                if (Game.player.shieldCooldown > 0) {
                    Game.player.shieldCooldown = Math.max(0, Game.player.shieldCooldown - dt);
                } else {
                    Game.player.shield = Math.min(Game.player.maxShield, Game.player.shield + (Game.player.maxShield * (Game.player.shieldRegenRate || 0.05)) * dt);
                }
            }

            if (Game.player.hasLastStand) {
                if (Game.state.lastStandCooldown > 0) {
                    Game.state.lastStandCooldown = Math.max(0, Game.state.lastStandCooldown - dt);
                } else if (Game.player.hp > 0 && Game.player.hp < (Game.player.maxHp * 0.25)) {
                    Game.player.shield = Math.min(Game.player.maxShield * 1.5, Game.player.shield + Math.round(Game.player.maxHp * 0.50));
                    Game.state.lastStandCooldown = 60.0;
                    Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 30, '🛡️ KHIÊN BẤT KHUẤT!', '#38bdf8');
                    if (Game.Audio && typeof Game.Audio.playShieldPulse === 'function') Game.Audio.playShieldPulse();
                }
            }

            if (Game.state.hasPet) {
                if (Game.state.petShieldCooldown > 0) {
                    Game.state.petShieldCooldown = Math.max(0, Game.state.petShieldCooldown - dt);
                } else if (Game.player.hp > 0 && Game.player.shield < Game.player.maxShield * 0.3) {
                    const healShield = 25 + (Game.state.petEvolutionLevel || 0) * 20;
                    Game.player.shield = Math.min(Game.player.maxShield, Game.player.shield + healShield);
                    Game.state.petShieldCooldown = Math.max(10, 20 - (Game.state.petEvolutionLevel || 0) * 2);
                    Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 35, `🧚 TINH LINH HỘ THUẪN +${healShield}!`, '#a7f3d0');
                    if (Game.Audio && typeof Game.Audio.playShieldPulse === 'function') Game.Audio.playShieldPulse();
                }
            }

            if (Game.state.chronoFreezeTimer > 0) {
                Game.state.chronoFreezeTimer = Math.max(0, Game.state.chronoFreezeTimer - dt);
            }
            if (Game.state.timeShiftCooldown > 0) {
                Game.state.timeShiftCooldown = Math.max(0, Game.state.timeShiftCooldown - dt);
            }
            if (Game.state.potionCooldown > 0) {
                Game.state.potionCooldown = Math.max(0, Game.state.potionCooldown - dt);
            }
            if (Game.player.screenShake > 0) {
                Game.player.screenShake = Math.max(0, Game.player.screenShake - dt * 25);
            }
            if (Game.player.hitStopTimer > 0) {
                Game.player.hitStopTimer = Math.max(0, Game.player.hitStopTimer - dt);
            }

            this.checkEmergencyGoldRelief();
        }
    },

    shiftTimeline: function (targetTimeline) {
        if (!['PAST', 'PRESENT', 'FUTURE'].includes(targetTimeline)) return false;
        if (Game.state.timeline === targetTimeline) {
            this.notify(`Bạn đang ở kỷ nguyên này rồi!`, '#94a3b8');
            return false;
        }

        if (Game.state.timeShiftCooldown > 0 && !Game.state.adminNoCd) {
            this.notify(`Dịch Chuyển Kỷ Nguyên đang hồi: ${Game.state.timeShiftCooldown.toFixed(1)}s`, '#f87171');
            return false;
        }

        Game.state.timeline = targetTimeline;
        Game.state.timeShiftCooldown = Game.state.timeShiftMaxCd || 4.0;

        if (Game.Audio && typeof Game.Audio.playTimeShift === 'function') {
            Game.Audio.playTimeShift();
        }

        const flashEl = document.getElementById('time-flash');
        if (flashEl) {
            flashEl.classList.remove('flash-active');
            void flashEl.offsetWidth;
            flashEl.classList.add('flash-active');
            setTimeout(() => flashEl.classList.remove('flash-active'), 500);
        }

        const eraNames = { PAST: 'Quá Khứ Nguyên Thủy', PRESENT: 'Hiện Tại Đương Đại', FUTURE: 'Tương Lai Cơ Giới' };
        this.notify(`🌀 Dịch chuyển tới: ${eraNames[targetTimeline]}!`, '#38bdf8');
        Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 25, `TIME SHIFT: ${targetTimeline}`, '#38bdf8');

        if (Game.World && typeof Game.World.onTimelineChanged === 'function') {
            Game.World.onTimelineChanged(targetTimeline);
        }
        if (Game.Enemies && typeof Game.Enemies.onTimelineChanged === 'function') {
            Game.Enemies.onTimelineChanged(targetTimeline);
        }

        this.updateTimelineBadge();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
        return true;
    },

    updateTimelineBadge: function () {
        const badge = document.getElementById('timeline-badge') || document.getElementById('current-timeline-txt');
        if (!badge) return;

        const timeline = Game.state.timeline || 'PRESENT';
        const config = {
            PAST: { text: 'Quá Khứ (Cổ Đại)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
            PRESENT: { text: 'Hiện Tại (Thực Tại)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)' },
            FUTURE: { text: 'Tương Lai (Cơ Giới)', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)' }
        };

        const currentCfg = config[timeline] || config.PRESENT;
        badge.textContent = currentCfg.text;
        badge.style.color = currentCfg.color;
        badge.style.backgroundColor = currentCfg.bg;
    },

    teleportToWaypoint: function (wpIndex) {
        const wp = this.waypointsConfig.find(w => w.index === wpIndex);
        if (!wp) return;

        if (!Game.state.unlockedWaypoints[wpIndex]) {
            this.notify(`Trụ dịch chuyển này chưa được kích hoạt!`, '#f87171');
            return;
        }

        Game.player.x = wp.x;
        Game.player.y = wp.y;
        Game.player.vx = 0;
        Game.player.vy = 0;

        if (Game.Audio && typeof Game.Audio.playTimeShift === 'function') {
            Game.Audio.playTimeShift();
        }
        this.notify(`⚡ Dịch chuyển tức thời đến: ${wp.name}!`, '#38bdf8');
        Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 25, `WARP: ${wp.shortName}`, '#00e5ff');
        this.updateUI();
    },

    buyWeapon: function (weaponId) {
        const cfg = this.weaponsConfig[weaponId];
        if (!cfg) return;

        if (cfg.futureOnly && Game.state.timeline !== 'FUTURE') {
            this.notify('Công nghệ này chỉ mua được tại Kỷ Nguyên Tương Lai!', '#f43f5e');
            return;
        }

        if (Game.state.ownedWeapons.includes(weaponId)) {
            this.equipWeapon(weaponId);
            return;
        }

        if ((Game.state.gold || 0) < cfg.price) {
            this.notify(`Không đủ Vàng! Cần ${cfg.price.toLocaleString()}G`, '#ef4444');
            return;
        }

        Game.state.gold -= cfg.price;
        Game.state.ownedWeapons.push(weaponId);
        Game.state.weaponLevels[weaponId] = 0;
        Game.state.currentWeapon = weaponId;

        if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
        this.notify(`🎉 Đã sở hữu vũ khí: ${cfg.name}!`, '#4ade80');
        this.recalculateMaxStats();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    equipWeapon: function (weaponId) {
        if (!Game.state.ownedWeapons.includes(weaponId)) return;
        Game.state.currentWeapon = weaponId;
        const cfg = this.weaponsConfig[weaponId];
        this.notify(`Đã trang bị: ${cfg ? cfg.name : weaponId}!`, '#38bdf8');
        this.recalculateMaxStats();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    enhanceWeapon: function (weaponId) {
        const targetId = weaponId || Game.state.currentWeapon;
        const cfg = this.weaponsConfig[targetId];
        if (!cfg) return;

        const curLevel = (Game.state.weaponLevels && Game.state.weaponLevels[targetId]) || 0;
        const cost = Math.round(cfg.baseEnhanceCost * Math.pow(1.35, curLevel));

        if ((Game.state.gold || 0) < cost) {
            this.notify(`Cần ${cost.toLocaleString()}G để cường hóa cấp kế tiếp!`, '#ef4444');
            return;
        }

        Game.state.gold -= cost;
        Game.state.weaponLevels[targetId] = curLevel + 1;

        if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
        this.notify(`✨ Cường hóa thành công: ${cfg.name} +${curLevel + 1}!`, '#ffd740');
        Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 30, `ENHANCE +${curLevel + 1}!`, '#ffd740');

        this.recalculateMaxStats();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    upgradeWeaponEffect: function (effectId) {
        const cfg = this.weaponEffectsConfig[effectId];
        if (!cfg) return;

        const curLevel = (Game.state.weaponEffectLevels && Game.state.weaponEffectLevels[effectId]) || 0;
        if (curLevel >= cfg.maxLevel) {
            this.notify(`Hiệu ứng [${cfg.name}] đã đạt cấp tối đa!`, '#94a3b8');
            return;
        }

        const cost = Math.round(cfg.baseCost * Math.pow(1.5, curLevel));
        if ((Game.state.gold || 0) < cost) {
            this.notify(`Cần ${cost.toLocaleString()}G để nâng cấp hiệu ứng!`, '#ef4444');
            return;
        }

        Game.state.gold -= cost;
        Game.state.weaponEffectLevels[effectId] = curLevel + 1;

        if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
        this.notify(`🔥 Thức tỉnh hiệu ứng [${cfg.name}] Cấp ${curLevel + 1}!`, '#f97316');
        this.recalculateMaxStats();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    // MUA / TRANG BỊ CỔ VẬT CHUẨN HÓA DỮ LIỆU
    buyRelic: function (relicId) {
        const canonicalKey = this._resolveRelicKey(relicId);
        const cfg = this.relicsConfig[canonicalKey];
        if (!cfg) return;

        if (!Array.isArray(Game.state.ownedRelics)) Game.state.ownedRelics = [];
        if (!Array.isArray(Game.state.equippedRelics)) Game.state.equippedRelics = [];

        if (Game.state.ownedRelics.includes(canonicalKey)) {
            this.equipRelic(canonicalKey);
            return;
        }

        if ((Game.state.gold || 0) < cfg.price) {
            this.notify(`Không đủ Vàng! Cần ${cfg.price.toLocaleString()}G`, '#ef4444');
            return;
        }

        Game.state.gold -= cfg.price;
        Game.state.ownedRelics.push(canonicalKey);

        if (Game.state.equippedRelics.length < 4) {
            Game.state.equippedRelics.push(canonicalKey);
            this.notify(`🔮 Nhận & Trang bị Cổ Vật: ${cfg.name}!`, '#38bdf8');
        } else {
            this.notify(`🔮 Nhận Cổ Vật [${cfg.name}] (Đã cất vào Balo)!`, '#38bdf8');
        }

        if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
        this.recalculateMaxStats();
        this.updateShopButtons();
        if (typeof this.renderBackpackUI === 'function') this.renderBackpackUI();
        this.updateUI();
        this.saveGame();
    },

    equipRelic: function (relicId) {
        const canonicalKey = this._resolveRelicKey(relicId);
        if (!Array.isArray(Game.state.ownedRelics) || !Game.state.ownedRelics.includes(canonicalKey)) return;
        if (!Array.isArray(Game.state.equippedRelics)) Game.state.equippedRelics = [];

        if (Game.state.equippedRelics.includes(canonicalKey)) {
            this.unequipRelic(canonicalKey);
            return;
        }

        if (Game.state.equippedRelics.length >= 4) {
            this.notify('Đã trang bị tối đa 4 Cổ Vật! Hãy tháo bớt 1 món trong Balo.', '#f59e0b');
            return;
        }

        Game.state.equippedRelics.push(canonicalKey);
        this.notify(`Đã trang bị: ${this.relicsConfig[canonicalKey]?.name || canonicalKey}!`, '#4ade80');
        this.recalculateMaxStats();
        this.updateShopButtons();
        if (typeof this.renderBackpackUI === 'function') this.renderBackpackUI();
        this.updateUI();
        this.saveGame();
    },

    unequipRelic: function (relicId) {
        const canonicalKey = this._resolveRelicKey(relicId);
        if (!Array.isArray(Game.state.equippedRelics)) return;
        const idx = Game.state.equippedRelics.indexOf(canonicalKey);
        if (idx > -1) {
            Game.state.equippedRelics.splice(idx, 1);
            this.notify(`Đã cất Cổ Vật vào Balo: ${this.relicsConfig[canonicalKey]?.name || canonicalKey}`, '#94a3b8');
            this.recalculateMaxStats();
            this.updateShopButtons();
            if (typeof this.renderBackpackUI === 'function') this.renderBackpackUI();
            this.updateUI();
            this.saveGame();
        }
    },

    buyPet: function () {
        if (Game.state.hasPet) {
            this.evolvePet();
            return;
        }

        const PET_COST = 1500;
        if ((Game.state.gold || 0) < PET_COST) {
            this.notify(`Cần ${PET_COST.toLocaleString()}G để triệu hồi Tinh Linh!`, '#ef4444');
            return;
        }

        Game.state.gold -= PET_COST;
        Game.state.hasPet = true;
        Game.state.petEvolutionLevel = 1;

        if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
        this.notify('🧚 Triệu hồi thành công Tinh Linh Thời Gian Bậc 1!', '#4ade80');
        this.recalculateMaxStats();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    evolvePet: function () {
        if (!Game.state.hasPet) return;
        const curLvl = Game.state.petEvolutionLevel || 1;
        if (curLvl >= 5) {
            this.notify('Tinh Linh Thời Không đã đạt cấp Thần Thoại (Bậc 5)!', '#ffd740');
            return;
        }

        const cost = Math.round(1200 * Math.pow(1.6, curLvl));
        if ((Game.state.gold || 0) < cost) {
            this.notify(`Cần ${cost.toLocaleString()}G để tiến hóa Tinh Linh lên Bậc ${curLvl + 1}!`, '#ef4444');
            return;
        }

        Game.state.gold -= cost;
        Game.state.petEvolutionLevel = curLvl + 1;

        if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
        this.notify(`🌟 Tinh Linh tiến hóa thành công lên Bậc ${curLvl + 1}!`, '#ffd740');
        this.recalculateMaxStats();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    buyUpgrade: function (type) {
        const cfg = this.upgradesConfig[type];
        if (!cfg) return;

        if (type === 'heal') {
            if ((Game.state.gold || 0) < cfg.baseCost) {
                this.notify('Không đủ Vàng mua Bình Máu!', '#ef4444');
                return;
            }
            if (Game.player.hp >= Game.player.maxHp) {
                this.notify('Lượng máu đã đạt tối đa!', '#94a3b8');
                return;
            }
            Game.state.gold -= cfg.baseCost;
            Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + cfg.amount);
            if (Game.Audio && typeof Game.Audio.playShieldPulse === 'function') Game.Audio.playShieldPulse();
            this.notify(`❤️ Hồi phục +${cfg.amount} Máu!`, '#4ade80');
            Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 20, `+${cfg.amount} HP`, '#4ade80');
            this.updateUI();
            this.saveGame();
            return;
        }

        const curLvl = (Game.state.upgradeLevels && Game.state.upgradeLevels[type]) || 0;
        const cost = Math.round(cfg.baseCost * Math.pow(1.3, curLvl));

        if ((Game.state.gold || 0) < cost) {
            this.notify(`Cần ${cost.toLocaleString()}G để nâng cấp!`, '#ef4444');
            return;
        }

        Game.state.gold -= cost;
        Game.state.upgradeLevels[type] = curLvl + 1;

        if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
        this.notify(`⚡ Nâng cấp ${cfg.label}!`, '#4ade80');
        this.recalculateMaxStats();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    usePotion: function () {
        if (Game.state.potionCooldown > 0) {
            this.notify(`Bình Máu đang hồi: ${Game.state.potionCooldown.toFixed(1)}s`, '#f87171');
            return;
        }
        if (Game.player.hp >= Game.player.maxHp) {
            this.notify('Máu đã đầy!', '#94a3b8');
            return;
        }

        const healAmount = Math.round(Game.player.maxHp * 0.40);
        Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + healAmount);
        Game.state.potionCooldown = 15.0;

        if (Game.Audio && typeof Game.Audio.playShieldPulse === 'function') Game.Audio.playShieldPulse();
        this.notify(`🧪 Đã dùng Bình Máu Lượng Tử (+${healAmount} HP)`, '#4ade80');
        Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 30, `+${healAmount} HP`, '#4ade80');
        this.updateUI();
    },

    triggerChronoRewind: function () {
        return Game.ChronoRewind.activate();
    },

    addExp: function (amount) {
        if (typeof amount !== 'number' || amount <= 0) return;
        const state = Game.state;
        const charId = state.selectedCharacter || 'time_traveler';

        state.exp = (state.exp || 0) + amount;
        if (state.characterStats && state.characterStats[charId]) {
            state.characterStats[charId].exp = state.exp;
        }

        Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 25, `+${Math.round(amount)} EXP`, '#a855f7');

        while (state.exp >= (state.maxExp || 100)) {
            state.exp -= state.maxExp;
            this.levelUp();
        }

        this.updateUI();
    },

    levelUp: function () {
        const state = Game.state;
        const charId = state.selectedCharacter || 'time_traveler';

        state.level = (state.level || 1) + 1;
        state.maxExp = Math.round((state.maxExp || 100) * 1.25);
        state.potentialPoints = (state.potentialPoints || 0) + 3;

        if (state.characterStats && state.characterStats[charId]) {
            state.characterStats[charId].level = state.level;
            state.characterStats[charId].maxExp = state.maxExp;
        }

        Game.player.hp = Game.player.maxHp;
        Game.player.shield = Game.player.maxShield;

        if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') {
            Game.Audio.playLevelUp();
        }

        this.notify(`🎉 THĂNG CẤP ${state.level}! Nhận 3 Điểm Tiềm Năng!`, '#ffd740');
        Game.FloatingTextPool.spawn(Game.player.x, Game.player.y - 40, `LEVEL UP! CẤP ${state.level}`, '#ffd740');

        if (state.level === 5) this.unlockTitle('Kẻ Xuyên Không Kiên Cường');
        if (state.level === 10) this.unlockTitle('Thống Soái Kỷ Nguyên');
        if (state.level === 20) this.unlockTitle('Chúa Tể Không Gian Thời Gian');

        this.recalculateMaxStats();
        this.updateUI();
        this.saveGame();
    },

    unlockTitle: function (titleName) {
        if (!Game.state.achievements) Game.state.achievements = [];
        if (!Game.state.achievements.includes(titleName)) {
            Game.state.achievements.push(titleName);
            Game.state.currentTitle = titleName;
            this.notify(`🏆 Nhận danh hiệu mới: [${titleName}]!`, '#ffd740');
            this.updateUI();
        }
    },

    updateQuestProgress: function (questId, increment = 1) {
        const quest = this.quests.find(q => q.id === questId);
        if (!quest || quest.done) return;

        quest.cur = Math.min(quest.target, (quest.cur || 0) + increment);
        if (quest.cur >= quest.target) {
            quest.done = true;
            Game.state.gold += quest.reward;
            this.addExp(quest.expReward || 100);
            this.notify(`✅ Hoàn thành: ${quest.title}! (+${quest.reward}G, +${quest.expReward}EXP)`, '#4ade80');
            if (Game.Audio && typeof Game.Audio.playCoin === 'function') Game.Audio.playCoin();
        }

        this.renderQuestList();
        this.updateUI();
        this.saveGame();
    },

    checkAndGenerateSideQuest: function () {
        if (this.activeSideQuest && !this.activeSideQuest.done) return;

        const sidePool = [
            { id: 'sq_kill_10', title: 'Tiêu diệt 10 Quái bất kỳ', target: 10, cur: 0, reward: 400, expReward: 80, done: false },
            { id: 'sq_shift_3', title: 'Thực hiện 3 lần Dịch chuyển Thời gian', target: 3, cur: 0, reward: 350, expReward: 70, done: false },
            { id: 'sq_collect_gold', title: 'Thu thập 500 Vàng rơi trên chiến trường', target: 500, cur: 0, reward: 600, expReward: 120, done: false }
        ];

        const pick = sidePool[Math.floor(Math.random() * sidePool.length)];
        this.activeSideQuest = Object.assign({}, pick);
    },

    renderQuestList: function () {
        const container = document.getElementById('quest-list') || document.getElementById('hud-quest-container');
        if (!container) return;

        let html = '';
        this.quests.forEach(q => {
            const statusColor = q.done ? '#4ade80' : '#fde047';
            const statusText = q.done ? '✓ Xong' : `${q.cur}/${q.target}`;
            html += `
                <div style="font-size: 11px; margin-bottom: 6px; padding: 4px; background: rgba(0,0,0,0.3); border-radius: 4px; border-left: 3px solid ${q.done ? '#22c55e' : '#38bdf8'};">
                    <div style="color: #e2e8f0; font-weight: bold;">${q.title}</div>
                    <div style="display: flex; justify-content: space-between; color: #94a3b8; font-size: 10px; margin-top: 2px;">
                        <span>Thưởng: +${q.reward}G</span>
                        <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                    </div>
                </div>
            `;
        });

        if (this.activeSideQuest) {
            const sq = this.activeSideQuest;
            html += `
                <div style="font-size: 11px; margin-top: 8px; padding: 4px; background: rgba(168, 85, 247, 0.15); border-radius: 4px; border-left: 3px solid #c084fc;">
                    <div style="color: #e9d5ff; font-weight: bold;">[Phụ] ${sq.title}</div>
                    <div style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 10px; margin-top: 2px;">
                        <span>Thưởng: +${sq.reward}G</span>
                        <span style="color: ${sq.done ? '#4ade80' : '#fde047'}; font-weight: bold;">${sq.done ? '✓ Xong' : `${sq.cur}/${sq.target}`}</span>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    toggleShopModal: function (forceShow) {
        let modal = document.getElementById('shop-modal');
        if (!modal) return;
        const shouldShow = typeof forceShow === 'boolean' ? forceShow : modal.classList.contains('hidden');
        if (shouldShow) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            this.updateShopButtons();
        } else {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    },

    setupSecretGiftcodeTrigger: function () {
        const goldDisplay = document.getElementById('hud-gold') || document.getElementById('stat-gold');
        if (!goldDisplay) return;

        goldDisplay.style.cursor = 'pointer';
        goldDisplay.title = 'Chạm liên tục 5 lần để mở ô nhập Giftcode Bí Mật!';
        goldDisplay.onclick = () => {
            const now = Date.now();
            this.goldClickTimestamps.push(now);
            this.goldClickTimestamps = this.goldClickTimestamps.filter(t => now - t < 2500);

            if (this.goldClickTimestamps.length >= 5) {
                this.goldClickTimestamps = [];
                this.toggleGiftcodeModal(true);
            }
        };
    },

    toggleGiftcodeModal: function (forceShow) {
        let modal = document.getElementById('giftcode-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'giftcode-modal';
            modal.className = 'modal-backdrop hidden';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(8, 10, 20, 0.90); backdrop-filter: blur(8px);
                z-index: 99999; display: none; justify-content: center; align-items: center;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            `;
            modal.innerHTML = `
                <div style="background: rgba(18, 24, 38, 0.96); border: 1px solid rgba(255, 215, 64, 0.4); border-radius: 12px; padding: 22px; width: 340px; box-shadow: 0 10px 35px rgba(0,0,0,0.8); text-align: center;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                        <h3 style="color: #ffd740; margin: 0; font-size: 16px;">🎁 KÍCH HOẠT GIFTCODE THỜI KHÔNG</h3>
                        <button type="button" onclick="Game.Systems.toggleGiftcodeModal(false)" style="background:transparent; border:none; color:#94a3b8; font-size:18px; cursor:pointer;">✕</button>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 14px;">Nhập mã tri ân để nhận ngay Vàng, Mảnh Thời Không và Trang Bị Thần Khí!</p>
                    <input type="text" id="giftcode-input" placeholder="Nhập mã quà tặng..." style="width: 100%; box-sizing: border-box; padding: 10px; background: rgba(0,0,0,0.6); border: 1px solid #475569; border-radius: 6px; color: #fff; font-weight: bold; text-align: center; font-size: 14px; text-transform: uppercase; margin-bottom: 14px;" />
                    <button type="button" onclick="Game.Systems.submitGiftcode()" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer; font-size: 14px;">
                        XÁC NHẬN NHẬN QUÀ
                    </button>
                </div>
            `;
            document.body.appendChild(modal);

            const inp = document.getElementById('giftcode-input');
            if (inp) {
                inp.addEventListener('keydown', e => {
                    if (e.key === 'Enter') Game.Systems.submitGiftcode();
                });
            }
        }

        const shouldShow = typeof forceShow === 'boolean' ? forceShow : modal.classList.contains('hidden');
        if (shouldShow) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            const inp = document.getElementById('giftcode-input');
            if (inp) {
                inp.value = '';
                setTimeout(() => inp.focus(), 100);
            }
        } else {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    },

    notify: function (message, color = '#38bdf8') {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                z-index: 999999; display: flex; flex-direction: column; gap: 8px;
                pointer-events: none; align-items: center; font-family: 'Segoe UI', Tahoma, sans-serif;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: rgba(15, 23, 42, 0.94); border: 1px solid ${color};
            color: ${color}; padding: 8px 18px; border-radius: 20px; font-size: 13px;
            font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(4px);
            opacity: 0; transform: translateY(-12px); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        `;
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 250);
        }, 2800);
    }
};

// ============================================================================
// BẢN VÁ ĐỒNG BỘ GIAO DIỆN, CẦU NỐI HÀM & QUẢN LÝ BALO CỔ VẬT
// ============================================================================
Object.assign(Game.Systems, {
    login: function () { return Game.Auth.login(); },
    register: function () { return Game.Auth.register(); },
    loginAsGuest: function () { return Game.Auth.loginAsGuest(); },

    switchTimeline: function (era) { return this.shiftTimeline(era); },
    cycleWeapon: function () {
        const owned = Game.state.ownedWeapons || ['iron_sword'];
        if (owned.length <= 1) {
            this.notify('Bạn mới chỉ sở hữu 1 vũ khí! Hãy mở Cửa Hàng để mua thêm.', '#94a3b8');
            return;
        }
        const curIdx = owned.indexOf(Game.state.currentWeapon);
        const nextWeapon = owned[(curIdx + 1) % owned.length];
        this.equipWeapon(nextWeapon);
    },
    useWaypoint: function (idx) { return this.teleportToWaypoint(idx); },
    toggleShop: function (force) {
        const modal = document.getElementById('shop-modal');
        if (!modal) return;
        const shouldShow = typeof force === 'boolean' ? force : modal.classList.contains('hidden');
        this.toggleShopModal(shouldShow);
        Game.state.isPaused = shouldShow;
    },
    togglePause: function () {
        Game.state.isPaused = !Game.state.isPaused;
        this.notify(Game.state.isPaused ? '⏸️ Đã tạm dừng trò chơi' : '▶️ Tiếp tục chiến đấu', '#38bdf8');
    },
    interact: function () {
        if (Game.World && typeof Game.World.interact === 'function') {
            const ok = Game.World.interact(Game.player);
            if (ok) {
                this.updateUI();
                this.saveGame();
            } else {
                this.notify('Không có mục tiêu tương tác nào ở gần!', '#94a3b8');
            }
        }
    },
    activateChronoFreeze: function () {
        if (Game.Combat && typeof Game.Combat.useSkill === 'function') {
            Game.Combat.useSkill(3, { manualAim: false });
        }
    },

    buyOrEquip: function (weaponId) { return this.buyWeapon(weaponId); },
    enhanceWeaponMulti: function (weaponId, times = 5) {
        for (let i = 0; i < times; i++) {
            const cfg = this.weaponsConfig[weaponId];
            const curLevel = (Game.state.weaponLevels && Game.state.weaponLevels[weaponId]) || 0;
            const cost = Math.round(cfg.baseEnhanceCost * Math.pow(1.35, curLevel));
            if ((Game.state.gold || 0) < cost) {
                if (i === 0) this.notify(`Cần ${cost.toLocaleString()}G để cường hóa!`, '#ef4444');
                break;
            }
            this.enhanceWeapon(weaponId);
        }
    },
    upgradeStat: function (statType) { return this.buyUpgrade(statType); },
    buyOrToggleRelic: function (relicKey) { return this.buyRelic(relicKey); },
    buyLootCompanion: function () {
        if (!Game.state.hasPet) {
            this.buyPet();
        }
        while ((Game.state.petEvolutionLevel || 1) < 3 && (Game.state.gold || 0) >= 1000) {
            const before = Game.state.petEvolutionLevel || 1;
            this.evolvePet();
            if ((Game.state.petEvolutionLevel || 1) === before) break;
        }
        Game.state.lootCompanion = true;
        Game.state.petEvolved = true;
        this.notify('🤖 Đã kích hoạt Drone Nhặt Đồ Lượng Tử!', '#00f2fe');
        this.updateShopButtons();
        this.updateUI();
    },
    resetSaveData: function () {
        if (!confirm('Bạn có chắc muốn xóa dữ liệu phiên chơi hiện tại và bắt đầu lại?')) return;
        location.reload();
    },

    renderTalents: function () {
        if (Game.TalentsAndTitles) Game.TalentsAndTitles.renderTalentsTree();
    },
    resetTalents: function () {
        if (Game.TalentsAndTitles) Game.TalentsAndTitles.resetAllTalents();
    },
    renderTitles: function () {
        if (Game.TalentsAndTitles) Game.TalentsAndTitles.renderTitlesModal();
    },
    renderAbyss: function () {
        const container = document.getElementById('abyss-container');
        const floorEl = document.getElementById('abyss-highest-floor');
        const maxFloor = Game.state.maxAbyssFloor || 1;
        if (floorEl) floorEl.textContent = `Tầng ${maxFloor}`;
        if (container) {
            container.innerHTML = `
                <div style="padding: 14px; background: rgba(168, 85, 247, 0.12); border: 1px solid #a855f7; border-radius: 12px; text-align: center;">
                    <h3 style="color: #e879f9; margin-bottom: 6px;">🗼 THÁP VÔ TẬN THỜI KHÔNG</h3>
                    <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 10px;">
                        Tầng hiện tại chuẩn bị khiêu chiến: <strong style="color: #00f2fe;">Tầng ${maxFloor}</strong>
                    </p>
                    <p style="font-size: 12px; color: #94a3b8;">
                        • Mỗi 3 tầng nhận 1 Bùa Lợi Thời Không<br>
                        • Mỗi 5 tầng chạm trán Boss Phụ Kỷ Nguyên<br>
                        • Mỗi 10 tầng đối đầu Chúa Tể Thời Không
                    </p>
                </div>
            `;
        }
    },
    startAbyssRun: function () {
        Game.state.player = Game.player;
        if (Game.AbyssAndBounties) {
            Game.AbyssAndBounties.startAbyssRun(Game.state.maxAbyssFloor || 1);
            this.notify('🌀 Đã bước vào Tháp Vô Tận!', '#c084fc');
        }
    },
    fetchLeaderboard: function () {
        if (Game.Leaderboard) {
            Game.Leaderboard.syncCombatPowerToLeaderboard();
            Game.Leaderboard.listenTopLeaderboard();
        }
    },
    refreshLeaderboard: function () {
        this.fetchLeaderboard();
        this.notify('🔄 Đã làm mới Bảng Xếp Hạng!', '#38bdf8');
    },
    renderBounties: function () {
        if (!Game.AbyssAndBounties) return;
        const listEl = document.getElementById('daily-bounties-list');
        if (!listEl) return;
        const bounties = Game.AbyssAndBounties.dailyBountiesState.activeBounties || [];
        listEl.innerHTML = bounties.map(b => {
            const pct = Math.min(100, Math.floor((b.currentValue / b.targetValue) * 100));
            return `
                <div class="bounty-card" style="margin-bottom: 10px;">
                    <div style="font-size: 24px;">${b.icon}</div>
                    <div class="bounty-details">
                        <div class="bounty-name">${b.title}</div>
                        <div style="font-size: 11px; color: #94a3b8;">${b.description}</div>
                        <div class="bounty-progress-bar-bg" style="margin-top: 4px;">
                            <div class="bounty-progress-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                    </div>
                    <div style="text-align: right; font-size: 11px;">
                        <div style="color: #ffd740; font-weight: bold;">+${b.reward.gold}G | +${b.reward.shards}💎</div>
                        ${b.isClaimed
                            ? `<button class="btn-action" disabled style="margin-top:4px; opacity:0.5;">Đã Nhận</button>`
                            : b.isCompleted
                            ? `<button class="btn-action" style="margin-top:4px; background:#10b981;" onclick="Game.AbyssAndBounties.claimBountyReward('${b.id}'); Game.Systems.renderBounties();">Nhận Thưởng</button>`
                            : `<span style="color:#38bdf8;">${b.currentValue}/${b.targetValue}</span>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    },
    updateRecapData: function () {
        const recap = (Game.Combat && typeof Game.Combat.getCombatRecap === 'function')
            ? Game.Combat.getCombatRecap()
            : { totalDamage: 0, dps: 0, shieldAbsorbed: 0, bulletsDeflected: 0 };
        const elDmg = document.getElementById('recap-total-dmg');
        const elDps = document.getElementById('recap-dps');
        const elTaken = document.getElementById('recap-dmg-taken');
        const elDeflect = document.getElementById('recap-bullets-deflected');
        if (elDmg) elDmg.textContent = (recap.totalDamage || 0).toLocaleString();
        if (elDps) elDps.textContent = (recap.dps || 0).toLocaleString() + '/s';
        if (elTaken) elTaken.textContent = (recap.shieldAbsorbed || 0).toLocaleString();
        if (elDeflect) elDeflect.textContent = (recap.bulletsDeflected || 0).toLocaleString();
    },
    onEnemyKilled: function (type, isBoss, isElite, expEarned, isMiniBoss) {
        this.addExp(expEarned || 30);
        if (type === 'ancient' && Game.state.timeline === 'PAST') {
            this.updateQuestProgress(1, 1);
        }
        if (isBoss) {
            this.updateQuestProgress(3, 1);
        }
        if (isMiniBoss) {
            this.updateQuestProgress(4, 1);
        }
        if (Game.AbyssAndBounties && Game.AbyssAndBounties.abyssState.isActive) {
            Game.AbyssAndBounties.onEnemyKilledInAbyss({
                tier: isBoss ? 'overlord' : isMiniBoss ? 'miniboss' : isElite ? 'elite' : 'normal',
                era: Game.state.timeline
            });
        }
    },

    // ========================================================================
    // 10. HỆ THỐNG QUẢN LÝ BALO CỔ VẬT (BACKPACK SYSTEM)
    // ========================================================================
    toggleBackpackModal: function (forceShow) {
        let modal = document.getElementById('backpack-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'backpack-modal';
            modal.className = 'modal-backdrop hidden';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(8, 10, 20, 0.92); backdrop-filter: blur(8px);
                z-index: 99998; display: none; justify-content: center; align-items: center;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            `;
            modal.innerHTML = `
                <div style="background: rgba(18, 24, 38, 0.98); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 14px; padding: 22px; width: 92%; max-width: 620px; box-shadow: 0 10px 40px rgba(0,0,0,0.85); max-height: 90vh; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 10px; margin-bottom: 12px;">
                        <h2 style="color: #38bdf8; margin: 0; font-size: 18px; letter-spacing: 1px;">🎒 BALO QUẢN LÝ CỔ VẬT THỜI KHÔNG</h2>
                        <button type="button" onclick="Game.Systems.toggleBackpackModal(false)" style="background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; padding: 0 4px;">✕</button>
                    </div>
                    <div id="backpack-content-area" style="overflow-y: auto; flex: 1; padding-right: 4px;">
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const shouldShow = typeof forceShow === 'boolean' ? forceShow : modal.classList.contains('hidden');
        if (shouldShow) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            Game.state.isPaused = true;
            this.renderBackpackUI();
        } else {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            Game.state.isPaused = false;
        }
    },

    renderBackpackUI: function () {
        const area = document.getElementById('backpack-content-area');
        if (!area) return;

        const state = Game.state;
        if (!Array.isArray(state.ownedRelics)) state.ownedRelics = [];
        if (!Array.isArray(state.equippedRelics)) state.equippedRelics = [];

        // 1. Render 4 ô Cổ Vật đang trang bị
        let equippedHtml = '';
        for (let i = 0; i < 4; i++) {
            const relicKey = state.equippedRelics[i];
            if (relicKey && this.relicsConfig[relicKey]) {
                const rCfg = this.relicsConfig[relicKey];
                equippedHtml += `
                    <div style="flex: 1; min-width: 120px; background: rgba(16, 185, 129, 0.12); border: 1px solid #10b981; border-radius: 8px; padding: 10px; text-align: center; position: relative;">
                        <div style="font-size: 28px; margin-bottom: 4px;">${rCfg.icon}</div>
                        <div style="font-weight: bold; font-size: 12px; color: #4ade80; margin-bottom: 4px;">${rCfg.name}</div>
                        <div style="font-size: 10px; color: #cbd5e1; margin-bottom: 8px; line-height: 1.3;">${rCfg.desc}</div>
                        <button type="button" class="btn-action" style="background: #dc2626; color: #fff; font-size: 11px; padding: 4px 10px; border-radius: 4px; border: none; cursor: pointer; font-weight: bold;" onclick="Game.Systems.unequipRelic('${relicKey}')">
                            Tháo Ra Balo
                        </button>
                    </div>
                `;
            } else {
                equippedHtml += `
                    <div style="flex: 1; min-width: 120px; background: rgba(0,0,0,0.3); border: 1px dashed rgba(255,255,255,0.2); border-radius: 8px; padding: 12px; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 110px;">
                        <span style="font-size: 24px; opacity: 0.3; margin-bottom: 4px;">🛡️</span>
                        <span style="font-size: 11px; color: #64748b; font-weight: bold;">Ô Trống ${i + 1}/4</span>
                    </div>
                `;
            }
        }

        // 2. Render Kho Cổ Vật còn lại trong Balo
        const unequippedRelics = state.ownedRelics.filter(r => !state.equippedRelics.includes(r));
        let storageHtml = '';
        if (unequippedRelics.length === 0) {
            storageHtml = `<div style="text-align: center; color: #64748b; font-size: 12px; padding: 16px;">Kho Balo chưa có Cổ Vật dự bị nào (Mở Cửa Hàng để mua thêm).</div>`;
        } else {
            storageHtml = unequippedRelics.map(rKey => {
                const rCfg = this.relicsConfig[rKey];
                if (!rCfg) return '';
                const isFull = state.equippedRelics.length >= 4;
                const btnActionText = isFull ? 'Đổi Chỗ Ô 1' : 'Trang Bị Ngay';
                const btnActionBg = isFull ? '#d97706' : '#2563eb';

                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 26px;">${rCfg.icon}</span>
                            <div>
                                <div style="font-weight: bold; color: #e2e8f0; font-size: 12px;">${rCfg.name}</div>
                                <div style="font-size: 11px; color: #94a3b8;">${rCfg.desc}</div>
                            </div>
                        </div>
                        <button type="button" class="btn-action" style="background: ${btnActionBg}; color: #fff; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: none; cursor: pointer; font-weight: bold; white-space: nowrap;" onclick="Game.Systems.backpackEquipOrSwap('${rKey}')">
                            ${btnActionText}
                        </button>
                    </div>
                `;
            }).join('');
        }

        // 3. Hiển thị danh sách hiệu ứng Cổ Vật đang kích hoạt
        let activeBuffs = [];
        if (this.hasEquippedRelic('relic_magnet')) activeBuffs.push('🧲 Bán kính hút: 450px');
        if (this.hasEquippedRelic('relic_greed')) activeBuffs.push('💰 25% Nhân đôi Vàng & EXP');
        if (this.hasEquippedRelic('relic_aero_boots')) activeBuffs.push('🥾 +25% Tốc chạy & vệt lửa làm chậm');
        if (this.hasEquippedRelic('relic_regen_ring')) activeBuffs.push('💍 Hồi 2% HP/giây liên tục');
        if (this.hasEquippedRelic('relic_frost_heart')) activeBuffs.push('❄️ Đóng băng quái khi bị trọng thương');
        if (this.hasEquippedRelic('relic_last_stand')) activeBuffs.push('🛡️ Khiên Ảo 50% HP khi máu dưới 25%');
        if (this.hasEquippedRelic('relic_sniper_scope')) activeBuffs.push('🎯 Kính hồng ngoại & cảnh báo laser');
        if (this.hasEquippedRelic('relic_quantum_battery')) activeBuffs.push('🔋 Dung lượng Nộ: 200 điểm');
        if (this.hasEquippedRelic('relic_blood_claws')) activeBuffs.push('🩸 Hút 10% sát thương cận chiến');
        if (this.hasEquippedRelic('relic_haste_matrix')) activeBuffs.push('⚡ Giảm 20% Hồi chiêu kỹ năng');

        const buffsText = activeBuffs.length > 0
            ? activeBuffs.map(b => `<span style="display:inline-block; background:rgba(56,189,248,0.15); border:1px solid #38bdf8; border-radius:4px; padding:2px 8px; margin:2px 3px; font-size:11px; color:#bae6fd;">${b}</span>`).join('')
            : '<span style="color:#64748b; font-size:11px;">Chưa kích hoạt hiệu ứng Cổ Vật nào.</span>';

        area.innerHTML = `
            <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: bold; color: #4ade80; font-size: 13px;">🛡️ CỔ VẬT ĐANG TRANG BỊ (${state.equippedRelics.length}/4)</span>
                    <span style="font-size: 11px; color: #94a3b8;">Nhấn "Tháo Ra Balo" để cất</span>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${equippedHtml}
                </div>
            </div>

            <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.06);">
                <div style="font-weight: bold; color: #ffd740; font-size: 12px; margin-bottom: 6px;">⚡ TỔNG HỢP HIỆU ỨNG CỔ VẬT ĐANG KÍCH HOẠT:</div>
                <div style="line-height: 1.6;">
                    ${buffsText}
                </div>
            </div>

            <div>
                <div style="font-weight: bold; color: #38bdf8; font-size: 13px; margin-bottom: 8px;">📦 KHO DỰ BỊ TRONG BALO (${unequippedRelics.length})</div>
                <div>
                    ${storageHtml}
                </div>
            </div>
        `;
    },

    backpackEquipOrSwap: function (relicKey) {
        const canonicalKey = this._resolveRelicKey(relicKey);
        const state = Game.state;
        if (!Array.isArray(state.equippedRelics)) state.equippedRelics = [];

        if (state.equippedRelics.length < 4) {
            this.equipRelic(canonicalKey);
        } else {
            const removed = state.equippedRelics.shift();
            state.equippedRelics.push(canonicalKey);
            this.notify(`Đã đổi Cổ Vật [${this.relicsConfig[removed]?.name || removed}] lấy [${this.relicsConfig[canonicalKey]?.name || canonicalKey}]!`, '#38bdf8');
            this.recalculateMaxStats();
            this.updateShopButtons();
            this.renderBackpackUI();
            this.updateUI();
            this.saveGame();
        }
    }
});

// ============================================================================
// HÀM CẬP NHẬT GIAO DIỆN CHÍNH & HUD
// ============================================================================
Game.Systems.updateUI = function () {
    const player = Game.player;
    const state = Game.state;
    if (!player || !state) return;

    // Thanh Máu
    const hpBar = document.getElementById('hp-bar');
    const hpTxt = document.getElementById('hp-text');
    const hpPct = Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100));
    if (hpBar) hpBar.style.width = hpPct + '%';
    if (hpTxt) hpTxt.textContent = `HP: ${Math.ceil(player.hp)} / ${Math.round(player.maxHp)}`;

    // Thanh Khiên
    const shieldBar = document.getElementById('shield-bar');
    const shieldTxt = document.getElementById('shield-text');
    const shieldPct = Math.max(0, Math.min(100, (player.shield / Math.max(1, player.maxShield)) * 100));
    if (shieldBar) shieldBar.style.width = shieldPct + '%';
    if (shieldTxt) shieldTxt.textContent = `KHIÊN: ${Math.ceil(player.shield)} / ${Math.round(player.maxShield)}`;

    // Thanh Nộ
    const rageBar = document.getElementById('rage-bar');
    const rageTxt = document.getElementById('rage-text');
    const maxRage = state.maxRage || 100;
    const ragePct = Math.max(0, Math.min(100, ((state.rage || 0) / maxRage) * 100));
    if (rageBar) rageBar.style.width = ragePct + '%';
    if (rageTxt) rageTxt.textContent = `NỘ THỜI KHÔNG: ${Math.floor(state.rage || 0)}%`;

    // Thanh EXP
    const expBar = document.getElementById('exp-bar');
    const expTxt = document.getElementById('exp-text');
    const expPct = Math.max(0, Math.min(100, ((state.exp || 0) / Math.max(1, state.maxExp || 100)) * 100));
    if (expBar) expBar.style.width = expPct + '%';
    if (expTxt) expTxt.textContent = `EXP: ${Math.floor(state.exp || 0)} / ${state.maxExp || 100}`;

    // Chỉ số Vàng, Mảnh & Chiến Lực
    const goldEl = document.getElementById('gold-text') || document.getElementById('hud-gold') || document.getElementById('stat-gold');
    if (goldEl) goldEl.textContent = (state.gold || 0).toLocaleString();

    const shardEl = document.getElementById('shard-text') || document.getElementById('hud-shards') || document.getElementById('stat-shards');
    if (shardEl) shardEl.textContent = (state.timeShards || 0).toLocaleString();

    const cp = this.calculateCombatPower();
    const cpEl = document.getElementById('combat-power-text') || document.getElementById('hud-combat-power');
    const shopCpEl = document.getElementById('shop-combat-power');
    if (cpEl) cpEl.textContent = cp.toLocaleString();
    if (shopCpEl) shopCpEl.textContent = cp.toLocaleString();

    // Badges trong Drawer & HUD
    const lvlBadge = document.getElementById('level-badge');
    if (lvlBadge) lvlBadge.textContent = `Lv.${state.level || 1}`;

    const loopBadge = document.getElementById('loop-badge');
    if (loopBadge) loopBadge.textContent = `Chu Kỳ ${state.loopLevel || 1}`;

    const titleBadge = document.getElementById('title-badge') || document.getElementById('hud-title');
    if (titleBadge) titleBadge.textContent = `✨ ${state.currentTitle || 'Kẻ Du Hành Tân Thủ'}`;

    const wKey = state.currentWeapon || 'iron_sword';
    const wCfg = this.weaponsConfig[wKey] || this.weaponsConfig.iron_sword;
    const wLvl = (state.weaponLevels && state.weaponLevels[wKey]) || 0;
    const weaponBadge = document.getElementById('weapon-hud-badge');
    if (weaponBadge) weaponBadge.textContent = `${wCfg.icon} ${wCfg.name} +${wLvl}`;

    // Đánh dấu nút Kỷ Nguyên đang hoạt động
    const tl = state.timeline || 'PRESENT';
    document.querySelectorAll('.timeline-switcher .time-btn').forEach(btn => {
        btn.classList.remove('active');
        if (tl === 'PAST' && btn.classList.contains('btn-past')) btn.classList.add('active');
        if (tl === 'PRESENT' && btn.classList.contains('btn-present')) btn.classList.add('active');
        if (tl === 'FUTURE' && btn.classList.contains('btn-future')) btn.classList.add('active');
    });
};

// ============================================================================
// HÀM CẬP NHẬT TRẠNG THÁI TOÀN BỘ NÚT VŨ KHÍ, CỔ VẬT, HIỆU ỨNG & PET TRONG CỬA HÀNG
// ============================================================================
Game.Systems.updateShopButtons = function () {
    const state = Game.state;
    const currentGold = state.gold || 0;

    // 1. CẬP NHẬT 5 VŨ KHÍ
    Object.keys(this.weaponsConfig).forEach(wId => {
        const btnMain = document.getElementById(`btn-${wId}`) || document.getElementById(`btn-buy-${wId}`);
        const btnEnh = document.getElementById(`btn-enhance-${wId}`);
        const btnMulti = document.getElementById(`btn-enhance-multi-${wId}`);
        const lvlTag = document.getElementById(`w-lvl-${wId}`);
        const isOwned = state.ownedWeapons.includes(wId);
        const isEquipped = state.currentWeapon === wId;
        const curLevel = (state.weaponLevels && state.weaponLevels[wId]) || 0;

        if (lvlTag) lvlTag.textContent = `+${curLevel}`;

        if (btnMain) {
            if (isEquipped) {
                btnMain.textContent = 'Đang Trang Bị';
                btnMain.disabled = true;
                btnMain.style.background = '#059669';
            } else if (isOwned) {
                btnMain.textContent = 'Trang Bị';
                btnMain.disabled = false;
                btnMain.style.background = '#0284c7';
            } else {
                const price = this.weaponsConfig[wId].price;
                btnMain.textContent = `Mua (${price.toLocaleString()}G)`;
                btnMain.disabled = currentGold < price;
                btnMain.style.background = currentGold >= price ? '#d97706' : '#475569';
            }
        }

        if (btnEnh) {
            btnEnh.classList.toggle('hidden', !isOwned);
            const enhanceCost = Math.round(this.weaponsConfig[wId].baseEnhanceCost * Math.pow(1.35, curLevel));
            btnEnh.textContent = `Cường Hóa (+1) - ${enhanceCost.toLocaleString()}G`;
            btnEnh.disabled = currentGold < enhanceCost;
        }
        if (btnMulti) {
            btnMulti.classList.toggle('hidden', !isOwned);
        }
    });

    // 2. CẬP NHẬT 3 CHỈ SỐ NÂNG CẤP & BÌNH MÁU
    ['hp', 'speed', 'damage'].forEach(stat => {
        const lvlEl = document.getElementById(`upg-lvl-${stat}`);
        const btnEl = document.getElementById(`btn-upg-${stat}`);
        const curLvl = (state.upgradeLevels && state.upgradeLevels[stat]) || 0;
        const cost = Math.round(this.upgradesConfig[stat].baseCost * Math.pow(1.3, curLvl));
        if (lvlEl) lvlEl.textContent = `Cấp ${curLvl}`;
        if (btnEl) {
            btnEl.textContent = `Nâng cấp (${cost.toLocaleString()}G)`;
            btnEl.disabled = currentGold < cost;
        }
    });
    const btnHeal = document.getElementById('btn-upg-heal');
    if (btnHeal) {
        btnHeal.textContent = `Bình Máu (50G)`;
        btnHeal.disabled = currentGold < 50;
    }

    // 3. CẬP NHẬT CẢ 10 CỔ VẬT THEO ĐÚNG domId
    Object.values(this.relicsConfig).forEach(cfg => {
        const domId = cfg.domId || cfg.id.replace('relic_', '');
        const btnRelic = document.getElementById(`btn-relic-${domId}`) || document.getElementById(`btn-relic-${cfg.id}`);
        if (!btnRelic) return;

        const isEquipped = this.hasEquippedRelic(cfg.id);
        const isOwned = Array.isArray(state.ownedRelics) && state.ownedRelics.includes(cfg.id);

        if (isEquipped) {
            btnRelic.textContent = 'Đang Dùng (Tháo)';
            btnRelic.disabled = false;
            btnRelic.style.background = '#16a34a';
            btnRelic.style.color = '#ffffff';
            btnRelic.onclick = () => Game.Systems.unequipRelic(cfg.id);
        } else if (isOwned) {
            btnRelic.textContent = 'Trong Balo (Trang Bị)';
            btnRelic.disabled = false;
            btnRelic.style.background = '#2563eb';
            btnRelic.style.color = '#ffffff';
            btnRelic.onclick = () => Game.Systems.equipRelic(cfg.id);
        } else {
            btnRelic.textContent = `Mua (${cfg.price.toLocaleString()}G)`;
            btnRelic.disabled = currentGold < cfg.price;
            btnRelic.style.background = currentGold >= cfg.price ? '#d97706' : '#475569';
            btnRelic.style.color = '#ffffff';
            btnRelic.onclick = () => Game.Systems.buyRelic(cfg.id);
        }
    });

    // 4. CẬP NHẬT CẤP ĐỘ & NÚT CỦA 10 HIỆU ỨNG VŨ KHÍ
    Object.keys(this.weaponEffectsConfig).forEach(effId => {
        const cfg = this.weaponEffectsConfig[effId];
        const lvlEl = document.getElementById(`weff-lvl-${effId}`);
        const btnEl = document.getElementById(`btn-weff-${effId}`);
        const curLvl = (state.weaponEffectLevels && state.weaponEffectLevels[effId]) || 0;

        if (lvlEl) {
            lvlEl.textContent = `Cấp ${curLvl}/${cfg.maxLevel}`;
        }

        if (btnEl) {
            if (curLvl >= cfg.maxLevel) {
                btnEl.textContent = 'TỐI ĐA (MAX)';
                btnEl.disabled = true;
                btnEl.style.background = '#64748b';
            } else {
                const cost = Math.round(cfg.baseCost * Math.pow(1.5, curLvl));
                btnEl.textContent = `Nâng cấp (${cost.toLocaleString()}G)`;
                btnEl.disabled = currentGold < cost;
                btnEl.style.background = currentGold >= cost ? '#9333ea' : '#475569';
                btnEl.onclick = () => Game.Systems.upgradeWeaponEffect(effId);
            }
        }
    });

    // 5. CẬP NHẬT TINH LINH HỘ TRỢ & DRONE NHẶT ĐỒ
    const btnBuyPet = document.getElementById('btn-buy-pet');
    const btnEvolvePet = document.getElementById('btn-evolve-pet');
    const petStageText = document.getElementById('pet-evolution-stage');

    if (petStageText) {
        if (!state.hasPet) {
            petStageText.textContent = 'Chưa Chiêu Mộ';
            petStageText.style.color = '#94a3b8';
        } else {
            const petTitles = ['', 'Sơ Sinh', 'Trưởng Thành', 'Hộ Vệ', 'Thần Thú', 'Thần Thoại'];
            const lvl = state.petEvolutionLevel || 1;
            petStageText.textContent = `Bậc ${lvl} - ${petTitles[lvl] || 'Thần Thoại'}`;
            petStageText.style.color = '#10b981';
        }
    }

    if (btnBuyPet) {
        if (state.hasPet) {
            btnBuyPet.style.display = 'none';
        } else {
            btnBuyPet.style.display = 'inline-block';
            btnBuyPet.textContent = 'Chiêu Mộ Tinh Linh (1.500G)';
            btnBuyPet.disabled = currentGold < 1500;
        }
    }

    if (btnEvolvePet) {
        if (!state.hasPet) {
            btnEvolvePet.style.display = 'none';
        } else {
            btnEvolvePet.style.display = 'inline-block';
            const curLvl = state.petEvolutionLevel || 1;
            if (curLvl >= 5) {
                btnEvolvePet.textContent = 'Đạt Bậc Tối Đa';
                btnEvolvePet.disabled = true;
            } else {
                const cost = Math.round(1200 * Math.pow(1.6, curLvl));
                btnEvolvePet.textContent = `Tiến Hóa Bậc ${curLvl + 1} (${cost.toLocaleString()}G)`;
                btnEvolvePet.disabled = currentGold < cost;
            }
        }
    }

    const btnLootDrone = document.getElementById('btn-buy-loot-drone');
    if (btnLootDrone) {
        if (state.lootCompanion || (state.hasPet && (state.petEvolutionLevel || 0) >= 3)) {
            btnLootDrone.textContent = 'Đã Kích Hoạt Drone';
            btnLootDrone.disabled = true;
            btnLootDrone.style.background = '#059669';
        } else {
            btnLootDrone.textContent = 'Drone Nhặt Đồ (Cần Tinh Linh Bậc 3)';
            btnLootDrone.disabled = false;
        }
    }
};

// ============================================================================
// KHỞI ĐỘNG HỆ THỐNG TOÀN CỤC KHI DOM SẴN SÀNG
// ============================================================================
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Game.Systems.init());
    } else {
        Game.Systems.init();
    }
}