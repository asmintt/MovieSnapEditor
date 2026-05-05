/**
 * frameExtractor.js - Canvas APIによるフレーム抽出
 */

class FrameExtractor {
    #videoElement;
    #canvas;
    #ctx;
    #cancelled = false;

    constructor(videoElement) {
        this.#videoElement = videoElement;
        this.#canvas = document.createElement('canvas');
        this.#ctx = this.#canvas.getContext('2d');
    }

    calculateFrameCount(startTime, endTime, interval) {
        if (interval <= 0 || endTime <= startTime) return 0;
        return Math.floor((endTime - startTime) / interval) + 1;
    }

    #seekTo(time) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.#videoElement.removeEventListener('seeked', onSeeked);
                reject(new Error('seekタイムアウト'));
            }, 8000);

            const onSeeked = () => {
                clearTimeout(timeout);
                this.#videoElement.removeEventListener('seeked', onSeeked);
                resolve();
            };

            this.#videoElement.addEventListener('seeked', onSeeked);
            this.#videoElement.currentTime = time;
        });
    }

    #captureFrame(timeSeconds, videoFileName) {
        this.#canvas.width = this.#videoElement.videoWidth;
        this.#canvas.height = this.#videoElement.videoHeight;
        this.#ctx.drawImage(this.#videoElement, 0, 0);
        const dataUrl = this.#canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const timestamp = formatTimeFromSeconds(timeSeconds);
        const fileName = ZipExporter.generateFileName(videoFileName, timeSeconds);
        return { dataUrl, timestamp, fileName, timeSeconds };
    }

    async extractRange(startTime, endTime, interval, videoFileName, { onFrame, onProgress } = {}) {
        this.#cancelled = false;
        const frames = [];
        const total = this.calculateFrameCount(startTime, endTime, interval);

        for (let i = 0; i < total; i++) {
            if (this.#cancelled) break;

            const t = Math.min(startTime + i * interval, endTime);

            try {
                await this.#seekTo(t);
                const frame = this.#captureFrame(t, videoFileName);
                frames.push(frame);

                if (onFrame) onFrame(frame);
                if (onProgress) onProgress(i + 1, total);
            } catch (e) {
                logError('FrameExtractor: フレーム抽出失敗', e);
            }
        }

        return frames;
    }

    cancel() {
        this.#cancelled = true;
    }
}

console.log('✅ frameExtractor.js: 読み込み完了');
