#!/usr/bin/env bash
# build-apk.sh - 一键构建 APK
set -euo pipefail

API_BASE="${1:-https://self-made-digital-twin-terrain-settlement-v1.vercel.app/api}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$MOBILE_DIR")/frontend"

echo "[1/5] 安装 mobile 依赖..."
cd "$MOBILE_DIR"
npm install

echo "[2/5] 构建前端 (VITE_MOBILE=true)..."
cd "$FRONTEND_DIR"
VITE_MOBILE=true VITE_API_BASE="$API_BASE" npx vite build --outDir "$MOBILE_DIR/www"

echo "[3/5] 同步到 Android 项目..."
cd "$MOBILE_DIR"
npx cap sync android

echo "[4/5] 构建 Debug APK..."
cd "$MOBILE_DIR/android"
./gradlew assembleDebug

APK_PATH=$(find "$MOBILE_DIR/android/app/build/outputs/apk/debug" -name "*.apk" | head -1)
if [ -n "$APK_PATH" ]; then
    cp "$APK_PATH" "$MOBILE_DIR/settlement-monitor.apk"
    echo "[5/5] APK 已生成: mobile/settlement-monitor.apk"
else
    echo "[5/5] APK 构建失败，请检查错误信息"
    exit 1
fi

echo "完成!"
