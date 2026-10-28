# Agent / contributor conventions (ygzl_2026_1)

## Production deploy (primary)

- **Aliyun single-machine** is the production path.
- Entry: `backend/wsgi.py` → gunicorn (`wsgi:app`).
- Templates: `deploy/aliyun/` (systemd + nginx + scripts).
- Follow `deploy/aliyun/README.md` on Ubuntu. Default branch: **`master`**.
- Do **not** use `backend/start_system.py` as a long-running production process.

## Dependencies

| Target | File |
|--------|------|
| Aliyun / local Linux | `backend/requirements.txt` (canonical) |
| Aliyun scripts (alias) | `backend/requirements.aliyun.txt` → includes the above |
| Vercel serverless (secondary) | `api/requirements.txt` only |
| Old Windows Anaconda dump | `backend/requirements.anaconda-windows.export.txt` (**do not install**) |

## Vercel (secondary / legacy)

- Root `vercel.json` + `api/index.py` (single `.py` under `api/`).
- `frontend/vercel.json` and `frontend/api/` are legacy; see `frontend/VERCEL_LEGACY.md`.
- Keep changes to `api/index.py` minimal; prefer editing `backend/`.

## Git hygiene

- Prefer reviewable PRs into `master`. Do **not** auto-push every edit.
- Do not force-push `master` or rewrite published history without explicit owner approval.
- Large static assets under `frontend/public/static/` stay in-tree for now.

## Frontend note

Several monitoring domains still have parallel `*New` / `*V2` pages. Converging
to one formal page per domain is a follow-up; do not drive-by delete live routes.
