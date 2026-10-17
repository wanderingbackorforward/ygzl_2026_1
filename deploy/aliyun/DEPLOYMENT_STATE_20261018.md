# 阿里云当前部署状态（2026-10-18）

- 本机 `D:/mine/myprojects/ygzl_2026_1`；云端 `/opt/ygzl_2026_1_aliyun`。当前云端目录没有 .git，不能直接照模板 git pull。
- systemd `ygzl-aliyun.service`，WorkingDirectory=`/opt/ygzl_2026_1_aliyun/backend`，根 `.venv/bin/gunicorn` 启动 `wsgi:app`，2个worker、每个4线程，18080；nginx以 `/ygzl/` 代理。
- 本机较新的应用与界面向云端同步；云端独有 `backend/wsgi.py`、`requirements.aliyun.txt`、deploy/aliyun模板回收到本机。重复嵌套目录的云端历史副本保留在此次完整备份，不引入主源码。
- 前端默认仍为Vercel根路径。阿里云构建使用 `VITE_BASE_PATH=/ygzl/ VITE_API_BASE=/ygzl/api`；BrowserRouter随Vite BASE_URL配置basename。构建产物是frontend/dist。环境差异有意保留，不相互覆盖。
- 阿里云使用 backend/requirements.aliyun.txt；Vercel使用api/requirements.txt。不要混用，不改api/index.py。
- 云端与本机Supabase项目相同，但域名当前均无法解析。用户已确认暂时没有新配置，先同步并记录“数据服务待恢复”。首页/健康/模块接口可核查；依赖该数据源的业务接口不能标记验收通过。
- 数据库与外部服务密钥只在受控.env。此次不将本机SUPABASE_DB_URL覆盖到云端（DB_VENDOR仍为supabase_http）；凭据相同与数据源可用是两件事。
- 统一同步规则：按有效领先内容逐文件合并；发布前备份并验证，不能只比较最后提交时间。
- 详细清单与验证：`D:/mine/myprojects/宁扬项目施组/docs/云端同步_20261018/`；云端回退材料：`/root/deployment-sync-backups/20261018/`。
