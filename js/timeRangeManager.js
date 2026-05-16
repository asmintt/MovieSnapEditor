/**
 * timeRangeManager.js - 時刻入力方式の範囲選択機能（Web版）
 */

class TimeRangeManager {
    constructor() {
        this.startTimeInput = null;
        this.endTimeInput = null;
        this.setStartTimeButton = null;
        this.setEndTimeButton = null;
        this.rangeDisplay = null;
        this.playRangeButton = null;
        this.includeAudioCheckbox = null;

        this.rangeSettings = {
            startTime: 0,
            endTime: 0,
            videoDuration: 0,
            includeAudio: true
        };

        this.onRangeChangedCallback = null;
    }

    init() {
        logDebug('TimeRangeManager: 初期化を開始');
        try {
            this.getDOMElements();
            this.setupEventListeners();
            this.setInitialState();
            logDebug('TimeRangeManager: 初期化完了');
        } catch (error) {
            logError('TimeRangeManager: 初期化に失敗', error);
        }
    }

    getDOMElements() {
        this.startTimeInput = getElementSafely('startTimeInput');
        this.endTimeInput = getElementSafely('endTimeInput');
        this.setStartTimeButton = getElementSafely('setStartTimeButton');
        this.setEndTimeButton = getElementSafely('setEndTimeButton');
        this.rangeDisplay = getElementSafely('rangeDisplay');
        this.playRangeButton = getElementSafely('playRangeButton');
        this.timeSlider = document.getElementById('timeSlider');
        // Web版HTMLには includeAudioCheckbox が存在しない場合がある
        this.includeAudioCheckbox = document.getElementById('includeAudioCheckbox') || null;
    }

    setupEventListeners() {
        if (this.startTimeInput) {
            this.startTimeInput.addEventListener('input', () => {
                this.handleTimeInputChange('start');
            });
            this.startTimeInput.addEventListener('blur', () => {
                this.validateAndFormatTimeInput('start');
            });
        }

        if (this.endTimeInput) {
            this.endTimeInput.addEventListener('input', () => {
                this.handleTimeInputChange('end');
            });
            this.endTimeInput.addEventListener('blur', () => {
                this.validateAndFormatTimeInput('end');
            });
        }

        if (this.setStartTimeButton) {
            this.setStartTimeButton.addEventListener('click', () => {
                this.setCurrentTimeToInput('start');
            });
        }

        if (this.setEndTimeButton) {
            this.setEndTimeButton.addEventListener('click', () => {
                this.setCurrentTimeToInput('end');
            });
        }

        if (this.includeAudioCheckbox) {
            this.includeAudioCheckbox.addEventListener('change', () => {
                this.handleAudioSettingChange();
            });
        }
    }

    setInitialState() {
        this.setControlsEnabled(false);
        this.updateTimeInputs();
        this.updateRangeDisplay();
    }

    onVideoLoaded(videoDuration, fromProject = false) {
        logDebug('TimeRangeManager: 動画読み込み完了', formatTimeFromSeconds(videoDuration));
        this.rangeSettings.videoDuration = videoDuration;

        if (!fromProject) {
            this.rangeSettings.startTime = 0;
            this.rangeSettings.endTime = videoDuration;
        }

        this.updateTimeInputs();
        this.updateRangeDisplay();
        this.updateSliderMarkers();
        this.setControlsEnabled(true);
    }

    handleTimeInputChange(inputType) {
        const inputElement = inputType === 'start' ? this.startTimeInput : this.endTimeInput;
        if (!inputElement) return;

        const timeInSeconds = parseTimeStringToSeconds(inputElement.value);

        if (inputType === 'start') {
            this.rangeSettings.startTime = timeInSeconds;
        } else {
            this.rangeSettings.endTime = timeInSeconds;
        }

        this.updateRangeDisplay();
        this.notifyRangeChanged();
    }

    validateAndFormatTimeInput(inputType) {
        const inputElement = inputType === 'start' ? this.startTimeInput : this.endTimeInput;
        if (!inputElement) return;

        const timeInSeconds = parseTimeStringToSeconds(inputElement.value);

        if (timeInSeconds > this.rangeSettings.videoDuration) {
            const clamped = this.rangeSettings.videoDuration;
            inputElement.value = formatTimeFromSeconds(clamped);
            if (inputType === 'start') {
                this.rangeSettings.startTime = clamped;
            } else {
                this.rangeSettings.endTime = clamped;
            }
        } else {
            inputElement.value = formatTimeFromSeconds(timeInSeconds);
        }

        this.validateTimeRange();
    }

