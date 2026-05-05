/**
 * zipExporter.js - ZIP保存・一括保存・タイムスタンプ焼き込み
 */

class ZipExporter {

    static generateFileName(videoFileName, timeSeconds) {
        const base = getFileNameWithoutExtension(videoFileName) || 'frame';
        const totalCentis = Math.round(timeSeconds * 100);
        const centis = totalCentis % 100;
        const totalSecs = Math.floor(totalCentis / 100);
        const secs = totalSecs % 60;
        const mins = Math.floor(totalSecs / 60);
        const mm = String(mins).padStart(2, '0');
        const ss = String(secs).padStart(2, '0');
        const ff = String(centis).padStart(2, '0');
        return `${base}_${mm}_${ss}_${ff}.jpg`;
    }

    static async saveAsZip(frames, videoFileName) {
        if (!frames || frames.length === 0) return;

        const zip = new JSZip();
        const baseName = getFileNameWithoutExtension(videoFileName) || 'frames';

        frames.forEach(frame => {
            const b64 = frame.dataUrl.split(',')[1];
            zip.file(frame.fileName, b64, { base64: true });
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, `${baseName}_frames.zip`);
    }

    static async burnTimestamp(frame) {
        if (!frame.timestamp) return frame;

        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload  = () => resolve(i);
            i.onerror = reject;
            i.src = frame.dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const { width, height } = canvas;
        const fontSize = Math.max(16, Math.round(height * 0.04));
        const padding  = Math.round(fontSize * 0.5);
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textBaseline = 'top';
        ctx.textAlign    = 'left';
        const tw = ctx.measureText(frame.timestamp).width;
        const x  = padding;
        const y  = padding;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - padding / 2, y - padding / 2, tw + padding * 2, fontSize + padding);
        ctx.fillStyle = '#000000';
        ctx.fillText(frame.timestamp, x, y);

        return { ...frame, dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY) };
    }
}

console.log('✅ zipExporter.js: 読み込み完了');
