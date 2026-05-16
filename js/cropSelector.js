/**
 * cropSelector.js - クロップ範囲選択・管理
 */

const CROP_DEFAULT_KEY = 'mse_cropDefault';

class CropSelector {
    #videoEl;
    #overlayEl;
    #cropBoxEl;
    #maskTop; #maskBottom; #maskLeft; #maskRight;

    // 実ピクセルでの座標
    #rect = { x: 0, y: 0, w: 0, h: 0 };
    #enabled = false;

    #inputX; #inputY; #inputW; #inputH;
    #scaleSelect;
    #swapBtn;
    #enabledCheck;
    #detailToggle;
    #detailPanel;
    #saveDefaultBtn;
    #restoreDefaultBtn;
    #resetBtn;

    #drag = null;

    constructor(videoEl) {
        this.#videoEl = videoEl;
    }

    init() {
        this.#overlayEl         = document.getElementById('cropOverlay');
        this.#cropBoxEl         = document.getElementById('cropBox');
        this.#maskTop           = document.getElementById('cropMaskTop');
        this.#maskBottom        = document.getElementById('cropMaskBottom');
        this.#maskLeft          = document.getElementById('cropMaskLeft');
        this.#maskRight         = document.getElementById('cropMaskRight');
        this.#inputX            = document.getElementById('cropX');
        this.#inputY            = document.getElementById('cropY');
        this.#inputW            = document.getElementById('cropW');
        this.#inputH            = document.getElementById('cropH');
        this.#scaleSelect       = document.getElementById('cropScaleSelect');
        this.#swapBtn           = document.getElementById('cropSwapBtn');
        this.#enabledCheck      = document.getElementById('cropEnabledCheck');
        this.#detailToggle      = document.getElementById('cropDetailToggle');
        this.#detailPanel       = document.getElementById('cropDetailPanel');
        this.#saveDefaultBtn    = document.getElementById('cropSaveDefaultBtn');
        this.#restoreDefaultBtn = document.getElementById('cropRestoreDefaultBtn');
        this.#resetBtn          = document.getElementById('cropResetBtn');

        this.#setupListeners();
        logInfo('CropSelector: 初期化完了');
    }

