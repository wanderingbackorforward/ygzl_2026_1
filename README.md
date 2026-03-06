# 沉降监测数字孪生系统（V1）

一个面向市政/工程监测的数字孪生系统，提供沉降、裂缝、温度、振动、InSAR、盾构机轨迹等数据的采集、处理、分析与可视化。后端基于 Flask，前端基于 React + Vite，支持 MySQL 或 Supabase 作为数据源。

## 核心功能

### 监测数据模块
- **沉降监测**：支持 Excel 数据导入、时间序列分析、趋势预测、异常检测
- **裂缝监测**：裂缝宽度变化追踪、多裂缝联合分析、预警分级
- **温度监测**：支持 Access MDB 文件导入、温度场分析、异常温度识别
- **振动监测**：振动数据采集、频谱分析、振动烈度评估
- **InSAR 监测**：卫星雷达干涉测量数据可视化、地表形变分析

### 智能分析模块
- **高级分析中心**：
  - 智能异常诊断：自动识别异常点、按严重程度分级
  - 处置建议生成：根据异常自动生成具体行动方案
  - 趋势预测与预警：预测未来 7/15/30 天趋势、识别高风险点位
  - 关联分析：施工事件影响分析、空间关联分析、多因素相关性
- **机器学习 API**：
  - 异常检测（Isolation Forest、LOF、DBSCAN）
  - 时间序列预测（ARIMA、SARIMA、Prophet）
  - 因果推断（DID、SCM）
  - 空间关联分析

### 工程管理模块
- **工单系统**：异常事件工单创建、分配、跟踪、闭环管理
- **盾构机轨迹展示**：盾构机施工轨迹可视化、实时位置追踪、历史轨迹回放
- **隧道监测**：隧道结构健康监测、KML 轨迹展示

### 可视化与交互
- **数据总览**：多维度数据汇总、统计图表、趋势分析
- **3D 模型**：工程结构三维可视化、监测点空间分布
- **地图展示**：百度地图/Leaflet 集成、监测点标注、轨迹绘制
- **AI 助手**：悬浮智能助手、自然语言问答、数据查询

### 移动端支持
- **Android APK**：基于 Capacitor 打包，支持移动端访问
- **响应式设计**：底部标签栏导航、触摸优化、移动端适配

## 目录结构

```
python_scripts/
├── backend/                    # 后端服务
│   ├── modules/
│   │   ├── api/               # API 路由与蓝图
│   │   │   ├── api_server.py  # 主 API 服务器
│   │   │   ├── shield_trajectory.py  # 盾构机轨迹 API
│   │   │   └── ...
│   │   ├── data_import/       # 数据导入模块
│   │   ├── data_processing/   # 数据处理与分析
│   │   ├── ml/                # 机器学习模块
│   │   ├── ticket_system/     # 工单系统
│   │   └── database/          # 数据库配置
│   ├── start_system.py        # 后端启动入口
│   └── requirements.txt       # Python 依赖
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   ├── components/        # 可复用组件
│   │   ├── contexts/          # React Context
│   │   ├── hooks/             # 自定义 Hooks
│   │   └── lib/               # 工具库
│   ├── public/
│   │   ├── static/            # 静态资源
│   │   └── shield-trajectory/ # 盾构机轨迹子系统
│   ├── package.json
│   └── vite.config.ts
├── mobile/                     # 移动端 APK 构建
│   ├── capacitor.config.ts
│   ├── scripts/
│   │   ├── build-apk.ps1      # Windows 构建脚本
│   │   └── build-apk.sh       # Linux/macOS 构建脚本
│   └── README.md
├── api/                        # Vercel Serverless API
│   └── index.py               # WSGI 桥接
├── docs/                       # 项目文档
├── .env.example               # 环境变量示例
├── vercel.json                # Vercel 部署配置
└── README.md                  # 本文件
```

## 快速开始

### 后端

1. **安装依赖**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **配置环境变量**（可选，Supabase HTTP 数据源）
   ```bash
   # 示例，占位值请自行替换
   set DB_VENDOR=supabase_http
   set SUPABASE_URL=https://your-project.supabase.co
   set SUPABASE_ANON_KEY=sb_publishable_xxx
   set SUPABASE_SERVICE_ROLE=sb_secret_xxx
   set SUPABASE_USE_HTTP=1
   ```
   不使用 Supabase 时，将 `DB_VENDOR` 设为 `mysql` 并在 `backend/modules/database/db_config.py` 配置 MySQL。

3. **启动服务**
   ```bash
   python backend/start_system.py
   ```

4. **健康检查**
   ```bash
   curl http://localhost:5000/health
   ```

### 前端

1. **安装依赖**
   ```bash
   cd frontend
   npm install
   ```

2. **启动开发服务**
   ```bash
   npm run dev
   ```

3. **访问浏览器**
   - 开发端口：http://localhost:5173
   - 后端 API：http://localhost:5000

### 移动端 APK 构建

详见 `mobile/README.md`

**快速构建**：
```bash
# Windows
cd mobile
.\scripts\build-apk.ps1

# Linux/macOS
cd mobile
bash scripts/build-apk.sh
```

## 主要 API 端点

