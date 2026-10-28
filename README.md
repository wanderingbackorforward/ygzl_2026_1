# 隧道工程综合监测数字孪生系统（V1）

面向隧道及市政工程的综合监测数字孪生平台，集成沉降、裂缝、温度、振动、InSAR、盾构机轨迹、隧道结构健康等多源监测数据的采集、处理、智能分析与可视化。

- **后端**: Flask（生产入口 `backend/wsgi.py`）
- **前端**: React + Vite + TypeScript + Tailwind
- **数据库**: Supabase (PostgreSQL HTTP)
- **生产部署（主路径）**: 阿里云单机（systemd + Nginx + gunicorn）
- **次要/遗留**: Vercel（`https://ygzl-2026-1.vercel.app`）仍可构建，但不再作为主生产路径

## 目录结构（仓库根目录）

```
.
├── api/                 # Vercel Serverless 入口（次要）；仅 index.py 一个 .py
├── backend/             # Flask 后端
│   ├── wsgi.py          # ★ 生产入口（gunicorn wsgi:app）
│   ├── start_system.py  # 本地开发启动器（勿用于生产）
│   ├── requirements.txt # ★ 规范依赖（Aliyun / 本地 Linux）
│   └── modules/         # API、分析、导入、ML、工单等
├── frontend/            # React + Vite 前端 → 构建产物 frontend/dist
├── deploy/aliyun/       # ★ 阿里云部署模板（README / systemd / nginx / 脚本）
├── mobile/              # Capacitor APK 构建脚本
├── scripts/             # 运维/数据工具脚本
├── docs/                # 历史计划与实施记录（多数已过时，以本 README 为准）
├── supabase/            # SQL 迁移
├── vercel.json          # Vercel 配置（次要）
├── .env.example         # 环境变量模板
└── AGENTS.md            # 贡献/Agent 约定
```

> 旧文档中的 `python_scripts/` 前缀已废弃：仓库根目录就是上述布局。

## 快速开始（本地）

### 环境变量

```bash
cp .env.example .env
# 至少填写 SUPABASE_* 与 DB_VENDOR=supabase_http
```

### 后端

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
# 开发：python backend/start_system.py
# 或更接近生产：cd backend && gunicorn -b 127.0.0.1:5000 wsgi:app
curl http://127.0.0.1:5000/health
```

### 前端

```bash
cd frontend && npm ci && npm run dev
# http://localhost:5173
```

## 生产部署（主路径：阿里云）

完整步骤见 **[`deploy/aliyun/README.md`](deploy/aliyun/README.md)**。摘要：

1. 在 Ubuntu 22.04 ECS 上 clone **`master`** 分支到 `/opt/ygzl_2026_1`
2. `pip install -r backend/requirements.txt`（或兼容别名 `backend/requirements.aliyun.txt`）
3. `cd frontend && npm ci && npm run build`
4. systemd 使用 `deploy/aliyun/ygzl.service` → gunicorn **`wsgi:app`**
5. Nginx 使用 `deploy/aliyun/nginx.conf` 反代 API 并托管 `frontend/dist`

**不要**安装 `backend/requirements.anaconda-windows.export.txt`（历史 Anaconda 导出，含无效 `file:///C:/...` 路径）。

## 依赖文件对照

| 场景 | 使用 |
|------|------|
| Aliyun / 本地 Linux | `backend/requirements.txt` |
| 旧脚本别名 | `backend/requirements.aliyun.txt`（`-r` 指向上一行） |
| Vercel Function | `api/requirements.txt` |
| 勿用 | `backend/requirements.anaconda-windows.export.txt` |

## 主要 API（摘要）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` 或 `/api/health` | 健康检查 |
| GET | `/api/points` | 监测点列表 |
| POST | `/api/upload` | 沉降/裂缝上传 |
| GET | `/api/temperature/points` | 温度点 |
| GET | `/api/vibration/channels` | 振动通道 |
| GET | `/api/insar/points` | InSAR |
| GET/POST | `/api/tickets` | 工单 |
| POST | `/api/assistant/chat` | AI 助手 |

## 前端页面（路由）

| 模块 | 路由 |
|------|------|
| 封面 | `/cover` |
| 沉降 | `/settlement` |
| 温度 | `/temperature` |
| 裂缝 | `/cracks` |
| 振动 | `/vibration`（legacy: `/vibration-legacy`） |
| InSAR | `/insar` |
| 数据总览 | `/overview` |
| 高级分析 | `/advanced` |
| 3D | `/three` |
| 隧道 | `/tunnel` |
| 工单 | `/tickets` |
| 盾构 | `/shield-trajectory` |
| 模块管理 | `/modules` |

部分模块仍并存 `*New` / `*V2` 实现；收敛为每域单页是后续清理项。

## Vercel（次要 / 遗留）

仅在需要沿用现有 `ygzl-2026-1.vercel.app` 时使用：

- Root Directory：**仓库根**（不是 `python_scripts`，也不是单独的 `frontend/`）
- Node.js：**20.x**
- 环境变量：`VERCEL=1`、`DB_VENDOR=supabase_http`、`SUPABASE_*`；可选 `DEEPSEEK_API_KEY`
- 入口：`api/index.py`；依赖：`api/requirements.txt`
- `frontend/vercel.json` / `frontend/api/` 为旧布局遗留，见 `frontend/VERCEL_LEGACY.md`

## 移动端 APK

见 `mobile/README.md`。

## 许可

暂未设定许可协议。