    #setupListeners() {
        this.#enabledCheck.addEventListener('change', () => {
            this.#enabled = this.#enabledCheck.checked;
            this.#overlayEl.classList.toggle('hidden', !this.#enabled);
            // オーバーレイが表示されるタイミングで位置を再同期
            if (this.#enabled) this.#syncToOverlay();
        });

        // モバイル用アコーディオン
        this.#detailToggle.addEventListener('click', () => {
            const isOpen = this.#detailPanel.classList.toggle('open');
            this.#detailToggle.textContent = isOpen ? '詳細設定 ▲' : '詳細設定 ▼';
        });

        // 数値入力 → オーバーレイ同期
        [
            [this.#inputX, 'x'], [this.#inputY, 'y'],
            [this.#inputW, 'w'], [this.#inputH, 'h']
        ].forEach(([el, key]) => {
            el.addEventListener('input', () => {
                const val = parseInt(el.value, 10);
                if (!isNaN(val) && val >= 0) {
                    this.#rect[key] = val;
                    this.#clamp();
                    this.#syncToOverlay();
                }
            });
        });

        // 倍率リスト → W/H変更
        this.#scaleSelect.addEventListener('change', () => {
            const ratio = parseFloat(this.#scaleSelect.value);
            if (!isNaN(ratio) && ratio > 0) this.#resizeByScale(ratio);
            this.#scaleSelect.value = '';
        });

        // 縦横入れ替え
        this.#swapBtn.addEventListener('click', () => this.#swapWH());

        // 初期値ボタン
        this.#saveDefaultBtn.addEventListener('click',    () => this.#saveDefault());
        this.#restoreDefaultBtn.addEventListener('click', () => this.#restoreDefault());
        this.#resetBtn.addEventListener('click',          () => this.#resetToFull());

        // ドラッグ: 移動
        this.#cropBoxEl.addEventListener('mousedown', (e) => {
            if (e.target.dataset.dir) return;
            e.preventDefault();
            this.#startDrag(e.clientX, e.clientY, 'move');
        });

        // ドラッグ: リサイズハンドル
        this.#cropBoxEl.querySelectorAll('.crop-handle').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.#startDrag(e.clientX, e.clientY, `resize-${el.dataset.dir}`);
            });
        });

        document.addEventListener('mousemove', (e) => this.#onDragMove(e.clientX, e.clientY));
        document.addEventListener('mouseup',   ()  => { this.#drag = null; });

        // タッチ対応
        this.#cropBoxEl.addEventListener('touchstart', (e) => {
            if (e.target.dataset.dir) return;
            e.preventDefault();
            this.#startDrag(e.touches[0].clientX, e.touches[0].clientY, 'move');
        }, { passive: false });

        this.#cropBoxEl.querySelectorAll('.crop-handle').forEach(el => {
            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.#startDrag(e.touches[0].clientX, e.touches[0].clientY, `resize-${el.dataset.dir}`);
            }, { passive: false });
        });

        document.addEventListener('touchmove', (e) => {
            if (this.#drag) {
                e.preventDefault();
                this.#onDragMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        document.addEventListener('touchend', () => { this.#drag = null; });

        window.addEventListener('resize', () => { if (this.#enabled) this.#syncToOverlay(); });
    }

    // 動画コンテンツのレンダリング領域（レターボックス対応）
    #getVideoRenderRect() {
        const el = this.#videoEl;
        const ew = el.clientWidth;
        const eh = el.clientHeight;
        const vw = el.videoWidth  || ew;
        const vh = el.videoHeight || eh;

        const elAspect    = ew / eh;
        const videoAspect = vw / vh;

        let renderW, renderH, offsetX, offsetY;
        if (videoAspect > elAspect) {
            renderW = ew;
            renderH = ew / videoAspect;
            offsetX = 0;
            offsetY = (eh - renderH) / 2;
        } else {
            renderH = eh;
            renderW = eh * videoAspect;
            offsetX = (ew - renderW) / 2;
            offsetY = 0;
        }
        return { x: offsetX, y: offsetY, w: renderW, h: renderH };
    }

    // 表示座標（レンダリング領域内）→ 実ピクセル
    #displayToReal(dx, dy, dw, dh) {
        const r  = this.#getVideoRenderRect();
        const vw = this.#videoEl.videoWidth  || 1;
        const vh = this.#videoEl.videoHeight || 1;
        return {
            x: Math.round(dx / r.w * vw),
            y: Math.round(dy / r.h * vh),
            w: Math.round(dw / r.w * vw),
            h: Math.round(dh / r.h * vh)
        };
    }

    // 実ピクセル → 表示座標（レンダリング領域内）
    #realToDisplay() {
        const r  = this.#getVideoRenderRect();
        const vw = this.#videoEl.videoWidth  || 1;
        const vh = this.#videoEl.videoHeight || 1;
        return {
            x: this.#rect.x / vw * r.w,
            y: this.#rect.y / vh * r.h,
            w: this.#rect.w / vw * r.w,
            h: this.#rect.h / vh * r.h
        };
    }

    #startDrag(clientX, clientY, type) {
        const overlayRect = this.#overlayEl.getBoundingClientRect();
        const relX = clientX - overlayRect.left;
        const relY = clientY - overlayRect.top;
        this.#drag = { type, startX: relX, startY: relY, startCrop: { ...this.#realToDisplay() } };
    }

    #onDragMove(clientX, clientY) {
        if (!this.#drag) return;

        const overlayRect = this.#overlayEl.getBoundingClientRect();
        const relX = clientX - overlayRect.left;
        const relY = clientY - overlayRect.top;
        const dx = relX - this.#drag.startX;
        const dy = relY - this.#drag.startY;
        const sc = this.#drag.startCrop;
        const rw = overlayRect.width;
        const rh = overlayRect.height;

        let nx = sc.x, ny = sc.y, nw = sc.w, nh = sc.h;

        if (this.#drag.type === 'move') {
            nx = sc.x + dx;
            ny = sc.y + dy;
        } else {
            const dir = this.#drag.type.replace('resize-', '');
            if (dir.includes('e')) nw = Math.max(4, sc.w + dx);
            if (dir.includes('s')) nh = Math.max(4, sc.h + dy);
            if (dir.includes('w')) { nx = sc.x + dx; nw = Math.max(4, sc.w - dx); }
            if (dir.includes('n')) { ny = sc.y + dy; nh = Math.max(4, sc.h - dy); }
        }

        // レンダリング領域内にクランプ
        nw = Math.min(nw, rw);
        nh = Math.min(nh, rh);
        nx = Math.max(0, Math.min(nx, rw - nw));
        ny = Math.max(0, Math.min(ny, rh - nh));

        this.#rect = this.#displayToReal(nx, ny, nw, nh);
        this.#syncToInputs();
        this.#syncToOverlay();
    }

    #syncToInputs() {
        this.#inputX.value = this.#rect.x;
        this.#inputY.value = this.#rect.y;
        this.#inputW.value = this.#rect.w;
        this.#inputH.value = this.#rect.h;
    }

    #syncToOverlay() {
        // オーバーレイをビデオのレンダリング領域に重ねる
        const videoRect     = this.#videoEl.getBoundingClientRect();
        const containerRect = this.#videoEl.parentElement.getBoundingClientRect();
        const renderRect    = this.#getVideoRenderRect();

        const ol = videoRect.left - containerRect.left + renderRect.x;
        const ot = videoRect.top  - containerRect.top  + renderRect.y;
        const ow = renderRect.w;
        const oh = renderRect.h;

        this.#overlayEl.style.left   = `${ol}px`;
        this.#overlayEl.style.top    = `${ot}px`;
        this.#overlayEl.style.width  = `${ow}px`;
        this.#overlayEl.style.height = `${oh}px`;

        // クロップ枠の表示座標
        const d = this.#realToDisplay();

        // 暗幕4枚を配置
        this.#maskTop.style.cssText    = `top:0;left:0;right:0;height:${d.y}px`;
        this.#maskBottom.style.cssText = `top:${d.y + d.h}px;left:0;right:0;bottom:0`;
        this.#maskLeft.style.cssText   = `top:${d.y}px;left:0;width:${d.x}px;height:${d.h}px`;
        this.#maskRight.style.cssText  = `top:${d.y}px;left:${d.x + d.w}px;right:0;height:${d.h}px`;

        // クロップ枠
        this.#cropBoxEl.style.left   = `${d.x}px`;
        this.#cropBoxEl.style.top    = `${d.y}px`;
        this.#cropBoxEl.style.width  = `${d.w}px`;
        this.#cropBoxEl.style.height = `${d.h}px`;
    }

    #clamp() {
        const vw = this.#videoEl.videoWidth  || 9999;
        const vh = this.#videoEl.videoHeight || 9999;
        this.#rect.w = Math.max(1, Math.min(this.#rect.w, vw));
        this.#rect.h = Math.max(1, Math.min(this.#rect.h, vh));
        this.#rect.x = Math.max(0, Math.min(this.#rect.x, vw - this.#rect.w));
        this.#rect.y = Math.max(0, Math.min(this.#rect.y, vh - this.#rect.h));
    }

    #resizeByScale(ratio) {
        const vw = this.#videoEl.videoWidth  || this.#videoEl.clientWidth;
        const vh = this.#videoEl.videoHeight || this.#videoEl.clientHeight;
        const newW = Math.max(1, Math.round(vw * ratio));
        const newH = Math.max(1, Math.round(vh * ratio));
        const cx = this.#rect.x + this.#rect.w / 2;
        const cy = this.#rect.y + this.#rect.h / 2;
        this.#rect.w = newW;
        this.#rect.h = newH;
        this.#rect.x = Math.round(cx - newW / 2);
        this.#rect.y = Math.round(cy - newH / 2);
        this.#clamp();
        this.#syncToInputs();
        this.#syncToOverlay();
    }

    #swapWH() {
        const cx = this.#rect.x + this.#rect.w / 2;
        const cy = this.#rect.y + this.#rect.h / 2;
        [this.#rect.w, this.#rect.h] = [this.#rect.h, this.#rect.w];
        this.#rect.x = Math.round(cx - this.#rect.w / 2);
        this.#rect.y = Math.round(cy - this.#rect.h / 2);
        this.#clamp();
        this.#syncToInputs();
        this.#syncToOverlay();
    }

    #resetToFull() {
        this.#rect = {
            x: 0, y: 0,
            w: this.#videoEl.videoWidth  || 0,
            h: this.#videoEl.videoHeight || 0
        };
        this.#syncToInputs();
        this.#syncToOverlay();
    }

    // 保存済みデフォルトがない場合は中央50%クロップを初期値にする
    #resetToDefault50() {
        const vw = this.#videoEl.videoWidth;
        const vh = this.#videoEl.videoHeight;
        const newW = Math.round(vw * 0.5);
        const newH = Math.round(vh * 0.5);
        this.#rect = {
            x: Math.round((vw - newW) / 2),
            y: Math.round((vh - newH) / 2),
            w: newW,
            h: newH
        };
        this.#syncToInputs();
        this.#syncToOverlay();
    }

    #saveDefault() {
        localStorage.setItem(
            CROP_DEFAULT_KEY,
            JSON.stringify({ enabled: this.#enabled, ...this.#rect })
        );
        logInfo('CropSelector: 初期値を保存しました', this.#rect);
    }

    #restoreDefault() {
        const saved = this.#loadDefault();
        if (!saved) return;
        this.#rect = { x: saved.x ?? 0, y: saved.y ?? 0, w: saved.w ?? 0, h: saved.h ?? 0 };
        this.#clamp();
        this.#syncToInputs();
        this.#syncToOverlay();
    }

    #loadDefault() {
        try {
            const raw = localStorage.getItem(CROP_DEFAULT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    // 動画読み込み完了時に呼び出す
    onVideoLoaded() {
        const saved = this.#loadDefault();
        if (saved && saved.w > 0 && saved.h > 0) {
            // 保存済みデフォルトを復元
            this.#enabled = saved.enabled ?? false;
            this.#rect    = { x: saved.x ?? 0, y: saved.y ?? 0, w: saved.w, h: saved.h };
            this.#enabledCheck.checked = this.#enabled;
        } else {
            // デフォルトなし: 中央50%クロップで初期化（OFFのまま）
            this.#enabled = false;
            this.#enabledCheck.checked = false;
            this.#resetToDefault50();
        }
        this.#clamp();
        this.#overlayEl.classList.toggle('hidden', !this.#enabled);
        this.#syncToInputs();
        this.#syncToOverlay();
    }

    getCropRect() {
        return this.#enabled ? { ...this.#rect } : null;
    }
}

console.log('✅ cropSelector.js: 読み込み完了');
