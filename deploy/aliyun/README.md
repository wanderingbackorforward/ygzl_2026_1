# 阿里云单机部署说明（生产主路径）

把本项目部署到一台 **Ubuntu 22.04** 阿里云 ECS。默认使用仓库 **`master`** 分支。

生产进程：**gunicorn** 加载 `backend/wsgi.py` 中的 `app`（`wsgi:app`），前面用 Nginx 托管 `frontend/dist` 并反代 API。

不要用 `backend/start_system.py` 作为长期生产进程（它会起子进程并尝试打开浏览器）。


## 两条部署路径（勿混用路径/服务名）

| 路径 | 目录 | 服务名 | 入口 |
|------|------|--------|------|
| **A. 独占 ECS（推荐生产）** | `/opt/ygzl_2026_1` | `ygzl`（本目录 `ygzl.service`） | Nginx:80 → gunicorn `127.0.0.1:5000` |
| **B. 共享机旁路** | `/opt/ygzl_2026_1_aliyun` | `ygzl-aliyun`（`deploy_safe.sh` 生成） | gunicorn 直接监听高位端口（默认 `18080`），**不改**现有 Nginx |

下文第 3–11 节按 **路径 A** 书写。路径 B 直接跑：

```bash
sudo bash deploy/aliyun/deploy_safe.sh
# 可选：APP_DIR=/opt/... SERVICE_NAME=... PUBLIC_PORT=18081 BRANCH=master
```


## 1. 结构

| 路径 | 作用 |
|------|------|
| `frontend/` | Vite 前端 → `frontend/dist` |
| `backend/modules/api/api_server.py` | Flask 应用主体 |
| `backend/wsgi.py` | ★ gunicorn 生产入口 |
| `backend/requirements.txt` | ★ 规范依赖（Linux） |
| `backend/requirements.aliyun.txt` | 兼容别名（`-r requirements.txt`） |
| `deploy/aliyun/` | systemd / nginx / 部署脚本 |

仓库根目录即项目根；不存在旧文档里的 `python_scripts/` 包装层。

## 2. 服务器初始化

```bash
apt update
apt install -y git curl nginx python3 python3-venv python3-pip
```

建议 Node.js **20.x**：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # v20.x
```

## 3. 拉取代码（master）

```bash
cd /opt
git clone https://github.com/wanderingbackorforward/ygzl_2026_1.git
cd /opt/ygzl_2026_1
git checkout master
git pull origin master
```

已有 clone：

```bash
cd /opt/ygzl_2026_1
git fetch origin
git checkout master
git pull origin master
```

> 历史分支名 `deploy/aliyun-single-machine` 已合入 `master`，新部署请用 **master**。  
> 脚本默认：`deploy/aliyun/deploy_safe.sh` 中 `BRANCH=master`。

## 4. 环境变量

```bash
cp .env.example .env
nano .env
```

至少：

```bash
DB_VENDOR=supabase_http
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key
SUPABASE_USE_HTTP=1
```

邮件 / DeepSeek 等可先留空；模块应降级，缺配置时再按日志补。完整字段见仓库根 `.env.example`。

## 5. 安装后端依赖

```bash
cd /opt/ygzl_2026_1
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r backend/requirements.txt
# 等价：pip install -r backend/requirements.aliyun.txt
```

**禁止**安装：

- `backend/requirements.anaconda-windows.export.txt`（旧 Windows/Anaconda 导出，含 `file:///C:/...`）
- `api/requirements.txt`（那是 Vercel 用的精简集，不是本机完整依赖）

## 6. 构建前端

```bash
cd /opt/ygzl_2026_1/frontend
npm ci
npm run build
ls /opt/ygzl_2026_1/frontend/dist
```

## 7. 权限

```bash
chown -R www-data:www-data /opt/ygzl_2026_1
```

若仍用 root `git pull`，需保证运行用户能读代码与 `.env`。

## 8. systemd

