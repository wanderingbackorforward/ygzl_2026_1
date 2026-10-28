# Backend

## Install (Aliyun / local Linux)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

From repo root, or `pip install -r requirements.txt` while cwd is `backend/`.

## Run

| Mode | Command |
|------|---------|
| **Production (Aliyun)** | gunicorn via `deploy/aliyun/ygzl.service` → `wsgi:app` |
| Local API only | `gunicorn -b 127.0.0.1:5000 wsgi:app` (cwd=`backend/`) |
| Local launcher (dev) | `python backend/start_system.py` (opens browser; not for production) |

## Requirements map

- `requirements.txt` — canonical (Aliyun + local)
- `requirements.aliyun.txt` — alias (`-r requirements.txt`) for older scripts
- `requirements.anaconda-windows.export.txt` — archived broken Anaconda dump; ignore
- `requirements_ml_upgrade.txt` — optional ML extras
- Repo `api/requirements.txt` — Vercel only (secondary)
