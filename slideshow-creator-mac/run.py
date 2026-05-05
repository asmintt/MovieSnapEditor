#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import re
import subprocess
import tempfile
from datetime import datetime

# ---------- ユーティリティ ----------

def clean_path(raw: str) -> str:
    path = raw.strip().strip('"').strip("'").strip()
    path = re.sub(r'\\(.)', r'\1', path)
    return path

def get_image_files(folder: str) -> list:
    exts = ('.jpg', '.jpeg')
    files = [
        f for f in os.listdir(folder)
        if f.lower().endswith(exts) and not f.startswith('.')
    ]
    return sorted(files)

def parse_interval(raw: str, default: float) -> float:
    raw = raw.strip()
    if raw == '':
        return default
    try:
        val = float(raw)
        if val <= 0:
            raise ValueError
        return val
    except ValueError:
        return None

# ---------- メイン ----------

def main():
    script_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    ffmpeg = os.path.join(script_dir, 'ffmpeg')

    print('================================================')
    print('  MovieSnapEditor - スライドショー作成ツール')
    print('================================================')
    print()

    # ffmpeg チェック
    if not os.path.isfile(ffmpeg):
        print('エラー: ffmpeg が見つかりません。')
        print()
        print('【準備が必要です】')
        print('  同じフォルダ内の「ffmpegの入手方法.txt」を参照してください。')
        print()
        input('Enterキーで終了')
        sys.exit(1)

    # Step 1: フレーム画像フォルダ
    print('【Step 1】フレーム画像フォルダをこのウィンドウにドラッグ&ドロップして Enter:')
    folder_path = clean_path(input('  > '))

    if not os.path.isdir(folder_path):
        print('エラー: フォルダが見つかりません。')
        input('Enterキーで終了')
        sys.exit(1)

    image_files = get_image_files(folder_path)
    if len(image_files) == 0:
        print('エラー: フォルダ内にJPEGファイルが見つかりません。')
        input('Enterキーで終了')
        sys.exit(1)

    print()

    # Step 2: 表示間隔
    DEFAULT_INTERVAL = 5.0
    print(f'【Step 2】1枚あたりの表示間隔（秒）[Enter で {int(DEFAULT_INTERVAL)}秒]:')
    raw = input('  > ')
    interval = parse_interval(raw, DEFAULT_INTERVAL)
    if interval is None:
        print(f'  ※ 無効な値です。{int(DEFAULT_INTERVAL)}秒で続行します。')
        interval = DEFAULT_INTERVAL

    print()
    print('準備中...')

    # 出力パス（デスクトップ）
    folder_name = os.path.basename(folder_path.rstrip('/'))
    safe_name   = re.sub(r'[\\/:*?"<>|]', '_', folder_name).strip() or 'slideshow'
    desktop     = os.path.expanduser('~/Desktop')
    out_path    = os.path.join(desktop, f'{safe_name}_slideshow.mp4')
    if os.path.exists(out_path):
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        out_path = os.path.join(desktop, f'{safe_name}_slideshow_{ts}.mp4')

    # 情報表示
    print()
    print(f'  フォルダ      : {folder_path}')
    print(f'  フレーム数    : {len(image_files)} 枚')
    print(f'  表示間隔      : {interval} 秒 / 枚')
    print(f'  合計時間      : {len(image_files) * interval:.1f} 秒')
    print(f'  出力先        : {out_path}')
    print()

    # concat マニフェストを一時ファイルに生成
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt',
                                     delete=False, encoding='utf-8') as tf:
        concat_path = tf.name
        for fname in image_files:
            fpath = os.path.join(folder_path, fname).replace('\\', '/')
            tf.write(f"file '{fpath}'\n")
            tf.write(f'duration {interval}\n')
        # 最終フレームを再度追加（末尾の duration を確定させるため）
        last = os.path.join(folder_path, image_files[-1]).replace('\\', '/')
        tf.write(f"file '{last}'\n")

    # FFmpeg 実行
    cmd = [
        ffmpeg, '-y',
        '-f', 'concat', '-safe', '0', '-i', concat_path,
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-crf', '23', '-movflags', '+faststart',
        out_path
    ]

    print('処理中...')
    proc = subprocess.Popen(
        cmd,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace'
    )

    stderr_lines = []
    try:
        for line in proc.stderr:
            stderr_lines.append(line)
    except Exception:
        pass

    proc.wait()
    os.unlink(concat_path)

    print()

    if proc.returncode == 0:
        print('================================================')
        print('  完了！')
        print('  デスクトップに保存しました:')
        print(f'  {os.path.basename(out_path)}')
        print('================================================')
    else:
        print(f'エラーが発生しました（コード: {proc.returncode}）')
        print('画像フォルダとffmpegを確認してください。')
        for line in stderr_lines[-20:]:
            print(line, end='')

    print()
    input('Enterキーを押すとウィンドウが閉じます')

if __name__ == '__main__':
    main()
