"""
Production WSGI entrypoint for single-machine deployment.

Why this file exists:
- backend/start_system.py is a local development launcher. It starts a subprocess
  and opens a browser, which is not suitable for gunicorn/systemd.
- This module exposes the Flask app object directly so gunicorn can manage
  workers, restarts, logs, and graceful shutdowns.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# Load environment variables from both repo root and backend directory.
# Existing OS environment variables still take precedence.
for env_file in (PROJECT_ROOT / ".env", BACKEND_DIR / ".env"):
    if env_file.exists():
        load_dotenv(env_file, override=False)

# Import after loading env so database/API clients can read configuration.
from modules.api import api_server  # noqa: E402

# On Vercel, frontend hosting is handled by Vercel. On a single VM, the Flask
# app can serve the built Vite assets from frontend/dist as a fallback behind Nginx.
frontend_dist = PROJECT_ROOT / "frontend" / "dist"
if frontend_dist.exists():
    api_server.WEB_DIST_DIR = str(frontend_dist)
    api_server.WEB_INDEX_PATH = str(frontend_dist / "index.html")

app = api_server.app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=port)
