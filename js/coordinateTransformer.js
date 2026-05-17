/**
 * coordinateTransformer.js - 表示座標と実ピクセル座標の変換
 */

class CoordinateTransformer {
    constructor(videoElement) {
        this.videoElement = videoElement;
    }

    // 動画コンテンツのレンダリング領域（レターボックス対応）
    getVideoRenderRect() {
        const el = this.videoElement;
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
    displayToReal(dx, dy, dw, dh) {
        const r  = this.getVideoRenderRect();
        const vw = this.videoElement.videoWidth  || 1;
        const vh = this.videoElement.videoHeight || 1;
        return {
            x: Math.round(dx / r.w * vw),
            y: Math.round(dy / r.h * vh),
            w: Math.round(dw / r.w * vw),
            h: Math.round(dh / r.h * vh)
        };
    }

    // 実ピクセル → 表示座標（レンダリング領域内）
    realToDisplay(rect) {
        const r  = this.getVideoRenderRect();
        const vw = this.videoElement.videoWidth  || 1;
        const vh = this.videoElement.videoHeight || 1;
        return {
            x: rect.x / vw * r.w,
            y: rect.y / vh * r.h,
            w: rect.w / vw * r.w,
            h: rect.h / vh * r.h
        };
    }
}

console.log('✅ coordinateTransformer.js: 読み込み完了');
