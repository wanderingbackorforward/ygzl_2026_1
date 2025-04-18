@echo off
echo 启动WebRTC信令服务器...
echo 服务器将在 ws://localhost:80/signaling 运行
echo 按Ctrl+C停止服务器

rem 检查是否安装了Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js
    echo 请安装Node.js后再运行此脚本
    echo 访问 https://nodejs.org/ 下载安装
    pause
    exit /b 1
)

rem 检查是否存在ws模块
node -e "try{require('ws');}catch(e){console.error('未找到ws模块');process.exit(1);}" >nul 2>&1
if %errorlevel% neq 0 (
    echo 安装WebSocket模块...
    npm install ws
    if %errorlevel% neq 0 (
        echo 无法安装WebSocket模块
        pause
        exit /b 1
    )
)

rem 启动服务器
node signaling-server.js

pause 