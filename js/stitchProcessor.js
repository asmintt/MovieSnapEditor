/**
 * stitchProcessor.js - 縦結合処理
 */

class StitchProcessor {
    async stitch(frames, videoFileName, onStatus) {
        const firstImg = await StitchProcessor.loadImage(frames[0].dataUrl);
        const frameW = firstImg.naturalWidth;
        const frameH = firstImg.naturalHeight;
        const maxCount = frameH > 0 ? Math.floor(MAX_STITCH_HEIGHT / frameH) : frames.length;

        const chunks = [];
        for (let i = 0; i < frames.length; i += maxCount) {
            chunks.push(frames.slice(i, i + maxCount));
        }

        const baseName = getFileNameWithoutExtension(videoFileName) || 'frames';
        const blobs = [];

        for (let c = 0; c < chunks.length; c++) {
            const chunk = chunks[c];
            const canvas = document.createElement('canvas');
            canvas.width = frameW;
            canvas.height = frameH * chunk.length;
            const ctx = canvas.getContext('2d');

            for (let i = 0; i < chunk.length; i++) {
                const img = (c === 0 && i === 0) ? firstImg : await StitchProcessor.loadImage(chunk[i].dataUrl);
                ctx.drawImage(img, 0, i * frameH);
                onStatus(`縦結合中... (${c + 1}/${chunks.length}ファイル目、${i + 1}/${chunk.length}枚)`);
            }

            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
            });
            blobs.push(blob);
        }

        if (blobs.length === 1) {
            saveAs(blobs[0], `${baseName}_stitched.jpg`);
            onStatus(`縦結合画像を保存しました（計${frames.length}枚）`);
        } else {
            const zip = new JSZip();
            blobs.forEach((blob, i) => {
                zip.file(`${baseName}_stitched_${i + 1}.jpg`, blob);
            });
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `${baseName}_stitched.zip`);
            onStatus(`縦結合画像をZIPで保存しました（${blobs.length}ファイル、計${frames.length}枚）`);
        }
    }

    static loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
}

console.log('✅ stitchProcessor.js: 読み込み完了');
