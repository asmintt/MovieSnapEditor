/**
 * app.js - メインコントローラー
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM要素 ---
    const statusText          = document.getElementById('statusText');
    const timeSlider          = document.getElementById('timeSlider');
    const currentTimeDisp     = document.getElementById('currentTimeDisplay');
    const durationDisp        = document.getElementById('durationDisplay');
    const extractBtn          = document.getElementById('extractBtn');
    const captureBtn          = document.getElementById('captureBtn');
    const saveZipBtn          = document.getElementById('saveZipBtn');
    const selectAllBtn        = document.getElementById('selectAllBtn');
    const deselectAllBtn      = document.getElementById('deselectAllBtn');
    const galleryGrid         = document.getElementById('galleryGrid');
    const selectionCount      = document.getElementById('selectionCount');
    const extractionProgress  = document.getElementById('extractionProgress');
    const progressFill        = document.getElementById('progressFill');
    const progressText        = document.getElementById('progressText');
    const imageModal          = document.getElementById('imageModal');
    const modalBackdrop       = document.getElementById('modalBackdrop');
    const modalClose          = document.getElementById('modalClose');
    const intervalBtns        = document.querySelectorAll('.interval-btn');
    const customIntervalRow   = document.getElementById('customIntervalRow');
    const customIntervalInput = document.getElementById('customIntervalInput');
    const includeTimestampCheck = document.getElementById('includeTimestampCheck');
    const stitchBtn             = document.getElementById('stitchBtn');
    const stitchLimitValue      = document.getElementById('stitchLimitValue');
    const statusTotalCount      = document.getElementById('statusTotalCount');
    const statusSelectedCount   = document.getElementById('statusSelectedCount');
    const headerFileBtn        = document.getElementById('headerFileBtn');
    const headerExtractBtn     = document.getElementById('headerExtractBtn');
    const headerStitchBtn      = document.getElementById('headerStitchBtn');
    const headerSaveZipBtn     = document.getElementById('headerSaveZipBtn');
    const reloadBtnEl          = document.querySelector('.reload-btn');
    const videoDropOverlay     = document.getElementById('videoDropOverlay');
    const frameCountValue      = document.getElementById('frameCountValue');

    // --- モジュール初期化 ---
    fileHandler.init();
    videoPlayer.init();
    timeRangeManager.init();

    const frameExtractor = new FrameExtractor(videoPlayer.getVideoElement());
    const imageGallery   = new ImageGallery(galleryGrid, selectionCount);
    const cropSelector   = new CropSelector(videoPlayer.getVideoElement());
    cropSelector.init();

    const playRangeButton = document.getElementById('playRangeButton');
    const videoEl = videoPlayer.getVideoElement();

    // --- 動画エリア長押しで新しいタブに開く（iOS: 共有シートから保存） ---
    // touchstart 時点で開いてユーザー操作と認識させ、短押しなら閉じる
    let longPressTimer = null;
    let longPressWindow = null;
    videoEl.addEventListener('touchstart', () => {
        if (!fileHandler.currentFile.fileURL) return;
        longPressWindow = window.open(fileHandler.currentFile.fileURL, '_blank');
        longPressTimer = setTimeout(() => {
            longPressWindow = null;
        }, 600);
    }, { passive: true });
    const cancelLongPress = () => {
        clearTimeout(longPressTimer);
        if (longPressWindow) { longPressWindow.close(); longPressWindow = null; }
    };
    videoEl.addEventListener('touchend',  cancelLongPress);
    videoEl.addEventListener('touchmove', cancelLongPress);

    function syncRangePlayBtn() {
        if (!playRangeButton) return;
        const playing = !videoEl.paused;
        playRangeButton.classList.toggle('is-playing', playing);
        playRangeButton.querySelector('span').textContent = playing ? '停止' : '範囲再生';
    }

    playRangeButton.addEventListener('click', async () => {
        if (!videoPlayer.isVideoLoaded()) return;
        if (!videoEl.paused) {
            videoPlayer.pauseVideo();
        } else {
            await timeRangeManager.playSelectedRange();
        }
    });

    videoEl.addEventListener('play',  syncRangePlayBtn);
    videoEl.addEventListener('pause', syncRangePlayBtn);
    videoEl.addEventListener('ended', syncRangePlayBtn);

    let currentVideoFileName = '';
    let selectedInterval = 0.2;
    let isExtracting = false;
    const MAX_STITCH_HEIGHT = 16384;
    let currentStitchLimit = 0;

    const CUSTOM_INTERVAL_KEY = 'mse_customInterval';

    // 保存済みカスタム値を復元
    const savedCustom = parseFloat(localStorage.getItem(CUSTOM_INTERVAL_KEY));
    if (!isNaN(savedCustom) && savedCustom >= 0.01) {
        customIntervalInput.value = savedCustom;
    }

    // --- 抽出間隔ボタン ---
    intervalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            intervalBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (btn.dataset.interval === 'custom') {
                const val = parseFloat(customIntervalInput.value);
                if (!isNaN(val) && val >= 0.01) selectedInterval = val;
            } else {
                selectedInterval = parseFloat(btn.dataset.interval);
            }
            updateFrameCount();
        });
    });

    customIntervalInput.addEventListener('input', () => {
        const val = parseFloat(customIntervalInput.value);
        if (!isNaN(val) && val >= 0.01) {
            selectedInterval = val;
            localStorage.setItem(CUSTOM_INTERVAL_KEY, String(val));
            updateFrameCount();
        }
    });

    // --- ファイル読み込み ---
    fileHandler.onFileSelected(async (fileInfo) => {
        currentVideoFileName = fileInfo.fileName;
        setStatus('動画を読み込んでいます...');
        await videoPlayer.loadVideoFile(fileInfo.fileURL, fileInfo.fileName);
    });

    fileHandler.onFileError((msg) => setStatus(`エラー: ${msg}`));

    // --- 動画読み込み完了 ---
    videoPlayer.onVideoLoaded((metadata) => {
        cropSelector.onVideoLoaded();
        timeRangeManager.onVideoLoaded(metadata.duration);
        durationDisp.textContent = formatTimeFromSeconds(metadata.duration);
        timeSlider.max = metadata.duration;
        timeSlider.value = 0;
        timeSlider.disabled = false;
        if (videoDropOverlay) videoDropOverlay.classList.add('hidden');
        if (metadata.height > 0) {
            currentStitchLimit = Math.floor(MAX_STITCH_HEIGHT / metadata.height);
            if (stitchLimitValue) stitchLimitValue.textContent = currentStitchLimit;
            imageGallery.setStitchLimit(currentStitchLimit);
        }
        updateExtractBtn();
        updateFrameCount();
        setStatus(`読み込み完了: ${currentVideoFileName}`);
    });

    videoPlayer.onVideoError((msg) => setStatus(`エラー: ${msg}`));

    // --- 時刻更新 ---
    videoPlayer.onTimeUpdate((currentTime) => {
        currentTimeDisp.textContent = formatTimeFromSeconds(currentTime);
        if (document.activeElement !== timeSlider) {
            timeSlider.value = currentTime;
        }
    });

    // --- タイムスライダー ---
    timeSlider.addEventListener('input', () => {
        videoPlayer.setCurrentTime(parseFloat(timeSlider.value));
    });

    // --- 範囲変更時に抽出ボタン状態・枚数更新 ---
    timeRangeManager.onRangeChanged(() => {
        updateExtractBtn();
        updateFrameCount();
    });

    // --- 範囲抽出ボタン ---
    extractBtn.addEventListener('click', async () => {
        if (isExtracting) {
            frameExtractor.cancel();
            return;
        }
        await startExtraction();
    });

    // --- 1枚抽出ボタン ---
    captureBtn.addEventListener('click', () => {
        if (!videoPlayer.isVideoLoaded() || isExtracting) return;
        const cropRect = cropSelector.getCropRect();
        const frame = frameExtractor.captureCurrentFrame(currentVideoFileName, cropRect);
        imageGallery.addFrame(frame);
        updateSaveButtons();
        const { total, selected } = imageGallery.getCounts();
        updateHeaderCounts(total, selected);
        setStatus(`1枚追加しました（${frame.timestamp}）`);
    });

    async function startExtraction() {
        const range = timeRangeManager.getRangeSettings();
        const { startTime, endTime } = range;

        if (selectedInterval < 0.01) {
            setStatus('抽出間隔を正しく設定してください');
            return;
        }

        const count = frameExtractor.calculateFrameCount(startTime, endTime, selectedInterval);

        if (count === 0) {
            setStatus('抽出できるフレームがありません。動画範囲を確認してください');
            return;
        }

        if (count > MAX_FRAMES) {
            setStatus(`抽出枚数が上限（${MAX_FRAMES}枚）を超えています（計算値: ${count}枚）`);
            return;
        }

        if (!confirm('実行しますか？')) return;

        isExtracting = true;
        captureBtn.disabled = true;
        extractBtn.querySelector('span').textContent = 'キャンセル';
        extractBtn.classList.add('btn-cancel');
        saveZipBtn.disabled = true;
        stitchBtn.disabled = true;
        extractionProgress.classList.remove('hidden');
        imageGallery.clear();
        updateProgress(0, count);
        setStatus(`フレームを抽出中... (0/${count}枚)`);

        try {
            await frameExtractor.extractRange(
                startTime, endTime, selectedInterval, currentVideoFileName,
                {
                    onFrame: (frame) => {
                        imageGallery.addFrame(frame);
                    },
                    onProgress: (current, total) => {
                        updateProgress(current, total);
                        setStatus(`フレームを抽出中... (${current}/${total}枚)`);
                    },
                    cropRect: cropSelector.getCropRect()
                }
            );

            imageGallery.selectAll();
            updateSaveButtons();
            const { total } = imageGallery.getCounts();

            // 実フレームの高さで上限を再計算（iOS回転補正ずれ対策）
            const firstFrames = imageGallery.getSelectedFrames();
            if (firstFrames.length > 0) {
                const img = await loadImage(firstFrames[0].dataUrl);
                const actualLimit = img.naturalHeight > 0
                    ? Math.floor(MAX_STITCH_HEIGHT / img.naturalHeight)
                    : currentStitchLimit;
                currentStitchLimit = actualLimit;
                if (stitchLimitValue) stitchLimitValue.textContent = actualLimit;
                imageGallery.setStitchLimit(actualLimit);
            }

            setStatus(`${total}枚のフレームを抽出しました`);

        } catch (e) {
            logError('抽出エラー', e);
            setStatus('抽出中にエラーが発生しました');
        } finally {
            isExtracting = false;
            captureBtn.disabled = false;
            extractBtn.querySelector('span').textContent = '範囲抽出';
            extractBtn.classList.remove('btn-cancel');
            extractionProgress.classList.add('hidden');
            updateSaveButtons();
        }
    }

    // --- 保存前処理（タイムスタンプ焼き込み）---
    async function prepareFramesForExport(frames) {
        if (!includeTimestampCheck || !includeTimestampCheck.checked) return frames;
        return Promise.all(frames.map(f => ZipExporter.burnTimestamp(f)));
    }

    // --- 保存ボタン ---
    saveZipBtn.addEventListener('click', async () => {
        const frames = imageGallery.getSelectedFrames();
        if (frames.length === 0) {
            setStatus('保存する画像が選択されていません');
            return;
        }
        setStatus(`ZIPファイルを作成中... (${frames.length}枚)`);
        const prepared = await prepareFramesForExport(frames);
        await ZipExporter.saveAsZip(prepared, currentVideoFileName);
        setStatus(`ZIP保存完了 (${frames.length}枚)`);
    });

    // --- 縦結合ボタン ---
    stitchBtn.addEventListener('click', async () => {
        const frames = imageGallery.getSelectedFrames();
        if (frames.length === 0) {
            setStatus('結合する画像が選択されていません');
            return;
        }
        stitchBtn.disabled = true;
        try {
            await stitchVertically(frames);
        } finally {
            updateSaveButtons();
        }
    });

    async function stitchVertically(frames) {
        const firstImg = await loadImage(frames[0].dataUrl);
        const frameW = firstImg.naturalWidth;
        const frameH = firstImg.naturalHeight;
        const maxCount = frameH > 0 ? Math.floor(MAX_STITCH_HEIGHT / frameH) : frames.length;

        const chunks = [];
        for (let i = 0; i < frames.length; i += maxCount) {
            chunks.push(frames.slice(i, i + maxCount));
        }

        const baseName = getFileNameWithoutExtension(currentVideoFileName) || 'frames';
        const blobs = [];

        for (let c = 0; c < chunks.length; c++) {
            const chunk = chunks[c];
            const canvas = document.createElement('canvas');
            canvas.width = frameW;
            canvas.height = frameH * chunk.length;
            const ctx = canvas.getContext('2d');

            for (let i = 0; i < chunk.length; i++) {
                const img = (c === 0 && i === 0) ? firstImg : await loadImage(chunk[i].dataUrl);
                ctx.drawImage(img, 0, i * frameH);
                setStatus(`縦結合中... (${c + 1}/${chunks.length}ファイル目、${i + 1}/${chunk.length}枚)`);
            }

            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
            });
            blobs.push(blob);
        }

        if (blobs.length === 1) {
            saveAs(blobs[0], `${baseName}_stitched.jpg`);
            setStatus(`縦結合画像を保存しました（計${frames.length}枚）`);
        } else {
            const zip = new JSZip();
            blobs.forEach((blob, i) => {
                zip.file(`${baseName}_stitched_${i + 1}.jpg`, blob);
            });
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `${baseName}_stitched.zip`);
            setStatus(`縦結合画像をZIPで保存しました（${blobs.length}ファイル、計${frames.length}枚）`);
        }
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // --- ギャラリー選択ボタン ---
    selectAllBtn.addEventListener('click', () => {
        imageGallery.selectAll();
        updateSaveButtons();
    });

    deselectAllBtn.addEventListener('click', () => {
        imageGallery.deselectAll();
        updateSaveButtons();
    });

    imageGallery.onSelectionChange(({ total, selected }) => {
        updateHeaderCounts(total, selected);
        if (!isExtracting) {
            saveZipBtn.disabled = selected === 0;
            stitchBtn.disabled = selected === 0;
        }
    });

    // --- モーダル ---
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', () => imageModal.classList.add('hidden'));
    }
    if (modalClose) {
        modalClose.addEventListener('click', () => imageModal.classList.add('hidden'));
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') imageModal.classList.add('hidden');
    });

    // --- スペースキーで再生/停止 ---
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') {
            e.preventDefault();
            if (videoPlayer.isVideoLoaded()) {
                const v = videoPlayer.getVideoElement();
                v.paused ? videoPlayer.playVideo() : videoPlayer.pauseVideo();
            }
        }
    });

    // --- ヘッダーボタン ---
    headerFileBtn.addEventListener('click', () => fileHandler.openFileDialog());
    // クリックをサイドバーの元ボタンに委譲
    headerExtractBtn.addEventListener('click', () => extractBtn.click());
    headerStitchBtn.addEventListener('click', () => stitchBtn.click());
    headerSaveZipBtn.addEventListener('click', async () => {
        const { file, fileName } = fileHandler.currentFile;
        if (!file) return;
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: fileName });
            } catch (e) {
                if (e.name !== 'AbortError') setStatus('共有に失敗しました');
            }
        } else {
            // フォールバック: ダウンロード
            const a = document.createElement('a');
            a.href = fileHandler.currentFile.fileURL;
            a.download = fileName || 'video';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        setStatus('元動画を再保存する（範囲・クロップは未適用）');
    });

    // disabled / is-cancel 状態を元ボタンから同期
    function syncHeaderBtn(source, mirror) {
        mirror.disabled = source.disabled;
        new MutationObserver(() => {
            mirror.disabled = source.disabled;
            mirror.classList.toggle('is-cancel', source.classList.contains('btn-cancel'));
        }).observe(source, { attributes: true, attributeFilter: ['disabled', 'class'] });
    }
    syncHeaderBtn(extractBtn, headerExtractBtn);
    syncHeaderBtn(stitchBtn, headerStitchBtn);

    // フッタートゥールチップ（マウスオーバー時に説明を表示）
    let savedStatus = '';
    const tooltips = [
        [headerFileBtn,    '動画ファイルを選択します', null],
        [headerExtractBtn, '範囲抽出: 設定した間隔でフレームを抽出します', 'キャンセル: 抽出を中断します'],
        [headerStitchBtn,  '縦結合: 選択中の画像を縦に並べて保存します', null],
        [headerSaveZipBtn, '元動画を再保存する（範囲・クロップは未適用）', null],
        [reloadBtnEl,      'リロード: アプリをリセットします（抽出データが消えます）', null],
    ];
    tooltips.forEach(([btn, desc, cancelDesc]) => {
        btn.addEventListener('mouseenter', () => {
            savedStatus = statusText.textContent;
            statusText.textContent = (cancelDesc && isExtracting) ? cancelDesc : desc;
        });
        btn.addEventListener('mouseleave', () => {
            statusText.textContent = savedStatus;
        });
    });

    // --- ヘルパー ---
    function updateFrameCount() {
        if (!videoPlayer.isVideoLoaded()) return;
        const { startTime, endTime } = timeRangeManager.getRangeSettings();
        const count = frameExtractor.calculateFrameCount(startTime, endTime, selectedInterval);
        if (count > 0) {
            setStatus(`抽出間隔 ${selectedInterval}秒 → 換算 ${count}枚`);
        }
    }

    function updateExtractBtn() {
        const loaded = videoPlayer.isVideoLoaded();
        captureBtn.disabled = !loaded || isExtracting;
        headerSaveZipBtn.disabled = !loaded;
        if (!loaded) {
            extractBtn.disabled = true;
            return;
        }
        const range = timeRangeManager.getRangeSettings();
        const valid = range.endTime > range.startTime;
        extractBtn.disabled = !valid || isExtracting;
    }

    function updateSaveButtons() {
        const { selected } = imageGallery.getCounts();
        saveZipBtn.disabled = selected === 0;
        stitchBtn.disabled = selected === 0;
    }

    function updateHeaderCounts(total, selected) {
        if (statusTotalCount)    statusTotalCount.textContent    = total > 0 ? total    : '--';
        if (statusSelectedCount) {
            statusSelectedCount.textContent = total > 0 ? selected : '--';
            const overLimit = currentStitchLimit > 0 && selected > currentStitchLimit;
            statusSelectedCount.style.color = overLimit ? '#e67e22' : '';
        }
    }

    function updateProgress(current, total) {
        const pct = total > 0 ? (current / total) * 100 : 0;
        progressFill.style.width = `${pct}%`;
        progressText.textContent = total > 0 ? `${current} / ${total} 枚` : '';
    }

    function setStatus(message) {
        if (statusText) statusText.textContent = message;
    }

    logInfo('MovieSnapEditor: 初期化完了');
});
