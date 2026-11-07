/**
 * FILE: systems.js (BẢN SIÊU CẤP TOÀN DIỆN - TÍCH HỢP FIREBASE REALTIME & BẢO MẬT ADMIN ĐỘC QUYỀN)
 * Lead Game Systems Architecture & Security Hardening:
 * - Hệ thống Firebase Realtime Database & Cloud Sync (users/{uid})
 * - Phân quyền Admin DUY NHẤT: Tài khoản bao2010 / Bao28102010 (Xóa sạch mọi quyền admin cũ trong localStorage)
 * - Server Remote Control: Ban/Unban thời gian thực (#banned-overlay), Tặng Quà Online (pendingGift)
 * - Tự động ẩn triệt để modal đăng nhập (#auth-modal & #login-modal) ngay khi đăng nhập thành công.
 * - Giữ nguyên 100% logic: Combat Skillsets, Vũ khí Thức tỉnh, Cổ vật, Tính điểm Chiến lực, Cường hóa x5, Giftcode, Quest & Save mã hóa.
 */

window.Game = window.Game || {};

// ============================================================================
// 0. FIREBASE REALTIME DATABASE CONFIGURATION & INITIALIZATION
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
        console.log('[Firebase] Realtime Database initialized successfully.');
    } else {
        console.warn('[Firebase] Firebase SDK chưa được nhúng qua thẻ <script>.');
    }
} catch (e) {
    console.error('[Firebase] Lỗi khởi tạo Firebase:', e);
}

