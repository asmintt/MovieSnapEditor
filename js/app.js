/**
 * app.js - メインコントローラー
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM要素 ---
    const statusText       = document.getElementById('statusText');
    const timeSlider       = document.getElementById('timeSlider');
    const currentTimeDisp  = document.getElementById('currentTimeDisplay');
    const durationDisp     = document.getElementById('durationDisplay');
    const extractBtn       = document.getElementById('extractBtn');
    const saveZipBtn       = document.getElementById('saveZipBtn');
    const saveBulkBtn      = document.getElementById('saveBulkBtn');
    const selectAllBtn     = document.getElementById('selectAllBtn');
    const deselectAllBtn   = document.getElementById('deselectAllBtn');
    const galleryGrid      = document.getElementById('galleryGrid');
    const selectionCount   = document.getElementById('selectionCount');
    const extractionProgress = document.getElementById('extractionProgress');
    const progressFill     = document.getElementById('progressFill');
    const progressText     = document.getElementById('progressText');
    const imageModal       = document.getElementById('imageModal');
    const modalBackdrop    = document.getElementById('modalBackdrop');
    const modalClose       = document.getElementById('modalClose');
    const intervalBtns     = document.querySelectorAll('.interval-btn');
    const customIntervalRow = document.getElementById('customIntervalRow');
    const customIntervalInput = document.getElementById('customIntervalInput');
    const tabBtns          = document.querySelectorAll('.tab-btn');
    const tabPanels        = document.querySelectorAll('.tab-panel');

    // 動画出力
    const slideIntervalBtns       = document.querySelectorAll('.slide-interval-btn');
    const customSlideIntervalRow  = document.getElementById('customSlideIntervalRow');
    const customSlideIntervalInput = document.getElementById('customSlideIntervalInput');
    const exportVideoBtn          = document.getElementById('exportVideoBtn');
    const videoExportProgress     = document.getElementById('videoExportProgress');
    const videoProgressFill       = document.getElementById('videoProgressFill');
    const videoProgressText       = document.getElementById('videoProgressText');

    // --- モジュール初期化 ---
    fileHandler.init();
    videoPlayer.init();
    timeRangeManager.init();

    const frameExtractor = new FrameExtractor(videoPlayer.getVideoElement());
    const imageGallery   = new ImageGallery(galleryGrid, selectionCount);

    let currentVideoFileName = '';
    let selectedInterval = 0.1;
    let selectedSlideInterval = 3;
    let isExportingVideo = false;
    let isExtracting = false;

    // --- タブ切り替え ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabPanels.forEach(p => p.classList.add('hidden'));
            document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
        });
    });

    // --- 抽出間隔ボタン ---
    intervalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            intervalBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (btn.dataset.interval === 'custom') {
                customIntervalRow.classList.remove('hidden');
                const val = parseFloat(customIntervalInput.value);
                if (!isNaN(val) && val >= 0.01) selectedInterval = val;
            } else {
                customIntervalRow.classList.add('hidden');
                selectedInterval = parseFloat(btn.dataset.interval);
            }
        });
    });

    customIntervalInput.addEventListener('input', () => {
        const val = parseFloat(customIntervalInput.value);
        if (!isNaN(val) && val >= 0.01) selectedInterval = val;
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
        timeRangeManager.onVideoLoaded(metadata.duration);
        durationDisp.textContent = formatTimeFromSeconds(metadata.duration);
        timeSlider.max = metadata.duration;
        timeSlider.value = 0;
        timeSlider.disabled = false;
        updateExtractBtn();
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

    // --- 範囲変更時に抽出ボタン状態更新 ---
    timeRangeManager.onRangeChanged(() => updateExtractBtn());

    // --- 抽出ボタン ---
    extractBtn.addEventListener('click', async () => {
        if (isExtracting) {
            frameExtractor.cancel();
            return;
        }
        await startExtraction();
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

        if (count >= WARN_FRAMES) {
            if (!confirm(`${count}枚のフレームを抽出します。続けますか？`)) return;
        }

        // 抽出開始
        isExtracting = true;
        extractBtn.textContent = 'キャンセル';
        extractBtn.classList.add('btn-cancel');
        saveZipBtn.disabled = true;
        saveBulkBtn.disabled = true;
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
                    }
                }
            );

            imageGallery.selectAll();
            updateSaveButtons();
            const { total } = imageGallery.getCounts();
            setStatus(`${total}枚のフレームを抽出しました`);

        } catch (e) {
            logError('抽出エラー', e);
            setStatus('抽出中にエラーが発生しました');
        } finally {
            isExtracting = false;
            extractBtn.textContent = '抽出';
            extractBtn.classList.remove('btn-cancel');
            extractionProgress.classList.add('hidden');
        }
    }

    // --- 保存ボタン ---
    saveZipBtn.addEventListener('click', async () => {
        const frames = imageGallery.getSelectedFrames();
        if (frames.length === 0) {
            setStatus('保存する画像が選択されていません');
            return;
        }
        setStatus(`ZIPファイルを作成中... (${frames.length}枚)`);
        await ZipExporter.saveAsZip(frames, currentVideoFileName);
        setStatus(`ZIP保存完了 (${frames.length}枚)`);
    });

    saveBulkBtn.addEventListener('click', async () => {
        const frames = imageGallery.getSelectedFrames();
        if (frames.length === 0) {
            setStatus('保存する画像が選択されていません');
            return;
        }
        setStatus(`${frames.length}枚をダウンロード中...`);
        await ZipExporter.saveAllIndividual(frames);
        setStatus(`一括保存完了 (${frames.length}枚)`);
    });

    // --- ギャラリー選択ボタン ---
    selectAllBtn.addEventListener('click', () => {
        imageGallery.selectAll();
        updateSaveButtons();
    });

    deselectAllBtn.addEventListener('click', () => {
        imageGallery.deselectAll();
        updateSaveButtons();
    });

    imageGallery.onSelectionChange(({ selected }) => {
        if (!isExtracting) {
            saveZipBtn.disabled     = selected === 0;
            saveBulkBtn.disabled    = selected === 0;
            exportVideoBtn.disabled = selected === 0;
        }
    });

    // --- 表示間隔ボタン（動画出力）---
    slideIntervalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            slideIntervalBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.interval === 'custom') {
                customSlideIntervalRow.classList.remove('hidden');
                const val = parseFloat(customSlideIntervalInput.value);
                if (!isNaN(val) && val >= 0.1) selectedSlideInterval = val;
            } else {
                customSlideIntervalRow.classList.add('hidden');
                selectedSlideInterval = parseFloat(btn.dataset.interval);
            }
        });
    });

    customSlideIntervalInput.addEventListener('input', () => {
        const val = parseFloat(customSlideIntervalInput.value);
        if (!isNaN(val) && val >= 0.1) selectedSlideInterval = val;
    });

    // --- 動画出力ボタン ---
    exportVideoBtn.addEventListener('click', async () => {
        const frames = imageGallery.getSelectedFrames();
        if (frames.length === 0) {
            setStatus('動画にする画像が選択されていません');
            return;
        }
        if (selectedSlideInterval < 0.1) {
            setStatus('表示間隔を正しく設定してください');
            return;
        }

        isExportingVideo = true;
        exportVideoBtn.disabled = true;
        exportVideoBtn.textContent = '出力中...';
        videoExportProgress.classList.remove('hidden');
        updateVideoProgress(0, frames.length);
        setStatus(`動画を出力中... (0/${frames.length}枚)`);

        try {
            await VideoExporter.export(frames, selectedSlideInterval, currentVideoFileName, {
                onProgress: (current, total) => {
                    updateVideoProgress(current, total);
                    setStatus(`動画を出力中... (${current}/${total}枚)`);
                }
            });
            setStatus(`動画の出力が完了しました (${frames.length}枚 × ${selectedSlideInterval}秒)`);
        } catch (e) {
            logError('動画出力エラー', e);
            setStatus('動画の出力中にエラーが発生しました');
        } finally {
            isExportingVideo = false;
            exportVideoBtn.disabled = frames.length === 0;
            exportVideoBtn.textContent = '動画を出力する';
            videoExportProgress.classList.add('hidden');
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

    // --- ヘルパー ---
    function updateExtractBtn() {
        if (!videoPlayer.isVideoLoaded()) {
            extractBtn.disabled = true;
            return;
        }
        const range = timeRangeManager.getRangeSettings();
        const valid = range.endTime > range.startTime;
        extractBtn.disabled = !valid || isExtracting;
    }

    function updateSaveButtons() {
        const { selected } = imageGallery.getCounts();
        saveZipBtn.disabled     = selected === 0;
        saveBulkBtn.disabled    = selected === 0;
        exportVideoBtn.disabled = selected === 0;
    }

    function updateVideoProgress(current, total) {
        const pct = total > 0 ? (current / total) * 100 : 0;
        videoProgressFill.style.width = `${pct}%`;
        videoProgressText.textContent = total > 0 ? `${current} / ${total} 枚` : '';
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
