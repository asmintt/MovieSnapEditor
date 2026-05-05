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

    static async saveAllIndividual(frames) {
        if (!frames || frames.length === 0) return;

        // File System Access API: フォルダを1回選ぶだけで全ファイルを書き込める（ブラウザのブロック回避）
        if ('showDirectoryPicker' in window) {
            let dirHandle;
            try {
                dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            } catch (e) {
                if (e.name === 'AbortError') return; // ユーザーがキャンセル
                // APIが使えない場合は旧方式にフォールバック
                dirHandle = null;
            }

            if (dirHandle) {
                for (const frame of frames) {
                    const fh = await dirHandle.getFileHandle(frame.fileName, { create: true });
                    const ws = await fh.createWritable();
                    const blob = await fetch(frame.dataUrl).then(r => r.blob());
                    await ws.write(blob);
                    await ws.close();
                }
                return;
            }
        }

        // フォールバック（旧方式 / Firefox など）
        for (let i = 0; i < frames.length; i++) {
            const link = document.createElement('a');
            link.href = frames[i].dataUrl;
            link.download = frames[i].fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (i < frames.length - 1) {
                await new Promise(resolve => setTimeout(resolve, BULK_SAVE_DELAY_MS));
            }
        }
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
        ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
        ctx.textBaseline = 'bottom';
        ctx.textAlign    = 'left';
        const tw = ctx.measureText(frame.timestamp).width;
        const x  = padding;
        const y  = height - padding;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(x - padding / 2, y - fontSize - padding * 0.5, tw + padding * 2, fontSize + padding);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(frame.timestamp, x, y);

        return { ...frame, dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY) };
    }
}

console.log('✅ zipExporter.js: 読み込み完了');
