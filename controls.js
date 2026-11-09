/**
 * ============================================================================
 * TỰA GAME: KẺ DU HÀNH THỜI KHÔNG (CHRONO TRAVELER: ARPG ESPORTS)
 * FILE: controls.js
 * PHIÊN BẢN: V.10 ESPORTS TOURNAMENT & HAPTIC ENGINE UPGRADE
 * QUY MÔ DỰ ÁN: FULL COMPLETE JAVASCRIPT ENGINE (KHÔNG CẮT BỚT CODE)
 * ============================================================================
 * ĐẶC TẢ HỆ THỐNG ĐIỀU KHIỂN & GIAO DIỆN CẢM ỨNG / PC HUD:
 * 1. Multi-touch Isolation (Cô Lập Đa Điểm Tuyệt Đối):
 *    - Quản lý độc lập joystickTouchId (bán cầu màn hình bên trái) và các 
 *      touchId nút kỹ năng bên phải. Khi thả ngón tay joystick, tuyệt đối không 
 *      ảnh hưởng đến việc kéo ngắm chiêu thức và ngược lại.
 * 2. Smart Haptic Feedback Engine (V.10):
 *    - Rung xúc giác phân tầng theo nhịp combo đòn đánh thường (Step 0, 1, 2).
 *    - Rung giật nhịp ba cảnh báo vỡ giáp năng lượng (Shield Break).
 *    - Rung xung kích sắc nét khi Phản Đòn (Parry) thành công hoặc Perfect Dodge.
 *    - Lưu trạng thái Bật/Tắt rung trong LocalStorage và tích hợp nút toggle trên HUD.
 * 3. Modal-Safe Mobile Touch Handler:
 *    - Khi mở Character Select Modal hoặc bất kỳ bảng giao diện nào, tự động nhả
 *      toàn bộ input và giải phóng e.preventDefault() để người dùng cuộn/chọn mượt mà.
 * 4. Input Buffering (Bộ đệm 150ms) & Hold-to-Fire Auto-Combo:
 *    - Ghi nhận lệnh xuất chiêu trước khi hồi chiêu hoàn tất trong 150ms.
 *    - Giữ nút Đánh / Space để xả combo liên tục mượt mà ở tốc độ khung hình cao.
 * ============================================================================
 */

window.Game = window.Game || {};

/**
 * ============================================================================
 * 1. HAPTIC ENGINE (HỆ THỐNG ĐIỀU KHIỂN XÚC GIÁC THÔNG MINH V.10)
 * ============================================================================
 */
