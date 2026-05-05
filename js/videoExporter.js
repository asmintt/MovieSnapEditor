/**
 * videoExporter.js - 選択画像をスライドショー動画として出力
 */

class VideoExporter {

    static getSupportedMimeType() {
        const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'video/webm';
    }

    static getExtension() {
        const mime = VideoExporter.getSupportedMimeType();
        return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    }

    static async export(frames, displayInterval, videoFileName, { onProgress } = {}) {
        if (!frames || frames.length === 0) return;

        const mimeType  = VideoExporter.getSupportedMimeType();
        const extension = VideoExporter.getExtension();
        const baseName  = getFileNameWithoutExtension(videoFileName) || 'slideshow';

        // 最初のフレームからCanvas サイズを決定
        const firstImg = await VideoExporter.#loadImage(frames[0].dataUrl);
        const width    = firstImg.naturalWidth;
        const height   = firstImg.naturalHeight;

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 最初のフレームを描画してからストリームを開始
        ctx.drawImage(firstImg, 0, 0, width, height);

        const stream   = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks   = [];

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        const finished = new Promise((resolve) => {
            recorder.onstop = () => {
                const blob     = new Blob(chunks, { type: mimeType });
                const fileName = `${baseName}_slideshow.${extension}`;
                saveAs(blob, fileName);
                resolve();
            };
        });

        recorder.start();

        // 各フレームを displayInterval 秒ずつ描画
        for (let i = 0; i < frames.length; i++) {
            const img = i === 0 ? firstImg : await VideoExporter.#loadImage(frames[i].dataUrl);
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            if (onProgress) onProgress(i + 1, frames.length);
            await VideoExporter.#wait(displayInterval * 1000);
        }

        recorder.stop();
        await finished;
    }

    static #loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload  = () => resolve(img);
            img.onerror = reject;
            img.src     = dataUrl;
        });
    }

    static #wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

console.log('✅ videoExporter.js: 読み込み完了');
