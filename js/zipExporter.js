/**
 * zipExporter.js - ZIP保存・一括保存処理
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
}

console.log('✅ zipExporter.js: 読み込み完了');
