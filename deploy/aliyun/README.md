# 阿里云单机部署说明

这份说明用于把本项目部署到一台 Ubuntu 22.04 阿里云 ECS 上。

## 1. 结构判断

当前项目是典型的前后端分离结构：

- `frontend/`：React + Vite 前端，生产构建输出到 `frontend/dist`。
- `backend/`：Flask 后端，API 主入口在 `backend/modules/api/api_server.py`。
- `backend/wsgi.py`：本分支新增的生产入口，用于给 gunicorn 暴露 Flask `app`。
- `deploy/aliyun/`：本分支新增的部署模板，包括 systemd 和 Nginx 配置。

不要在生产环境使用 `backend/start_system.py` 作为长期进程。它会启动子进程并尝试打开浏览器，更适合本地开发。

## 2. 服务器初始化

```bash
apt update
apt install -y git curl nginx python3 python3-venv python3-pip nodejs npm
node -v
npm -v
python3 --version
```

建议 Node.js 使用 20.x。如果 apt 默认版本过低，可以安装 NodeSource 20.x：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
```

## 3. 拉取代码

```bash
cd /opt
git clone https://github.com/wanderingbackorforward/ygzl_2026_1.git
cd /opt/ygzl_2026_1
git checkout deploy/aliyun-single-machine
```

如果服务器上已经 clone 过：

```bash
cd /opt/ygzl_2026_1
git fetch origin
git checkout deploy/aliyun-single-machine
git pull
```

## 4. 配置环境变量

```bash
cp .env.example .env
nano .env
```

至少确认这些变量：

```bash
DB_VENDOR=supabase_http
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key
SUPABASE_USE_HTTP=1
```

如果暂时不用邮件/企业微信/DeepSeek 等功能，可以先不填对应 key；相关模块应优雅降级，若启动时报缺失依赖或配置，再按日志补。

## 5. 安装后端依赖

不要使用 `backend/requirements.txt`，它是 Windows/Anaconda 环境导出的，包含大量 `file:///C:/...` 路径，在 Ubuntu 上不可用。

使用本分支新增的 Linux 部署依赖：

```bash
cd /opt/ygzl_2026_1
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r backend/requirements.aliyun.txt
```

## 6. 构建前端

```bash
cd /opt/ygzl_2026_1/frontend
npm ci
npm run build
```

构建成功后应出现：

```bash
ls /opt/ygzl_2026_1/frontend/dist
```

## 7. 配置权限

```bash
chown -R www-data:www-data /opt/ygzl_2026_1
```

如果你后续还要用 root 直接 `git pull`，可以先不执行这一步；但 systemd 用 `www-data` 运行时，需要保证运行用户能读代码和 `.env`。

## 8. 配置 systemd 后端服务

```bash
cp /opt/ygzl_2026_1/deploy/aliyun/ygzl.service /etc/systemd/system/ygzl.service
systemctl daemon-reload
systemctl enable ygzl
systemctl start ygzl
systemctl status ygzl --no-pager
```

查看日志：

```bash
journalctl -u ygzl -n 100 --no-pager
journalctl -u ygzl -f
```

本机健康检查：

```bash
curl http://127.0.0.1:5000/health
```

## 9. 配置 Nginx

```bash
cp /opt/ygzl_2026_1/deploy/aliyun/nginx.conf /etc/nginx/sites-available/ygzl
ln -sf /etc/nginx/sites-available/ygzl /etc/nginx/sites-enabled/ygzl
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

外部访问：

```bash
curl http://120.55.70.218/health
```

浏览器访问：

```text
http://120.55.70.218/
```

## 10. 阿里云安全组

在阿里云 ECS 控制台确认安全组放行：

- TCP 22：SSH
- TCP 80：HTTP
- TCP 443：HTTPS，后续配置域名证书时再用

不要直接对公网开放 5000 端口。5000 只给本机 Nginx 反向代理访问。

## 11. 常见问题

### 11.1 pip 安装失败

优先确认你装的是：

```bash
pip install -r backend/requirements.aliyun.txt
```

不是：

```bash
pip install -r backend/requirements.txt
```

### 11.2 前端页面能打开，但 API 失败

检查：

```bash
systemctl status ygzl --no-pager
journalctl -u ygzl -n 100 --no-pager
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/api/source
```

### 11.3 页面刷新 404

确认 Nginx 里有：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

这行是给 React Router 的 SPA 路由兜底用的。

### 11.4 静态 3D/视频资源找不到

项目 `.gitignore` 当前忽略了很多大静态资源，例如 `static/glb/`、`static/videos/`。如果线上需要这些资源，需要手动上传到服务器对应目录，或改成对象存储 OSS/CDN。

## 12. 更新部署

后续代码更新后：

```bash
cd /opt/ygzl_2026_1
git pull
source .venv/bin/activate
pip install -r backend/requirements.aliyun.txt
cd frontend && npm ci && npm run build
systemctl restart ygzl
systemctl reload nginx
```
