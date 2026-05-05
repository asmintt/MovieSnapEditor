/**
 * videoPlayer.js - 動画再生・制御機能
 */

class VideoPlayer {
    constructor() {
        this.videoElement = null;
        this.playButton = null;
        this.pauseButton = null;
        this.resetButton = null;

        this.videoMetadata = {
            duration: 0,
            currentTime: 0,
            width: 0,
            height: 0,
            isLoaded: false
        };

        this.onVideoLoadedCallback = null;
        this.onTimeUpdateCallback = null;
        this.onVideoErrorCallback = null;

        this.currentObjectUrl = null;
        this.isLoadingVideo = false;
        this.loadingContext = null;
        this.rangePlaybackInterval = null;
    }

    init() {
        logDebug('VideoPlayer: 初期化を開始');
        try {
            this.getDOMElements();
            this.setupEventListeners();
            this.setupPlaybackButtons();
            logInfo('VideoPlayer: 初期化完了');
        } catch (error) {
            logError('VideoPlayer: 初期化エラー', error);
        }
    }

    getDOMElements() {
        this.videoElement = getElementSafely('videoPlayer');
        if (!this.videoElement) {
            throw new Error('video要素が見つかりません');
        }
    }

    setupEventListeners() {
        if (!this.videoElement) return;

        this.videoElement.addEventListener('loadedmetadata', () => {
            this.handleVideoLoaded();
        });

        this.videoElement.addEventListener('timeupdate', () => {
            this.handleTimeUpdate();
        });

        this.videoElement.addEventListener('error', (event) => {
            this.handleVideoError(event);
        });

        this.videoElement.addEventListener('loadstart', () => {
            logDebug('VideoPlayer: 動画読み込み開始');
        });

        this.videoElement.addEventListener('canplaythrough', () => {
            logDebug('VideoPlayer: 動画再生可能');
        });
    }

