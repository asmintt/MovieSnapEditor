/**
 * fileHandler.js - ファイル選択・管理機能
 */

class FileHandler {
    constructor() {
        this.videoFileInput = null;
        this.selectVideoButton = null;
        this.selectedFileName = null;
        this.fileLabel = null;

        this.currentFile = {
            file: null,
            fileName: '',
            fileURL: '',
            fileSize: 0,
            isLoaded: false
        };

        this.onFileSelectedCallback = null;
        this.onFileErrorCallback = null;
    }

    init() {
        logDebug('FileHandler: 初期化を開始');
        try {
            this.getDOMElements();
            this.setupEventListeners();
            logInfo('FileHandler: 初期化完了');
        } catch (error) {
            logError('FileHandler: 初期化エラー', error);
        }
    }

    getDOMElements() {
        this.videoFileInput = getElementSafely('videoFileInput');
        this.selectVideoButton = getElementSafely('selectVideoButton');
        this.selectedFileName = getElementSafely('selectedFileName');
        this.videoContainer = getElementSafely('videoContainer');
        this.videoDropOverlay = getElementSafely('videoDropOverlay');

        if (!this.videoFileInput) {
            throw new Error('videoFileInput要素が見つかりません');
        }
    }

    setupEventListeners() {
        if (this.videoFileInput) {
            this.videoFileInput.addEventListener('change', (event) => {
                this.handleFileSelect(event);
            });
        }

        if (this.selectVideoButton) {
            this.selectVideoButton.addEventListener('click', () => {
                this.openFileDialog();
            });
        }

        if (this.videoDropOverlay) {
            this.videoDropOverlay.addEventListener('click', () => {
                this.openFileDialog();
            });
        }

        if (this.videoContainer) {
            this.setupDragAndDrop();
        }
    }

    setupDragAndDrop() {
        const dropArea = this.videoContainer;
        const overlay = this.videoDropOverlay;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                if (overlay) overlay.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                if (overlay) overlay.classList.remove('drag-over');
            });
        });

        dropArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processSelectedFile(files[0]);
            }
        });
    }

    openFileDialog() {
        if (this.videoFileInput) {
            this.videoFileInput.click();
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processSelectedFile(file);
        }
    }

    async processSelectedFile(file) {
        try {
            logDebug('FileHandler: ファイル処理開始', { fileName: file.name, size: file.size });

            if (!this.validateFile(file)) return;

            this.cleanup();

            this.currentFile = {
                file: file,
                fileName: file.name,
                fileURL: URL.createObjectURL(file),
                fileSize: file.size,
                isLoaded: true
            };

            this.updateFileDisplay();

            if (this.onFileSelectedCallback) {
                await this.onFileSelectedCallback(this.currentFile);
            }

            logInfo('FileHandler: ファイル処理完了', { fileName: file.name });

        } catch (error) {
            logError('FileHandler: ファイル処理エラー', error);
            this.handleError('ファイルの読み込みに失敗しました');
        }
    }

    validateFile(file) {
        const isVideoMimeType = file.type.startsWith('video/');
        const isSupportedExtension = isSupportedVideoFile(file.name);

        if (!isVideoMimeType && !isSupportedExtension) {
            this.handleError('対応していないファイル形式です');
            return false;
        }

        return true;
    }

    updateFileDisplay() {
        if (this.selectedFileName && this.currentFile.fileName) {
            const fileSizeMB = (this.currentFile.fileSize / 1024 / 1024).toFixed(2);
            this.selectedFileName.textContent =
                `読込済: ${this.currentFile.fileName} (${fileSizeMB} MB)`;
            this.selectedFileName.style.display = 'block';
        }
    }

    onFileSelected(callback) {
        this.onFileSelectedCallback = callback;
    }

    onFileError(callback) {
        this.onFileErrorCallback = callback;
    }

    getCurrentFile() {
        return this.currentFile;
    }

    isFileLoaded() {
        return this.currentFile.isLoaded && this.currentFile.file !== null;
    }

    cleanup() {
        if (this.currentFile.fileURL) {
            URL.revokeObjectURL(this.currentFile.fileURL);
        }
    }

    handleError(message) {
        logError('FileHandler: エラー発生', message);
        if (this.onFileErrorCallback) {
            this.onFileErrorCallback(message);
        }
    }

    destroy() {
        this.cleanup();
        this.currentFile = {
            file: null,
            fileName: '',
            fileURL: '',
            fileSize: 0,
            isLoaded: false
        };
    }
}

const fileHandler = new FileHandler();

console.log('✅ fileHandler.js: 読み込み完了');
