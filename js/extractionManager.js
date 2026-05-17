/**
 * extractionManager.js - フレーム抽出処理の管理
 */

class ExtractionManager {
    #frameExtractor;
    #cropSelector;
    #imageGallery;
    #isExtracting = false;

    constructor(frameExtractor, cropSelector, imageGallery) {
        this.#frameExtractor = frameExtractor;
        this.#cropSelector   = cropSelector;
        this.#imageGallery   = imageGallery;
    }

    get isExtracting() { return this.#isExtracting; }

    async extract(startTime, endTime, interval, videoFileName, { onStart, onProgress, onFrame, onComplete, onError } = {}) {
        if (interval < 0.01) {
            onError?.('抽出間隔を正しく設定してください');
            return;
        }

        const count = this.#frameExtractor.calculateFrameCount(startTime, endTime, interval);

        if (count === 0) {
            onError?.('抽出できるフレームがありません。動画範囲を確認してください');
            return;
        }

        if (count > MAX_FRAMES) {
            onError?.(`抽出枚数が上限（${MAX_FRAMES}枚）を超えています（計算値: ${count}枚）`);
            return;
        }

        if (!confirm('実行しますか？')) return;

        this.#isExtracting = true;
        this.#imageGallery.clear();
        onStart?.(count);

        try {
            await this.#frameExtractor.extractRange(
                startTime, endTime, interval, videoFileName,
                {
                    onFrame: (frame) => {
                        this.#imageGallery.addFrame(frame);
                        onFrame?.(frame);
                    },
                    onProgress: (current, total) => {
                        onProgress?.(current, total);
                    },
                    cropRect: this.#cropSelector.getCropRect()
                }
            );

            this.#imageGallery.selectAll();
            const { total } = this.#imageGallery.getCounts();

            // 実フレームの高さで上限を再計算（iOS回転補正ずれ対策）
            const firstFrames = this.#imageGallery.getSelectedFrames();
            let actualStitchLimit = null;
            if (firstFrames.length > 0) {
                const img = await StitchProcessor.loadImage(firstFrames[0].dataUrl);
                if (img.naturalHeight > 0) {
                    actualStitchLimit = Math.floor(MAX_STITCH_HEIGHT / img.naturalHeight);
                }
            }

            onComplete?.({ total, actualStitchLimit });

        } catch (e) {
            logError('抽出エラー', e);
            onError?.('抽出中にエラーが発生しました');
        } finally {
            this.#isExtracting = false;
        }
    }

    cancel() { this.#frameExtractor.cancel(); }
}

console.log('✅ extractionManager.js: 読み込み完了');
