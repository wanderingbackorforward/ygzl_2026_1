# Legacy: frontend-scoped Vercel config

`frontend/vercel.json` and `frontend/api/` exist from an older Vercel layout
where the Vercel Root Directory was `frontend/`.

**Aliyun single-machine production does not use these files.**

If you still deploy on Vercel, use the **repository root** `vercel.json` +
`api/index.py` (not `frontend/api/`). Prefer Aliyun for production.
