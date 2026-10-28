# 阿里云单机部署说明（生产主路径）

把本项目部署到一台 **Ubuntu 22.04** 阿里云 ECS。默认使用仓库 **`master`** 分支。

生产进程：**gunicorn** 加载 `backend/wsgi.py` 中的 `app`（`wsgi:app`），前面用 Nginx 托管 `frontend/dist` 并反代 API。

不要用 `backend/start_system.py` 作为长期生产进程（它会起子进程并尝试打开浏览器）。

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

### 大静态资源

部分资源可能未进 git 或体积很大；按需上传到服务器或改走 OSS/CDN。当前仓库内 `frontend/public/static/` 资产先保持不动。

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