```bash
cp /opt/ygzl_2026_1/deploy/aliyun/ygzl.service /etc/systemd/system/ygzl.service
systemctl daemon-reload
systemctl enable ygzl
systemctl start ygzl
systemctl status ygzl --no-pager
```

日志与健康检查：

```bash
journalctl -u ygzl -n 100 --no-pager
curl http://127.0.0.1:5000/health
```

服务文件要点：`WorkingDirectory=.../backend`，`ExecStart=.../gunicorn ... wsgi:app`。

## 9. Nginx

```bash
cp /opt/ygzl_2026_1/deploy/aliyun/nginx.conf /etc/nginx/sites-available/ygzl
ln -sf /etc/nginx/sites-available/ygzl /etc/nginx/sites-enabled/ygzl
# 按需：rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

将 `nginx.conf` / 文档中的示例公网 IP 换成你的 ECS IP 或域名。不要对公网直接开放 5000。

## 10. 安全组

- TCP 22：SSH  
- TCP 80：HTTP  
- TCP 443：HTTPS（证书就绪后再开）  

## 11. 常见问题

### pip 失败

确认安装的是 `backend/requirements.txt`（或 `requirements.aliyun.txt` 别名），不是 Anaconda 导出文件。

### 页面开了但 API 失败

```bash
systemctl status ygzl --no-pager
journalctl -u ygzl -n 100 --no-pager
curl http://127.0.0.1:5000/health
```

### 刷新 404

Nginx `location /` 需有 `try_files $uri $uri/ /index.html;`。

### `/static/` 404（三维 / 瓦片 / 数据）

生产构建后静态文件在 **`frontend/dist/static/`**（由 Vite 从 `frontend/public/static/` 拷贝）。

- 路径 A：`nginx.conf` 优先从 `frontend/dist` 提供 `/static/`，缺失再回源 gunicorn。
- 路径 B（仅 gunicorn）：`backend/wsgi.py` 会把 Flask `static_folder` 指到 `frontend/dist/static`（或回退 `frontend/public/static`）。

### 大静态资源

drone / InSAR 等大文件体积很大；按需上传到服务器或改走 OSS/CDN。仓库内 `frontend/public/static/` 大数据目录本轮**不搬迁**。

## 12. 更新

```bash
cd /opt/ygzl_2026_1
git pull origin master
source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend && npm ci && npm run build
systemctl restart ygzl
systemctl reload nginx
```

## 13. 旁路脚本

- `deploy_safe.sh`：在共享机器上用高位端口旁路部署（默认 `BRANCH=master`）
- `deploy_from_current_dir.sh`：从当前工作树同步到 `/opt/...` 而不 git clone  

共享机上若已有其它站点，优先读脚本注释，避免占用 80/443/5000。

## 14. 部署前自检清单

- [ ] Ubuntu 22.04；已装 git / nginx / python3-venv / Node 20
- [ ] `git checkout master && git pull`
- [ ] 根目录 `.env` 已从 `.env.example` 复制，至少填好 `DB_VENDOR` + Supabase 三项 + `SUPABASE_USE_HTTP=1`
- [ ] `pip install -r backend/requirements.txt`（**不要**装 `requirements.anaconda-windows.export.txt`）
- [ ] `cd frontend && npm ci && npm run build`，存在 `frontend/dist/index.html` 与 `frontend/dist/static/three_test.html`
- [ ] 路径 A：已安装 `ygzl.service`，`curl 127.0.0.1:5000/health` 成功；Nginx `nginx -t` 通过；安全组放行 80
- [ ] 浏览器打开站点：`/cover` 可进；`/three` iframe 能加载；API 经 `/api/` 正常
- [ ] Supabase 项目网络可达（若域名解析失败，业务接口会挂，但 `/health` 仍应返回）

仍可能阻塞真实验收：Supabase 连通性、邮件/LLM 密钥、大资源是否已在服务器上。
