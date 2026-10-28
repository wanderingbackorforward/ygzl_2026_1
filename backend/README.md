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
- `requirements_ml_upgrade.txt` — optional ML/research extras only (install after `requirements.txt`; never for Aliyun/Vercel prod — see file header)
- Repo `api/requirements.txt` — Vercel only (secondary)

## Dual tracks (intentional; do not merge casually)

Two pairs of similarly named packages are **both live**. Prefer documenting and
routing new code to the intended one; only delete after grep+import proof.

### `modules/database` vs `modules/db`

| Package | Role |
|---------|------|
| `modules/database` | Low-level MySQL helpers (`db_config`, connections). Used by data import/processing and by `modules/db` itself. |
| `modules/db` | Repository / vendor layer (`get_repo`, `repos/`). Used by tickets, analysis_v2, temperature_v2, tunnel, api_server, agent patrol. |

New feature code that needs app data should go through `modules.db.vendor.get_repo` unless it is a batch ETL script that already uses `db_config`.

### `modules/assistant` vs `modules/agent`

| Package | Role | HTTP prefix |
|---------|------|-------------|
| `modules/assistant` | Chat / LLM floating assistant (conversations, tools, streaming) | `/api/assistant` |
| `modules/agent` | Patrol / insights / badge / cron (ops agent) | `/api/agent` |

Different products. Both blueprints are registered from `modules/api/api_server.py`. Do not collapse them without an explicit product decision.
