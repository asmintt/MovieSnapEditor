/**
 * utils.js - ユーティリティ関数集（Web版）
 *
 * 【主な機能】
 * - 時刻フォーマット変換
 * - 文字列処理
 * - DOM操作ヘルパー
 * - バリデーション機能
 *
 * 【Web版の変更点】
 * - logDebugでfile://プロトコルも開発環境として扱う
 * - 他の機能はElectron版と同じ
 */

// ===== 時刻関連ユーティリティ =====

/**
 * 秒数を時刻文字列に変換する機能
 * 動画の再生時間を「MM:SS」または「HH:MM:SS」形式で表示
 *
 * @param {number} totalSeconds - 変換したい秒数
 * @param {boolean} includeHours - 時間を含めるかどうか（デフォルト: false）
 * @returns {string} フォーマット済み時刻文字列
 *
 * 例:
 * formatTimeFromSeconds(125) → "02:05"
 * formatTimeFromSeconds(3665, true) → "1:01:05"
 */
function formatTimeFromSeconds(totalSeconds, includeHours = false) {
    // 入力値の安全性チェック
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) {
        console.log('⚠️ 警告: 無効な秒数が渡されました:', totalSeconds);
        return '00:00.00';
    }

    // 負の値を0にする
    const clamped = Math.max(0, totalSeconds);
    const totalInt = Math.floor(clamped);
    const centiseconds = Math.floor((clamped - totalInt) * 100);

    // 時間・分・秒を計算
    const hours = Math.floor(totalInt / 3600);
    const minutes = Math.floor((totalInt % 3600) / 60);
    const remainingSeconds = totalInt % 60;

    // 2桁表示にフォーマット
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
    const formattedCenti = centiseconds.toString().padStart(2, '0');

    if (includeHours || hours > 0) {
        const formattedHours = hours.toString().padStart(2, '0');
        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}.${formattedCenti}`;
    } else {
        return `${formattedMinutes}:${formattedSeconds}.${formattedCenti}`;
    }
}

/**
 * 時刻文字列を秒数に変換する機能
 * ユーザー入力の時刻文字列を数値（秒）に変換
 *
 * @param {string} timeString - 時刻文字列（"MM:SS" または "HH:MM:SS"）
 * @returns {number} 秒数（変換失敗時は0）
 *
 * 例:
 * parseTimeStringToSeconds("02:05") → 125
 * parseTimeStringToSeconds("1:01:05") → 3665
 */
function parseTimeStringToSeconds(timeString) {
    // 入力値の安全性チェック
    if (typeof timeString !== 'string' || !timeString.trim()) {
        console.log('⚠️ 警告: 無効な時刻文字列:', timeString);
        return 0;
    }

    // 時刻文字列を分割（":"で区切る）
    const timeParts = timeString.trim().split(':');

    try {
        if (timeParts.length === 2) {
            // "MM:SS" または "MM:SS.cc" 形式の場合
            const minutes = parseInt(timeParts[0], 10);
            const seconds = parseFloat(timeParts[1]);

            // 数値の妥当性チェック
            if (isNaN(minutes) || isNaN(seconds) || seconds >= 60) {
                throw new Error('無効な時刻形式');
            }

            return minutes * 60 + seconds;

        } else if (timeParts.length === 3) {
            // "HH:MM:SS" 形式の場合
            const hours = parseInt(timeParts[0], 10);
            const minutes = parseInt(timeParts[1], 10);
            const seconds = parseInt(timeParts[2], 10);

            // 数値の妥当性チェック
            if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) ||
                minutes >= 60 || seconds >= 60) {
                throw new Error('無効な時刻形式');
            }

            return hours * 3600 + minutes * 60 + seconds;

        } else {
            throw new Error('無効な時刻形式');
        }

    } catch (error) {
        console.log('⚠️ 警告: 時刻文字列の変換に失敗:', timeString, error.message);
        return 0;
    }
}

// ===== DOM操作ヘルパー機能 =====

/**
 * DOM要素を安全に取得する機能
 * 要素が存在しない場合のエラーを防止
 *
 * @param {string} elementId - 取得したい要素のID
 * @returns {HTMLElement|null} DOM要素（見つからない場合はnull）
 */
function getElementSafely(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.log(`⚠️ 警告: 要素が見つかりません - ${elementId}`);
    }
    return element;
}

/**
 * 入力フィールドを安全に有効/無効化する機能
 * 複数のマネージャーからの競合を防止
 *
 * @param {string} elementId - 対象要素のID
 * @param {boolean} isEnabled - 有効にするかどうか
 */
function setInputFieldEnabled(elementId, isEnabled) {
    const element = getElementSafely(elementId);
    if (!element) return;

    element.disabled = !isEnabled;

    // 視覚的な状態も更新
    if (isEnabled) {
        element.classList.remove('disabled');
    } else {
        element.classList.add('disabled');
    }
}

/**
 * 入力フィールドの値を安全に設定する機能
 * ユーザーが入力中の場合は設定をスキップして競合を防止
 *
 * @param {string} elementId - 対象要素のID
 * @param {string} value - 設定する値
 */
function setInputValueSafely(elementId, value) {
    const element = getElementSafely(elementId);
    if (!element) return;

    // ユーザーが現在入力中の場合はスキップ
    if (document.activeElement === element) {
        console.log(`📝 ユーザー入力中のため値の設定をスキップ: ${elementId}`);
        return;
    }

    element.value = value;
}

/**
 * 複数の要素を一括で有効/無効化する機能
 * 一貫した状態管理を実現
 *
 * @param {string[]} elementIds - 対象要素IDの配列
 * @param {boolean} isEnabled - 有効にするかどうか
 */
function setMultipleElementsEnabled(elementIds, isEnabled) {
    elementIds.forEach(id => {
        if (id) {
            setInputFieldEnabled(id, isEnabled);
        }
    });
}

// ===== 文字列処理ユーティリティ =====

/**
 * 文字列の長さを安全に取得する機能
 * 全角・半角を正しくカウント
 *
 * @param {string} text - 文字数を数えたい文字列
 * @returns {number} 文字数
 */
function getTextLength(text) {
    if (typeof text !== 'string') {
        return 0;
    }
    return text.length;
}

/**
 * テキストが文字数制限内かチェックする機能
 * ユーザー入力のバリデーションに使用
 *
 * @param {string} text - チェックしたいテキスト
 * @param {number} maxLength - 最大文字数（デフォルト: MAX_TEXT_LENGTH）
 * @returns {boolean} 制限内の場合はtrue
 */
function isTextLengthValid(text, maxLength = MAX_TEXT_LENGTH) {
    const length = getTextLength(text);
    return length > 0 && length <= maxLength;
}

/**
 * 空白・改行のみのテキストかチェックする機能
 * 有効なテキスト入力かを判定
 *
 * @param {string} text - チェックしたいテキスト
 * @returns {boolean} 有効なテキストの場合はtrue
 */
function isTextContentValid(text) {
    if (typeof text !== 'string') {
        return false;
    }
    return text.trim().length > 0;
}

// ===== バリデーション機能 =====

/**
 * 動画時間の範囲が有効かチェックする機能
 * 開始時刻 < 終了時刻 の関係をチェック
 *
 * @param {number} startTime - 開始時刻（秒）
 * @param {number} endTime - 終了時刻（秒）
 * @param {number} videoDuration - 動画の長さ（秒）
 * @returns {Object} バリデーション結果
 */
function validateTimeRange(startTime, endTime, videoDuration) {
    const result = {
        isValid: true,
        errorMessage: '',
        warnings: []
    };

    // 基本的な数値チェック
    if (typeof startTime !== 'number' || typeof endTime !== 'number') {
        result.isValid = false;
        result.errorMessage = '時刻は数値で入力してください';
        return result;
    }

    // 負の値チェック
    if (startTime < 0 || endTime < 0) {
        result.isValid = false;
        result.errorMessage = '時刻は0以上で入力してください';
        return result;
    }

    // 開始時刻 < 終了時刻チェック
    if (startTime >= endTime) {
        result.isValid = false;
        result.errorMessage = '開始時刻は終了時刻より前に設定してください';
        return result;
    }

    // 動画の長さを超えていないかチェック
    if (videoDuration && endTime > videoDuration) {
        result.warnings.push('終了時刻が動画の長さを超えています');
    }

    return result;
}

// ===== ファイル関連ユーティリティ =====

/**
 * ファイル拡張子をチェックする機能
 * サポートされている動画ファイルかを判定
 *
 * @param {string} fileName - ファイル名
 * @returns {boolean} サポートされている拡張子の場合はtrue
 */
function isSupportedVideoFile(fileName) {
    if (typeof fileName !== 'string') {
        return false;
    }

    const extension = fileName.split('.').pop();
    if (!extension) {
        return false;
    }

    return SUPPORTED_VIDEO_EXTENSIONS.includes(extension);
}

/**
 * ファイル名から拡張子を除いた名前を取得する機能
 * プロジェクト名の自動生成に使用
 *
 * @param {string} fileName - ファイル名
 * @returns {string} 拡張子を除いたファイル名
 */
function getFileNameWithoutExtension(fileName) {
    if (typeof fileName !== 'string') {
        return '';
    }

    const parts = fileName.split('.');
    if (parts.length <= 1) {
        return fileName;
    }

    // 最後の部分（拡張子）を除いて結合
    return parts.slice(0, -1).join('.');
}

// ===== デバッグ・ログ機能 =====

/**
 * 開発モードでのみログを出力する機能
 * 本番環境でのコンソール汚染を防止
 * 【Web版】file://プロトコルも開発環境として扱う
 *
 * @param {string} message - ログメッセージ
 * @param {any} data - ログに含めるデータ（オプション）
 */
function logDebug(message, data = null) {
    // 開発環境でのみログ出力（本番では出力しない）
    // Web版: file://プロトコルでの実行も開発環境として扱う
    if (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'file:') {

        const timestamp = new Date().toLocaleTimeString();

        if (data !== null) {
            console.log(`[${timestamp}] 🔧 ${message}`, data);
        } else {
            console.log(`[${timestamp}] 🔧 ${message}`);
        }
    }
}

/**
 * 情報ログを出力する機能
 * ユーザー操作やシステム状態の記録
 */
function logInfo(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();

    if (data !== null) {
        console.log(`[${timestamp}] ℹ️ ${message}`, data);
    } else {
        console.log(`[${timestamp}] ℹ️ ${message}`);
    }
}

/**
 * エラーログを出力する機能
 * 重要なエラーは本番環境でも記録
 *
 * @param {string} message - エラーメッセージ
 * @param {Error|any} error - エラーオブジェクト
 */
function logError(message, error = null) {
    const timestamp = new Date().toLocaleTimeString();

    if (error) {
        console.error(`[${timestamp}] ❌ ${message}`, error);
    } else {
        console.error(`[${timestamp}] ❌ ${message}`);
    }
}

console.log('✅ utils.js (Web版): ユーティリティ関数を読み込み完了');