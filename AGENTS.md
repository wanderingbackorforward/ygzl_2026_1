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

Each monitoring domain has one formal page (SettlementV2 / Temperature V2 cockpit /
VibrationV2 / Cracks). Do not reintroduce dual-tab New+V2 switchers or `/vibration-legacy`
implementations without an explicit product decision.

## Backend dual tracks

See `backend/README.md` § Dual tracks. Short version:

- `modules/database` = MySQL `db_config`; `modules/db` = `get_repo` vendor/repos (both used).
- `modules/assistant` = `/api/assistant` chat; `modules/agent` = `/api/agent` patrol/insights (both used).

Do not merge or delete either pair without grep+build proof and an explicit decision.

## Docs

Active guides under `docs/`; historical plans under `docs/archive/` (see `docs/README.md`).

## Cover vs Overview (`/cover` vs `/overview`)

Two different pages, not duplicates:

| Route | Page | Cards / UI |
|-------|------|------------|
| `/cover` | `Cover.tsx` | `components/overview/*` (SafetyScore, RiskRadar, domain overview cards) + OverviewContext |
| `/overview` | `OverviewV2.tsx` | Inline diagnosis UI + `components/overview-v2/SciencePanel` |

Do not reintroduce a shared cardRegistry between them. Prefer deleting only
components with zero importers after grep.