// ============================================================================
// 1. CONFIGURATION: SCHEMA ĐA NHÂN VẬT & KỸ NĂNG ĐẶC TRƯNG
// ============================================================================
Game.charactersConfig = {
    time_traveler: {
        id: 'time_traveler',
        name: 'Kẻ Du Hành Thời Không',
        title: 'Bậc Thầy Không Gian',
        role: 'Cận Chiến / Cơ Động',
        avatar: '⚔️',
        description: 'Cân bằng giữa tấn công cơ động và kiểm soát nhịp độ trận đấu.',
        spriteColor: '#2563eb',
        accentColor: '#38bdf8',
        radius: 20,
        baseHp: 100,
        baseShield: 50,
        baseSpeed: 240,
        hpRegen: 2.5,
        shieldRegenRate: 0.05,
        ccResistance: 0.1,
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
        description: 'Tốc chạy cực cao, hồi chiêu nhanh nhưng lượng máu và giáp mỏng.',
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
        description: 'Máu và giáp cực lớn, kháng hiệu ứng khống chế cao nhưng tốc chạy chậm.',
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
// 2. KHỞI TẠO STATE & CONTRACT MẶC ĐỊNH
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
    upgradeLevels: {
        hp: 0,
        speed: 0,
        damage: 0
    },
    equippedRelics: [],
    ownedRelics: [],
    hasPet: false,
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
    ccResistance: 0.1,
    hpRegen: 2.5,
    shieldRegenRate: 0.05,
    skills: []
};

Game.state = Object.assign({}, DEFAULT_GAME_STATE, Game.state || {});
Game.player = Object.assign({}, DEFAULT_PLAYER_STATE, Game.player || {});
Game.camera = Game.camera || { x: 0, y: 0, width: 800, height: 600, zoom: 1.0 };

// ============================================================================
// 3. SYNTHESIZER WEB AUDIO ENGINE
// ============================================================================
Game.Audio = {
    ctx: null,
    muted: false,

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

    playSlash: function () {
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
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const bufferSize = ctx.sampleRate * 0.35;
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
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.07);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
    },

    playTimeShift: function () {
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

    playLevelUp: function () {
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

    playPowerup: function () {
        this.playLevelUp();
    },

    playFreeze: function () {
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
// 4. MODULE GAME.AUTH & GAME.CLOUD (FIREBASE & SERVER ADMIN TỪ XA)
// ============================================================================
Game.Auth = {
    currentUser: null,
    isAdmin: false,
    isLoggedIn: false,

    // Hàm tiện ích: Ẩn tất cả các modal đăng nhập và mở khóa Game loop
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

    login: function (username, password) {
        // Hỗ trợ lấy tự động từ input nếu không truyền tham số
        if (typeof username !== 'string' || typeof password !== 'string') {
            const uInput = document.getElementById('auth-username') || document.querySelector('#auth-modal input[type="text"]');
            const pInput = document.getElementById('auth-password') || document.querySelector('#auth-modal input[type="password"]');
            username = uInput ? uInput.value : '';
            password = pInput ? pInput.value : '';
        }

        const u = (username || '').trim();
        const p = (password || '').trim();

        if (!u || !p) {
            Game.Systems.notify('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu!', '#ef4444');
            return false;
        }

        // BẢO MẬT ĐỘC QUYỀN DUY NHẤT: bao2010 (case-insensitive) & Bao28102010
        if (u.toLowerCase() === 'bao2010' && p === 'Bao28102010') {
            this.isAdmin = true;
            this.isLoggedIn = true;
            this.currentUser = { uid: 'admin_bao2010', username: 'bao2010', role: 'ADMIN' };
            Game.state.adminUnlocked = true;

            const adminEl = document.getElementById('admin-panel');
            if (adminEl) adminEl.classList.remove('hidden');

            Game.Systems.ensureAdminDrawerShortcut();
            Game.Systems.syncAdminInputs();
            Game.Cloud.renderAdminServerTab();

            Game.Systems.notify('⚡ XÁC THỰC THÀNH CÔNG: QUYỀN CHỦ TỂ ADMIN BẢO 2010 ĐÃ KÍCH HOẠT!', '#ffd740');
            Game.Systems.saveGame();

            this.closeAllAuthModals();
            return true;
        }

        // TÀI KHOẢN NGƯỜI CHƠI THƯỜNG: Thu hồi quyền Admin tuyệt đối
        this.isAdmin = false;
        this.isLoggedIn = true;
        Game.state.adminUnlocked = false;

        const adminEl = document.getElementById('admin-panel');
        if (adminEl) adminEl.classList.add('hidden');
        const adminShortcut = document.getElementById('drawer-admin-shortcut');
        if (adminShortcut) adminShortcut.remove();

        const sanitizedUid = u.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        this.currentUser = { uid: sanitizedUid, username: u, role: 'PLAYER' };

        Game.Systems.notify(`Chào mừng chiến binh [${u}] trở lại!`, '#38bdf8');
        Game.Cloud.initUserSync(sanitizedUid, u);

        this.closeAllAuthModals();
        return true;
    },

    loginAsGuest: function () {
        const guestId = 'guest_' + Math.floor(Math.random() * 89999 + 10000);
        this.isAdmin = false;
        this.isLoggedIn = true;
        Game.state.adminUnlocked = false;
        this.currentUser = { uid: guestId, username: 'Khách ' + guestId.slice(-4), role: 'GUEST' };

        Game.Systems.notify(`Tham gia dưới dạng Khách!`, '#94a3b8');
        this.closeAllAuthModals();
        return true;
    },

    logout: function () {
        if (Game.Cloud._userListenerRef && Game.Cloud._userListenerHandler) {
            Game.Cloud._userListenerRef.off('value', Game.Cloud._userListenerHandler);
        }

        this.currentUser = null;
        this.isAdmin = false;
        this.isLoggedIn = false;
        Game.state.adminUnlocked = false;
        Game.state.isPaused = true;

        const adminEl = document.getElementById('admin-panel');
        if (adminEl) adminEl.classList.add('hidden');
        const adminShortcut = document.getElementById('drawer-admin-shortcut');
        if (adminShortcut) adminShortcut.remove();

        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.remove('hidden');
            authModal.style.display = 'flex';
        } else {
            Game.Cloud.showLoginModal();
        }
        Game.Systems.notify('Đã đăng xuất tài khoản. Đang chờ đăng nhập...', '#94a3b8');
    }
};

Game.Cloud = {
    _userListenerRef: null,
    _userListenerHandler: null,

    initUserSync: function (uid, username) {
        if (!window.db) return;
        const userRef = window.db.ref('users/' + uid);

        userRef.once('value').then(snap => {
            const data = snap.val();
            if (!data) {
                userRef.set({
                    uid: uid,
                    username: username,
                    gold: Game.state.gold || 200,
                    level: Game.state.level || 1,
                    currentWeapon: Game.state.currentWeapon || 'iron_sword',
                    timeShards: Game.state.timeShards || 0,
                    isBanned: false,
                    banReason: '',
                    lastLogin: Date.now()
                });
            } else {
                userRef.update({ lastLogin: Date.now() });
            }
        }).catch(err => console.warn('[Cloud] Init user sync error:', err));

        this.listenUserChanges(uid);
    },

    listenUserChanges: function (uid) {
        if (!window.db) return;
        if (this._userListenerRef && this._userListenerHandler) {
            this._userListenerRef.off('value', this._userListenerHandler);
        }

        this._userListenerRef = window.db.ref('users/' + uid);
        this._userListenerHandler = this._userListenerRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;

            // 1. KIỂM TRA LỆNH KHÓA TÀI KHOẢN (BAN)
            if (data.isBanned === true) {
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
                const reason = data.banReason || 'Vi phạm chính sách thời không.';
                banOverlay.innerHTML = `
                    <div style="font-size: 64px; margin-bottom: 15px;">🚫</div>
                    <h1 style="font-size: 32px; letter-spacing: 2px; color: #ff3860;">TÀI KHOẢN ĐÃ BỊ ĐÓNG BĂNG</h1>
                    <p style="font-size: 18px; color: #cbd5e1; margin-top: 10px; max-width: 500px;">Lý do: <strong>${reason}</strong></p>
                    <p style="font-size: 14px; color: #64748b; margin-top: 20px;">Vui lòng liên hệ Admin Bảo để gỡ án cấm.</p>
                `;
                banOverlay.classList.remove('hidden');
                banOverlay.style.display = 'flex';
                return;
            } else {
                const banOverlay = document.getElementById('banned-overlay');
                if (banOverlay) {
                    banOverlay.classList.add('hidden');
                    banOverlay.style.display = 'none';
                }
            }

            // 2. LẮNG NGHE VÀ NHẬN PHẦN THƯỞNG TỪ ADMIN (pendingGift)
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
                if (gift.weapon && Game.Systems.weaponsConfig[gift.weapon]) {
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
                    const notifyText = `🎁 ADMIN BẢO VỪA TẶNG BẠN: ${rewardDesc.join(' | ')}!`;
                    Game.Systems.notify(notifyText, '#00e5ff');
                    if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
                    Game.Systems.updateShopButtons();
                    Game.Systems.updateUI();
                    Game.Systems.saveGame();
                }
            }
        });
    },

    syncCurrentPlayerData: function () {
        if (!window.db || !Game.Auth.currentUser || Game.Auth.isAdmin) return;
        const uid = Game.Auth.currentUser.uid;
        window.db.ref('users/' + uid).update({
            gold: Game.state.gold || 0,
            level: Game.state.level || 1,
            timeShards: Game.state.timeShards || 0,
            currentWeapon: Game.state.currentWeapon || 'iron_sword',
            lastSync: Date.now()
        }).catch(() => {});
    },

    adminFetchUsers: function (callback) {
        if (!window.db || !Game.Auth.isAdmin) {
            if (callback) callback({});
            return;
        }
        window.db.ref('users').once('value').then(snap => {
            const data = snap.val() || {};
            if (callback) callback(data);
        }).catch(err => {
            console.error('[Admin] Lỗi lấy danh sách users:', err);
            if (callback) callback({});
        });
    },

    adminBanUser: function (targetUid, reason) {
        if (!window.db || !Game.Auth.isAdmin) return;
        const banMsg = reason || 'Vi phạm điều khoản game.';
        window.db.ref('users/' + targetUid).update({
            isBanned: true,
            banReason: banMsg
        }).then(() => {
            Game.Systems.notify(`🚫 Đã Khóa Người Chơi: ${targetUid}`, '#ef4444');
            this.refreshAdminUserListUI();
        });
    },

    adminUnbanUser: function (targetUid) {
        if (!window.db || !Game.Auth.isAdmin) return;
        window.db.ref('users/' + targetUid).update({
            isBanned: false,
            banReason: ''
        }).then(() => {
            Game.Systems.notify(`✅ Đã Mở Khóa Người Chơi: ${targetUid}`, '#4ade80');
            this.refreshAdminUserListUI();
        });
    },

    adminSendGift: function (targetUid, giftData) {
        if (!window.db || !Game.Auth.isAdmin) return;
        window.db.ref('users/' + targetUid + '/pendingGift').set(giftData).then(() => {
            Game.Systems.notify(`🎁 Đã gửi quà tới [${targetUid}] thành công!`, '#00e5ff');
        });
    },

    renderAdminServerTab: function () {
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
                    <span style="font-weight: bold; color: #ffd740; font-size: 13px;">🌐 QUẢN TRỊ SERVER TỪ XA (FIREBASE)</span>
                    <button type="button" class="btn-action" style="font-size: 11px; padding: 3px 8px;" onclick="Game.Cloud.refreshAdminUserListUI()">🔄 Làm mới</button>
                </div>
                <div id="admin-user-list" style="max-height: 180px; overflow-y: auto; background: rgba(0,0,0,0.5); border-radius: 6px; padding: 6px; font-size: 11px;">
                    <em>Đang tải dữ liệu người chơi từ Firebase...</em>
                </div>
            `;
            adminPanel.appendChild(serverTab);
        }
        this.refreshAdminUserListUI();
    },

    refreshAdminUserListUI: function () {
        const container = document.getElementById('admin-user-list');
        if (!container || !Game.Auth.isAdmin) return;

        this.adminFetchUsers(users => {
            const keys = Object.keys(users);
            if (keys.length === 0) {
                container.innerHTML = '<span style="color: #94a3b8;">Chưa có người chơi nào đăng nhập.</span>';
                return;
            }

            container.innerHTML = keys.map(k => {
                const u = users[k];
                const isBanned = !!u.isBanned;
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 5px 0;">
                        <div>
                            <strong style="color: ${isBanned ? '#ef4444' : '#38bdf8'}">${u.username || k}</strong>
                            <span style="color: #94a3b8; margin-left: 6px;">Lv.${u.level || 1} | ${u.gold || 0}G | ${u.timeShards || 0}💎</span>
                            ${isBanned ? '<span style="color:#ef4444; font-weight:bold; margin-left:4px;">[BANNED]</span>' : ''}
                        </div>
                        <div style="display: flex; gap: 4px;">
                            ${isBanned
                                ? `<button type="button" class="btn-action" style="background:#22c55e; color:#fff; font-size:10px; padding:2px 6px;" onclick="Game.Cloud.adminUnbanUser('${k}')">Gỡ Ban</button>`
                                : `<button type="button" class="btn-action" style="background:#ef4444; color:#fff; font-size:10px; padding:2px 6px;" onclick="Game.Cloud.promptBan('${k}')">Ban</button>`
                            }
                            <button type="button" class="btn-action" style="background:#0284c7; color:#fff; font-size:10px; padding:2px 6px;" onclick="Game.Cloud.promptGift('${k}')">Tặng Quà</button>
                        </div>
                    </div>
                `;
            }).join('');
        });
    },

    promptBan: function (targetUid) {
        const reason = prompt(`Nhập lý do khóa tài khoản [${targetUid}]:`, 'Vi phạm nội quy máy chủ');
        if (reason !== null) {
            this.adminBanUser(targetUid, reason);
        }
    },

    promptGift: function (targetUid) {
        const goldStr = prompt(`Nhập số VÀNG muốn tặng [${targetUid}]:`, '10000');
        if (goldStr === null) return;
        const shardsStr = prompt(`Nhập số MẢNH THỜI KHÔNG (💎) muốn tặng:`, '10');
        if (shardsStr === null) return;

        const gold = parseInt(goldStr, 10) || 0;
        const shards = parseInt(shardsStr, 10) || 0;

        this.adminSendGift(targetUid, { gold: gold, shards: shards });
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
                background: rgba(8, 10, 20, 0.88); backdrop-filter: blur(8px);
                z-index: 99999; display: flex; justify-content: center; align-items: center;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            `;
            modal.innerHTML = `
                <div style="background: rgba(18, 24, 38, 0.95); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 26px; width: 340px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); text-align: center;">
                    <h2 style="color: #38bdf8; margin-bottom: 6px; font-size: 20px; letter-spacing: 1px;">⚔️ ĐĂNG NHẬP THỜI KHÔNG</h2>
                    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 18px;">Nhập tài khoản để kích hoạt dữ liệu Cloud</p>
                    <input type="text" id="auth-username" placeholder="Tên tài khoản..." style="width: 100%; box-sizing: border-box; padding: 10px 12px; margin-bottom: 10px; background: rgba(0,0,0,0.5); border: 1px solid #334155; border-radius: 6px; color: #fff; font-size: 14px;" />
                    <input type="password" id="auth-password" placeholder="Mật khẩu..." style="width: 100%; box-sizing: border-box; padding: 10px 12px; margin-bottom: 16px; background: rgba(0,0,0,0.5); border: 1px solid #334155; border-radius: 6px; color: #fff; font-size: 14px;" />
                    <button type="button" id="auth-submit-btn" style="width: 100%; padding: 11px; background: linear-gradient(135deg, #0284c7, #38bdf8); border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer; font-size: 14px; letter-spacing: 1px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);">
                        VÀO GAME
                    </button>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('auth-submit-btn').addEventListener('click', () => {
                Game.Auth.login();
            });

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

// ============================================================================
// 5. HỆ THỐNG TRUNG TÂM & QUẢN LÝ DỮ LIỆU GAME (Game.Systems)
// ============================================================================
Game.Systems = {
    SAVE_KEY: 'TIME_TRAVELER_PRO_PERSISTENCE_V3',
    LEGACY_KEYS: ['TIME_TRAVELER_SAVE_V2', 'TIME_TRAVELER_SAVE_V1', 'TIME_TRAVELER_SAVE'],
    SECRET_SALT: 'CHRONO_ARCHITECT_2026_SALT_KEY',
    quests: [],
    sideQuestCounter: 0,
    activeSideQuest: null,
    lastQuestStateHash: '',
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

    relicsConfig: {
        relic_speed: { id: 'relic_speed', name: 'Ngọc Tốc Độ', price: 500, desc: '+15% Tốc chạy' },
        relic_vamp: { id: 'relic_vamp', name: 'Ngọc Hút Máu', price: 500, desc: 'Hút 8% Máu' },
        relic_thorn: { id: 'relic_thorn', name: 'Ngọc Phản Đòn', price: 500, desc: 'Phản 25% Sát thương' },
        relic_cooling: { id: 'relic_cooling', name: 'Lõi Làm Mát Lượng Tử', price: 600, desc: '-40% Nhiệt Súng & +10 ST' },
        relic_assassin: { id: 'relic_assassin', name: 'Ấn Ký Ám Sát', price: 750, desc: '+20% Máu, +10 Tốc & +5 Nộ/Kill' }
    },

    upgradesConfig: {
        hp: { baseCost: 100, amount: 25, shieldBonus: 5, label: '+25 Máu Tối Đa' },
        speed: { baseCost: 120, amount: 15, label: '+15 Tốc Độ Chạy' },
        damage: { baseCost: 150, amount: 6, label: '+6 Sát Thương Cơ Bản' },
        heal: { baseCost: 50, amount: 100, label: 'Bình Hồi Phục' }
    },

    _syncCombatSkillsets: function () {
        if (!window.Game.Combat) return;
        window.Game.Combat.characterSkillsets = {
            time_traveler: Game.charactersConfig.time_traveler.skills,
            shadow_assassin: Game.charactersConfig.shadow_assassin.skills,
            iron_juggernaut: Game.charactersConfig.iron_juggernaut.skills,
            chrono_traveler: Game.charactersConfig.time_traveler.skills,
            cyber_ninja: Game.charactersConfig.shadow_assassin.skills,
            void_mage: Game.charactersConfig.iron_juggernaut.skills
        };
        if (typeof window.Game.Combat.attack !== 'function') {
            window.Game.Combat.attack = function () {
                this.useSkill(0, { manualAim: false });
            };
        }
    },

    _ensureCharacterStateIntegrity: function () {
        const state = Game.state;
        const legacyMap = {
            chrono_striker: 'time_traveler',
            chrono_traveler: 'time_traveler',
            void_ranger: 'shadow_assassin',
            cyber_ninja: 'shadow_assassin',
            aegis_guardian: 'iron_juggernaut',
            void_mage: 'iron_juggernaut'
        };
        if (legacyMap[state.selectedCharacter]) {
            state.selectedCharacter = legacyMap[state.selectedCharacter];
        }

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
        this.updateUI();
        return true;
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

        const clonedSkills = cfg.skills.map(sk => Object.assign({}, sk, { cd: Number(sk.cd) || 0 }));
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

        // 1. HỆ THỐNG THỨC TỈNH VŨ KHÍ (WEAPON AWAKENING TIERS)
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

        // 2. HIỆU ỨNG CỔ VẬT THỜI KHÔNG
        if (Array.isArray(state.equippedRelics)) {
            if (state.equippedRelics.includes('relic_speed')) {
                effectiveSpeed = Math.round(effectiveSpeed * 1.15);
            }
            if (state.equippedRelics.includes('relic_cooling')) {
                effectiveBaseDamage += 10;
            }
            if (state.equippedRelics.includes('relic_assassin')) {
                expectedMaxHp = Math.round(expectedMaxHp * 1.20);
                effectiveSpeed += 10;
            }
        }

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
        const petBonus = state.hasPet ? 400 : 0;

        const totalCp = (player.maxHp * 2) +
                        (player.maxShield * 2.5) +
                        (player.baseDamageBonus * 12) +
                        (player.speed * 1.5) +
                        (wLvl * 85) +
                        (relicCount * 250) +
                        petBonus;

        return Math.round(totalCp);
    },

    computeChecksum: function (str, useSalt = true) {
        const input = useSalt ? `${str}|${this.SECRET_SALT}` : str;
        let hash = 0x811c9dc5;
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
            hash = ((hash << 5) | (hash >>> 27)) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    },

    saveGame: function () {
        try {
            this._ensureCharacterStateIntegrity();
            const payload = {
                version: '3.4.0',
                timestamp: Date.now(),
                state: Object.assign({}, Game.state, { isPaused: false, adminUnlocked: false }),
                player: {
                    x: Number(Game.player.x) || 1920,
                    y: Number(Game.player.y) || 1920,
                    speed: Game.player.speed,
                    hp: Game.player.hp,
                    maxHp: Game.player.maxHp,
                    shield: Game.player.shield,
                    maxShield: Game.player.maxShield,
                    baseDamageBonus: Game.player.baseDamageBonus,
                    characterId: Game.state.selectedCharacter
                },
                quests: this.quests,
                sideQuestCounter: this.sideQuestCounter,
                activeSideQuest: this.activeSideQuest
            };

            const jsonStr = JSON.stringify(payload);
            const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
            const checksum = this.computeChecksum(encoded, true);
            localStorage.setItem(this.SAVE_KEY, `${checksum}.${encoded}`);

            if (Game.Cloud && typeof Game.Cloud.syncCurrentPlayerData === 'function') {
                Game.Cloud.syncCurrentPlayerData();
            }
            return true;
        } catch (e) {
            console.warn('[Persistence] Không thể ghi dữ liệu:', e);
            return false;
        }
    },

    loadGame: function () {
        try {
            let raw = localStorage.getItem(this.SAVE_KEY);
            let isLegacy = false;

            if (!raw) {
                for (let i = 0; i < this.LEGACY_KEYS.length; i++) {
                    const legacyData = localStorage.getItem(this.LEGACY_KEYS[i]);
                    if (legacyData) {
                        raw = legacyData;
                        isLegacy = true;
                        break;
                    }
                }
            }

            if (!raw) return false;

            let data = null;

            if (raw.trim().startsWith('{')) {
                data = JSON.parse(raw);
            } else if (raw.includes('.')) {
                const [savedHash, encoded] = raw.split('.');
                if (!savedHash || !encoded) return false;

                const saltedHash = this.computeChecksum(encoded, true);
                const unsaltedHash = this.computeChecksum(encoded, false);

                if (savedHash !== saltedHash && savedHash !== unsaltedHash) {
                    console.warn('[Persistence] Checksum không khớp, bỏ qua save cũ.');
                    return false;
                }

                const jsonStr = decodeURIComponent(escape(atob(encoded)));
                data = JSON.parse(jsonStr);
            } else {
                return false;
            }

            if (data && data.state) {
                Game.state = Object.assign({}, DEFAULT_GAME_STATE, data.state);
                Game.state.weaponLevels = Object.assign({}, DEFAULT_GAME_STATE.weaponLevels, data.state.weaponLevels || {});
                Game.state.upgradeLevels = Object.assign({}, DEFAULT_GAME_STATE.upgradeLevels, data.state.upgradeLevels || {});
                Game.state.characterStats = Object.assign(
                    JSON.parse(JSON.stringify(DEFAULT_CHARACTER_STATS)),
                    data.state.characterStats || {}
                );

                if (typeof Game.state.gold !== 'number' || !isFinite(Game.state.gold) || Game.state.gold > 999999999) {
                    Game.state.gold = 999999;
                }
                if (typeof Game.state.timeShards !== 'number' || !isFinite(Game.state.timeShards) || Game.state.timeShards > 999999) {
                    Game.state.timeShards = 999;
                }
                Game.state.usedGiftcodes = Array.isArray(data.state.usedGiftcodes)
                    ? data.state.usedGiftcodes
                        .map(c => String(c).toUpperCase())
                        .filter(c => c !== 'BAO28102010@@')
                    : [];
                Game.state.isPaused = false;
            }

            // Thu hồi toàn bộ quyền Admin lưu trong LocalStorage
            Game.state.adminUnlocked = false;
            if (Game.Auth) Game.Auth.isAdmin = false;

            if (data && data.player) {
                Game.player = Object.assign({}, DEFAULT_PLAYER_STATE, Game.player, data.player);
            }

            if (data && Array.isArray(data.quests)) {
                this.quests = data.quests;
            }
            if (data && typeof data.sideQuestCounter === 'number') {
                this.sideQuestCounter = data.sideQuestCounter;
            }
            if (data && data.activeSideQuest) {
                this.activeSideQuest = data.activeSideQuest;
            }

            this._ensureCharacterStateIntegrity();
            this.applyCharacterStats(Game.state.selectedCharacter);

            if (isLegacy) {
                this.saveGame();
            }
            return true;
        } catch (err) {
            console.warn('[Persistence] Khởi tạo dữ liệu mặc định do lỗi đọc save:', err);
            Game.state.adminUnlocked = false;
            if (Game.Auth) Game.Auth.isAdmin = false;
            this._ensureCharacterStateIntegrity();
            this.applyCharacterStats('time_traveler');
            return false;
        }
    },

    resetSaveData: function () {
        try {
            localStorage.removeItem(this.SAVE_KEY);
            this.LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
        location.reload();
    },

    // ========================================================================
    // CÁC HÀM QUẢN TRỊ ADMIN PANEL (CHỈ HOẠT ĐỘNG KHI Game.Auth.isAdmin = true)
    // ========================================================================
    adminSetStat: function (statType, value) {
        if (!Game.Auth.isAdmin) {
            this.notify('⛔ Cảnh báo: Chỉ Admin Bảo 2010 mới được can thiệp chỉ số!', '#ef4444');
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
            this.notify(`🔥 Đã đặt Sát thương cơ bản: +${p.baseDamageBonus.toLocaleString()}`, '#f97316');
        }

        this.syncAdminInputs();
        this.updateUI();
        this.saveGame();
    },

    syncAdminInputs: function () {
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
        if (!Game.Auth.isAdmin) {
            this.notify('⛔ Cảnh báo: Chỉ Admin Bảo 2010 mới được dùng quyền hạn này!', '#ef4444');
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
            this.notify('💀 Đã tiêu diệt toàn bộ Quái & Boss!', '#ef4444');
        } else if (action === 'nextLoop') {
            Game.state.loopLevel = (Game.state.loopLevel || 1) + 1;
            if (Game.Enemies && typeof Game.Enemies.init === 'function') {
                Game.Enemies.init();
            }
            this.notify(`🌀 Đã chuyển sang Chu Kỳ ${Game.state.loopLevel}!`, '#a855f7');
        }

        this.recalculateMaxStats();
        this.syncAdminInputs();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    toggleAdminPanel: function (forceShow) {
        if (!Game.Auth.isAdmin) {
            const adminEl = document.getElementById('admin-panel');
            if (adminEl) adminEl.classList.add('hidden');
            this.notify('⛔ Bạn không có quyền Admin!', '#ef4444');
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
        if (!Game.Auth.isAdmin) return;
        const drawer = document.getElementById('compact-info-drawer');
        if (!drawer || document.getElementById('drawer-admin-shortcut')) return;

        const section = document.createElement('div');
        section.id = 'drawer-admin-shortcut';
        section.className = 'drawer-section';
        section.innerHTML = `
            <button type="button" class="btn-action" style="width: 100%; border-color: #ffd740; background: linear-gradient(135deg, rgba(255, 215, 64, 0.25), rgba(213, 0, 249, 0.28)); color: #fde047;" onclick="Game.Systems.toggleAdminPanel()">
                ⚡ Bật / Tắt Bảng Admin
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

        const isUnlimitedAdminCode = (normalizedCode === 'BAO28102010@@');
        const normalizedHistory = Game.state.usedGiftcodes.map(c => String(c).toUpperCase());

        if (!isUnlimitedAdminCode && normalizedHistory.includes(normalizedCode)) {
            this.notify(`Mã "${normalizedCode}" đã được sử dụng trước đó!`, '#f87171');
            return false;
        }

        let isSuccess = false;
        let successMessage = '';

        switch (normalizedCode) {
            case 'UPDATE2026':
                Game.state.gold += 25000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 30;
                this._grantRelicFree('relic_cooling');
                this._grantRelicFree('relic_assassin');
                this.recalculateMaxStats();
                successMessage = '🚀 UPDATE2026: +25.000G, +30💎, Gắn Lõi Làm Mát & Ấn Ký Ám Sát!';
                isSuccess = true;
                break;

            case 'MELEEKING':
                Game.state.gold += 15000;
                if (!Game.state.ownedWeapons.includes('cyber_sword')) {
                    Game.state.ownedWeapons.push('cyber_sword');
                }
                if (!Game.state.ownedWeapons.includes('void_scythe')) {
                    Game.state.ownedWeapons.push('void_scythe');
                }
                Game.state.weaponLevels.cyber_sword = Math.max((Game.state.weaponLevels.cyber_sword || 0), 10);
                Game.state.weaponLevels.void_scythe = Math.max((Game.state.weaponLevels.void_scythe || 0), 10);
                Game.state.currentWeapon = 'void_scythe';
                this.recalculateMaxStats();
                successMessage = '👑 MELEEKING: +15.000G, Mở Kiếm Điện Tử & Lưỡi Hái Hư Không +10!';
                isSuccess = true;
                break;

            case 'BAODEPZAI':
                Game.state.gold += 5000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 5;
                successMessage = '🎁 BAODEPZAI: +5.000 Vàng & +5💎 Mảnh Thời Không!';
                isSuccess = true;
                break;

            case 'BAO28102010@@':
                Game.state.gold += 50000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 100;
                Game.state.godMode = true;
                Game.player.godMode = true;
                Game.state.unlockedWaypoints = [true, true, true];
                this.unlockCharacter('shadow_assassin');
                this.unlockCharacter('iron_juggernaut');
                this.unlockTitle('⚡ ĐẤNG SÁNG TẠO BẢO ADMIN ⚡');
                successMessage = '⚡ GIFTCODE ADMIN: +50k Vàng, +100💎, Full Tướng & Bất Tử! (Bảng Admin chỉ mở qua đăng nhập bao2010)';
                isSuccess = true;
                break;

            case 'SHADOW2026':
            case 'ASSASSINVIP':
                this.unlockCharacter('shadow_assassin');
                Game.state.gold += 12000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 15;
                Game.state.bonusSpeed = (Game.state.bonusSpeed || 0) + 20;
                this.recalculateMaxStats();
                successMessage = '🗡️ Mở khóa Nữ Sát Thủ Bóng Đêm, +12.000G, +15💎 & +20 Tốc Chạy Nền!';
                isSuccess = true;
                break;

            case 'JUGGERNAUT99':
            case 'TANKERPRO':
                this.unlockCharacter('iron_juggernaut');
                Game.state.gold += 15000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 20;
                Game.state.bonusMaxShield = (Game.state.bonusMaxShield || 0) + 60;
                this.recalculateMaxStats();
                successMessage = '🛡️ Mở khóa Hộ Vệ Tinh Vân, +15.000G, +20💎 & +60 Giáp Nền!';
                isSuccess = true;
                break;

            case 'FREEFIRE2026':
                Game.state.gold += 15000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 15;
                Game.state.bonusMaxShield = (Game.state.bonusMaxShield || 0) + 50;
                Game.state.bonusSpeed = (Game.state.bonusSpeed || 0) + 15;
                this.unlockTitle('🔥 Chiến Binh Sinh Tồn');
                this.recalculateMaxStats();
                successMessage = '🔥 FREEFIRE2026: +15.000G, +15💎, +50 Giáp Nền, +15 Tốc Chạy!';
                isSuccess = true;
                break;

            case 'SIEUCAPVIP':
                Game.state.gold += 30000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 25;
                Game.state.hasPet = true;
                this.unlockCharacter('shadow_assassin');
                this._grantRelicFree('relic_vamp');
                this.recalculateMaxStats();
                successMessage = '👑 SIEUCAPVIP: +30.000G, +25💎, Mở Sát Thủ, Tinh Linh & Ngọc Hút Máu!';
                isSuccess = true;
                break;

            case 'THOIKHONG999':
                Game.state.gold += 9999;
                Game.state.timeShards = (Game.state.timeShards || 0) + 30;
                for (let i = 0; i < 3; i++) this.addExp(Game.state.maxExp || 100);
                Game.state.rage = Game.state.maxRage || 100;
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
                successMessage = '🗡️ TANTHU2026: +8.888G, +10💎, +25 Giáp Nền & Kiếm Điện Tử +5!';
                isSuccess = true;
                break;

            case 'SANBOSSMAX':
                Game.state.gold += 20000;
                Game.state.timeShards = (Game.state.timeShards || 0) + 20;
                Game.state.unlockedWaypoints = [true, true, true];
                this.unlockCharacter('iron_juggernaut');
                this._grantRelicFree('relic_speed');
                this._grantRelicFree('relic_thorn');
                this.recalculateMaxStats();
                successMessage = '⚔️ SANBOSSMAX: +20.000G, +20💎, Mở Thiết Giáp, Full Trụ & 2 Cổ Vật!';
                isSuccess = true;
                break;

            default:
                this.notify('Mã Giftcode không hợp lệ hoặc đã hết hạn!', '#ef4444');
                return false;
        }

        if (isSuccess) {
            if (!isUnlimitedAdminCode && !normalizedHistory.includes(normalizedCode)) {
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
        if (!this.relicsConfig[relicId]) return;
        if (!Array.isArray(Game.state.ownedRelics)) Game.state.ownedRelics = [];
        if (!Array.isArray(Game.state.equippedRelics)) Game.state.equippedRelics = [];
        if (!Game.state.ownedRelics.includes(relicId)) Game.state.ownedRelics.push(relicId);
        if (Game.state.equippedRelics.length < 4 && !Game.state.equippedRelics.includes(relicId)) {
            Game.state.equippedRelics.push(relicId);
        }
    },

    bindAuthUiEvents: function () {
        // Gắn sự kiện cho các nút trên giao diện đăng nhập
        const btnAuthLogin = document.getElementById('btn-auth-login');
        if (btnAuthLogin) {
            btnAuthLogin.onclick = () => Game.Auth.login();
        }

        const btnGuest = document.getElementById('btn-auth-guest');
        if (btnGuest) {
            btnGuest.onclick = () => Game.Auth.loginAsGuest();
        }

        // Bắt sự kiện phím Enter ở các ô nhập tài khoản / mật khẩu
        const pInputs = document.querySelectorAll('#auth-password, input[type="password"]');
        pInputs.forEach(input => {
            input.onkeydown = e => {
                if (e.key === 'Enter') Game.Auth.login();
            };
        });

        // Bắt sự kiện cho bất kỳ nút nào có chữ "Đăng Nhập" hoặc "Vào Game"
        document.querySelectorAll('button').forEach(btn => {
            const txt = (btn.textContent || '').trim().toLowerCase();
            if ((txt.includes('đăng nhập') || txt.includes('vào game')) && !btn.id.includes('shop')) {
                btn.onclick = () => Game.Auth.login();
            } else if (txt.includes('chơi khách') || txt.includes('đăng xuất')) {
                btn.onclick = () => Game.Auth.loginAsGuest();
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
        this.loadGame();

        // Thu hồi toàn bộ quyền Admin từ save cũ
        Game.state.adminUnlocked = false;
        if (Game.Auth) Game.Auth.isAdmin = false;
        const adminEl = document.getElementById('admin-panel');
        if (adminEl) adminEl.classList.add('hidden');

        if (!this.quests.some(q => q.id === 4)) {
            this.quests.push({
                id: 4,
                title: 'Hạ gục 3 Boss Phụ Kỷ Nguyên (Quá Khứ/Hiện Tại/Tương Lai)',
                cur: 0,
                target: 3,
                reward: 1500,
                expReward: 250,
                done: false
            });
        }

        if (Array.isArray(Game.state.usedGiftcodes)) {
            Game.state.usedGiftcodes = Game.state.usedGiftcodes.filter(
                code => String(code).toUpperCase() !== 'BAO28102010@@'
            );
        }

        this._ensureCharacterStateIntegrity();
        this.applyCharacterStats(Game.state.selectedCharacter);
        this.setupSecretGiftcodeTrigger();
        this.checkAndGenerateSideQuest();
        this.renderQuestList();
        this.updateTimelineBadge();
        this.updateShopButtons();
        this.syncAdminInputs();
        this.updateUI();

        // Kích hoạt ràng buộc các nút đăng nhập trên giao diện
        this.bindAuthUiEvents();

        // Kiểm tra phiên đăng nhập
        if (!Game.Auth.isLoggedIn) {
            Game.Cloud.showLoginModal();
            Game.state.isPaused = true;
        }

        if (this._autoSaveInterval) clearInterval(this._autoSaveInterval);
        this._autoSaveInterval = setInterval(() => {
            this.saveGame();
        }, 5000);
    },

    notify: function (text, color = '#ffffff') {
        if (Game.Combat && typeof Game.Combat.spawnFloatingText === 'function') {
            Game.Combat.spawnFloatingText(Game.player.x, Game.player.y - 38, text, color);
        }
    },

    onItemPickedUp: function (type, amount = 1) {
        if (type === 'shard' || type === 'timeShard') {
            Game.state.timeShards = (Game.state.timeShards || 0) + amount;
            this.notify(`+${amount} 💎 Mảnh Thời Không!`, '#00e5ff');
        } else if (type === 'gold') {
            Game.state.gold = (Game.state.gold || 0) + amount;
            this.notify(`+${amount}G`, '#fde047');
        }
        if (Game.Audio && typeof Game.Audio.playCoin === 'function') {
            Game.Audio.playCoin();
        }
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    switchTimeline: function (newTimeline) {
        const validTimelines = ['PAST', 'PRESENT', 'FUTURE'];
        if (!validTimelines.includes(newTimeline)) return;
        if (Game.state.timeline === newTimeline) return;

        if ((Game.state.timeShiftCooldown || 0) > 0) {
            this.notify(`Năng lượng hồi chiêu: ${Game.state.timeShiftCooldown.toFixed(1)}s!`, '#f87171');
            return;
        }

        const shopModal = document.getElementById('shop-modal');
        if (shopModal && !shopModal.classList.contains('hidden')) {
            this.toggleShop();
        }

        Game.state.timeline = newTimeline;
        Game.state.timeShiftMaxCd = 4.0;
        Game.state.timeShiftCooldown = 4.0;

        this.recalculateMaxStats();

        const flashEl = document.getElementById('time-flash');
        if (flashEl) {
            flashEl.classList.remove('flash-active');
            void flashEl.offsetWidth;
            flashEl.classList.add('flash-active');
            setTimeout(() => flashEl.classList.remove('flash-active'), 560);
        }

        const timelineColors = { PAST: '#f59e0b', PRESENT: '#10b981', FUTURE: '#06b6d4' };
        this.notify(`Du hành tới: ${newTimeline}`, timelineColors[newTimeline] || '#ffffff');

        this.updateTimelineBadge();
        this.updateUI();

        if (Game.World && typeof Game.World.ensureSafePlayerPosition === 'function') {
            Game.World.ensureSafePlayerPosition();
        }
        if (Game.Audio && typeof Game.Audio.playTimeShift === 'function') {
            Game.Audio.playTimeShift();
        }
        this.saveGame();
    },

    updateTimelineBadge: function () {
        const current = Game.state.timeline;
        const badgeEl = document.getElementById('timeline-badge');
        if (badgeEl) {
            const labels = { PAST: 'QUÁ KHỨ', PRESENT: 'HIỆN TẠI', FUTURE: 'TƯƠNG LAI' };
            const colors = { PAST: '#d97706', PRESENT: '#059669', FUTURE: '#0284c7' };
            badgeEl.textContent = labels[current] || current;
            badgeEl.style.backgroundColor = colors[current] || '#374151';
        }

        const cd = Game.state.timeShiftCooldown || 0;
        const btnMap = { PAST: 'btn-past', PRESENT: 'btn-present', FUTURE: 'btn-future' };
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btnMap[current] && btn.classList.contains(btnMap[current])) {
                btn.classList.add('active');
            }
            btn.style.opacity = (cd > 0 && !btn.classList.contains('active')) ? '0.6' : '1';
        });
    },

    interact: function () {
        if (!Game.World || typeof Game.World.getNearbyInteractable !== 'function') return;
        const raw = Game.World.getNearbyInteractable(Game.player.x, Game.player.y);
        if (!raw) return;
        const type = typeof raw === 'object' ? raw.type : raw;

        if (type === 'SEED') {
            if (!Game.state.hasSeed) {
                Game.state.hasSeed = true;
                Game.Audio.playCoin();
                this.notify('Đã nhặt Hạt Giống Cổ Đại! Hãy mang về Quá Khứ trồng cạnh vực!', '#fde047');
                this.saveGame();
            } else {
                this.notify('Bạn đã có Hạt Giống Cổ Đại!', '#9ca3af');
            }
        } else if (type === 'SOIL') {
            if (Game.state.isTreePlanted) {
                this.notify('Cây cổ thụ đã được trồng tại đây!', '#86efac');
            } else if (Game.state.hasSeed) {
                Game.state.isTreePlanted = true;
                Game.Audio.playLevelUp();
                const q2 = this.quests.find(q => q.id === 2);
                if (q2 && !q2.done) {
                    q2.cur = q2.target;
                    q2.done = true;
                    Game.state.gold += q2.reward;
                    this.addExp(q2.expReward || 100);
                    this.unlockTitle('Bậc Thầy Nhân Quả');
                }
                this.notify('Đã trồng cây xuyên thời không!', '#4ade80');
                this.checkAndGenerateSideQuest();
                this.renderQuestList();
                this.saveGame();
            } else {
                this.notify('Cần Hạt Giống ở HIỆN TẠI để gieo mầm!', '#f87171');
            }
        } else if (type === 'CHEST_PAST') {
            if (!Game.state.chestOiled) {
                Game.state.chestOiled = true;
                Game.Audio.playCoin();
                this.notify('Đã bôi dầu bảo quản Rương! Sang TƯƠNG LAI mở!', '#38bdf8');
                this.saveGame();
            } else {
                this.notify('Rương đã được tra dầu bảo quản.', '#86efac');
            }
        } else if (type === 'CHEST_PRESENT') {
            this.notify(
                Game.state.chestOiled
                    ? 'Dầu đang bảo quản rương, hãy sang TƯƠNG LAI mở!'
                    : 'Rương bị rỉ sét! Hãy về QUÁ KHỨ tra dầu!',
                '#fb923c'
            );
        } else if (type === 'CHEST_FUTURE') {
            if (Game.state.chestOpened) {
                this.notify('Kho báu Nhân Quả đã được lấy!', '#9ca3af');
            } else if (Game.state.chestOiled) {
                Game.state.chestOpened = true;
                Game.state.gold += 500;
                Game.state.timeShards = (Game.state.timeShards || 0) + 2;
                Game.Audio.playCoin();
                this.notify('Mở Rương thành công! +500G, +2💎 & +150 EXP!', '#facc15');
                this.addExp(150);
                this.saveGame();
            } else {
                this.notify('Rương đã mục nát do rỉ sét qua ngàn năm!', '#ef4444');
            }
        } else if (type.startsWith('WAYPOINT_')) {
            const idx = parseInt(type.split('_')[1], 10);
            if (!isNaN(idx) && idx >= 0 && idx <= 2) {
                if (!Game.state.unlockedWaypoints[idx]) {
                    Game.state.unlockedWaypoints[idx] = true;
                    Game.Audio.playLevelUp();
                    this.notify(`Đã kích hoạt ${this.waypointsConfig[idx].name}!`, '#00e5ff');
                    this.saveGame();
                }
                this.toggleShop();
            }
        }
        this.updateUI();
    },

    addExp: function (amount) {
        const expGain = Math.max(0, Number(amount) || 0);
        if (expGain <= 0) return;

        this._ensureCharacterStateIntegrity();
        const cId = Game.state.selectedCharacter || 'time_traveler';
        const cStats = Game.state.characterStats[cId];

        Game.state.exp += expGain;
        let leveledUp = false;

        while (Game.state.exp >= Game.state.maxExp) {
            Game.state.exp -= Game.state.maxExp;
            Game.state.level += 1;
            Game.state.maxExp = Math.floor(Game.state.maxExp * 1.35 + 35);

            if (cStats) {
                cStats.level = Game.state.level;
                cStats.exp = Game.state.exp;
                cStats.maxExp = Game.state.maxExp;
            }

            this.recalculateMaxStats();
            Game.player.hp = Game.player.maxHp;
            Game.player.shield = Game.player.maxShield;
            leveledUp = true;
        }

        if (cStats && !leveledUp) {
            cStats.exp = Game.state.exp;
        }

        if (leveledUp) {
            if (Game.Audio && typeof Game.Audio.playLevelUp === 'function') Game.Audio.playLevelUp();
            this.notify(`LEVEL UP! Cấp ${Game.state.level} (+Chỉ số cơ bản)!`, '#fde047');
            this.syncAdminInputs();
        }
        this.updateUI();
        this.saveGame();
    },

    unlockTitle: function (newTitle) {
        if (!newTitle) return;
        Game.state.currentTitle = newTitle;
        if (!Game.state.achievements.includes(newTitle)) {
            Game.state.achievements.push(newTitle);
        }
    },

    onEnemyKilled: function (type, isBoss, isElite, expReward, isMiniBoss) {
        let questUpdated = false;
        const loop = Game.state.loopLevel || 1;
        const calcExp = expReward || (isBoss ? 250 * loop : isMiniBoss ? 120 * loop : isElite ? 45 * loop : 20 * loop);

        if (Game.state.chronoFreezeTimer <= 0) {
            let rageGain = isBoss ? 35 : isMiniBoss ? 25 : isElite ? 18 : 8;
            if (Array.isArray(Game.state.equippedRelics) && Game.state.equippedRelics.includes('relic_assassin')) {
                rageGain += 5;
            }
            Game.state.rage = Math.min(
                Game.state.maxRage || 100,
                (Game.state.rage || 0) + rageGain
            );
        }
        this.addExp(calcExp);

        if (type === 'ancient') {
            const q1 = this.quests.find(q => q.id === 1);
            if (q1 && !q1.done) {
                q1.cur = Math.min(q1.target, q1.cur + 1);
                questUpdated = true;
                if (q1.cur >= q1.target) {
                    q1.done = true;
                    Game.state.gold += q1.reward;
                    this.addExp(q1.expReward || 60);
                    this.unlockTitle('Kẻ Săn Cổ Đại');
                }
            }
        }

        if (isMiniBoss === true) {
            const q4 = this.quests.find(q => q.id === 4);
            if (q4 && !q4.done) {
                q4.cur = Math.min(q4.target, q4.cur + 1);
                questUpdated = true;
                if (q4.cur >= q4.target) {
                    q4.done = true;
                    Game.state.gold += q4.reward;
                    Game.state.timeShards = (Game.state.timeShards || 0) + 5;
                    this.addExp(q4.expReward || 250);
                    this.unlockTitle('Kẻ Chinh Phục Tam Giới');
                    this.notify('🏆 Hoàn thành diệt 3 Boss Phụ! +1500G & +5💎!', '#00e5ff');
                }
            }
        }

        if (isBoss === true) {
            const q3 = this.quests.find(q => q.id === 3);
            if (q3 && !q3.done) {
                q3.cur = Math.min(q3.target, q3.cur + 1);
                q3.done = true;
                Game.state.gold += q3.reward;
                this.addExp(q3.expReward || 300);
                this.unlockTitle('Chúa Tể Thời Không');
                questUpdated = true;
            }
            Game.state.loopLevel = (Game.state.loopLevel || 1) + 1;
            this.notify(`CỔNG CHU KỲ ${Game.state.loopLevel} ĐÃ MỞ! Quái vật gia tăng uy lực.`, '#00e5ff');
        }

        if (this.activeSideQuest && !this.activeSideQuest.done) {
            const sq = this.activeSideQuest;
            if (sq.targetType === 'any' || sq.targetType === type || (sq.targetType === 'elite' && isElite)) {
                sq.cur = Math.min(sq.target, sq.cur + 1);
                questUpdated = true;
                if (sq.cur >= sq.target) {
                    sq.done = true;
                    Game.state.gold += sq.reward;
                    if (sq.shardReward) Game.state.timeShards = (Game.state.timeShards || 0) + sq.shardReward;
                    this.addExp(sq.expReward);
                    this.activeSideQuest = null;
                    this.checkAndGenerateSideQuest();
                }
            }
        }

        if (questUpdated) this.renderQuestList();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    checkAndGenerateSideQuest: function () {
        if (this.activeSideQuest && !this.activeSideQuest.done) return;
        this.sideQuestCounter += 1;
        const step = this.sideQuestCounter;
        const loop = Game.state.loopLevel || 1;

        this.activeSideQuest = {
            id: 100 + step,
            title: `[Phụ #${step}] Tiêu diệt ${6 + step * 2} Quái Vật Đột Biến`,
            targetType: 'mutant',
            cur: 0,
            target: 6 + step * 2,
            reward: 350 + step * 100,
            expReward: 80 + step * 30,
            shardReward: loop >= 2 ? 1 : 0,
            done: false
        };
    },

    activateChronoFreeze: function () {
        if (Game.Combat && typeof Game.Combat.useSkill === 'function') {
            Game.Combat.useSkill(3, { manualAim: false });
        } else {
            if ((Game.state.rage || 0) < (Game.state.maxRage || 100)) {
                this.notify('Nộ Thời Không chưa đầy!', '#c084fc');
                return;
            }
            Game.state.rage = 0;
            Game.state.chronoFreezeTimer = 3.5;
            if (Game.Audio && typeof Game.Audio.playFreeze === 'function') Game.Audio.playFreeze();
            this.notify('NGƯNG ĐỌNG THỜI GIAN!', '#d500f9');
        }
        this.updateUI();
    },

    cycleWeapon: function () {
        const owned = Game.state.ownedWeapons || ['iron_sword'];
        if (owned.length <= 1) {
            this.notify('Bạn mới sở hữu 1 vũ khí! Hãy mua thêm ở Cửa Hàng.', '#94a3b8');
            return;
        }
        const nextIdx = (owned.indexOf(Game.state.currentWeapon) + 1) % owned.length;
        Game.state.currentWeapon = owned[nextIdx];
        if (Game.Audio && typeof Game.Audio.playSlash === 'function') Game.Audio.playSlash();
        this.notify(`Vũ khí: ${this.weaponsConfig[Game.state.currentWeapon].name}`, '#00e5ff');
        this.recalculateMaxStats();
        this.syncAdminInputs();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    useWaypoint: function (index) {
        const wp = this.waypointsConfig[index];
        if (!wp || !Game.state.unlockedWaypoints[index]) {
            this.notify('Trụ dịch chuyển chưa mở khóa!', '#f87171');
            return;
        }
        Game.player.x = wp.x;
        Game.player.y = wp.y;
        Game.player.vx = 0;
        Game.player.vy = 0;
        const shop = document.getElementById('shop-modal');
        if (shop && !shop.classList.contains('hidden')) this.toggleShop();
        if (Game.World && typeof Game.World.ensureSafePlayerPosition === 'function') Game.World.ensureSafePlayerPosition();
        this.notify(`Đã dịch chuyển: ${wp.name}!`, '#00e5ff');
        this.updateUI();
        this.saveGame();
    },

    toggleShop: function () {
        const shopModal = document.getElementById('shop-modal');
        if (!shopModal) return;
        const isHidden = shopModal.classList.contains('hidden');
        if (isHidden) {
            shopModal.classList.remove('hidden');
            Game.state.isPaused = true;
            this.updateShopButtons();
        } else {
            shopModal.classList.add('hidden');
            Game.state.isPaused = false;
        }
    },

    togglePause: function () {
        this.toggleShop();
    },

    buyOrEquip: function (weaponId) {
        const w = this.weaponsConfig[weaponId];
        if (!w) return;
        if (Game.state.ownedWeapons.includes(weaponId)) {
            Game.state.currentWeapon = weaponId;
            this.notify(`Đã trang bị: ${w.name}`, '#38bdf8');
        } else {
            if (w.futureOnly && Game.state.timeline !== 'FUTURE') {
                this.notify('Vũ khí công nghệ chỉ mua được ở TƯƠNG LAI!', '#ef4444');
                return;
            }
            if (Game.state.gold < w.price) {
                this.notify(`Cần ${w.price}G để mua ${w.name}!`, '#f87171');
                return;
            }
            Game.state.gold -= w.price;
            Game.state.ownedWeapons.push(weaponId);
            Game.state.currentWeapon = weaponId;
            Game.Audio.playCoin();
            this.notify(`Đã sở hữu: ${w.name}!`, '#4ade80');
        }
        this.recalculateMaxStats();
        this.syncAdminInputs();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    enhanceWeapon: function (weaponId) {
        const w = this.weaponsConfig[weaponId];
        if (!w || !Game.state.ownedWeapons.includes(weaponId)) return;
        const curLvl = Game.state.weaponLevels[weaponId] || 0;
        const cost = Math.floor(w.baseEnhanceCost * Math.pow(1.35, curLvl));

        if (Game.state.gold < cost) {
            this.notify(`Không đủ Vàng! Cần ${cost}G.`, '#f87171');
            return;
        }
        Game.state.gold -= cost;

        if (curLvl >= 5 && (Game.state.timeShards || 0) >= 3) {
            Game.state.timeShards -= 3;
            Game.state.weaponLevels[weaponId] = curLvl + 2;
            Game.Audio.playLevelUp();
            this.notify(`💎 ĐỘT PHÁ THỜI KHÔNG (+2 CẤP): +${curLvl + 2}! (-3💎)`, '#00e5ff');
        } else if (Math.random() < (curLvl < 5 ? 0.88 : 0.55)) {
            Game.state.weaponLevels[weaponId] = curLvl + 1;
            Game.Audio.playLevelUp();
            this.notify(`Cường hóa thành công: +${curLvl + 1}!`, '#fde047');
        } else {
            Game.Audio.playExplosion();
            this.notify('Cường hóa thất bại! (Mẹo: Có 3💎 sẽ đột phá 100%)', '#ef4444');
        }
        this.recalculateMaxStats();
        this.syncAdminInputs();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    enhanceWeaponMulti: function (weaponId, times = 5) {
        const w = this.weaponsConfig[weaponId];
        if (!w || !Game.state.ownedWeapons.includes(weaponId)) return;
        let enhancedTimes = 0;

        for (let i = 0; i < times; i++) {
            const curLvl = (Game.state.weaponLevels && Game.state.weaponLevels[weaponId]) || 0;
            const cost = Math.floor(w.baseEnhanceCost * Math.pow(1.35, curLvl));
            if (Game.state.gold < cost) {
                if (enhancedTimes === 0) {
                    this.notify(`Không đủ Vàng để cường hóa! Cần ${cost}G.`, '#f87171');
                }
                break;
            }
            this.enhanceWeapon(weaponId);
            enhancedTimes++;
        }
    },

    upgradeStat: function (stat) {
        if (stat === 'heal') {
            if (Game.state.potionCooldown > 0) {
                this.notify(`Bình hồi phục nạp lại: ${Game.state.potionCooldown.toFixed(1)}s`, '#f87171');
                return;
            }
            const cost = 50 * (Game.state.loopLevel || 1);
            if (Game.state.gold < cost) {
                this.notify(`Cần ${cost}G để mua Bình Hồi Phục!`, '#f87171');
                return;
            }
            Game.state.gold -= cost;
            Game.player.hp = Game.player.maxHp;
            Game.player.shield = Game.player.maxShield;
            Game.state.potionCooldown = 15.0;
            Game.Audio.playCoin();
            this.notify('Hồi phục toàn bộ Máu & Khiên!', '#4ade80');
            this.updateShopButtons();
            this.updateUI();
            this.saveGame();
            return;
        }
        const cfg = this.upgradesConfig[stat];
        if (!cfg) return;
        const curLvl = Game.state.upgradeLevels[stat] || 0;
        const cost = Math.floor(cfg.baseCost * Math.pow(1.35, lvl));
        if (Game.state.gold < cost) {
            this.notify(`Cần ${cost}G để nâng cấp!`, '#f87171');
            return;
        }

        Game.state.gold -= cost;
        Game.state.upgradeLevels[stat] = curLvl + 1;
        this.recalculateMaxStats();
        this.syncAdminInputs();
        Game.Audio.playCoin();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    buyPet: function () {
        if (Game.state.hasPet) return;
        if (Game.state.gold < 800) {
            this.notify('Cần 800G để chiêu mộ Tinh Linh!', '#f87171');
            return;
        }
        Game.state.gold -= 800;
        Game.state.hasPet = true;
        Game.Audio.playLevelUp();
        this.notify('Chiêu mộ thành công Tinh Linh Thời Không!', '#00e5ff');
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    buyOrToggleRelic: function (relicId) {
        const relic = this.relicsConfig[relicId];
        if (!relic) return;
        if (!Game.state.ownedRelics.includes(relicId)) {
            if (Game.state.gold < relic.price) {
                this.notify(`Cần ${relic.price}G để mua ${relic.name}!`, '#f87171');
                return;
            }
            Game.state.gold -= relic.price;
            Game.state.ownedRelics.push(relicId);
            this._grantRelicFree(relicId);
            Game.Audio.playCoin();
        } else {
            const idx = Game.state.equippedRelics.indexOf(relicId);
            if (idx >= 0) {
                Game.state.equippedRelics.splice(idx, 1);
            } else if (Game.state.equippedRelics.length < 4) {
                Game.state.equippedRelics.push(relicId);
            } else {
                this.notify('Đã đạt giới hạn tối đa 4 Cổ Vật trang bị!', '#f87171');
            }
        }
        this.recalculateMaxStats();
        this.syncAdminInputs();
        this.updateShopButtons();
        this.updateUI();
        this.saveGame();
    },

    updateShopButtons: function () {
        const hasShardsForBreakthrough = (Game.state.timeShards || 0) >= 3;

        Object.keys(this.weaponsConfig).forEach(wId => {
            const w = this.weaponsConfig[wId];
            const isOwned = Game.state.ownedWeapons.includes(wId);
            const curLvl = (Game.state.weaponLevels && Game.state.weaponLevels[wId]) || 0;

            const lvlBadge = document.getElementById(`w-lvl-${wId}`);
            if (lvlBadge) lvlBadge.textContent = `+${curLvl}`;

            const awakenBadge = document.getElementById(`w-awaken-${wId}`);
            if (awakenBadge) {
                awakenBadge.classList.remove('unlocked', 'tier-max');
                if (curLvl >= 30) {
                    awakenBadge.textContent = '🌌 THỨC TỈNH HƯ KHÔNG (+80 HP / +45 ST)';
                    awakenBadge.classList.add('unlocked', 'tier-max');
                } else if (curLvl >= 15) {
                    awakenBadge.textContent = '🔥 THỨC TỈNH HUYẾT VŨ (+35 HP / +20 ST)';
                    awakenBadge.classList.add('unlocked', 'tier-max');
                } else if (curLvl >= 10) {
                    awakenBadge.textContent = '⚡ THỨC TỈNH CHÂN KHÔNG (+12 Tốc / +10 ST)';
                    awakenBadge.classList.add('unlocked');
                } else if (curLvl >= 5) {
                    awakenBadge.textContent = '✨ THỨC TỈNH HOÀNG KIM (+15 Giáp / +4 ST)';
                    awakenBadge.classList.add('unlocked');
                } else {
                    awakenBadge.textContent = '🔒 Cường hóa +5 mở Thức Tỉnh';
                }
            }

            const btnEquip = document.getElementById(`btn-${wId}`);
            if (btnEquip) {
                btnEquip.textContent = Game.state.currentWeapon === wId ? 'Đang Trang Bị' : isOwned ? 'Trang Bị' : `Mua (${w.price}G)`;
            }

            const btnEnhance = document.getElementById(`btn-enhance-${wId}`);
            if (btnEnhance) {
                if (isOwned) {
                    btnEnhance.classList.remove('hidden');
                    const cost = Math.floor(w.baseEnhanceCost * Math.pow(1.35, curLvl));
                    if (curLvl >= 5 && hasShardsForBreakthrough) {
                        btnEnhance.textContent = `💎 Đột Phá (+${curLvl + 2}) - ${cost}G & 3💎`;
                    } else {
                        btnEnhance.textContent = `Cường Hóa (+${curLvl + 1}) - ${cost}G`;
                    }
                } else {
                    btnEnhance.classList.add('hidden');
                }
            }

            const btnEnhanceMulti = document.getElementById(`btn-enhance-multi-${wId}`);
            if (btnEnhanceMulti) {
                btnEnhanceMulti.classList.toggle('hidden', !isOwned);
            }
        });

        ['hp', 'speed', 'damage'].forEach(stat => {
            const cfg = this.upgradesConfig[stat];
            const lvl = (Game.state.upgradeLevels && Game.state.upgradeLevels[stat]) || 0;
            const cost = Math.floor(cfg.baseCost * Math.pow(1.35, lvl));
            const lvlEl = document.getElementById(`upg-lvl-${stat}`);
            if (lvlEl) lvlEl.textContent = `Cấp ${lvl}`;
            const btnEl = document.getElementById(`btn-upg-${stat}`);
            if (btnEl) btnEl.textContent = `Nâng cấp (${cost}G)`;
        });

        const pCd = Game.state.potionCooldown || 0;
        const btnHeal = document.getElementById('btn-upg-heal');
        if (btnHeal) {
            btnHeal.classList.toggle('on-cooldown', pCd > 0);
            btnHeal.textContent = pCd > 0 ? `Hồi chiêu (${pCd.toFixed(1)}s)` : `Mua (${50 * (Game.state.loopLevel || 1)}G)`;
        }

        const btnPet = document.getElementById('btn-buy-pet');
        if (btnPet) {
            btnPet.textContent = Game.state.hasPet ? 'Đã Chiêu Mộ' : 'Chiêu Mộ (800G)';
        }

        Object.keys(this.relicsConfig).forEach(rId => {
            const btnRelic = document.getElementById(`btn-relic-${rId}`);
            if (!btnRelic) return;
            const owned = Game.state.ownedRelics.includes(rId);
            const equipped = Game.state.equippedRelics.includes(rId);
            btnRelic.textContent = !owned ? `Mua (${this.relicsConfig[rId].price}G)` : equipped ? 'Đang Gắn (Tháo)' : 'Trang Bị';
        });

        this.waypointsConfig.forEach(wp => {
            const unlocked = !!(Game.state.unlockedWaypoints && Game.state.unlockedWaypoints[wp.index]);
            const hudBtn = document.getElementById(`hud-wp-${wp.index}`);
            if (hudBtn) {
                hudBtn.className = `wp-chip ${unlocked ? 'unlocked' : 'locked'}`;
                hudBtn.textContent = `${unlocked ? '📍' : '🔒'} ${wp.shortName}`;
            }
            const shopBtn = document.getElementById(`shop-wp-${wp.index}`);
            if (shopBtn) {
                shopBtn.textContent = `${unlocked ? '📍' : '🔒'} ${wp.name}`;
            }
        });

        const currentCombatPower = this.calculateCombatPower();
        const shopCpEl = document.getElementById('shop-combat-power');
        if (shopCpEl) shopCpEl.textContent = currentCombatPower.toLocaleString();
    },

    renderQuestList: function () {
        const questListEl = document.getElementById('quest-list');
        if (!questListEl) return;
        const list = [...this.quests];
        if (this.activeSideQuest) list.push(this.activeSideQuest);
        questListEl.innerHTML = list
            .map(q => `<li class="quest-item ${q.done ? 'done' : ''}">${q.done ? '✅' : '⏳'} ${q.title} (${q.cur}/${q.target})</li>`)
            .join('');
    },

    updateUI: function () {
        const p = Game.player;
        const s = Game.state;

        const hpBar = document.getElementById('hp-bar');
        if (hpBar) hpBar.style.width = `${Math.min(100, Math.max(0, (p.hp / (p.maxHp || 1)) * 100))}%`;
        const hpText = document.getElementById('hp-text');
        if (hpText) hpText.textContent = `HP: ${Math.ceil(p.hp)} / ${p.maxHp}`;

        const shieldBar = document.getElementById('shield-bar');
        if (shieldBar) shieldBar.style.width = `${Math.min(100, Math.max(0, (p.shield / (p.maxShield || 1)) * 100))}%`;
        const shieldText = document.getElementById('shield-text');
        if (shieldText) shieldText.textContent = `KHIÊN: ${Math.ceil(p.shield)} / ${p.maxShield}`;

        const rageVal = Math.min(100, Math.max(0, s.rage || 0));
        const rageBar = document.getElementById('rage-bar');
        if (rageBar) {
            rageBar.style.width = `${rageVal}%`;
            rageBar.classList.toggle('rage-ready', rageVal >= 100);
        }
        const rageText = document.getElementById('rage-text');
        if (rageText) rageText.textContent = `NỘ THỜI KHÔNG: ${Math.floor(rageVal)}%`;

        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${Math.min(100, Math.max(0, ((s.exp || 0) / (s.maxExp || 100)) * 100))}%`;
        const expText = document.getElementById('exp-text');
        if (expText) expText.textContent = `EXP: ${Math.floor(s.exp || 0)} / ${s.maxExp || 100}`;

        const goldText = document.getElementById('gold-text');
        if (goldText) goldText.textContent = `${Math.floor(s.gold || 0)}`;
        const shardText = document.getElementById('shard-text');
        if (shardText) shardText.textContent = `${Math.floor(s.timeShards || 0)}`;

        const lvlBadge = document.getElementById('level-badge');
        if (lvlBadge) lvlBadge.textContent = `Lv.${s.level || 1}`;
        const loopBadge = document.getElementById('loop-badge');
        if (loopBadge) loopBadge.textContent = `Chu Kỳ ${s.loopLevel || 1}`;

        const titleBadge = document.getElementById('title-badge');
        if (titleBadge) titleBadge.textContent = `✨ ${s.currentTitle || 'Kẻ Du Hành Tân Thủ'}`;

        const wKey = s.currentWeapon || 'iron_sword';
        const wCfg = this.weaponsConfig[wKey] || this.weaponsConfig.iron_sword;
        const wLvl = (s.weaponLevels && s.weaponLevels[wKey]) || 0;
        const weaponBadge = document.getElementById('weapon-hud-badge');
        if (weaponBadge) weaponBadge.textContent = `${wCfg.icon} ${wCfg.name} +${wLvl}`;

        const currentCombatPower = this.calculateCombatPower();
        const cpEl = document.getElementById('combat-power-text');
        if (cpEl) cpEl.textContent = currentCombatPower.toLocaleString();

        this.updateTimelineBadge();
    },

    setupSecretGiftcodeTrigger: function () {
        const goldBox = document.getElementById('gold-container');
        if (goldBox) {
            goldBox.addEventListener('click', () => {
                const now = performance.now();
                this.goldClickTimestamps.push(now);
                this.goldClickTimestamps = this.goldClickTimestamps.filter(t => now - t <= 2000);
                if (this.goldClickTimestamps.length >= 5) {
                    this.goldClickTimestamps = [];
                    this.toggleGiftcodeModal(true);
                }
            });
        }
    },

    toggleGiftcodeModal: function (show) {
        const modal = document.getElementById('giftcode-modal');
        if (!modal) return;
        modal.classList.toggle('hidden', !show);
        Game.state.isPaused = show;
        if (show) {
            const inp = document.getElementById('giftcode-input');
            if (inp) setTimeout(() => inp.focus(), 50);
        }
    }
};