### 监测数据 API
- `GET /api/points` - 监测点列表（含预警与趋势）
- `GET /api/point/{point_id}` - 单点时间序列与分析
- `GET /api/summary` - 监测点汇总分析
- `GET /api/trends` - 趋势分类统计
- `POST /api/upload` - 上传沉降/裂缝 Excel
- `POST /api/temperature/upload` - 上传温度 MDB/ACCDB
- `GET /api/temperature/points` - 温度监测点列表
- `GET /api/vibration/channels` - 振动监测通道列表
- `GET /api/insar/points` - InSAR 监测点数据

### 智能分析 API
- `GET /api/analysis/v2/settlement` - 沉降完整分析
- `GET /api/analysis/v2/settlement/anomalies` - 异常列表
- `GET /api/analysis/v2/settlement/recommendations` - 处置建议
- `POST /api/ml/anomalies/batch` - 批量异常检测
- `GET /api/ml/auto-predict/{point_id}` - 自动预测
- `POST /api/ml/causal-inference` - 因果推断
- `POST /api/ml/spatial-correlation` - 空间关联分析

### 工程管理 API
- `GET /api/tickets` - 工单列表
- `POST /api/tickets` - 创建工单
- `PATCH /api/tickets/{id}` - 更新工单
- `GET /api/shield/trajectory/status` - 盾构机轨迹服务状态
- `POST /api/shield/trajectory/calculate` - 计算盾构机轨迹

### 其他 API
- `POST /api/assistant/chat` - AI 助手对话
- `GET /api/cover/cameras` - 封面页画面源
- `GET /api/modules` - 模块配置列表
- `GET /api/health` - 健康检查

## 技术栈

### 后端
- **框架**：Flask 3.x
- **数据库**：MySQL / Supabase (PostgreSQL)
- **机器学习**：scikit-learn、statsmodels、prophet
- **数据处理**：pandas、numpy
- **API 文档**：Flask-CORS

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite 5
- **UI 库**：Tailwind CSS、Ant Design
- **图表库**：ECharts、Recharts
- **地图**：百度地图 API、Leaflet
- **状态管理**：React Context、React Query

### 移动端
- **打包工具**：Capacitor 6
- **目标平台**：Android (iOS 待支持)

## 部署

### Vercel 部署（推荐）

1. **配置环境变量**
   - `VERCEL=1`
   - `DB_VENDOR=supabase_http`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `DEEPSEEK_API_KEY`（可选）

2. **部署设置**
   - Root Directory：`python_scripts`
   - 输出目录：`frontend/dist`
   - 构建命令：`npm run build --prefix frontend`
   - 安装命令：`npm ci --prefix frontend`

3. **API 路由**
   - `vercel.json` 将 `/api/:path*` 重写到 `api/index.py`
   - Serverless Functions 自动处理 Python 后端

### 传统部署

**后端**：
```bash
# 使用 Gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 backend.start_system:app
```

**前端**：
```bash
cd frontend
npm run build
# 将 dist/ 目录部署到 Nginx/Apache
```

## 封面页画面源配置

- 默认封面页会标记为”演示视频”，并尝试从 `/api/cover/cameras` 读取真实/外部源配置
- 可用环境变量：`COVER_CAMERA_ENTRANCE_URL`、`COVER_CAMERA_MIDDLE_URL` 或 `COVER_CAMERAS_JSON`
- 示例（使用公开交通摄像头静态图，5 秒刷新一次）：
  ```bash
  COVER_CAMERAS_JSON=[{“id”:”entrance”,”label”:”外部源 1”,”url”:”https://cwwp2.dot.ca.gov/data/d4/cctv/image/tvd32i80baybridgesastowereast/tvd32i80baybridgesastowereast.jpg”,”format”:”image”,”kind”:”external”},{“id”:”middle”,”label”:”外部源 2”,”url”:”https://cwwp2.dot.ca.gov/data/d2/cctv/image/vollmers/vollmers.jpg”,”format”:”image”,”kind”:”external”}]
  ```

## 大资源与仓库体积

- 已将历史中的超大文件从版本历史移除，显著降低仓库体积
- 请将以下目录保持未纳入版本控制：`/static/`、`/temp_uploads/`、`/shield-machine-trajectory/`
- 如需长期版本化二进制资产，建议采用 Git LFS（如 .glb/.mp4/.bundle）

## 开发指南

### 添加新模块

1. **后端**：在 `backend/modules/api/` 创建新的 Blueprint
2. **前端**：在 `frontend/src/pages/` 创建新页面组件
3. **路由**：在 `frontend/src/main.tsx` 添加路由
4. **导航**：在 `frontend/src/shared/Nav.tsx` 添加导航项

### 模块分类

导航栏按功能分为四类（不同颜色主题）：
- **监测数据**（蓝色）：沉降、温度、裂缝、振动、InSAR
- **分析展示**（紫色）：高级分析、数据总览、3D模型、隧道监测
- **管理工具**（橙色）：工单、模块管理、盾构轨迹
- **其他**（绿色）：封面

### 移动端适配

- 使用 `VITE_MOBILE=true` 环境变量标识移动端构建
- 移动端强制使用”新版”视图模式
- 底部标签栏导航，隐藏不适合手机的模块
- 所有新功能需考虑移动端兼容性

## 许可

暂未设定许可协议（如需要可补充 MIT/Apache-2.0 等）

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。
