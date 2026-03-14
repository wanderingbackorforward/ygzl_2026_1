# 沉降监测数字孪生系统（V1）

面向市政/工程监测的数字孪生平台，集成沉降、裂缝、温度、振动、InSAR 等多源监测数据的采集、处理、智能分析与可视化。后端基于 Flask，前端基于 React + Vite + Tailwind CSS，数据库使用 Supabase (PostgreSQL)，部署于 Vercel。

## 核心功能

### 多源监测数据
- **沉降监测**：Excel 数据导入、时间序列分析、趋势预测、异常检测
- **裂缝监测**：裂缝宽度变化追踪、多裂缝联合分析、预警分级
- **温度监测**：Access MDB/ACCDB 文件导入、温度场分析、异常识别
- **振动监测**：振动数据采集、频谱分析、振动烈度评估
- **InSAR 监测**：卫星雷达干涉测量数据可视化、地表形变分析、沉降区域聚类

### 智能分析引擎
- **高级分析中心**：异常诊断、处置建议生成、趋势预测预警、关联分析
- **机器学习模型**：
  - 异常检测（Isolation Forest、LOF、DBSCAN）
  - 时间序列预测（ARIMA、Prophet、Informer、STGCN、PINN）
  - 集成预测器（多模型融合）、因果推断（DID、SCM）
  - 空间关联分析、可解释性分析（SHAP）、数字孪生模拟器
- **知识图谱**：基于 NetworkX 的工程知识图谱，支持知识问答

### AI 智能助手
- 悬浮式智能助手，支持流式对话
- Agent 循环架构：意图分类 → 工具调用 → 上下文格式化
- 内置工具集：数据查询、异常分析、趋势预测
- 知识图谱驱动的问答系统

### 工程管理
- **工单系统**：工单创建/分配/跟踪/闭环管理、邮件通知、超期提醒
- **盾构机轨迹**：施工轨迹可视化、实时位置追踪、历史回放
- **隧道监测**：隧道结构健康监测、KML 轨迹展示
- **模块管理**：动态模块注册、启用/禁用、权限控制

### 可视化与交互
- **数据总览**：多维度数据汇总、统计图表、趋势分析
- **3D 模型**：基于 Three.js 的工程结构三维可视化
- **地图展示**：Leaflet 集成、监测点标注、轨迹绘制
- **封面页**：支持外部摄像头实时画面接入

### 移动端
- **Android APK**：基于 Capacitor 6 打包，底部标签栏导航
- **响应式设计**：触摸优化、移动端模块筛选、自适应布局

## 目录结构

```
python_scripts/
├── api/                        # Vercel Serverless 入口
│   └── index.py                # 唯一 .py（Vercel 要求）
├── backend/                    # 后端服务
│   ├── modules/
│   │   ├── api/                # API 路由（api_server.py 主入口）
│   │   ├── advanced_analysis/  # 高级分析（事件/剖面/联合分析）
│   │   ├── analysis_v2/        # 分析引擎 V2（沉降/温度服务）
│   │   ├── assistant/          # AI 助手（Agent/知识图谱/流式对话）
│   │   ├── data_import/        # 数据导入（沉降/裂缝/温度/振动）
│   │   ├── data_processing/    # 数据处理与指标计算
│   │   ├── db/repos/           # 数据库适配（Supabase HTTP / MySQL）
│   │   ├── insar/              # InSAR（区域引擎/聚类/地理计算）
│   │   ├── ml_models/          # ML 模型集（20+ 模块）
│   │   ├── module_registry/    # 模块注册与管理
│   │   ├── ticket_system/      # 工单（API/模型/邮件通知）
│   │   └── tunnel/             # 隧道监测
│   ├── fallback_app.py         # Vercel 降级 App
│   ├── start_system.py         # 本地启动入口
│   └── requirements.txt
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── pages/              # 13 个模块页面
│   │   ├── components/         # 可复用组件（助手/工单/认证/模块）
│   │   ├── shared/             # 共享组件（Nav 导航栏）
│   │   ├── contexts/           # React Context
│   │   ├── hooks/              # 自定义 Hooks
│   │   └── lib/                # 工具库（API 客户端等）
│   ├── android/                # Android 原生壳
│   └── package.json
├── mobile/                     # APK 构建配置与脚本
├── scripts/                    # 工具脚本（知识图谱/无人机/隧道）
├── docs/                       # 项目文档（升级计划/实施记录）
├── supabase/                   # Supabase 迁移脚本
├── tests/                      # 测试用例
├── static/                     # 静态资源（InSAR 数据等）
├── vercel.json                 # Vercel 部署配置
└── .env.example                # 环境变量示例
```

## 快速开始

### 环境变量

复制 `.env.example` 并填入实际值：
```bash
DB_VENDOR=supabase_http
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key
```

### 后端
```bash
pip install -r backend/requirements.txt
python backend/start_system.py
# 健康检查：curl http://localhost:5000/health
```

