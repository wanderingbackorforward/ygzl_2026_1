# Legacy Vercel entry (unused for Aliyun)

This `frontend/api/index.py` was a fallback when Vercel Root Directory pointed
at `frontend/`. Production Aliyun uses `backend/wsgi.py` via gunicorn.

Canonical Vercel serverless entry (secondary/legacy hosting) is `/api/index.py`
at the repository root.