    setCurrentTimeToInput(inputType) {
        if (!videoPlayer.isVideoLoaded()) return;

        const currentTime = videoPlayer.getCurrentTime();
        const formattedTime = formatTimeFromSeconds(currentTime);
        const inputElement = inputType === 'start' ? this.startTimeInput : this.endTimeInput;
        if (inputElement) inputElement.value = formattedTime;

        if (inputType === 'start') {
            this.rangeSettings.startTime = currentTime;
        } else {
            this.rangeSettings.endTime = currentTime;
        }

        this.updateRangeDisplay();
        this.notifyRangeChanged();
    }

    updateTimeInputs() {
        const hasVideo = this.rangeSettings.videoDuration > 0;
        if (this.startTimeInput) {
            this.startTimeInput.value = hasVideo ? formatTimeFromSeconds(this.rangeSettings.startTime) : '';
        }
        if (this.endTimeInput) {
            this.endTimeInput.value = hasVideo ? formatTimeFromSeconds(this.rangeSettings.endTime) : '';
        }
    }

    updateRangeDisplay() {
        if (!this.rangeDisplay) return;
        const duration = this.rangeSettings.endTime - this.rangeSettings.startTime;
        if (duration > 0) {
            this.rangeDisplay.textContent = formatTimeFromSeconds(duration);
            this.rangeDisplay.style.color = '#2980b9';
        } else {
            this.rangeDisplay.textContent = '--';
            this.rangeDisplay.style.color = '#e74c3c';
        }
    }

    validateTimeRange() {
        const validation = validateTimeRange(
            this.rangeSettings.startTime,
            this.rangeSettings.endTime,
            this.rangeSettings.videoDuration
        );

        if (!validation.isValid) {
            if (this.rangeDisplay) {
                this.rangeDisplay.textContent = 'エラー';
                this.rangeDisplay.style.color = '#e74c3c';
            }
            return false;
        }

        return true;
    }

    async playSelectedRange() {
        if (!videoPlayer.isVideoLoaded()) return;
        if (!this.validateTimeRange()) return;

        await videoPlayer.playRange(
            this.rangeSettings.startTime,
            this.rangeSettings.endTime
        );
    }

    resetToFullRange() {
        if (this.rangeSettings.videoDuration <= 0) return;

        this.rangeSettings.startTime = 0;
        this.rangeSettings.endTime = this.rangeSettings.videoDuration;

        this.updateTimeInputs();
        this.updateRangeDisplay();
        this.notifyRangeChanged();
    }

    handleAudioSettingChange() {
        if (!this.includeAudioCheckbox) return;
        this.rangeSettings.includeAudio = this.includeAudioCheckbox.checked;
        this.notifyRangeChanged();
    }

    setControlsEnabled(enabled) {
        const controlIds = [
            'startTimeInput', 'endTimeInput',
            'setStartTimeButton', 'setEndTimeButton',
            'playRangeButton'
        ];
        setMultipleElementsEnabled(controlIds, enabled);
        if (this.includeAudioCheckbox) {
            this.includeAudioCheckbox.disabled = !enabled;
        }
    }

    getRangeSettings() {
        return { ...this.rangeSettings };
    }

    getStartTime() {
        return this.rangeSettings.startTime;
    }

    setRangeSettings(settings) {
        if (settings.startTime !== undefined) {
            this.rangeSettings.startTime = Math.max(0, settings.startTime);
        }
        if (settings.endTime !== undefined) {
            this.rangeSettings.endTime = Math.max(0, settings.endTime);
        }
        if (settings.includeAudio !== undefined) {
            this.rangeSettings.includeAudio = settings.includeAudio;
            if (this.includeAudioCheckbox) {
                this.includeAudioCheckbox.checked = settings.includeAudio;
            }
        }

        this.updateTimeInputs();
        this.updateRangeDisplay();
        this.notifyRangeChanged();
    }

    updateSliderMarkers() {
        if (!this.timeSlider) return;
        const duration = this.rangeSettings.videoDuration;
        if (duration <= 0) return;
        const inPct  = (this.rangeSettings.startTime / duration) * 100;
        const outPct = (this.rangeSettings.endTime   / duration) * 100;
        const gray = '#e0e0e0';
        const blue = '#2980b9';
        this.timeSlider.style.background =
            `linear-gradient(to right, ${gray} 0%, ${gray} ${inPct}%, ${blue} ${inPct}%, ${blue} ${outPct}%, ${gray} ${outPct}%, ${gray} 100%)`;
    }

    notifyRangeChanged() {
        this.updateSliderMarkers();
        if (this.onRangeChangedCallback) {
            this.onRangeChangedCallback(this.getRangeSettings());
        }
    }

    onRangeChanged(callback) {
        this.onRangeChangedCallback = callback;
    }
}

const timeRangeManager = new TimeRangeManager();

console.log('✅ timeRangeManager.js (Web版): 読み込み完了');
