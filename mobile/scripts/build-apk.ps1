<# build-apk.ps1 - Windows PowerShell 一键构建 APK #>
param(
    [string]$ApiBase = "https://self-made-digital-twin-terrain-settlement-v1.vercel.app/api"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MobileDir = Split-Path -Parent $ScriptDir
$FrontendDir = Join-Path (Split-Path -Parent $MobileDir) "frontend"

Write-Host "[1/5] 安装 mobile 依赖..." -ForegroundColor Cyan
Set-Location $MobileDir
npm install

Write-Host "[2/5] 构建前端 (VITE_MOBILE=true)..." -ForegroundColor Cyan
Set-Location $FrontendDir
$env:VITE_MOBILE = "true"
$env:VITE_API_BASE = $ApiBase
npx vite build --outDir "$MobileDir/www"
Remove-Item Env:\VITE_MOBILE
Remove-Item Env:\VITE_API_BASE

Write-Host "[3/5] 同步到 Android 项目..." -ForegroundColor Cyan
Set-Location $MobileDir
npx cap sync android

Write-Host "[4/5] 构建 Debug APK..." -ForegroundColor Cyan
$AndroidDir = Join-Path $MobileDir "android"
Set-Location $AndroidDir
if ($IsWindows -or $env:OS -match "Windows") {
    & .\gradlew.bat assembleDebug
} else {
    & ./gradlew assembleDebug
}

$ApkPath = Get-ChildItem -Path "$AndroidDir/app/build/outputs/apk/debug/*.apk" | Select-Object -First 1
if ($ApkPath) {
    Copy-Item $ApkPath.FullName "$MobileDir/settlement-monitor.apk"
    Write-Host "[5/5] APK 已生成: mobile/settlement-monitor.apk" -ForegroundColor Green
} else {
    Write-Host "[5/5] APK 构建失败，请检查错误信息" -ForegroundColor Red
    exit 1
}

Set-Location $MobileDir
Write-Host "完成!" -ForegroundColor Green