window.Game.Controls = {
    // -------------------------------------------------------------
    // HAPTIC FEEDBACK SUBSYSTEM
    // -------------------------------------------------------------
    HapticEngine: {
        STORAGE_KEY: 'CHRONO_HAPTIC_ENABLED_V10',
        enabled: true,
        supported: false,
        lastVibrateTime: 0,
        minIntervalMs: 25, // Ngăn chặn xung đột rung quá dày đặc gây đơ phần cứng

        init: function () {
            this.supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
            try {
                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (saved !== null) {
                    this.enabled = saved === 'true';
                } else {
                    this.enabled = true; // Mặc định bật phản hồi xúc giác
                }
            } catch (err) {
                this.enabled = true;
            }
        },

        isEnabled: function () {
            return this.enabled && this.supported;
        },

        setEnabled: function (state) {
            this.enabled = !!state;
            try {
                localStorage.setItem(this.STORAGE_KEY, this.enabled ? 'true' : 'false');
            } catch (e) {}

            if (this.enabled) {
                this.vibrate([15, 30, 20]);
            }

            if (window.Game.Systems && typeof window.Game.Systems.notify === 'function') {
                const msg = this.enabled 
                    ? '📳 RUNG PHẢN HỒI XÚC GIÁC: ĐÃ BẬT' 
                    : '📴 RUNG PHẢN HỒI XÚC GIÁC: ĐÃ TẮT';
                window.Game.Systems.notify(msg, this.enabled ? '#10b981' : '#94a3b8');
            }
        },

        toggle: function () {
            this.setEnabled(!this.enabled);
            return this.enabled;
        },

        vibrate: function (pattern) {
            if (!this.enabled || !this.supported) return false;
            const now = performance.now();
            if (now - this.lastVibrateTime < this.minIntervalMs) return false;

            try {
                navigator.vibrate(pattern);
                this.lastVibrateTime = now;
                return true;
            } catch (err) {
                return false;
            }
        },

        // Nhịp rung Combo 3 đòn đánh thường (Cường độ tăng tiến theo lực đòn đánh)
        triggerComboHaptic: function (comboStep) {
            if (!this.enabled || !this.supported) return;
            const step = Math.max(0, parseInt(comboStep, 10) || 0) % 3;
            if (step === 0) {
                this.vibrate([10]); // Đòn 1: Nhẹ, dứt khoát
            } else if (step === 1) {
                this.vibrate([16]); // Đòn 2: Trung bình, sắc nét
            } else {
                this.vibrate([25, 30, 45]); // Đòn 3: Kích xung chém quét cực mạnh
            }
        },

        // Rung giật mạnh cảnh báo khiên chắn vỡ vụn
        triggerShieldBreakHaptic: function () {
            if (!this.enabled || !this.supported) return;
            // Nhịp xung giật mạnh 3 đợt: Cảnh báo nguy hiểm cận kề
            this.vibrate([70, 40, 90]);
        },

        // Rung phản hồi sắc nét khi Chém Phản Đạn (Parry) hoặc Lướt Hoàn Hảo (Perfect Dodge)
        triggerParryHaptic: function () {
            if (!this.enabled || !this.supported) return;
            // Xung nhịp đôi cao tần mô phỏng âm thanh va chạm kim loại cực chuẩn
            this.vibrate([18, 25, 50]);
        },

        // Rung khi thực hiện pha Lướt Hoàn Hảo (Perfect Dodge)
        triggerPerfectDodgeHaptic: function () {
            if (!this.enabled || !this.supported) return;
            this.vibrate([15, 20, 35]);
        },

        // Rung xuất chiêu kỹ năng
        triggerSkillCastHaptic: function (skillIndex) {
            if (!this.enabled || !this.supported) return;
            if (skillIndex === 0) {
                this.vibrate([12]);
            } else if (skillIndex === 1) {
                this.vibrate([22]);
            } else if (skillIndex === 2) {
                this.vibrate([35]);
            } else if (skillIndex === 3) {
                // Chiêu cuối Nộ Lượng Tử: Rung rung uy lực
                this.vibrate([40, 30, 60]);
            }
        },

        // Rung cảnh báo Quá Nhiệt Laser (Heat >= 80)
        triggerOverheatWarningHaptic: function () {
            if (!this.enabled || !this.supported) return;
            this.vibrate([20, 30, 20, 30]);
        }
    },

    // -------------------------------------------------------------
    // BIẾN THÀNH PHẦN & TÀI NGUYÊN NỀN TẢNG
    // -------------------------------------------------------------
    canvas: null,
    uiScale: 1.0,

    // Ngưỡng kéo ngắm siêu nhạy (px)
    AIM_DRAG_THRESHOLD: 12,

    // Bàn phím & Chuột PC
    keys: {},
    mouseDownButtonKey: null,

    // Chế độ Ngắm Chuột PC (PC Cursor Aim Mode)
    mouseAimActive: false,
    rightMouseDown: false,
    mouseScreenPos: { x: 0, y: 0 },
    mouseWorldPos: { x: 0, y: 0 },

    // Hệ thống Tự Động Đánh Liên Thanh khi Giữ Nút (Continuous Hold-to-Fire)
    autoFireTracker: {
        attack: { isHolding: false, lastFireTime: 0, minInterval: 0.12 }
    },

    // Input Buffering (Đệm lệnh bấm chiêu trước 150ms)
    inputBuffer: {
        skillIndex: null,
        options: null,
        expireTime: 0
    },

    // Cache tọa độ cảm ứng để tiết lưu (Throttle cho màn hình 120Hz/144Hz)
    _pendingJoystickPos: { x: 0, y: 0, dirty: false },

    // Hiệu ứng Lóe sáng viền nút khi hồi chiêu xong (Ready Flash Rings)
    skillFlashStates: [
        { prevCd: 0, flashAlpha: 0, flashTimer: 0 }, // Đánh thường (Skill 0)
        { prevCd: 0, flashAlpha: 0, flashTimer: 0 }, // Skill 1 (Lướt)
        { prevCd: 0, flashAlpha: 0, flashTimer: 0 }, // Skill 2 (Bão Không Thời)
        { prevCd: 0, flashAlpha: 0, flashTimer: 0 }  // Skill 3 (Chiêu Cuối / Rage)
    ],

    // Cờ chế độ Chỉnh sửa HUD (HUD Customizer)
    isEditMode: false,
    STORAGE_KEY: 'CUSTOM_HUD_LAYOUT_V3',
    draggingHudKey: null,
    dragTouchId: null,
    dragOffset: { x: 0, y: 0 },

    // Kích thước bán kính gốc của các nút trên canvas chuẩn 1080p
    baseRadii: {
        joystick: 54,
        attack: 44,
        skill1: 31,
        skill2: 31,
        skill3: 33,
        switchWeapon: 24,
        timeShift: 24,
        interact: 27
    },

    // Vùng bấm trên thanh công cụ Customizer
    editToolbarRects: {
        save: { x: 0, y: 0, w: 105, h: 36 },
        reset: { x: 0, y: 0, w: 105, h: 36 },
        haptic: { x: 0, y: 0, w: 105, h: 36 },
        cancel: { x: 0, y: 0, w: 80, h: 36 }
    },

    // Virtual Floating Joystick (Cần gạt ảo tự do)
    joystick: {
        active: false,
        touchId: null,
        originX: 120,
        originY: 0,
        defaultOriginX: 120,
        defaultOriginY: 0,
        currentX: 120,
        currentY: 0,
        maxRadius: 54,
        deadzone: 0.08,
        dx: 0,
        dy: 0,
        angle: 0
    },

    lastAngle: 0,
    ripples: [],

    // Danh mục các nút chức năng trên màn hình
    buttons: {
        attack: {
            index: 0,
            x: 0,
            y: 0,
            r: 44,
            keyHint: 'J',
            pressed: false,
            touchId: null,
            isAiming: false,
            touchStartX: 0,
            touchStartY: 0,
            aimAngle: 0,
            targetAimAngle: 0,
            aimDistRatio: 1.0,
            aimCanceled: false,
            pendingTouchPos: { x: 0, y: 0, dirty: false }
        },
        skill1: {
            index: 1,
            x: 0,
            y: 0,
            r: 31,
            keyHint: 'K',
            pressed: false,
            touchId: null,
            isAiming: false,
            touchStartX: 0,
            touchStartY: 0,
            aimAngle: 0,
            targetAimAngle: 0,
            aimDistRatio: 1.0,
            aimCanceled: false,
            pendingTouchPos: { x: 0, y: 0, dirty: false }
        },
        skill2: {
            index: 2,
            x: 0,
            y: 0,
            r: 31,
            keyHint: 'L',
            pressed: false,
            touchId: null,
            isAiming: false,
            touchStartX: 0,
            touchStartY: 0,
            aimAngle: 0,
            targetAimAngle: 0,
            aimDistRatio: 1.0,
            aimCanceled: false,
            pendingTouchPos: { x: 0, y: 0, dirty: false }
        },
        skill3: {
            index: 3,
            x: 0,
            y: 0,
            r: 33,
            keyHint: 'U',
            pressed: false,
            touchId: null,
            isAiming: false,
            touchStartX: 0,
            touchStartY: 0,
            aimAngle: 0,
            targetAimAngle: 0,
            aimDistRatio: 1.0,
            aimCanceled: false,
            pendingTouchPos: { x: 0, y: 0, dirty: false }
        },
        switchWeapon: { x: 0, y: 0, r: 24, keyHint: 'Tab', pressed: false, touchId: null },
        timeShift: { x: 0, y: 0, r: 24, keyHint: 'Q', pressed: false, touchId: null },
        interact: { x: 0, y: 0, r: 27, keyHint: 'E', pressed: false, touchId: null }
    },

    // Vùng hủy chiêu thức khi kéo vuốt lên trên
    cancelZone: {
        x: 0,
        y: 80,
        r: 45,
        active: false
    },

    _lastCdTickTime: 0,

    // =========================================================================
    // TOÁN HỌC & LÀM MƯỢT GÓC (ANGULAR INTERPOLATION)
    // =========================================================================
    _lerpAngle: function (current, target, t) {
        let diff = (target - current) % (Math.PI * 2);
        if (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > Math.PI) diff -= Math.PI * 2;
        return current + diff * Math.max(0, Math.min(1, t));
    },

    // =========================================================================
    // KHỞI TẠO & ĐIỀU CHỈNH KÍCH THƯỚC (INITIALIZATION & RESPONSIVE)
    // =========================================================================
    init: function (canvas) {
        this.canvas = canvas || document.querySelector('canvas');
        this.HapticEngine.init();

        const initialW = (this.canvas && this.canvas.width) || window.innerWidth || 1280;
        const initialH = (this.canvas && this.canvas.height) || window.innerHeight || 720;

        this.onResize(initialW, initialH);

        this._bindKeyboardEvents();
        if (this.canvas) {
            this._bindTouchEvents(this.canvas);
            this._bindMouseEvents(this.canvas);
        }
    },

    onResize: function (width, height) {
        const w = width || (this.canvas && this.canvas.width) || window.innerWidth || 1280;
        const h = height || (this.canvas && this.canvas.height) || window.innerHeight || 720;

        if (!this.loadCustomLayout(w, h)) {
            this._resetToDefaultLayout(w, h);
        }
        this._updateEditToolbarRects(w, h);
    },

    _computeUiScale: function (width, height) {
        const isMobile = width <= 950 || height <= 580;
        return isMobile ? Math.max(0.66, Math.min(width / 1080, height / 600)) : 1.0;
    },

    _applyScaledRadii: function () {
        const s = this.uiScale || 1.0;
        this.joystick.maxRadius = this.baseRadii.joystick * s;
        for (let key in this.buttons) {
            if (this.baseRadii[key]) {
                this.buttons[key].r = this.baseRadii[key] * s;
            }
        }
    },

    _updateEditToolbarRects: function (width, height) {
        const centerX = width * 0.5;
        const topY = Math.max(16, 20 * (this.uiScale || 1.0));
        const btnW = 105;
        const btnH = 36;
        const gap = 8;

        const totalW = btnW * 4 + gap * 3;
        const startX = centerX - totalW / 2;

        this.editToolbarRects.save = { x: startX, y: topY + 46, w: btnW, h: btnH };
        this.editToolbarRects.reset = { x: startX + (btnW + gap), y: topY + 46, w: btnW, h: btnH };
        this.editToolbarRects.haptic = { x: startX + (btnW + gap) * 2, y: topY + 46, w: btnW, h: btnH };
        this.editToolbarRects.cancel = { x: startX + (btnW + gap) * 3, y: topY + 46, w: btnW, h: btnH };
    },

    // =========================================================================
    // QUẢN LÝ BỐ CỤC TÙY CHỈNH (HUD CUSTOMIZER LOGIC)
    // =========================================================================
    toggleEditMode: function (forceState) {
        this.isEditMode = typeof forceState === 'boolean' ? forceState : !this.isEditMode;
        this.releaseAllInputs();
        this.HapticEngine.vibrate(30);

        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('hud-edit-active', this.isEditMode);
        }

        const w = (this.canvas && this.canvas.width) || window.innerWidth;
        const h = (this.canvas && this.canvas.height) || window.innerHeight;
        this._updateEditToolbarRects(w, h);

        if (window.Game.Systems && typeof window.Game.Systems.notify === 'function') {
            const msg = this.isEditMode
                ? '⚙️ CHẾ ĐỘ CHỈNH NÚT: Chạm & Kéo nút bất kỳ để đổi vị trí!'
                : '✅ ĐÃ THOÁT CHẾ ĐỘ CHỈNH SỬA BỐ CỤC NÚT';
            window.Game.Systems.notify(msg, this.isEditMode ? '#f59e0b' : '#10b981');
        }
    },

    toggleMouseAim: function (forceState) {
        this.mouseAimActive = typeof forceState === 'boolean' ? forceState : !this.mouseAimActive;
        this.HapticEngine.vibrate(20);
        if (window.Game.Systems && typeof window.Game.Systems.notify === 'function') {
            const msg = this.mouseAimActive
                ? '🎯 NGẮM CHUỘT PC (PC CURSOR AIM): ĐÃ BẬT [Phím F để tắt]'
                : '🎯 NGẮM CHUỘT PC (PC CURSOR AIM): ĐÃ TẮT';
            window.Game.Systems.notify(msg, this.mouseAimActive ? '#00f2fe' : '#94a3b8');
        }
    },

    saveCustomLayout: function () {
        const w = Math.max(1, (this.canvas && this.canvas.width) || window.innerWidth);
        const h = Math.max(1, (this.canvas && this.canvas.height) || window.innerHeight);

        const layoutData = {
            joystick: {
                rx: this.joystick.defaultOriginX / w,
                ry: this.joystick.defaultOriginY / h
            },
            buttons: {}
        };

        for (let key in this.buttons) {
            layoutData.buttons[key] = {
                rx: this.buttons[key].x / w,
                ry: this.buttons[key].y / h
            };
        }

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layoutData));
            this.HapticEngine.vibrate([20, 50, 20]);
            if (window.Game.Systems && typeof window.Game.Systems.notify === 'function') {
                window.Game.Systems.notify('💾 Đã lưu vị trí nút thành công!', '#10b981');
            }
        } catch (e) {
            console.error('Không thể lưu cấu hình HUD vào Storage:', e);
        }
    },

    loadCustomLayout: function (width, height) {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY) || localStorage.getItem('CUSTOM_HUD_LAYOUT_V2');
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !data.buttons) return false;

            this.uiScale = this._computeUiScale(width, height);
            this._applyScaledRadii();

            if (data.joystick && typeof data.joystick.rx === 'number') {
                const jr = this.joystick.maxRadius + 10;
                this.joystick.defaultOriginX = Math.max(jr, Math.min(width - jr, data.joystick.rx * width));
                this.joystick.defaultOriginY = Math.max(jr, Math.min(height - jr, data.joystick.ry * height));
                this.joystick.originX = this.joystick.defaultOriginX;
                this.joystick.originY = this.joystick.defaultOriginY;
                this.joystick.currentX = this.joystick.originX;
                this.joystick.currentY = this.joystick.originY;
            }

            for (let key in this.buttons) {
                const savedBtn = data.buttons[key];
                if (savedBtn && typeof savedBtn.rx === 'number' && typeof savedBtn.ry === 'number') {
                    const br = this.buttons[key].r + 8;
                    this.buttons[key].x = Math.max(br, Math.min(width - br, savedBtn.rx * width));
                    this.buttons[key].y = Math.max(br, Math.min(height - br, savedBtn.ry * height));
                }
            }

            this.cancelZone.x = width * 0.5;
            this.cancelZone.y = Math.max(65, 80 * this.uiScale);
            this.cancelZone.r = 45 * this.uiScale;
            return true;
        } catch (e) {
            console.error('Lỗi phân tích cú pháp bố cục HUD:', e);
            return false;
        }
    },

    _resetToDefaultLayout: function (width, height) {
        this.uiScale = this._computeUiScale(width, height);
        const uiScale = this.uiScale;
        this._applyScaledRadii();

        const atkX = width - 78 * uiScale;
        const atkY = height - 74 * uiScale;
        this.buttons.attack.x = atkX;
        this.buttons.attack.y = atkY;

        const skillArcR = 108 * uiScale;
        this.buttons.skill1.x = atkX + Math.cos((180 * Math.PI) / 180) * skillArcR;
        this.buttons.skill1.y = atkY + Math.sin((180 * Math.PI) / 180) * skillArcR;

        this.buttons.skill2.x = atkX + Math.cos((225 * Math.PI) / 180) * skillArcR;
        this.buttons.skill2.y = atkY + Math.sin((225 * Math.PI) / 180) * skillArcR;

        this.buttons.skill3.x = atkX + Math.cos((270 * Math.PI) / 180) * skillArcR;
        this.buttons.skill3.y = atkY + Math.sin((270 * Math.PI) / 180) * skillArcR;

        const subArcR = 176 * uiScale;
        this.buttons.switchWeapon.x = atkX + Math.cos((192 * Math.PI) / 180) * subArcR;
        this.buttons.switchWeapon.y = atkY + Math.sin((192 * Math.PI) / 180) * subArcR;

        this.buttons.timeShift.x = atkX + Math.cos((228 * Math.PI) / 180) * subArcR;
        this.buttons.timeShift.y = atkY + Math.sin((228 * Math.PI) / 180) * subArcR;

        this.buttons.interact.x = atkX + Math.cos((264 * Math.PI) / 180) * subArcR;
        this.buttons.interact.y = atkY + Math.sin((264 * Math.PI) / 180) * subArcR;

        this.joystick.defaultOriginX = Math.max(75 * uiScale, width * 0.14);
        this.joystick.defaultOriginY = height - Math.max(85 * uiScale, height * 0.22);
        this.joystick.originX = this.joystick.defaultOriginX;
        this.joystick.originY = this.joystick.defaultOriginY;
        this.joystick.currentX = this.joystick.originX;
        this.joystick.currentY = this.joystick.originY;

        this.cancelZone.x = width * 0.5;
        this.cancelZone.y = Math.max(65, 80 * uiScale);
        this.cancelZone.r = 45 * uiScale;
    },

    resetAndClearSavedLayout: function () {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem('CUSTOM_HUD_LAYOUT_V2');
            localStorage.removeItem('CUSTOM_HUD_LAYOUT');
        } catch (e) {}
        const w = (this.canvas && this.canvas.width) || window.innerWidth;
        const h = (this.canvas && this.canvas.height) || window.innerHeight;
        this._resetToDefaultLayout(w, h);
        this.HapticEngine.vibrate(25);
        if (window.Game.Systems && typeof window.Game.Systems.notify === 'function') {
            window.Game.Systems.notify('🔄 Đã khôi phục bố cục nút về mặc định!', '#38bdf8');
        }
    },

    _spawnRipple: function (btn, color) {
        if (!btn) return;
        this.ripples.push({
            x: btn.x,
            y: btn.y,
            r: btn.r * 0.85,
            maxR: btn.r * 1.65,
            alpha: 0.9,
            color: color || '#38bdf8'
        });
    },

    /**
     * KIỂM TRA KHÓA ĐIỀU KHIỂN & ĐẢM BẢO MODAL HOẠT ĐỘNG HOÀN TOÀN TỰ DO
     */
    isControlLocked: function () {
        const state = window.Game && window.Game.state;
        if (state && state.isPaused === true) return true;

        if (typeof document !== 'undefined') {
            // Danh sách toàn bộ các modal có thể mở trong trận đấu
            const modalIds = [
                'character-select-modal',
                'shop-modal',
                'giftcode-modal',
                'talent-tree-modal',
                'leaderboard-modal',
                'combat-recap-modal'
            ];

            for (let i = 0; i < modalIds.length; i++) {
                const el = document.getElementById(modalIds[i]);
                if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
                    return true;
                }
            }
        }
        return false;
    },

    releaseAllInputs: function () {
        this.keys = {};
        for (let k in this.buttons) {
            const btn = this.buttons[k];
            btn.pressed = false;
            btn.touchId = null;
            btn.isAiming = false;
            btn.aimCanceled = false;
            if (btn.pendingTouchPos) {
                btn.pendingTouchPos.dirty = false;
            }
        }
        this.joystick.active = false;
        this.joystick.touchId = null;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
        this.joystick.originX = this.joystick.defaultOriginX;
        this.joystick.originY = this.joystick.defaultOriginY;
        this.joystick.currentX = this.joystick.originX;
        this.joystick.currentY = this.joystick.originY;
        this._pendingJoystickPos.dirty = false;

        this.mouseDownButtonKey = null;
        this.rightMouseDown = false;
        this.draggingHudKey = null;
        this.dragTouchId = null;
        this.cancelZone.active = false;
        this.autoFireTracker.attack.isHolding = false;

        this.inputBuffer.skillIndex = null;
        this.inputBuffer.options = null;
        this.inputBuffer.expireTime = 0;
    },

    _getCanvasCoords: function (clientX, clientY) {
        if (!this.canvas) return { x: clientX, y: clientY };
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / (rect.width || 1);
        const scaleY = this.canvas.height / (rect.height || 1);
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    },

    _updateMouseWorldPos: function (screenX, screenY) {
        this.mouseScreenPos.x = screenX;
        this.mouseScreenPos.y = screenY;
        const cam = window.Game.camera || { x: 0, y: 0, zoom: 1.0 };
        const zoom = cam.zoom || 1.0;
        this.mouseWorldPos.x = screenX / zoom + (cam.x || 0);
        this.mouseWorldPos.y = screenY / zoom + (cam.y || 0);
    },

    _isPointInRect: function (x, y, rect) {
        if (!rect) return false;
        return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    },

    _handleEditPointerDown: function (x, y, pointerId) {
        const w = (this.canvas && this.canvas.width) || window.innerWidth;
        const h = (this.canvas && this.canvas.height) || window.innerHeight;
        this._updateEditToolbarRects(w, h);

        if (this._isPointInRect(x, y, this.editToolbarRects.save)) {
            this.saveCustomLayout();
            this.toggleEditMode(false);
            return true;
        }
        if (this._isPointInRect(x, y, this.editToolbarRects.reset)) {
            this.resetAndClearSavedLayout();
            return true;
        }
        if (this._isPointInRect(x, y, this.editToolbarRects.haptic)) {
            this.HapticEngine.toggle();
            return true;
        }
        if (this._isPointInRect(x, y, this.editToolbarRects.cancel)) {
            this.loadCustomLayout(w, h);
            this.toggleEditMode(false);
            return true;
        }

        const hitElement = this._findHitHudElementForEdit(x, y);
        if (hitElement) {
            this.draggingHudKey = hitElement.key;
            this.dragTouchId = pointerId;
            if (hitElement.key === 'joystick') {
                this.dragOffset.x = x - this.joystick.defaultOriginX;
                this.dragOffset.y = y - this.joystick.defaultOriginY;
            } else {
                this.dragOffset.x = x - hitElement.target.x;
                this.dragOffset.y = y - hitElement.target.y;
            }
            this.HapticEngine.vibrate(12);
            return true;
        }
        return false;
    },

    _handleEditPointerMove: function (x, y, pointerId) {
        if (!this.isEditMode || !this.draggingHudKey) return;
        if (this.dragTouchId !== null && pointerId !== undefined && this.dragTouchId !== pointerId) return;

        const canvasW = (this.canvas && this.canvas.width) || window.innerWidth;
        const canvasH = (this.canvas && this.canvas.height) || window.innerHeight;

        if (this.draggingHudKey === 'joystick') {
            const pad = this.joystick.maxRadius + 8;
            const targetX = Math.max(pad, Math.min(canvasW - pad, x - this.dragOffset.x));
            const targetY = Math.max(pad, Math.min(canvasH - pad, y - this.dragOffset.y));
            this.joystick.defaultOriginX = targetX;
            this.joystick.defaultOriginY = targetY;
            this.joystick.originX = targetX;
            this.joystick.originY = targetY;
            this.joystick.currentX = targetX;
            this.joystick.currentY = targetY;
        } else if (this.buttons[this.draggingHudKey]) {
            const btn = this.buttons[this.draggingHudKey];
            const pad = btn.r + 8;
            btn.x = Math.max(pad, Math.min(canvasW - pad, x - this.dragOffset.x));
            btn.y = Math.max(pad, Math.min(canvasH - pad, y - this.dragOffset.y));
        }
    },

    _handleEditPointerUp: function (pointerId) {
        if (!this.isEditMode) return;
        if (this.dragTouchId === null || pointerId === undefined || this.dragTouchId === pointerId) {
            this.draggingHudKey = null;
            this.dragTouchId = null;
        }
    },

    _handleMinimapTap: function () {
        this.HapticEngine.vibrate(15);
        const state = window.Game.state;
        if (state) state.minimapExpanded = !state.minimapExpanded;

        if (window.Game.World && typeof window.Game.World.toggleMinimapZoom === 'function') {
            window.Game.World.toggleMinimapZoom();
        } else if (window.Game.Systems && typeof window.Game.Systems.notify === 'function') {
            const modeText = state && state.minimapExpanded ? 'Phóng to Radar Căn Cứ' : 'Thu nhỏ Radar Căn Cứ';
            window.Game.Systems.notify('🗺️ ' + modeText, '#38bdf8');
        }
    },

    /**
     * TÌM KIẾM QUÁI / BOSS GẦN NHẤT ĐỂ SMART AUTO-AIM KHÓA MỤC TIÊU
     */
    _findNearestAutoAimTarget: function (maxRange) {
        const player = window.Game.player;
        if (!player || player.hp <= 0) return null;
        if (!window.Game.Enemies || typeof window.Game.Enemies.getActiveList !== 'function') return null;

        const enemies = window.Game.Enemies.getActiveList();
        if (!enemies || enemies.length === 0) return null;

        const searchRange = maxRange || 540;
        let bestTarget = null;
        let minScore = Infinity;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.hp <= 0) continue;

            const edx = e.x - player.x;
            const edy = e.y - player.y;
            const dist = Math.hypot(edx, edy);

            if (dist > searchRange) continue;

            // Ưu tiên Boss (nhân hệ số giảm khoảng cách ảo để khóa Boss trước tiên)
            const isBoss = !!(e.isBoss || e.type === 'boss' || (e.maxHp && e.maxHp >= 500));
            const score = isBoss ? dist * 0.62 : dist;

            if (score < minScore) {
                minScore = score;
                bestTarget = e;
            }
        }
        return bestTarget;
    },

    /**
     * KÍCH HOẠT KỸ NĂNG VỚI SMART AUTO-AIM & INPUT BUFFERING (150ms)
     */
    _triggerSkill: function (skillIndex, aimOptions, isInitialPress, isBufferedExecution) {
        if (this.isControlLocked()) return;

        const options = Object.assign({ manualAim: false, autoAimOnTap: false, distRatio: 1.0 }, aimOptions);
        const combatSkills = (window.Game.Combat && typeof window.Game.Combat.getActiveSkills === 'function')
            ? window.Game.Combat.getActiveSkills()
            : (window.Game.Combat && window.Game.Combat.skills) || [];

        const currentSkill = combatSkills[skillIndex];
        const cd = currentSkill ? Math.max(0, currentSkill.cd || 0) : 0;

        // KIỂM TRA HỒI CHIÊU & INPUT BUFFERING (150ms = 0.15s)
        if (!isBufferedExecution && cd > 0.02) {
            if (cd <= 0.15) {
                this.inputBuffer.skillIndex = skillIndex;
                this.inputBuffer.options = options;
                this.inputBuffer.expireTime = performance.now() + 150;
            }
            return;
        }

        // SMART AUTO-AIM: Tự động hướng mặt về quái/Boss gần nhất khi nhấp nhanh
        if (!options.manualAim || options.autoAimOnTap) {
            const player = window.Game.player;
            if (player) {
                const target = this._findNearestAutoAimTarget(560);
                if (target) {
                    const autoAngle = Math.atan2(target.y - player.y, target.x - player.x);
                    player.angle = autoAngle;
                    this.lastAngle = autoAngle;
                    options.aimAngle = autoAngle;
                    options.autoAimTarget = target;
                } else {
                    options.aimAngle = (typeof options.aimAngle === 'number') ? options.aimAngle : (player.angle || this.lastAngle);
                }
            }
        }

        if (isInitialPress) {
            this.HapticEngine.triggerSkillCastHaptic(skillIndex);
            const btnMap = [this.buttons.attack, this.buttons.skill1, this.buttons.skill2, this.buttons.skill3];
            const color = (currentSkill && currentSkill.color) || '#38bdf8';
            if (btnMap[skillIndex]) {
                this._spawnRipple(btnMap[skillIndex], color);
            }
        }

        if (window.Game.Combat && typeof window.Game.Combat.useSkill === 'function') {
            window.Game.Combat.useSkill(skillIndex, options);
        }
    },

    _triggerInteract: function () {
        if (this.isControlLocked()) return;
        this.HapticEngine.vibrate(15);
        this._spawnRipple(this.buttons.interact, '#facc15');
        if (window.Game.Systems && typeof window.Game.Systems.interact === 'function') {
            window.Game.Systems.interact();
        }
    },

    _triggerSwitchWeapon: function () {
        if (this.isControlLocked()) return;
        this.HapticEngine.vibrate(15);
        this._spawnRipple(this.buttons.switchWeapon, '#38bdf8');
        if (window.Game.Systems && typeof window.Game.Systems.cycleWeapon === 'function') {
            window.Game.Systems.cycleWeapon();
        }
    },

    _triggerSwitchTimeline: function (targetTimeline) {
        if (this.isControlLocked()) return;
        this.HapticEngine.vibrate(18);
        this._spawnRipple(this.buttons.timeShift, '#06b6d4');
        if (window.Game.Systems && typeof window.Game.Systems.switchTimeline === 'function') {
            window.Game.Systems.switchTimeline(targetTimeline);
        } else if (window.Game.state) {
            window.Game.state.timeline = targetTimeline;
        }
        if (window.Game.state) {
            window.Game.state.timeShiftCooldown = 4.0;
        }
    },

    _cycleNextTimeline: function () {
        if (this.isControlLocked()) return;
        const state = window.Game.state;
        if (state && typeof state.timeShiftCooldown === 'number' && state.timeShiftCooldown > 0.05) return;
        const order = ['PAST', 'PRESENT', 'FUTURE'];
        const current = (state && state.timeline) || 'PRESENT';
        const idx = order.indexOf(current);
        const nextTimeline = order[(idx + 1) % order.length];
        this._triggerSwitchTimeline(nextTimeline);
    },

    _findHitRightButton: function (x, y) {
        const entries = [
            ['attack', this.buttons.attack],
            ['skill1', this.buttons.skill1],
            ['skill2', this.buttons.skill2],
            ['skill3', this.buttons.skill3],
            ['switchWeapon', this.buttons.switchWeapon],
            ['timeShift', this.buttons.timeShift],
            ['interact', this.buttons.interact]
        ];

        let bestMatch = null;
        let minDistance = Infinity;

        for (let i = 0; i < entries.length; i++) {
            const key = entries[i][0];
            const btn = entries[i][1];
            const dist = Math.hypot(x - btn.x, y - btn.y);
            if (dist <= btn.r + 8 && dist < minDistance) {
                minDistance = dist;
                bestMatch = { key, btn };
            }
        }
        return bestMatch;
    },

    _findHitHudElementForEdit: function (x, y) {
        const hit = this._findHitRightButton(x, y);
        if (hit) return { key: hit.key, target: hit.btn };

        const joyDist = Math.hypot(x - this.joystick.defaultOriginX, y - this.joystick.defaultOriginY);
        if (joyDist <= this.joystick.maxRadius + 15) {
            return { key: 'joystick', target: this.joystick };
        }
        return null;
    },

    _updateJoystickVector: function (x, y) {
        const canvasW = (this.canvas && this.canvas.width) || window.innerWidth;
        const canvasH = (this.canvas && this.canvas.height) || window.innerHeight;
        let rawDx = x - this.joystick.originX;
        let rawDy = y - this.joystick.originY;
        let dist = Math.hypot(rawDx, rawDy);
        const maxR = this.joystick.maxRadius;

        if (dist > 0.001) {
            const angle = Math.atan2(rawDy, rawDx);

            // Floating Dynamic Follow: Tâm cần gạt tự trôi theo ngón tay cái nếu kéo vượt bán kính
            if (dist > maxR) {
                const extra = dist - maxR;
                this.joystick.originX += Math.cos(angle) * extra;
                this.joystick.originY += Math.sin(angle) * extra;

                const maxAllowedLeftX = canvasW * 0.46 - maxR;
                this.joystick.originX = Math.max(maxR + 10, Math.min(maxAllowedLeftX, this.joystick.originX));
                this.joystick.originY = Math.max(maxR + 10, Math.min(canvasH - maxR - 10, this.joystick.originY));
                dist = maxR;
            }

            this.joystick.currentX = this.joystick.originX + Math.cos(angle) * dist;
            this.joystick.currentY = this.joystick.originY + Math.sin(angle) * dist;

            const rawMagnitude = dist / maxR;
            if (rawMagnitude < this.joystick.deadzone) {
                this.joystick.dx = 0;
                this.joystick.dy = 0;
            } else {
                const smoothMag = (rawMagnitude - this.joystick.deadzone) / (1 - this.joystick.deadzone);
                this.joystick.dx = Math.cos(angle) * smoothMag;
                this.joystick.dy = Math.sin(angle) * smoothMag;
                this.joystick.angle = angle;
                this.lastAngle = angle;
            }
        } else {
            this.joystick.currentX = x;
            this.joystick.currentY = y;
            this.joystick.dx = 0;
            this.joystick.dy = 0;
        }
    },

    /**
     * TIẾT LƯU: XỬ LÝ TOÀN BỘ CÁC CHẠM CẢM ỨNG 1 LẦN MỖI FRAME (THROTTLE CHO 120HZ)
     */
    _processPendingInputs: function () {
        // 1. Cập nhật Vector Joystick từ vị trí chạm đã lưu
        if (this.joystick.active && this._pendingJoystickPos.dirty) {
            this._updateJoystickVector(this._pendingJoystickPos.x, this._pendingJoystickPos.y);
            this._pendingJoystickPos.dirty = false;
        }

        // 2. Cập nhật Drag-Aim của các nút kỹ năng
        const dragThreshold = (this.AIM_DRAG_THRESHOLD || 12) * (this.uiScale || 1.0);
        for (let key in this.buttons) {
            const btn = this.buttons[key];
            if (btn.pendingTouchPos && btn.pendingTouchPos.dirty && typeof btn.index === 'number') {
                const px = btn.pendingTouchPos.x;
                const py = btn.pendingTouchPos.y;
                const deltaX = px - btn.touchStartX;
                const deltaY = py - btn.touchStartY;
                const dragDist = Math.hypot(deltaX, deltaY);

                const distToCancel = Math.hypot(px - this.cancelZone.x, py - this.cancelZone.y);
                if (distToCancel <= this.cancelZone.r + 20) {
                    btn.aimCanceled = true;
                    this.cancelZone.active = true;
                } else {
                    btn.aimCanceled = false;
                    this.cancelZone.active = false;
                }

                if (dragDist >= dragThreshold) {
                    btn.isAiming = true;
                    btn.targetAimAngle = Math.atan2(deltaY, deltaX);
                    btn.aimDistRatio = Math.max(0.25, Math.min(1.0, (dragDist - dragThreshold * 0.5) / (105 * this.uiScale)));
                    if (window.Game.player) {
                        window.Game.player.angle = btn.aimAngle;
                    }
                } else {
                    btn.isAiming = false;
                    btn.aimCanceled = false;
                }
                btn.pendingTouchPos.dirty = false;
            }
        }
    },

    // =========================================================================
    // SỰ KIỆN CẢM ỨNG ĐA ĐIỂM ĐỘC LẬP (ISOLATED MULTI-TOUCH)
    // SỬA TRIỆT ĐỂ LỖI KẸT CẢM ỨNG KHI MỞ BẢNG CHỌN NHÂN VẬT & MODAL
    // =========================================================================
    _bindTouchEvents: function (canvas) {
        canvas.addEventListener(
            'touchstart',
            (e) => {
                // NẾU CÓ MODAL ĐANG MỞ: TUYỆT ĐỐI KHÔNG GỌI e.preventDefault() ĐỂ NGƯỜI DÙNG CUỘN VÀ CHỌN
                if (this.isControlLocked()) {
                    this.releaseAllInputs();
                    return; // Nhả qua cho trình duyệt xử lý tương tác DOM HTML
                }

                e.preventDefault();
                const canvasW = canvas.width || window.innerWidth;
                const canvasH = canvas.height || window.innerHeight;

                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    const pos = this._getCanvasCoords(t.clientX, t.clientY);

                    if (this.isEditMode) {
                        this._handleEditPointerDown(pos.x, pos.y, t.identifier);
                        continue;
                    }

                    if (pos.x >= 12 && pos.x <= 120 && pos.y >= 12 && pos.y <= 120) {
                        this._handleMinimapTap();
                        continue;
                    }
                    if (pos.x <= 130 && pos.y <= 130) continue;

                    // KIỂM TRA NỬA PHẢI HOẶC VÙNG NÚT: Kỹ năng / Thao tác
                    const hit = this._findHitRightButton(pos.x, pos.y);
                    if (hit) {
                        hit.btn.pressed = true;
                        hit.btn.touchId = t.identifier;
                        if (hit.btn.pendingTouchPos) {
                            hit.btn.pendingTouchPos.x = pos.x;
                            hit.btn.pendingTouchPos.y = pos.y;
                            hit.btn.pendingTouchPos.dirty = false;
                        }

                        if (hit.key === 'interact') {
                            this._triggerInteract();
                        } else if (hit.key === 'switchWeapon') {
                            this._triggerSwitchWeapon();
                        } else if (hit.key === 'timeShift') {
                            this._cycleNextTimeline();
                        } else {
                            hit.btn.touchStartX = pos.x;
                            hit.btn.touchStartY = pos.y;
                            hit.btn.isAiming = false;
                            hit.btn.aimCanceled = false;
                            const curAngle = (window.Game.player && window.Game.player.angle) || this.lastAngle;
                            hit.btn.aimAngle = curAngle;
                            hit.btn.targetAimAngle = curAngle;
                            hit.btn.aimDistRatio = 1.0;

                            if (hit.key === 'attack') {
                                this.autoFireTracker.attack.isHolding = true;
                                this.autoFireTracker.attack.lastFireTime = 0;
                            }
                        }
                        continue;
                    }

                    const isBottomCenterHud =
                        pos.x >= canvasW * 0.34 &&
                        pos.x <= canvasW * 0.66 &&
                        pos.y >= canvasH - 95 * (this.uiScale || 1.0);
                    if (isBottomCenterHud) continue;

                    // FLOATING JOYSTICK: Nửa màn hình trái (x < canvasW * 0.5)
                    if (pos.x < canvasW * 0.5 && this.joystick.touchId === null) {
                        const maxR = this.joystick.maxRadius;
                        const clampOriginX = Math.max(maxR + 10, Math.min(canvasW * 0.44, pos.x));
                        const clampOriginY = Math.max(maxR + 10, Math.min(canvasH - maxR - 10, pos.y));

                        this.joystick.active = true;
                        this.joystick.touchId = t.identifier;
                        this.joystick.originX = clampOriginX;
                        this.joystick.originY = clampOriginY;
                        this.joystick.currentX = clampOriginX;
                        this.joystick.currentY = clampOriginY;
                        this.joystick.dx = 0;
                        this.joystick.dy = 0;

                        this._pendingJoystickPos.x = clampOriginX;
                        this._pendingJoystickPos.y = clampOriginY;
                        this._pendingJoystickPos.dirty = false;
                    }
                }
            },
            { passive: false }
        );

        canvas.addEventListener(
            'touchmove',
            (e) => {
                if (this.isControlLocked()) {
                    this.releaseAllInputs();
                    return; // Cho phép cuộn trang modal tự nhiên
                }
                e.preventDefault();

                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    const pos = this._getCanvasCoords(t.clientX, t.clientY);

                    if (this.isEditMode) {
                        this._handleEditPointerMove(pos.x, pos.y, t.identifier);
                        continue;
                    }

                    // 1. Tiết lưu Joystick: Lưu tọa độ thô, không tính vector ngay lập tức
                    if (this.joystick.active && t.identifier === this.joystick.touchId) {
                        this._pendingJoystickPos.x = pos.x;
                        this._pendingJoystickPos.y = pos.y;
                        this._pendingJoystickPos.dirty = true;
                        continue;
                    }

                    // 2. Tiết lưu Kéo ngắm kỹ năng
                    for (let key in this.buttons) {
                        const btn = this.buttons[key];
                        if (btn.touchId === t.identifier && typeof btn.index === 'number') {
                            if (!btn.pendingTouchPos) btn.pendingTouchPos = { x: 0, y: 0, dirty: false };
                            btn.pendingTouchPos.x = pos.x;
                            btn.pendingTouchPos.y = pos.y;
                            btn.pendingTouchPos.dirty = true;
                        }
                    }
                }
            },
            { passive: false }
        );

        const handleTouchEnd = (e) => {
            if (this.isControlLocked()) {
                this.releaseAllInputs();
                return;
            }
            e.preventDefault();

            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];

                if (this.isEditMode) {
                    this._handleEditPointerUp(t.identifier);
                    continue;
                }

                // 1. Thả ngón tay Joystick ở nửa trái: Độc lập 100%, không ảnh hưởng nút kỹ năng
                if (this.joystick.active && t.identifier === this.joystick.touchId) {
                    this.joystick.active = false;
                    this.joystick.touchId = null;
                    this.joystick.dx = 0;
                    this.joystick.dy = 0;
                    this.joystick.currentX = this.joystick.originX;
                    this.joystick.currentY = this.joystick.originY;
                    this._pendingJoystickPos.dirty = false;
                    continue;
                }

                // 2. Thả ngón tay Kỹ năng ở nửa phải: Độc lập 100%, không ảnh hưởng cần gạt di chuyển
                for (let key in this.buttons) {
                    const btn = this.buttons[key];
                    if (btn.touchId === t.identifier) {
                        if (key === 'attack') {
                            this.autoFireTracker.attack.isHolding = false;
                        }

                        if (typeof btn.index === 'number') {
                            if (!btn.aimCanceled) {
                                if (btn.isAiming) {
                                    this._triggerSkill(btn.index, {
                                        manualAim: true,
                                        aimAngle: btn.aimAngle,
                                        distRatio: btn.aimDistRatio
                                    }, true);
                                } else {
                                    // Quick-Tap: Smart Auto-Aim quái gần nhất
                                    this._triggerSkill(btn.index, {
                                        manualAim: false,
                                        autoAimOnTap: true,
                                        distRatio: 1.0
                                    }, true);
                                }
                            } else {
                                this.HapticEngine.vibrate(35);
                            }
                        }

                        btn.pressed = false;
                        btn.touchId = null;
                        btn.isAiming = false;
                        btn.aimCanceled = false;
                        if (btn.pendingTouchPos) {
                            btn.pendingTouchPos.dirty = false;
                        }
                    }
                }
            }

            let anyAiming = false;
            for (let key in this.buttons) {
                if (this.buttons[key].isAiming) {
                    anyAiming = true;
                    break;
                }
            }
            if (!anyAiming) {
                this.cancelZone.active = false;
            }
        };

        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    },

    // =========================================================================
    // SỰ KIỆN CHUỘT (PC MOUSE AIM & ESPORTS CONTROL)
    // =========================================================================
    _bindMouseEvents: function (canvas) {
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        canvas.addEventListener('mousedown', (e) => {
            if (this.isControlLocked()) {
                this.releaseAllInputs();
                return;
            }
            const pos = this._getCanvasCoords(e.clientX, e.clientY);
            this._updateMouseWorldPos(pos.x, pos.y);

            // Chuột phải: Hướng xoay người ngắm tức thì
            if (e.button === 2) {
                e.preventDefault();
                this.rightMouseDown = true;
                if (window.Game.player) {
                    const angle = Math.atan2(this.mouseWorldPos.y - window.Game.player.y, this.mouseWorldPos.x - window.Game.player.x);
                    window.Game.player.angle = angle;
                    this.lastAngle = angle;
                }
                return;
            }

            // Chuột trái
            if (e.button === 0) {
                if (this.isEditMode) {
                    this._handleEditPointerDown(pos.x, pos.y, 'MOUSE');
                    return;
                }

                if (pos.x >= 12 && pos.x <= 120 && pos.y >= 12 && pos.y <= 120) {
                    this._handleMinimapTap();
                    return;
                }

                if (this.mouseAimActive || this.rightMouseDown) {
                    this.buttons.attack.pressed = true;
                    this.autoFireTracker.attack.isHolding = true;
                    this.autoFireTracker.attack.lastFireTime = 0;
                    return;
                }

                const hit = this._findHitRightButton(pos.x, pos.y);
                if (hit) {
                    hit.btn.pressed = true;
                    this.mouseDownButtonKey = hit.key;
                    if (hit.key === 'interact') {
                        this._triggerInteract();
                    } else if (hit.key === 'switchWeapon') {
                        this._triggerSwitchWeapon();
                    } else if (hit.key === 'timeShift') {
                        this._cycleNextTimeline();
                    } else {
                        hit.btn.touchStartX = pos.x;
                        hit.btn.touchStartY = pos.y;
                        hit.btn.isAiming = false;
                        hit.btn.aimCanceled = false;
                        const curAngle = (window.Game.player && window.Game.player.angle) || this.lastAngle;
                        hit.btn.aimAngle = curAngle;
                        hit.btn.targetAimAngle = curAngle;
                        hit.btn.aimDistRatio = 1.0;

                        if (hit.key === 'attack') {
                            this.autoFireTracker.attack.isHolding = true;
                            this.autoFireTracker.attack.lastFireTime = 0;
                        }
                    }
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            const pos = this._getCanvasCoords(e.clientX, e.clientY);
            this._updateMouseWorldPos(pos.x, pos.y);

            if (this.mouseAimActive || this.rightMouseDown) {
                const player = window.Game.player;
                if (player && player.hp > 0) {
                    const mouseAngle = Math.atan2(this.mouseWorldPos.y - player.y, this.mouseWorldPos.x - player.x);
                    player.angle = mouseAngle;
                    this.lastAngle = mouseAngle;
                    this.buttons.attack.aimAngle = mouseAngle;
                    this.buttons.attack.targetAimAngle = mouseAngle;
                }
            }

            if (this.isEditMode && this.draggingHudKey) {
                this._handleEditPointerMove(pos.x, pos.y, 'MOUSE');
                return;
            }

            if (this.mouseDownButtonKey && this.buttons[this.mouseDownButtonKey]) {
                const btn = this.buttons[this.mouseDownButtonKey];
                if (typeof btn.index === 'number') {
                    const deltaX = pos.x - btn.touchStartX;
                    const deltaY = pos.y - btn.touchStartY;
                    const dragDist = Math.hypot(deltaX, deltaY);
                    const dragThreshold = (this.AIM_DRAG_THRESHOLD || 12) * (this.uiScale || 1.0);

                    const distToCancel = Math.hypot(pos.x - this.cancelZone.x, pos.y - this.cancelZone.y);
                    if (distToCancel <= this.cancelZone.r + 20) {
                        btn.aimCanceled = true;
                        this.cancelZone.active = true;
                    } else {
                        btn.aimCanceled = false;
                        this.cancelZone.active = false;
                    }

                    if (dragDist >= dragThreshold) {
                        btn.isAiming = true;
                        btn.targetAimAngle = Math.atan2(deltaY, deltaX);
                        btn.aimDistRatio = Math.max(0.25, Math.min(1.0, (dragDist - dragThreshold * 0.5) / (105 * this.uiScale)));
                        if (window.Game.player) {
                            window.Game.player.angle = btn.aimAngle;
                        }
                    } else {
                        btn.isAiming = false;
                        btn.aimCanceled = false;
                    }
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.rightMouseDown = false;
                return;
            }

            if (this.isEditMode) {
                this._handleEditPointerUp('MOUSE');
            }

            if (this.mouseAimActive && e.button === 0) {
                this.buttons.attack.pressed = false;
                this.autoFireTracker.attack.isHolding = false;
            }

            if (this.mouseDownButtonKey && this.buttons[this.mouseDownButtonKey]) {
                const btn = this.buttons[this.mouseDownButtonKey];
                if (this.mouseDownButtonKey === 'attack') {
                    this.autoFireTracker.attack.isHolding = false;
                }

                if (typeof btn.index === 'number') {
                    if (!btn.aimCanceled) {
                        if (btn.isAiming) {
                            this._triggerSkill(btn.index, {
                                manualAim: true,
                                aimAngle: btn.aimAngle,
                                distRatio: btn.aimDistRatio
                            }, true);
                        } else {
                            this._triggerSkill(btn.index, {
                                manualAim: false,
                                autoAimOnTap: true,
                                distRatio: 1.0
                            }, true);
                        }
                    }
                }
                btn.pressed = false;
                btn.isAiming = false;
                btn.aimCanceled = false;
                this.mouseDownButtonKey = null;
                this.cancelZone.active = false;
            }
        });
    },

    // =========================================================================
    // SỰ KIỆN BÀN PHÍM ESPORTS (KEYBOARD SHORTCUTS)
    // =========================================================================
    _bindKeyboardEvents: function () {
        window.addEventListener('keydown', (e) => {
            const code = e.code;
            const key = e.key ? e.key.toLowerCase() : '';

            if (key === 'f' || code === 'KeyF') {
                e.preventDefault();
                this.toggleMouseAim();
                return;
            }

            if (key === 'h' || code === 'KeyH') {
                e.preventDefault();
                this.toggleEditMode();
                return;
            }

            if (key === 'b' || code === 'KeyB') {
                e.preventDefault();
                if (window.Game.Systems && typeof window.Game.Systems.toggleShop === 'function') {
                    window.Game.Systems.toggleShop();
                }
                return;
            }

            if (key === 'escape' || code === 'Escape') {
                e.preventDefault();
                if (this.isEditMode) {
                    this.toggleEditMode(false);
                    return;
                }
                if (window.Game.Systems && typeof window.Game.Systems.togglePause === 'function') {
                    window.Game.Systems.togglePause();
                    return;
                }
                return;
            }

            if (this.isControlLocked() || this.isEditMode) {
                this.releaseAllInputs();
                return;
            }

            if (code === 'Tab' || key === 'tab') e.preventDefault();

            this.keys[code] = true;
            this.keys[key] = true;

            if (e.repeat) return;

            if (key === 'j' || code === 'KeyJ' || code === 'Space') {
                this.buttons.attack.pressed = true;
                this.autoFireTracker.attack.isHolding = true;
                this.autoFireTracker.attack.lastFireTime = 0;
            } else if (key === 'k' || code === 'KeyK') {
                this.buttons.skill1.pressed = true;
                this._triggerSkill(1, { manualAim: false, autoAimOnTap: true }, true);
            } else if (key === 'l' || code === 'KeyL') {
                this.buttons.skill2.pressed = true;
                this._triggerSkill(2, { manualAim: false, autoAimOnTap: true }, true);
            } else if (key === 'u' || code === 'KeyU') {
                this.buttons.skill3.pressed = true;
                this._triggerSkill(3, { manualAim: false, autoAimOnTap: true }, true);
            } else if (key === 'e' || code === 'KeyE') {
                this.buttons.interact.pressed = true;
                this._triggerInteract();
            } else if (code === 'Tab' || key === 'tab') {
                this.buttons.switchWeapon.pressed = true;
                this._triggerSwitchWeapon();
            } else if (key === 'q' || code === 'KeyQ') {
                this.buttons.timeShift.pressed = true;
                this._cycleNextTimeline();
            } else if (key === '1' || code === 'Digit1') {
                this._triggerSwitchTimeline('PAST');
            } else if (key === '2' || code === 'Digit2') {
                this._triggerSwitchTimeline('PRESENT');
            } else if (key === '3' || code === 'Digit3') {
                this._triggerSwitchTimeline('FUTURE');
            }
        });

        window.addEventListener('keyup', (e) => {
            const code = e.code;
            const key = e.key ? e.key.toLowerCase() : '';

            this.keys[code] = false;
            this.keys[key] = false;

            if (key === 'j' || code === 'KeyJ' || code === 'Space') {
                this.buttons.attack.pressed = false;
                this.autoFireTracker.attack.isHolding = false;
            }
            if (key === 'k' || code === 'KeyK') this.buttons.skill1.pressed = false;
            if (key === 'l' || code === 'KeyL') this.buttons.skill2.pressed = false;
            if (key === 'u' || code === 'KeyU') this.buttons.skill3.pressed = false;
            if (key === 'e' || code === 'KeyE') this.buttons.interact.pressed = false;
            if (code === 'Tab' || key === 'tab') this.buttons.switchWeapon.pressed = false;
            if (key === 'q' || code === 'KeyQ') this.buttons.timeShift.pressed = false;
        });

        window.addEventListener('blur', () => {
            this.releaseAllInputs();
        });
    },
    // [HẾT PHẦN 1 - DỪNG TRỌN VẸN SAU HÀM _bindKeyboardEvents]
// =========================================================================
    // CẬP NHẬT TRẠNG THÁI & HỒI CHIÊU (TICK LOGIC & INPUT BUFFERING)
    // =========================================================================
    _tickCooldowns: function () {
        const nowSec = performance.now() * 0.001;
        const nowMs = performance.now();
        if (!this._lastCdTickTime) this._lastCdTickTime = nowSec;
        const dt = Math.min(0.1, Math.max(0, nowSec - this._lastCdTickTime));
        this._lastCdTickTime = nowSec;

        // 1. Tiết lưu: Xử lý Joystick & Vuốt ngắm thô gom về 1 lần/frame (120Hz/144Hz)[cite: 1]
        this._processPendingInputs();

        const state = window.Game.state;
        if (state && typeof state.timeShiftCooldown === 'number' && state.timeShiftCooldown > 0) {
            state.timeShiftCooldown = Math.max(0, state.timeShiftCooldown - dt);
        }

        // 2. Dynamic Angular Lerp cho các nút đang kéo ngắm[cite: 1]
        const lerpFactor = 1.0 - Math.exp(-dt * 26);
        for (let k in this.buttons) {
            const btn = this.buttons[k];
            if (btn.isAiming && typeof btn.targetAimAngle === 'number') {
                btn.aimAngle = this._lerpAngle(btn.aimAngle, btn.targetAimAngle, lerpFactor);
            }
        }

        // 3. Theo dõi CD và kích hoạt Hiệu ứng Lóe Sáng (Ready Flash Rings) + Haptic[cite: 1]
        const combatSkills = (window.Game.Combat && typeof window.Game.Combat.getActiveSkills === 'function')
            ? window.Game.Combat.getActiveSkills()
            : (window.Game.Combat && window.Game.Combat.skills) || [];

        for (let i = 0; i < 4; i++) {
            const skill = combatSkills[i];
            const currentCd = skill ? Math.max(0, skill.cd || 0) : 0;
            const flashState = this.skillFlashStates[i];

            if (flashState.prevCd > 0.05 && currentCd <= 0.01) {
                flashState.flashAlpha = 1.0;
                flashState.flashTimer = 0.45;
                if (i > 0) this.HapticEngine.vibrate(8);
            }
            flashState.prevCd = currentCd;

            if (flashState.flashAlpha > 0) {
                flashState.flashAlpha = Math.max(0, flashState.flashAlpha - dt * 2.2);
            }
        }

        // 4. XỬ LÝ INPUT BUFFERING: Tự kích hoạt khi kỹ năng hồi xong trong 150ms[cite: 1]
        if (this.inputBuffer.skillIndex !== null) {
            if (nowMs > this.inputBuffer.expireTime) {
                this.inputBuffer.skillIndex = null;
                this.inputBuffer.options = null;
            } else {
                const bufferedIdx = this.inputBuffer.skillIndex;
                const bSkill = combatSkills[bufferedIdx];
                const bCd = bSkill ? Math.max(0, bSkill.cd || 0) : 0;
                if (bCd <= 0.02) {
                    const bOptions = this.inputBuffer.options;
                    this.inputBuffer.skillIndex = null;
                    this.inputBuffer.options = null;
                    this._triggerSkill(bufferedIdx, bOptions, true, true);
                }
            }
        }

        // 5. Cơ Chế Giữ Nút Đánh Liên Thanh (Hold-to-Fire / Auto-Combo)[cite: 1]
        if (this.autoFireTracker.attack.isHolding && !this.isControlLocked()) {
            const atkSkill = combatSkills[0];
            const isAtkReady = !atkSkill || (atkSkill.cd <= 0.03);
            const timeSinceLast = nowSec - this.autoFireTracker.attack.lastFireTime;

            if (isAtkReady && timeSinceLast >= this.autoFireTracker.attack.minInterval) {
                this.autoFireTracker.attack.lastFireTime = nowSec;
                const atkBtn = this.buttons.attack;

                if (atkBtn.isAiming) {
                    this._triggerSkill(0, {
                        manualAim: true,
                        aimAngle: atkBtn.aimAngle,
                        distRatio: atkBtn.aimDistRatio
                    }, false);
                } else if (this.mouseAimActive || this.rightMouseDown) {
                    const player = window.Game.player;
                    const aimAngle = player ? Math.atan2(this.mouseWorldPos.y - player.y, this.mouseWorldPos.x - player.x) : this.lastAngle;
                    this._triggerSkill(0, {
                        manualAim: true,
                        aimAngle: aimAngle,
                        distRatio: 1.0
                    }, false);
                } else {
                    this._triggerSkill(0, {
                        manualAim: false,
                        autoAimOnTap: true,
                        distRatio: 1.0
                    }, false);
                }
            }
        }

        // 6. Cập nhật các gợn sóng xúc giác HUD (Ripples)[cite: 1]
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const rp = this.ripples[i];
            rp.r += (rp.maxR - rp.r) * Math.min(1, dt * 14);
            rp.alpha -= dt * 3.4;
            if (rp.alpha <= 0.02) {
                this.ripples.splice(i, 1);
            }
        }
    },

    getInput: function () {
        this._tickCooldowns();

        if (this.isControlLocked() || this.isEditMode) {
            return { dx: 0, dy: 0, angle: this.lastAngle, isMoving: false };
        }

        let dx = 0;
        let dy = 0;

        if (this.joystick.active && (Math.abs(this.joystick.dx) > 0.01 || Math.abs(this.joystick.dy) > 0.01)) {
            dx = this.joystick.dx;
            dy = this.joystick.dy;
        } else {
            const up = this.keys['w'] || this.keys['KeyW'] || this.keys['ArrowUp'];
            const down = this.keys['s'] || this.keys['KeyS'] || this.keys['ArrowDown'];
            const left = this.keys['a'] || this.keys['KeyA'] || this.keys['ArrowLeft'];
            const right = this.keys['d'] || this.keys['KeyD'] || this.keys['ArrowRight'];

            if (up) dy -= 1;
            if (down) dy += 1;
            if (left) dx -= 1;
            if (right) dx += 1;

            if (dx !== 0 || dy !== 0) {
                const len = Math.hypot(dx, dy);
                dx /= len;
                dy /= len;
                this.lastAngle = Math.atan2(dy, dx);
            }
        }

        const isMoving = Math.hypot(dx, dy) > 0.01;

        let angle = isMoving ? Math.atan2(dy, dx) : this.lastAngle;
        if (this.mouseAimActive || this.rightMouseDown) {
            const player = window.Game.player;
            if (player) {
                angle = Math.atan2(this.mouseWorldPos.y - player.y, this.mouseWorldPos.x - player.x);
                this.lastAngle = angle;
            }
        }

        return { dx, dy, angle, isMoving };
    },

    // =========================================================================
    // 2. HIỂN THỊ KÍNH HỒNG NGOẠI (SNIPER SCOPE) & KHU VỰC KHÔNG TRỌNG LỰC
    // =========================================================================
    drawAimTrajectory: function (ctx, camera) {
        const player = window.Game.player;
        if (!player || player.hp <= 0) return;

        let activeAimButton = null;
        for (let key in this.buttons) {
            const btn = this.buttons[key];
            if (btn.isAiming && typeof btn.index === 'number') {
                activeAimButton = btn;
                break;
            }
        }

        const isMouseAiming = (this.mouseAimActive || this.rightMouseDown) && !activeAimButton;
        if (!activeAimButton && !isMouseAiming) return;

        const camX = (camera && camera.x) || (window.Game.camera && window.Game.camera.x) || 0;
        const camY = (camera && camera.y) || (window.Game.camera && window.Game.camera.y) || 0;
        const zoom = (camera && camera.zoom) || (window.Game.camera && window.Game.camera.zoom) || 1.0;

        const px = (player.x - camX) * zoom;
        const py = (player.y - camY) * zoom;

        const skillIdx = activeAimButton ? activeAimButton.index : 0;
        const aimConfig = (window.Game.Combat && typeof window.Game.Combat.getSkillAimConfig === 'function')
            ? window.Game.Combat.getSkillAimConfig(skillIdx)
            : { type: 'LINE', range: 430, color: '#00f2fe' };

        const angle = activeAimButton
            ? activeAimButton.aimAngle
            : Math.atan2(this.mouseWorldPos.y - player.y, this.mouseWorldPos.x - player.x);
        const distRatio = activeAimButton ? (activeAimButton.aimDistRatio || 1.0) : 1.0;
        const isCanceled = activeAimButton ? activeAimButton.aimCanceled : false;

        const weaponHeat = (window.Game.Combat && window.Game.Combat.weaponHeat) || 0;
        const isOverheating = (aimConfig.type === 'LASER' && weaponHeat >= 60);
        const now = performance.now() * 0.001;

        // KIỂM TRA TRANG BỊ SNIPER SCOPE (I.7) HOẶC ĐỨNG TRONG ZERO-GRAVITY ZONE (IV.9)
        const hasSniperScope = !!(
            (player.relics && (player.relics.has('relic_sniper_scope') || player.relics.relic_sniper_scope)) ||
            (window.Game.state && window.Game.state.hasSniperScope)
        );

        let isInZeroGravity = false;
        if (window.Game.World && typeof window.Game.World.getTerrainEffectAt === 'function') {
            const effect = window.Game.World.getTerrainEffectAt(player.x, player.y);
            isInZeroGravity = (effect === 'ZERO_GRAVITY' || effect === 'zero_gravity');
        } else if (player.inZeroGravity || (window.Game.state && window.Game.state.inZeroGravity)) {
            isInZeroGravity = true;
        }

        const isBoostedAim = hasSniperScope || isInZeroGravity;

        // Tăng +40% độ dài tầm ngắm khi có Sniper Scope hoặc trong Không Trọng Lực
        let maxRangeWorld = aimConfig.range || 420;
        if (isBoostedAim) {
            maxRangeWorld *= 1.40;
        }

        // Mở rộng phễu ngắm Laser từ ±15° lên ±26°
        const baseConeHalfAngle = (aimConfig.coneHalfAngle || 15) * (Math.PI / 180);
        const coneHalfAngle = isBoostedAim ? baseConeHalfAngle * 1.73 : baseConeHalfAngle;

        let mainColor = isCanceled ? '#ef4444' : (aimConfig.color || '#00f2fe');
        let glowColor = isCanceled ? '#dc2626' : (aimConfig.glow || '#38bdf8');

        if (isBoostedAim && !isCanceled) {
            mainColor = hasSniperScope ? '#ff2a6d' : '#05d9e8';
            glowColor = hasSniperScope ? '#ff0055' : '#00f2fe';
        }

        if (isOverheating && !isCanceled) {
            const flash = Math.sin(now * 12) > 0;
            mainColor = flash ? '#ef4444' : '#f97316';
            glowColor = '#ff0033';
        }

        const targetDist = maxRangeWorld * distRatio * zoom;
        const targetX = px + Math.cos(angle) * targetDist;
        const targetY = py + Math.sin(angle) * targetDist;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Phễu Hỗ Trợ Ngắm (Aim Cone) - Tự động nở rộng nếu có Kính Hồng Ngoại / Vùng Không Trọng Lực
        if (aimConfig.type === 'LASER' || aimConfig.type === 'CANNON_AOE' || aimConfig.type === 'LINE') {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.arc(px, py, targetDist, angle - coneHalfAngle, angle + coneHalfAngle);
            ctx.closePath();

            ctx.fillStyle = isCanceled
                ? 'rgba(239, 68, 68, 0.05)'
                : (isOverheating
                    ? 'rgba(249, 115, 22, 0.08)'
                    : (isBoostedAim ? (hasSniperScope ? 'rgba(255, 42, 109, 0.12)' : 'rgba(5, 217, 232, 0.10)') : 'rgba(0, 242, 254, 0.06)'));
            ctx.fill();

            ctx.lineWidth = isBoostedAim ? 2 : 1;
            ctx.strokeStyle = isCanceled
                ? 'rgba(239, 68, 68, 0.25)'
                : (isOverheating
                    ? 'rgba(249, 115, 22, 0.35)'
                    : (isBoostedAim ? (hasSniperScope ? 'rgba(255, 42, 109, 0.45)' : 'rgba(5, 217, 232, 0.40)') : 'rgba(0, 242, 254, 0.22)'));
            ctx.stroke();

            // Hiển thị huy hiệu chỉ báo Kính Hồng Ngoại / Không Trọng Lực trên đường phễu
            if (isBoostedAim && !isCanceled) {
                ctx.save();
                ctx.font = `bold ${Math.round(10 * this.uiScale)}px sans-serif`;
                ctx.fillStyle = hasSniperScope ? '#ff2a6d' : '#05d9e8';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const tagText = hasSniperScope ? '🔭 KÍNH HỒNG NGOẠI (+40% TẦM)' : '🌌 KHÔNG TRỌNG LỰC (+40% TẦM)';
                const tagX = px + Math.cos(angle) * (targetDist * 0.5);
                const tagY = py + Math.sin(angle) * (targetDist * 0.5) - 8 * this.uiScale;
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 4;
                ctx.fillText(tagText, tagX, tagY);
                ctx.restore();
            }
        }

        // 2. Vòng tròn định vị dưới chân nhân vật
        ctx.beginPath();
        ctx.arc(px, py, (player.radius || 20) * zoom + 4, 0, Math.PI * 2);
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.65;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // 3. Quỹ đạo ngắm chính
        if (aimConfig.type === 'CANNON_AOE') {
            const midX = (px + targetX) * 0.5;
            const midY = (py + targetY) * 0.5 - (isBoostedAim ? 65 : 45) * zoom;

            ctx.setLineDash([8, 6]);
            ctx.lineDashOffset = -(now * 30) % 14;
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 2.5 * this.uiScale;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 10;

            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.quadraticCurveTo(midX, midY, targetX, targetY);
            ctx.stroke();
            ctx.setLineDash([]);

            const aoeR = (aimConfig.aoeRadius || 100) * (isBoostedAim ? 1.15 : 1.0) * zoom;
            const sweetSpotR = aoeR * 0.40;

            ctx.beginPath();
            ctx.arc(targetX, targetY, aoeR, 0, Math.PI * 2);
            ctx.fillStyle = isCanceled ? 'rgba(239, 68, 68, 0.12)' : (isBoostedAim ? 'rgba(255, 42, 109, 0.16)' : 'rgba(0, 242, 254, 0.12)');
            ctx.fill();
            ctx.lineWidth = 1.8 * this.uiScale;
            ctx.strokeStyle = isCanceled ? '#ef4444' : (isBoostedAim ? '#ff2a6d' : 'rgba(0, 242, 254, 0.7)');
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(targetX, targetY, sweetSpotR, 0, Math.PI * 2);
            ctx.fillStyle = isCanceled ? 'rgba(220, 38, 38, 0.35)' : 'rgba(249, 115, 22, 0.35)';
            ctx.fill();
            ctx.lineWidth = 2.5 * this.uiScale;
            ctx.strokeStyle = isCanceled ? '#fca5a5' : '#f97316';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 12;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(targetX, targetY, 4 * this.uiScale, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

        } else if (aimConfig.type === 'LASER') {
            const beamW = (aimConfig.beamWidth || 20) * 0.5 * (isBoostedAim ? 1.25 : 1.0) * zoom;
            const perpX = Math.cos(angle + Math.PI / 2) * beamW;
            const perpY = Math.sin(angle + Math.PI / 2) * beamW;

            ctx.beginPath();
            ctx.moveTo(px + perpX, py + perpY);
            ctx.lineTo(targetX + perpX, targetY + perpY);
            ctx.lineTo(targetX - perpX, targetY - perpY);
            ctx.lineTo(px - perpX, py - perpY);
            ctx.closePath();

            ctx.fillStyle = isCanceled
                ? 'rgba(239, 68, 68, 0.15)'
                : (isOverheating
                    ? 'rgba(239, 68, 68, 0.25)'
                    : (isBoostedAim ? 'rgba(255, 42, 109, 0.22)' : 'rgba(0, 242, 254, 0.16)'));
            ctx.fill();

            ctx.lineWidth = 1.8 * this.uiScale;
            ctx.strokeStyle = mainColor;
            ctx.stroke();

            const dashOffset = -(now * 50) % 20;
            ctx.setLineDash([12, 8]);
            ctx.lineDashOffset = dashOffset;
            ctx.strokeStyle = isOverheating ? '#fef08a' : '#ffffff';
            ctx.lineWidth = (isBoostedAim ? 3.0 : 2.2) * this.uiScale;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = isBoostedAim ? 16 : 12;

            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            ctx.setLineDash([]);

            if (isOverheating) {
                ctx.save();
                ctx.font = `bold ${Math.round(11 * this.uiScale)}px sans-serif`;
                ctx.fillStyle = '#ef4444';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 4;
                ctx.fillText('🔥 SÚNG QUÁ NHIỆT!', targetX, targetY - 14 * this.uiScale);
                ctx.restore();
            }
        } else {
            const dashOffset = -(now * 40) % 18;
            ctx.setLineDash([10, 8]);
            ctx.lineDashOffset = dashOffset;
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 3.2 * this.uiScale;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 12;

            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            ctx.setLineDash([]);

            if (targetDist > 20) {
                const arrowLen = 12 * this.uiScale;
                ctx.beginPath();
                ctx.moveTo(targetX, targetY);
                ctx.lineTo(targetX - Math.cos(angle - 0.4) * arrowLen, targetY - Math.sin(angle - 0.4) * arrowLen);
                ctx.lineTo(targetX - Math.cos(angle + 0.4) * arrowLen, targetY - Math.sin(angle + 0.4) * arrowLen);
                ctx.closePath();
                ctx.fillStyle = mainColor;
                ctx.fill();
            }
        }

        // 4. RADAR KHÓA MỤC TIÊU TRONG PHỄU NGẮM
        this._drawLockOnReticle(ctx, px, py, angle, maxRangeWorld, camX, camY, zoom, now, coneHalfAngle);

        ctx.restore();
    },

    _drawLockOnReticle: function (ctx, playerScreenX, playerScreenY, aimAngle, maxRangeWorld, camX, camY, zoom, now, customConeAngle) {
        if (!window.Game.Enemies || typeof window.Game.Enemies.getActiveList !== 'function') return;

        const enemies = window.Game.Enemies.getActiveList();
        if (!enemies || enemies.length === 0) return;

        const player = window.Game.player;
        if (!player) return;

        const coneHalfRad = customConeAngle || 15 * (Math.PI / 180);
        let bestTarget = null;
        let minScore = Infinity;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.hp <= 0) continue;

            const edx = e.x - player.x;
            const edy = e.y - player.y;
            const dist = Math.hypot(edx, edy);

            if (dist > maxRangeWorld + 30) continue;

            const enemyAngle = Math.atan2(edy, edx);
            let diff = Math.abs((enemyAngle - aimAngle) % (Math.PI * 2));
            if (diff > Math.PI) diff = Math.PI * 2 - diff;

            if (diff <= coneHalfRad) {
                const score = dist * 0.6 + diff * 320;
                if (score < minScore) {
                    minScore = score;
                    bestTarget = e;
                }
            }
        }

        if (!bestTarget) return;

        const ex = (bestTarget.x - camX) * zoom;
        const ey = (bestTarget.y - camY) * zoom;
        const r = Math.max(18, (bestTarget.radius || 24) * zoom + 6);
        const rot = now * 2.8;

        ctx.save();
        ctx.translate(ex, ey);

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.rotate(rot);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5 * this.uiScale;
        ctx.shadowColor = '#ff003b';
        ctx.shadowBlur = 10;

        const cornerLen = r * 0.45;
        for (let a = 0; a < 4; a++) {
            ctx.save();
            ctx.rotate((a * Math.PI) / 2);
            ctx.beginPath();
            ctx.moveTo(r, r - cornerLen);
            ctx.lineTo(r, r);
            ctx.lineTo(r - cornerLen, r);
            ctx.stroke();
            ctx.restore();
        }

        ctx.rotate(-rot);
        ctx.beginPath();
        ctx.arc(0, 0, 3 * this.uiScale, 0, Math.PI * 2);
        ctx.fillStyle = '#fde047';
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${Math.round(8 * this.uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('TARGET LOCKED', 0, r + 4);

        ctx.restore();
    },

    // =========================================================================
    // VẼ TOÀN BỘ GIAO DIỆN HUD CẢM ỨNG (DRAW UI)
    // =========================================================================
    drawUI: function (ctx, width, height, camera) {
        const w = width || (ctx.canvas && ctx.canvas.width) || window.innerWidth;
        const h = height || (ctx.canvas && ctx.canvas.height) || window.innerHeight;

        this.drawAimTrajectory(ctx, camera);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (this.isEditMode) {
            this._drawEditModeBackground(ctx, w, h);
        }

        this._drawCancelZone(ctx);
        this._drawJoystick(ctx);

        const defaultSkills = [
            { name: 'Đánh', cd: 0, maxCd: 0.5, color: '#f59e0b' },
            { name: 'Lướt Chém', cd: 0, maxCd: 5.2, color: '#00f2fe' },
            { name: 'Siêu Bão', cd: 0, maxCd: 11.0, color: '#ff0844' },
            { name: 'Ngưng Đọng', cd: 0, maxCd: 22.0, color: '#a855f7' }
        ];

        const combatSkills = (window.Game.Combat && typeof window.Game.Combat.getActiveSkills === 'function')
            ? window.Game.Combat.getActiveSkills()
            : (window.Game.Combat && window.Game.Combat.skills) || defaultSkills;

        this._drawAttackButton(ctx, this.buttons.attack, combatSkills[0] || defaultSkills[0]);
        this._drawSkillButton(ctx, this.buttons.skill1, combatSkills[1] || defaultSkills[1], 1);
        this._drawSkillButton(ctx, this.buttons.skill2, combatSkills[2] || defaultSkills[2], 2);
        this._drawRageSkillButton(ctx, this.buttons.skill3, combatSkills[3] || defaultSkills[3]);

        this._drawSwitchWeaponButton(ctx);
        this._drawTimeShiftButton(ctx);
        this._drawInteractButton(ctx);

        if (this.mouseAimActive) {
            this._drawMouseAimIndicator(ctx, w);
        }

        this._drawRipples(ctx);

        if (this.isEditMode) {
            this._drawEditModeToolbarAndRings(ctx, w, h);
        }

        ctx.restore();
    },

    _drawMouseAimIndicator: function (ctx, width) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 1.5;
        const rectW = 210 * this.uiScale;
        const rectH = 26 * this.uiScale;
        const rx = (width - rectW) * 0.5;
        const ry = 14 * this.uiScale;

        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(rx, ry, rectW, rectH, 6) : ctx.rect(rx, ry, rectW, rectH);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f2fe';
        ctx.font = `bold ${Math.round(10 * this.uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎯 PC MOUSE AIM ON [F: TẮT]', width * 0.5, ry + rectH * 0.5);
        ctx.restore();
    },

    _drawCancelZone: function (ctx) {
        let isAnyAiming = false;
        for (let key in this.buttons) {
            if (this.buttons[key].isAiming) {
                isAnyAiming = true;
                break;
            }
        }
        if (!isAnyAiming) return;

        const cz = this.cancelZone;
        const isActive = cz.active;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cz.x, cz.y, cz.r * (isActive ? 1.15 : 1.0), 0, Math.PI * 2);
        ctx.fillStyle = isActive ? 'rgba(239, 68, 68, 0.85)' : 'rgba(15, 23, 42, 0.72)';
        ctx.fill();

        ctx.lineWidth = 2.5 * this.uiScale;
        ctx.strokeStyle = isActive ? '#fecaca' : '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = isActive ? 16 : 8;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(11 * this.uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isActive ? 'THẢ ĐỂ HỦY' : 'HỦY CHIÊU', cz.x, cz.y);
        ctx.restore();
    },

    _drawEditModeBackground: function (ctx, width, height) {
        ctx.save();
        ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = step; x < width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = step; y < height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.restore();
    },

    _drawEditModeToolbarAndRings: function (ctx, width, height) {
        this._updateEditToolbarRects(width, height);

        ctx.save();
        const centerX = width * 0.5;
        const topY = Math.max(16, 20 * (this.uiScale || 1.0));

        const panelW = Math.min(width - 20, 480);
        const panelH = 92;
        const panelX = centerX - panelW / 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.fillRect(panelX, topY, panelW, panelH);
        ctx.strokeRect(panelX, topY, panelW, panelH);

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚙️ TÙY CHỈNH HUD & XÚC GIÁC: Chạm & Kéo nút để chỉnh vị trí', centerX, topY + 20);

        // Nút Lưu
        const sRect = this.editToolbarRects.save;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sRect.x, sRect.y, sRect.w, sRect.h);
        ctx.strokeStyle = '#a7f3d0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sRect.x, sRect.y, sRect.w, sRect.h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('💾 LƯU LẠI', sRect.x + sRect.w / 2, sRect.y + sRect.h / 2);

        // Nút Mặc định
        const rRect = this.editToolbarRects.reset;
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(rRect.x, rRect.y, rRect.w, rRect.h);
        ctx.strokeStyle = '#bfdbfe';
        ctx.strokeRect(rRect.x, rRect.y, rRect.w, rRect.h);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🔄 MẶC ĐỊNH', rRect.x + rRect.w / 2, rRect.y + rRect.h / 2);

        // NÚT BẬT / TẮT RUNG XÚC GIÁC (HAPTIC TOGGLE)
        const hRect = this.editToolbarRects.haptic;
        const isHapticOn = this.HapticEngine.isEnabled();
        ctx.fillStyle = isHapticOn ? '#8b5cf6' : '#475569';
        ctx.fillRect(hRect.x, hRect.y, hRect.w, hRect.h);
        ctx.strokeStyle = isHapticOn ? '#c4b5fd' : '#94a3b8';
        ctx.strokeRect(hRect.x, hRect.y, hRect.w, hRect.h);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(isHapticOn ? '📳 RUNG: BẬT' : '📴 RUNG: TẮT', hRect.x + hRect.w / 2, hRect.y + hRect.h / 2);

        // Nút Thoát
        const cRect = this.editToolbarRects.cancel;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cRect.x, cRect.y, cRect.w, cRect.h);
        ctx.strokeStyle = '#fecaca';
        ctx.strokeRect(cRect.x, cRect.y, cRect.w, cRect.h);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('✕ THOÁT', cRect.x + cRect.w / 2, cRect.y + cRect.h / 2);

        // Vòng viền hiển thị trạng thái kéo thả nút
        for (let k in this.buttons) {
            const b = this.buttons[k];
            const isDragging = this.draggingHudKey === k;
            ctx.save();
            ctx.strokeStyle = isDragging ? '#fde047' : '#00e5ff';
            ctx.lineWidth = isDragging ? 3 : 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r + 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        const isJoyDragging = this.draggingHudKey === 'joystick';
        ctx.save();
        ctx.strokeStyle = isJoyDragging ? '#fde047' : '#00e5ff';
        ctx.lineWidth = isJoyDragging ? 3 : 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(this.joystick.defaultOriginX, this.joystick.defaultOriginY, this.joystick.maxRadius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    },

    _drawRipples: function (ctx) {
        if (!this.ripples || this.ripples.length === 0) return;
        const uiScale = this.uiScale || 1.0;
        ctx.save();
        for (let i = 0; i < this.ripples.length; i++) {
            const rp = this.ripples[i];
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            ctx.strokeStyle = rp.color;
            ctx.globalAlpha = Math.max(0, rp.alpha);
            ctx.lineWidth = 3 * uiScale;
            ctx.shadowColor = rp.color;
            ctx.shadowBlur = 10 * uiScale;
            ctx.stroke();
        }
        ctx.restore();
    },

    _drawJoystick: function (ctx) {
        const j = this.joystick;
        const alpha = (j.active || this.isEditMode) ? 0.88 : 0.42;
        const uiScale = this.uiScale || 1.0;
        const isPulling = j.active && Math.hypot(j.dx, j.dy) > 0.05;

        ctx.save();

        ctx.beginPath();
        ctx.arc(j.originX, j.originY, j.maxRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(15, 23, 42, ${alpha * 0.58})`;
        ctx.fill();
        ctx.lineWidth = 2.5 * uiScale;
        ctx.strokeStyle = isPulling ? 'rgba(56, 189, 248, 0.9)' : `rgba(148, 163, 184, ${alpha})`;
        ctx.stroke();

        if (isPulling) {
            const dirAngle = j.angle;
            ctx.save();
            ctx.beginPath();
            ctx.arc(j.originX, j.originY, j.maxRadius + 3 * uiScale, dirAngle - 0.48, dirAngle + 0.48);
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 3.5 * uiScale;
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 10 * uiScale;
            ctx.stroke();

            const arrowDist = j.maxRadius + 11 * uiScale;
            const tipX = j.originX + Math.cos(dirAngle) * arrowDist;
            const tipY = j.originY + Math.sin(dirAngle) * arrowDist;
            const sideAngle = 0.22;
            const baseDist = j.maxRadius + 2 * uiScale;

            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(j.originX + Math.cos(dirAngle - sideAngle) * baseDist, j.originY + Math.sin(dirAngle - sideAngle) * baseDist);
            ctx.lineTo(j.originX + Math.cos(dirAngle + sideAngle) * baseDist, j.originY + Math.sin(dirAngle + sideAngle) * baseDist);
            ctx.closePath();
            ctx.fillStyle = '#38bdf8';
            ctx.fill();
            ctx.restore();
        }

        const knobRadius = 22 * uiScale;
        ctx.beginPath();
        ctx.arc(j.currentX, j.currentY, knobRadius, 0, Math.PI * 2);
        ctx.fillStyle = j.active ? 'rgba(56, 189, 248, 0.92)' : 'rgba(203, 213, 225, 0.5)';
        ctx.fill();
        ctx.lineWidth = 2 * uiScale;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.stroke();

        ctx.restore();
    },

    _drawAttackButton: function (ctx, btn, skillData) {
        const uiScale = this.uiScale || 1.0;
        const scale = btn.pressed ? 0.91 : 1.0;
        const r = btn.r * scale;

        const currentWeapon = (window.Game.Combat && window.Game.Combat.currentWeapon)
            || (window.Game.state && window.Game.state.weapon) || 'cyber_sword';

        let weaponLabel = 'KIẾM';
        let weaponIcon = '⚔️';
        if (currentWeapon === 'laser_gun') {
            weaponLabel = 'LASER';
            weaponIcon = '⚡';
        } else if (currentWeapon === 'chrono_cannon') {
            weaponLabel = 'PHÁO';
            weaponIcon = '💥';
        }

        const cd = Math.max(0, (skillData && skillData.cd) || 0);
        const maxCd = Math.max(0.001, (skillData && skillData.maxCd) || 0.4);
        const isOnCooldown = cd > 0.01;
        const color = (skillData && skillData.color) || '#f59e0b';

        ctx.save();

        const flash = this.skillFlashStates[0];
        if (flash.flashAlpha > 0.01) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, r + 7 * uiScale + (1.0 - flash.flashAlpha) * 8 * uiScale, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${flash.flashAlpha * 0.95})`;
            ctx.lineWidth = 3.5 * uiScale;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 14 * uiScale;
            ctx.stroke();
            ctx.restore();
        }

        if (btn.pressed && !isOnCooldown) {
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, r + 6 * uiScale, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.35;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r - 3 * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = isOnCooldown ? 'rgba(51, 65, 85, 0.7)' : color;
        ctx.globalAlpha = isOnCooldown ? 0.45 : (btn.pressed ? 0.95 : 0.82);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.lineWidth = 3.5 * uiScale;
        ctx.strokeStyle = isOnCooldown ? 'rgba(148, 163, 184, 0.5)' : (btn.pressed ? '#fde047' : '#ffffff');
        ctx.stroke();

        if (currentWeapon === 'laser_gun') {
            const heat = Math.max(0, Math.min(100, (window.Game.Combat && window.Game.Combat.weaponHeat) || 0));
            if (heat > 0) {
                const heatRatio = heat / 100;
                const startA = -Math.PI / 2;
                const endA = startA + heatRatio * Math.PI * 2;

                let heatColor = '#00f2fe';
                if (heat >= 80) heatColor = '#ef4444';
                else if (heat >= 50) heatColor = '#f59e0b';

                ctx.save();
                ctx.beginPath();
                ctx.arc(btn.x, btn.y, r + 3.5 * uiScale, startA, endA);
                ctx.strokeStyle = heatColor;
                ctx.lineWidth = 3.5 * uiScale;
                ctx.shadowColor = heatColor;
                ctx.shadowBlur = heat >= 80 ? 12 : 6;
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(11 * uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${weaponIcon} ${weaponLabel}`, btn.x, btn.y - (isOnCooldown ? 9 * uiScale : 1 * uiScale));

        if (isOnCooldown) {
            const ratio = Math.min(1, Math.max(0, cd / maxCd));
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + ratio * Math.PI * 2;

            ctx.beginPath();
            ctx.moveTo(btn.x, btn.y);
            ctx.arc(btn.x, btn.y, r, startAngle, endAngle, false);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
            ctx.fill();

            ctx.fillStyle = '#fde047';
            ctx.font = `bold ${Math.round(12 * uiScale)}px sans-serif`;
            ctx.fillText(cd.toFixed(1), btn.x, btn.y + 6 * uiScale);
        }

        this._drawKeyBadge(ctx, btn, r);
        ctx.restore();
    },

    // =========================================================================
    // 3. VẼ KỸ NĂNG VỚI MULTI-DASH (2 LẦN LƯỚT) & GIẢM HỒI CHIÊU HASTE MATRIX
    // =========================================================================
    _drawSkillButton: function (ctx, btn, skillData, skillIndex) {
        const name = (skillData && skillData.name) || 'Kỹ năng';
        const cd = Math.max(0, (skillData && skillData.cd) || 0);
        const maxCd = Math.max(0.001, (skillData && skillData.maxCd) || 1);
        const color = (skillData && skillData.color) || '#38bdf8';
        const isOnCooldown = cd > 0.01;
        const uiScale = this.uiScale || 1.0;

        const player = window.Game.player;

        // KIỂM TRA TRANG BỊ MA TRẬN GIA TỐC HASTE MATRIX (-20% CD)
        const hasHasteMatrix = !!(
            (player && player.relics && (player.relics.has('relic_haste_matrix') || player.relics.relic_haste_matrix)) ||
            (window.Game.state && window.Game.state.hasHasteMatrix)
        );

        // KIỂM TRA SỐ TẦNG TÍCH LŨY CỦA KỸ NĂNG LƯỚT (MULTI-DASH CHARGES - SKILL 1)
        const isDashSkill = (skillIndex === 1);
        const dashCharges = (isDashSkill && window.Game.Combat && typeof window.Game.Combat.dashCharges === 'number')
            ? window.Game.Combat.dashCharges
            : (player && player.dashCharges !== undefined ? player.dashCharges : (isDashSkill ? 1 : 0));
        const maxDashCharges = (isDashSkill && window.Game.Combat && typeof window.Game.Combat.maxDashCharges === 'number')
            ? window.Game.Combat.maxDashCharges
            : 2;

        const scale = btn.pressed ? 0.91 : 1.0;
        const r = btn.r * scale;

        ctx.save();

        if (typeof skillIndex === 'number' && this.skillFlashStates[skillIndex]) {
            const flash = this.skillFlashStates[skillIndex];
            if (flash.flashAlpha > 0.01) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(btn.x, btn.y, r + 6 * uiScale + (1.0 - flash.flashAlpha) * 8 * uiScale, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${flash.flashAlpha * 0.95})`;
                ctx.lineWidth = 3.5 * uiScale;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 14 * uiScale;
                ctx.stroke();
                ctx.restore();
            }
        }

        if (btn.pressed && !isOnCooldown) {
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, r + 5 * uiScale, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.32;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r - 3 * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = isOnCooldown ? 'rgba(51, 65, 85, 0.7)' : color;
        ctx.globalAlpha = isOnCooldown ? 0.45 : (btn.pressed ? 0.95 : 0.78);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.lineWidth = 2.5 * uiScale;
        ctx.strokeStyle = isOnCooldown ? 'rgba(148, 163, 184, 0.5)' : (btn.pressed ? '#fde047' : '#f8fafc');
        ctx.stroke();

        // HIỂN THỊ VIỀN CHỈ BÁO GIẢM HỒI CHIÊU HASTE MATRIX (-20% CD)
        if (hasHasteMatrix) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, r + 2.5 * uiScale, 0, Math.PI * 2);
            ctx.lineWidth = 1.8 * uiScale;
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.75)';
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(9.5 * uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const shortName = name.length > 10 ? name.substring(0, 9) + '…' : name;
        ctx.fillText(shortName, btn.x, btn.y - (isOnCooldown ? 10 * uiScale : 0));

        if (isOnCooldown) {
            const ratio = Math.min(1, Math.max(0, cd / maxCd));
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + ratio * Math.PI * 2;

            ctx.beginPath();
            ctx.moveTo(btn.x, btn.y);
            ctx.arc(btn.x, btn.y, r, startAngle, endAngle, false);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
            ctx.fill();

            ctx.fillStyle = '#fde047';
            ctx.font = `bold ${Math.round(13 * uiScale)}px sans-serif`;
            const cdText = cd < 10 ? cd.toFixed(1) : Math.ceil(cd).toString();
            ctx.fillText(cdText, btn.x, btn.y + 5 * uiScale);
        }

        // VẼ CÁC CHẤM SÁNG CHỈ BÁO SỐ LẦN TÍCH LŨY CỦA TỐC BIẾN ĐA TẦNG (MULTI-DASH CHARGES)
        if (isDashSkill) {
            const dotRadius = 3.5 * uiScale;
            const startDotX = btn.x - ((maxDashCharges - 1) * 11 * uiScale) / 2;
            const dotY = btn.y + r - 8 * uiScale;

            for (let d = 0; d < maxDashCharges; d++) {
                const curDotX = startDotX + d * 11 * uiScale;
                const isCharged = d < dashCharges;

                ctx.save();
                ctx.beginPath();
                ctx.arc(curDotX, dotY, dotRadius, 0, Math.PI * 2);
                ctx.fillStyle = isCharged ? '#00f2fe' : 'rgba(100, 116, 139, 0.6)';
                ctx.shadowColor = isCharged ? '#00f2fe' : 'transparent';
                ctx.shadowBlur = isCharged ? 6 : 0;
                ctx.fill();

                ctx.strokeStyle = isCharged ? '#ffffff' : '#475569';
                ctx.lineWidth = 1 * uiScale;
                ctx.stroke();
                ctx.restore();
            }
        }

        this._drawKeyBadge(ctx, btn, r);
        ctx.restore();
    },

    // =========================================================================
    // 4. VẼ CHIÊU CUỐI NỘ LƯỢNG TỬ (QUANTUM BATTERY 200 NỘ VỚI VÒNG KÉP)
    // =========================================================================
    _drawRageSkillButton: function (ctx, btn, skillData) {
        const player = window.Game.player;

        // KIỂM TRA TRANG BỊ BỘ LƯU TRỮ LƯỢNG TỬ (QUANTUM BATTERY - MAX 200 NỘ)
        const hasQuantumBattery = !!(
            (player && player.relics && (player.relics.has('relic_quantum_battery') || player.relics.relic_quantum_battery)) ||
            (window.Game.state && window.Game.state.hasQuantumBattery)
        );

        const maxRageAllowed = hasQuantumBattery ? 200 : 100;
        const rage = Math.max(0, Math.min(maxRageAllowed, (window.Game.state && window.Game.state.rage) || 0));

        const tier1Ratio = Math.min(1.0, rage / 100);
        const tier2Ratio = hasQuantumBattery ? Math.max(0.0, (rage - 100) / 100) : 0;

        const isReady1 = rage >= 100;
        const isReady2 = hasQuantumBattery && rage >= 200;

        const uiScale = this.uiScale || 1.0;
        const scale = btn.pressed ? 0.91 : 1.0;
        const r = btn.r * scale;
        const now = performance.now() * 0.001;

        ctx.save();

        // Xung nhịp tỏa sáng khi đầy Chiêu Cuối (Pulse Aura)
        if (isReady1 || btn.pressed) {
            const pulseR = r + 5 * uiScale + Math.sin(now * (isReady2 ? 14 : 8)) * (isReady2 ? 5.0 : 3.5) * uiScale;
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = isReady2 ? 'rgba(236, 72, 153, 0.95)' : 'rgba(34, 211, 238, 0.95)';
            ctx.shadowColor = isReady2 ? '#ff007f' : '#00f2fe';
            ctx.shadowBlur = (isReady2 ? 18 : 14) * uiScale;
            ctx.lineWidth = (isReady2 ? 4.5 : 3.5) * uiScale;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fill();

        // TẦNG NỘ 1: Vòng tròn năng lượng bên trong (0% - 100%)
        if (tier1Ratio > 0) {
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + tier1Ratio * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(btn.x, btn.y);
            ctx.arc(btn.x, btn.y, r - 3 * uiScale, startAngle, endAngle, false);
            ctx.closePath();
            ctx.fillStyle = isReady1 ? (hasQuantumBattery ? '#0284c7' : '#06b6d4') : 'rgba(245, 158, 11, 0.65)';
            ctx.fill();
        }

        // TẦNG NỘ 2: VÒNG NĂNG LƯỢNG KÉP KHI CÓ QUANTUM BATTERY (100% - 200%)
        if (hasQuantumBattery && tier2Ratio > 0) {
            const startAngle2 = -Math.PI / 2;
            const endAngle2 = startAngle2 + tier2Ratio * Math.PI * 2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, r + 4 * uiScale, startAngle2, endAngle2);
            ctx.strokeStyle = isReady2 ? '#f43f5e' : '#ec4899';
            ctx.lineWidth = 3.5 * uiScale;
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 10 * uiScale;
            ctx.stroke();
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.lineWidth = (isReady1 ? 3 : 2) * uiScale;
        ctx.strokeStyle = isReady2 ? '#fda4af' : (isReady1 ? '#a5f3fc' : 'rgba(148, 163, 184, 0.55)');
        ctx.stroke();

        ctx.fillStyle = isReady1 ? '#ffffff' : '#e2e8f0';
        ctx.font = `bold ${Math.round(9 * uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const title = (skillData && skillData.name) || 'NGƯNG ĐỌNG';
        ctx.fillText(title.substring(0, 10), btn.x, btn.y - 7 * uiScale);

        // HIỂN THỊ CHỈ BÁO NĂNG LƯỢNG NỘ: x1 READY hoặc x2 MAX!
        let rageLabel = `${Math.floor(rage)}%`;
        let rageColor = '#38bdf8';

        if (hasQuantumBattery) {
            if (isReady2) {
                rageLabel = 'x2 MAX!';
                rageColor = '#fda4af';
            } else if (isReady1) {
                rageLabel = `x1 READY (${Math.floor(rage)}%)`;
                rageColor = '#fde047';
            } else {
                rageLabel = `${Math.floor(rage)}/200`;
                rageColor = '#38bdf8';
            }
        } else {
            if (isReady1) {
                rageLabel = 'MAX NỘ!';
                rageColor = '#fde047';
            }
        }

        ctx.fillStyle = rageColor;
        ctx.font = `bold ${Math.round(hasQuantumBattery && isReady1 ? 9.5 * uiScale : 11 * uiScale)}px sans-serif`;
        ctx.fillText(rageLabel, btn.x, btn.y + 7 * uiScale);

        this._drawKeyBadge(ctx, btn, r);
        ctx.restore();
    },

    _drawSwitchWeaponButton: function (ctx) {
        const btn = this.buttons.switchWeapon;
        const uiScale = this.uiScale || 1.0;
        const scale = btn.pressed ? 0.91 : 1.0;
        const r = btn.r * scale;

        ctx.save();
        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fill();
        ctx.lineWidth = 2 * uiScale;
        ctx.strokeStyle = btn.pressed ? '#fde047' : '#38bdf8';
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.round(8.5 * uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ĐỔI VK', btn.x, btn.y - 4 * uiScale);

        ctx.fillStyle = '#38bdf8';
        ctx.font = `bold ${Math.round(8 * uiScale)}px sans-serif`;
        ctx.fillText('[Tab]', btn.x, btn.y + 7 * uiScale);
        ctx.restore();
    },

    _drawTimeShiftButton: function (ctx) {
        const btn = this.buttons.timeShift;
        const uiScale = this.uiScale || 1.0;
        const scale = btn.pressed ? 0.91 : 1.0;
        const r = btn.r * scale;

        const state = window.Game.state || {};
        const timeline = state.timeline || 'PRESENT';
        const cd = typeof state.timeShiftCooldown === 'number' ? Math.max(0, state.timeShiftCooldown) : 0;
        const maxCd = 4.0;
        const isOnCooldown = cd > 0.05;

        const timelineColors = { PAST: '#f59e0b', PRESENT: '#10b981', FUTURE: '#06b6d4' };
        const nextTimelineMap = { PAST: 'PRESENT', PRESENT: 'FUTURE', FUTURE: 'PAST' };
        const nextTl = nextTimelineMap[timeline] || 'PAST';
        const mainColor = timelineColors[timeline] || '#38bdf8';
        const nextColor = timelineColors[nextTl] || '#38bdf8';

        ctx.save();
        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r - 2.5 * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = isOnCooldown ? 'rgba(51, 65, 85, 0.65)' : mainColor;
        ctx.globalAlpha = isOnCooldown ? 0.35 : 0.78;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.lineWidth = 2 * uiScale;
        ctx.strokeStyle = isOnCooldown ? 'rgba(148, 163, 184, 0.45)' : nextColor;
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.round(8 * uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ĐẢO T.G', btn.x, btn.y - (isOnCooldown ? 9 * uiScale : 3 * uiScale));

        if (!isOnCooldown) {
            ctx.fillStyle = nextColor;
            ctx.font = `bold ${Math.round(7.5 * uiScale)}px sans-serif`;
            const nextLabels = { PAST: '→ CỔ ĐẠI', PRESENT: '→ HIỆN TẠI', FUTURE: '→ TƯƠNG LAI' };
            ctx.fillText(nextLabels[nextTl] || '→ NEXT', btn.x, btn.y + 7 * uiScale);
        } else {
            const ratio = Math.min(1, Math.max(0, cd / maxCd));
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + ratio * Math.PI * 2;

            ctx.beginPath();
            ctx.moveTo(btn.x, btn.y);
            ctx.arc(btn.x, btn.y, r, startAngle, endAngle, false);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fill();

            ctx.fillStyle = '#fde047';
            ctx.font = `bold ${Math.round(11 * uiScale)}px sans-serif`;
            ctx.fillText(`${cd.toFixed(1)}s`, btn.x, btn.y + 6 * uiScale);
        }

        this._drawKeyBadge(ctx, btn, r);
        ctx.restore();
    },

    _drawKeyBadge: function (ctx, btn, r) {
        const uiScale = this.uiScale || 1.0;
        const badgeR = Math.max(7, 9.5 * uiScale);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.beginPath();
        ctx.arc(btn.x + r * 0.68, btn.y + r * 0.68, badgeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `bold ${Math.round(9 * uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.keyHint, btn.x + r * 0.68, btn.y + r * 0.68 + 0.5);
    },

    _drawInteractButton: function (ctx) {
        const btn = this.buttons.interact;
        const uiScale = this.uiScale || 1.0;
        const player = window.Game.player || { x: 1920, y: 1920 };
        const nearby =
            window.Game.World && typeof window.Game.World.getNearbyInteractable === 'function'
                ? window.Game.World.getNearbyInteractable(player.x, player.y)
                : null;

        const isActive = nearby !== null;
        const scale = btn.pressed ? 0.91 : 1.0;
        const r = btn.r * scale;
        const now = performance.now() * 0.001;

        ctx.save();
        if (isActive) {
            const pulseR = r + 5 * uiScale + Math.sin(now * 6) * 4 * uiScale;
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
            ctx.lineWidth = 3 * uiScale;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? 'rgba(234, 179, 8, 0.95)' : 'rgba(30, 41, 59, 0.62)';
        ctx.fill();

        ctx.lineWidth = 2.2 * uiScale;
        ctx.strokeStyle = isActive ? '#fef08a' : 'rgba(148, 163, 184, 0.45)';
        ctx.stroke();

        ctx.fillStyle = isActive ? '#0f172a' : 'rgba(226, 232, 240, 0.7)';
        ctx.font = `bold ${Math.round(8.5 * uiScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let label = 'TƯƠNG TÁC';
        if (nearby === 'SEED') label = 'NHẶT HẠT';
        else if (nearby === 'SOIL') label = 'TRỒNG CÂY';
        else if (typeof nearby === 'string' && nearby.indexOf('CHEST') !== -1) label = 'MỞ RƯƠNG';
        else if (typeof nearby === 'string' && nearby.indexOf('WAYPOINT') !== -1) label = 'DỊCH CHUYỂN';
        else if (typeof nearby === 'string' && nearby.indexOf('SHRINE') !== -1) label = 'HIẾN TẾ ĐỀN';

        ctx.fillText(label, btn.x, btn.y - 4 * uiScale);
        ctx.font = `bold ${Math.round(8 * uiScale)}px sans-serif`;
        ctx.fillText(`[${btn.keyHint}]`, btn.x, btn.y + 7 * uiScale);
        ctx.restore();
    }
};