### 前端
```bash
cd frontend && npm install && npm run dev
# 访问 http://localhost:5173
```

### 移动端 APK
```bash
cd mobile && .\scripts\build-apk.ps1   # Windows
cd mobile && bash scripts/build-apk.sh  # Linux/macOS
```
详见 `mobile/README.md`。

## 主要 API 端点

### 监测数据
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/points` | 监测点列表（含预警与趋势） |
| GET | `/api/point/{id}` | 单点时间序列与分析 |
| GET | `/api/summary` | 监测点汇总分析 |
| POST | `/api/upload` | 上传沉降/裂缝 Excel |
| POST | `/api/temperature/upload` | 上传温度 MDB/ACCDB |
| GET | `/api/temperature/points` | 温度监测点列表 |
| GET | `/api/vibration/channels` | 振动监测通道列表 |
| GET | `/api/insar/points` | InSAR 监测点数据 |

### 智能分析
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analysis/v2/settlement` | 沉降完整分析 |
| GET | `/api/analysis/v2/settlement/anomalies` | 异常列表 |
| GET | `/api/analysis/v2/settlement/recommendations` | 处置建议 |
| POST | `/api/ml/anomalies/batch` | 批量异常检测 |
| GET | `/api/ml/auto-predict/{id}` | 自动预测 |
| POST | `/api/ml/causal-inference` | 因果推断 |
| POST | `/api/ml/spatial-correlation` | 空间关联分析 |

### 工程管理与其他
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/tickets` | 工单列表/创建 |
| PATCH | `/api/tickets/{id}` | 更新工单 |
| POST | `/api/shield/trajectory/calculate` | 计算盾构机轨迹 |
| POST | `/api/assistant/chat` | AI 助手对话 |
| GET | `/api/modules` | 模块配置列表 |
| GET | `/api/health` | 健康检查 |

## 技术栈

| 层 | 技术 |
|----|------|
| **后端框架** | Flask 3.x + Flask-CORS |
| **数据库** | Supabase (PostgreSQL HTTP REST API)，兼容 MySQL |
| **机器学习** | scikit-learn、statsmodels、PyTorch、SHAP |
| **深度学习模型** | Informer、STGCN、PINN（时序预测） |
| **知识图谱** | NetworkX（轻量）/ Neo4j（可选） |
| **数据处理** | pandas、numpy、scipy |
| **前端框架** | React 18 + TypeScript |
| **构建工具** | Vite 5 |
| **样式** | Tailwind CSS 3（深色主题） |
| **图表** | ECharts 5 |
| **3D** | Three.js |
| **地图** | Leaflet |
| **布局** | react-grid-layout |
| **路由** | React Router 6 |
| **移动端** | Capacitor 6（Android） |

## 前端页面

| 模块 | 路由 | 分类 |
|------|------|------|
| 封面 | `/cover` | 其他（绿色） |
| 沉降监测 | `/settlement` | 监测数据（蓝色） |
| 温度监测 | `/temperature` | 监测数据 |
| 裂缝监测 | `/cracks` | 监测数据 |
| 振动监测 | `/vibration` | 监测数据 |
| InSAR 监测 | `/insar` | 监测数据 |
| 数据总览 | `/overview` | 分析展示（紫色） |
| 高级分析 | `/advanced-analysis` | 分析展示 |
| 3D 模型 | `/3d-model` | 分析展示 |
| 隧道监测 | `/tunnel` | 分析展示 |
| 工单管理 | `/tickets` | 管理工具（橙色） |
| 盾构轨迹 | `/shield-trajectory` | 管理工具 |
| 模块管理 | `/module-admin` | 管理工具 |

## 部署

### Vercel（生产环境）

环境变量：`VERCEL=1`、`DB_VENDOR=supabase_http`、`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`DEEPSEEK_API_KEY`（可选）

**关键设置**：
- Root Directory：`python_scripts`
- Node.js 版本：**20.x**（24.x 会破坏 Python Function 检测）
- `api/` 目录只能有 `index.py` 一个 .py 文件，新代码放 `backend/`

### 本地部署
```bash
# 后端
python backend/start_system.py  # :5000

# 前端生产构建
cd frontend && npm run build
# 将 dist/ 部署到 Nginx/Apache
```

## 开发指南

### 添加新模块
1. 后端：`backend/modules/` 创建模块目录，注册 Blueprint 到 `api_server.py`
2. 前端：`frontend/src/pages/` 创建页面组件
3. 路由：`frontend/src/main.tsx` 添加路由
4. 导航：`frontend/src/shared/Nav.tsx` 添加导航项

### 仓库体积
- 保持以下目录不纳入版本控制：`static/`、`temp_uploads/`、`shield-machine-trajectory/`
- 二进制资产建议使用 Git LFS

## 许可

暂未设定许可协议。

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。
