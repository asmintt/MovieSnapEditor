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
    const headerExtractBtn     = document.getElementById('headerExtractBtn');
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

    let currentVideoFileName = '';
    let selectedInterval = 0.2;
    let isExtracting = false;

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
                customIntervalRow.classList.remove('hidden');
                const val = parseFloat(customIntervalInput.value);
                if (!isNaN(val) && val >= 0.01) selectedInterval = val;
            } else {
                customIntervalRow.classList.add('hidden');
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
        timeRangeManager.onVideoLoaded(metadata.duration);
        durationDisp.textContent = formatTimeFromSeconds(metadata.duration);
        timeSlider.max = metadata.duration;
        timeSlider.value = 0;
        timeSlider.disabled = false;
        if (videoDropOverlay) videoDropOverlay.classList.add('hidden');
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

        if (!confirm('実行しますか？')) return;

        isExtracting = true;
        extractBtn.textContent = 'キャンセル';
        extractBtn.classList.add('btn-cancel');
        saveZipBtn.disabled = true;
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
            saveZipBtn.disabled = selected === 0;
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
    // クリックをサイドバーの元ボタンに委譲
    headerExtractBtn.addEventListener('click', () => extractBtn.click());
    headerSaveZipBtn.addEventListener('click', () => saveZipBtn.click());

    // disabled / is-cancel 状態を元ボタンから同期
    function syncHeaderBtn(source, mirror) {
        mirror.disabled = source.disabled;
        new MutationObserver(() => {
            mirror.disabled = source.disabled;
            mirror.classList.toggle('is-cancel', source.classList.contains('btn-cancel'));
        }).observe(source, { attributes: true, attributeFilter: ['disabled', 'class'] });
    }
    syncHeaderBtn(extractBtn, headerExtractBtn);
    syncHeaderBtn(saveZipBtn, headerSaveZipBtn);

    // フッタートゥールチップ（マウスオーバー時に説明を表示）
    let savedStatus = '';
    const tooltips = [
        [headerExtractBtn, '抽出: 設定した間隔でフレームを抽出します', 'キャンセル: 抽出を中断します'],
        [headerSaveZipBtn, '一括保存: 選択中の画像をZIPでダウンロードします', null],
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
        if (!frameCountValue) return;
        if (!videoPlayer.isVideoLoaded()) {
            frameCountValue.textContent = '--';
            return;
        }
        const { startTime, endTime } = timeRangeManager.getRangeSettings();
        const count = frameExtractor.calculateFrameCount(startTime, endTime, selectedInterval);
        frameCountValue.textContent = count > 0 ? count : '--';
    }

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
        saveZipBtn.disabled = selected === 0;
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
