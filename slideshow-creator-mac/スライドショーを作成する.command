#!/bin/bash
# ダブルクリックで Terminal.app が開き、このスクリプトが実行される

export LANG=ja_JP.UTF-8
export LC_ALL=ja_JP.UTF-8

DIR="$(cd "$(dirname "$0")" && pwd)"

# ffmpeg の実行権限を付与し、Gatekeeper の隔離属性を除去
chmod +x "$DIR/ffmpeg" 2>/dev/null
xattr -d com.apple.quarantine "$DIR/ffmpeg" 2>/dev/null

python3 "$DIR/run.py" "$DIR"
