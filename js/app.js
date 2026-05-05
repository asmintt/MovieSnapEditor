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

    // --- モジュール初期化 ---
    fileHandler.init();
    videoPlayer.init();
    timeRangeManager.init();

    const frameExtractor = new FrameExtractor(videoPlayer.getVideoElement());
    const imageGallery   = new ImageGallery(galleryGrid, selectionCount);

    let currentVideoFileName = '';
    let selectedInterval = 0.1;
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
            saveZipBtn.disabled  = selected === 0;
            saveBulkBtn.disabled = selected === 0;
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
        saveZipBtn.disabled  = selected === 0;
        saveBulkBtn.disabled = selected === 0;
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
