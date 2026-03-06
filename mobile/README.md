# 数字孪生沉降监测 - 移动端 (Android APK)

将现有 React Web 应用打包为 Android APK。

## 前置依赖

- **Node.js** >= 18
- **Java JDK** 17（推荐 [Eclipse Temurin](https://adoptium.net/)）
- **Android SDK**（通过 [Android Studio](https://developer.android.com/studio) 安装）
- 环境变量 `ANDROID_HOME` 指向 Android SDK 路径

## 快速开始

### 首次初始化

```bash
cd mobile/
npm install
npx cap add android
```

### 一键构建 APK

**Windows (PowerShell):**
```powershell
.\scripts\build-apk.ps1
```

**Linux / macOS:**
```bash
bash scripts/build-apk.sh
```

构建成功后，APK 文件位于 `mobile/settlement-monitor.apk`。

### 自定义后端地址

```powershell
.\scripts\build-apk.ps1 -ApiBase "https://your-server.com/api"
```

```bash
bash scripts/build-apk.sh "https://your-server.com/api"
```

### 手动分步构建

```bash
# 1. 在 frontend/ 目录构建移动版
cd ../frontend
VITE_MOBILE=true VITE_API_BASE=https://xxx.vercel.app/api npx vite build --outDir ../mobile/www

# 2. 同步到 Android
cd ../mobile
npx cap sync android

# 3. 构建 APK
cd android
./gradlew assembleDebug

# APK 位于 android/app/build/outputs/apk/debug/
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE` | `/api` | API 基础地址，移动端需设为完整 URL |
| `VITE_MOBILE` | 未设置 | 设为 `true` 启用移动端模式 |

## 移动端与 Web 端差异

- 底部标签栏导航（替代顶部水平导航）
- 强制使用"新版"视图模式
- 隐藏不适合手机的模块（3D 模型、模块管理）
- 隐藏浮动助手和逾期工单提醒

## 目录结构

```
mobile/
  package.json          - Capacitor 依赖
  capacitor.config.ts   - Capacitor 配置
  .env.mobile           - 移动端环境变量模板
  .gitignore            - 忽略构建产物
  scripts/
    build-apk.ps1       - Windows 一键构建
    build-apk.sh        - Linux/macOS 一键构建
  www/                  - 前端构建产物（构建时生成）
  android/              - Android 项目（cap add 后生成）
```