    setupPlaybackButtons() {
        this.playButton = getElementSafely('playButton');
        this.pauseButton = getElementSafely('pauseButton');
        this.resetButton = getElementSafely('resetButton');

        if (this.playButton) {
            this.playButton.addEventListener('click', () => this.playVideo());
        }
        if (this.pauseButton) {
            this.pauseButton.addEventListener('click', () => this.pauseVideo());
        }
        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => this.resetVideo());
        }

        logDebug('VideoPlayer: 再生ボタン設定完了');
    }

    async loadVideoFile(videoURL, fileName = '') {
        if (this.isLoadingVideo) {
            logDebug('VideoPlayer: 読み込み中のためスキップ');
            return;
        }

        this.isLoadingVideo = true;
        const loadingId = Date.now();
        this.loadingContext = loadingId;

        try {
            this.cleanup();
            this.currentObjectUrl = videoURL;
            this.videoElement.src = videoURL;

            await this.waitForVideoLoad();

            if (this.loadingContext === loadingId) {
                logInfo('VideoPlayer: 動画読み込み完了', { fileName });
            }

        } catch (error) {
            if (this.loadingContext === loadingId) {
                logError('VideoPlayer: 動画読み込みエラー', error);
                this.handleError('動画ファイルの読み込みに失敗しました');
            }
        } finally {
            if (this.loadingContext === loadingId) {
                this.isLoadingVideo = false;
            }
        }
    }

    waitForVideoLoad() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('動画読み込みタイムアウト'));
            }, 30000);

            const onLoaded = () => {
                clearTimeout(timeout);
                this.videoElement.removeEventListener('loadedmetadata', onLoaded);
                this.videoElement.removeEventListener('error', onError);
                resolve();
            };

            const onError = () => {
                clearTimeout(timeout);
                this.videoElement.removeEventListener('loadedmetadata', onLoaded);
                this.videoElement.removeEventListener('error', onError);
                reject(new Error('動画読み込みエラー'));
            };

            this.videoElement.addEventListener('loadedmetadata', onLoaded);
            this.videoElement.addEventListener('error', onError);
        });
    }

    handleVideoLoaded() {
        try {
            this.updateVideoMetadata();
            this.videoMetadata.isLoaded = true;
            this.enableVideoControls();

            if (this.onVideoLoadedCallback) {
                this.onVideoLoadedCallback(this.videoMetadata);
            }

            logDebug('VideoPlayer: 動画読み込み処理完了', this.videoMetadata);
        } catch (error) {
            logError('VideoPlayer: 動画読み込み処理エラー', error);
        }
    }

    updateVideoMetadata() {
        if (!this.videoElement) return;
        this.videoMetadata = {
            duration: this.videoElement.duration || 0,
            currentTime: this.videoElement.currentTime || 0,
            width: this.videoElement.videoWidth || 0,
            height: this.videoElement.videoHeight || 0,
            isLoaded: true
        };
    }

    handleTimeUpdate() {
        if (!this.videoElement) return;
        this.videoMetadata.currentTime = this.videoElement.currentTime;
        if (this.onTimeUpdateCallback) {
            this.onTimeUpdateCallback(this.videoMetadata.currentTime);
        }
    }

    handleVideoError(event) {
        const error = this.videoElement.error;
        let errorMessage = '動画の再生でエラーが発生しました';
        if (error) {
            switch (error.code) {
                case error.MEDIA_ERR_ABORTED:      errorMessage = '動画の読み込みが中断されました'; break;
                case error.MEDIA_ERR_NETWORK:      errorMessage = 'ネットワークエラーが発生しました'; break;
                case error.MEDIA_ERR_DECODE:       errorMessage = '動画のデコードエラーが発生しました'; break;
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMessage = 'この動画形式はサポートされていません'; break;
            }
        }
        logError('VideoPlayer: 動画エラー', { code: error?.code, message: errorMessage });
        this.handleError(errorMessage);
    }

    async playVideo() {
        if (!this.videoElement || !this.videoMetadata.isLoaded) return false;
        try {
            await this.videoElement.play();
            logDebug('VideoPlayer: 再生開始');
            return true;
        } catch (error) {
            logError('VideoPlayer: 再生エラー', error);
            return false;
        }
    }

    pauseVideo() {
        if (!this.videoElement || !this.videoMetadata.isLoaded) return false;
        this.videoElement.pause();
        logDebug('VideoPlayer: 一時停止');
        return true;
    }

    resetVideo() {
        if (!this.videoElement || !this.videoMetadata.isLoaded) return false;
        let startTime = 0;
        if (typeof timeRangeManager !== 'undefined' && typeof timeRangeManager.getStartTime === 'function') {
            startTime = timeRangeManager.getStartTime();
        }
        this.videoElement.currentTime = startTime;
        logDebug('VideoPlayer: 開始時刻に戻す', startTime);
        return true;
    }

    async play() { return this.playVideo(); }
    pause() { return this.pauseVideo(); }

    async playRange(startTime, endTime) {
        if (!this.videoMetadata.isLoaded) return false;
        try {
            if (this.rangePlaybackInterval) {
                clearInterval(this.rangePlaybackInterval);
                this.rangePlaybackInterval = null;
            }
            this.setCurrentTime(startTime);
            await this.playVideo();
            this.monitorRangePlayback(endTime);
            logDebug('VideoPlayer: 範囲再生開始', {
                開始: formatTimeFromSeconds(startTime),
                終了: formatTimeFromSeconds(endTime)
            });
            return true;
        } catch (error) {
            logError('VideoPlayer: 範囲再生エラー', error);
            return false;
        }
    }

    monitorRangePlayback(endTime) {
        this.rangePlaybackInterval = setInterval(() => {
            if (this.getCurrentTime() >= endTime) {
                this.pauseVideo();
                clearInterval(this.rangePlaybackInterval);
                this.rangePlaybackInterval = null;
                logDebug('VideoPlayer: 範囲再生終了');
            }
        }, 100);
    }

    enableVideoControls() {
        if (this.playButton) this.playButton.disabled = false;
        if (this.pauseButton) this.pauseButton.disabled = false;
        if (this.resetButton) this.resetButton.disabled = false;
        logDebug('VideoPlayer: 再生ボタンを有効化');
    }

    disableVideoControls() {
        if (this.playButton) this.playButton.disabled = true;
        if (this.pauseButton) this.pauseButton.disabled = true;
        if (this.resetButton) this.resetButton.disabled = true;
    }

    setCurrentTime(seconds) {
        if (!this.videoElement || !this.videoMetadata.isLoaded) return;
        const clamped = Math.max(0, Math.min(seconds, this.videoMetadata.duration));
        this.videoElement.currentTime = clamped;
    }

    getCurrentTime() {
        return this.videoElement ? this.videoElement.currentTime : 0;
    }

    getDuration() {
        return this.videoMetadata.duration;
    }

    getMetadata() {
        return { ...this.videoMetadata };
    }

    isVideoLoaded() {
        return this.videoMetadata.isLoaded;
    }

    getVideoElement() {
        return this.videoElement;
    }

    onVideoLoaded(callback) {
        this.onVideoLoadedCallback = callback;
    }

    onTimeUpdate(callback) {
        this.onTimeUpdateCallback = callback;
    }

    onVideoError(callback) {
        this.onVideoErrorCallback = callback;
    }

    cleanup() {
        if (this.rangePlaybackInterval) {
            clearInterval(this.rangePlaybackInterval);
            this.rangePlaybackInterval = null;
        }
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
        }
        this.currentObjectUrl = null;
        this.videoMetadata = {
            duration: 0,
            currentTime: 0,
            width: 0,
            height: 0,
            isLoaded: false
        };
        this.disableVideoControls();
    }

    handleError(message) {
        logError('VideoPlayer: エラー発生', message);
        if (this.onVideoErrorCallback) {
            this.onVideoErrorCallback(message);
        }
    }

    destroy() {
        this.cleanup();
        this.isLoadingVideo = false;
        this.loadingContext = null;
    }
}

const videoPlayer = new VideoPlayer();

console.log('✅ videoPlayer.js: 読み込み完了');
