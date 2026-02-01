# 沉降监测数字孪生系统（V1）

一个面向市政/工程监测的数字孪生系统，提供沉降、裂缝、温度、振动等数据的采集、处理、分析与可视化。后端基于 Flask，前端基于 React + Vite，支持 MySQL 或 Supabase 作为数据源。

## 核心功能
- 数据导入：支持 Excel（沉降/裂缝）与 Access MDB（温度）文件上传与入库
- 数据处理：生成时间序列与统计分析（趋势分类、预警等级、变化率等）
- API 服务：统一提供监测点列表、单点详情、汇总与趋势统计
- 可视化前端：覆盖沉降、裂缝、温度、振动、概览等页面
- 大文件静态资源优化：GLB 模型分块传输与断点续传支持

## 目录结构
- backend：后端服务与业务模块
  - modules/api/api_server.py：Flask API 服务
  - modules/data_import/*：数据导入
  - modules/data_processing/*：数据处理与分析
  - modules/ticket_system/*：工单系统
  - start_system.py：后端统一启动入口
  - requirements.txt：后端依赖清单
- frontend：React + Vite 前端（含静态页面与 TSX 页面）
- static（未纳入版本控制）：大型资源目录（GLB/视频/地图等）
- temp_uploads（未纳入版本控制）：上传临时目录
- .env.example：示例环境变量

## 快速开始
### 后端
1. 安装依赖
   ```bash
   pip install -r backend/requirements.txt
   ```
2. 配置环境（可选，Supabase HTTP 数据源）
   ```bash
   # 示例，占位值请自行替换
   set DB_VENDOR=supabase_http
   set SUPABASE_URL=https://your-project.supabase.co
   set SUPABASE_ANON_KEY=sb_publishable_xxx
   set SUPABASE_SERVICE_ROLE=sb_secret_xxx
   set SUPABASE_USE_HTTP=1
   ```
   不使用 Supabase 时，将 `DB_VENDOR` 设为 `mysql` 并在 `backend/modules/database/db_config.py` 配置 MySQL。
3. 启动服务
   ```bash
   python backend/start_system.py
   ```
4. 健康检查
   ```bash
   curl http://localhost:5000/health
   ```

### 前端
1. 安装依赖
   ```bash
   cd frontend
   npm i
   ```
2. 启动开发服务
   ```bash
   npm run dev
   ```
3. 访问浏览器开发端口（默认 5173）

## 主要 API（示例）
- GET /api/points：监测点列表（含预警与趋势）
- GET /api/point/{point_id}：单点时间序列与分析
- GET /api/summary：监测点汇总分析
- GET /api/trends：趋势分类统计
- GET /api/cover/cameras：封面页画面源（演示/外部源）
- POST /api/assistant/chat：悬浮小助手（一问一答，返回 Markdown）
- POST /api/upload：上传沉降/裂缝 Excel（xlsx/xls）
- POST /api/temperature/upload：上传温度 MDB/ACCDB
- GET /api/temperature/points、/api/temperature/summary 等

## 封面页画面源配置
- 默认封面页会标记为“演示视频”，并尝试从 `/api/cover/cameras` 读取真实/外部源配置
- 可用环境变量：`COVER_CAMERA_ENTRANCE_URL`、`COVER_CAMERA_MIDDLE_URL` 或 `COVER_CAMERAS_JSON`
- 示例（使用公开交通摄像头静态图，5 秒刷新一次）：
  - `COVER_CAMERAS_JSON=[{"id":"entrance","label":"外部源 1","url":"https://cwwp2.dot.ca.gov/data/d4/cctv/image/tvd32i80baybridgesastowereast/tvd32i80baybridgesastowereast.jpg","format":"image","kind":"external"},{"id":"middle","label":"外部源 2","url":"https://cwwp2.dot.ca.gov/data/d2/cctv/image/vollmers/vollmers.jpg","format":"image","kind":"external"}]`

## 大资源与仓库体积
- 已将历史中的超大文件从版本历史移除，显著降低仓库体积
- 请将以下目录保持未纳入版本控制：`/static/`、`/temp_uploads/`
- 如需长期版本化二进制资产，建议采用 Git LFS（如 .glb/.mp4/.bundle）

## 部署提示
- 后端为 Flask + WSGI，可部署到常见的 Linux/Windows 环境或容器
- 前端可独立构建并部署到静态托管（含 Vite 构建）
- 若采用 Supabase HTTP，注意密钥管理与最小权限原则

### Vercel 部署（Serverless）
- Root Directory：`python_scripts`
- 输出目录：`frontend/dist`（Vite 构建产物）
- 环境变量：`VERCEL=1`、`DB_VENDOR=supabase_http`、`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`DEEPSEEK_API_KEY`（可选：`DEEPSEEK_MODEL`、`DEEPSEEK_API_BASE`）
- 安装依赖：默认读取根目录 `requirements.txt`（已提供最小依赖）
- API 入口：`api/index.py`（WSGI 桥接），`vercel.json` 将 `/api/:path*` 重写到该入口

## 许可
暂未设定许可协议（如需要可补充 MIT/Apache-2.0 等）
