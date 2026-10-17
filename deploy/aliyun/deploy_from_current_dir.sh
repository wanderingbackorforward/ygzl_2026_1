#!/usr/bin/env bash
set -euo pipefail

# Deploy from the current extracted project directory.
# Use this when the server cannot access GitHub reliably:
# 1. Download repo zip on your local machine.
# 2. scp the zip to the server.
# 3. unzip it on the server.
# 4. run this script from the extracted project root.
#
# This script does NOT stop existing projects.
# It does NOT touch Nginx.
# It binds to PUBLIC_PORT, default 18080.

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="${APP_DIR:-/opt/ygzl_2026_1_aliyun}"
SERVICE_NAME="${SERVICE_NAME:-ygzl-aliyun}"
PUBLIC_PORT="${PUBLIC_PORT:-18080}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
ALLOW_NODE_UPGRADE="${ALLOW_NODE_UPGRADE:-0}"

log() {
  printf '\n[ygzl-local-deploy] %s\n' "$*"
}

fail() {
  printf '\n[ygzl-local-deploy][ERROR] %s\n' "$*" >&2
  exit 1
}

if [ "$(id -u)" != "0" ]; then
  fail "Please run as root."
fi

case "$PUBLIC_PORT" in
  80|443|5000|5173|3000|8080)
    fail "PUBLIC_PORT=$PUBLIC_PORT may conflict with existing projects. Use a high unused port, e.g. PUBLIC_PORT=18080."
    ;;
esac

if ss -ltnp 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${PUBLIC_PORT}$"; then
  ss -ltnp | grep -E "(^|:)${PUBLIC_PORT}[[:space:]]" || true
  fail "Port $PUBLIC_PORT is already in use. Pick another one, e.g. PUBLIC_PORT=18081."
fi

log "Installing base packages if missing"
apt-get update
apt-get install -y unzip rsync curl ca-certificates build-essential "$PYTHON_BIN" python3-venv python3-pip

node_major() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi
  node -v | sed 's/^v//' | cut -d. -f1
}

NODE_MAJOR="$(node_major)"
if [ "$NODE_MAJOR" -lt 18 ] 2>/dev/null; then
  if command -v node >/dev/null 2>&1 && [ "$ALLOW_NODE_UPGRADE" != "1" ]; then
    fail "Existing Node.js is $(node -v), but Vite needs Node >= 18. To avoid breaking other projects, not upgrading automatically. Re-run with ALLOW_NODE_UPGRADE=1 if acceptable."
  fi
  log "Installing Node.js 20.x"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "Node.js: $(node -v)"

log "Copying project from $SRC_DIR to $APP_DIR"
mkdir -p "$APP_DIR"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'temp_uploads' \
  "$SRC_DIR/" "$APP_DIR/"

cd "$APP_DIR"

log "Preparing .env"
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  log "Created $APP_DIR/.env from .env.example. Edit it with real keys before relying on DB-backed features."
fi

log "Installing Python dependencies"
"$PYTHON_BIN" -m venv .venv
. "$APP_DIR/.venv/bin/activate"
pip install --upgrade pip setuptools wheel
pip install -r backend/requirements.aliyun.txt

log "Building frontend"
cd "$APP_DIR/frontend"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build

log "Writing systemd service $SERVICE_NAME"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=YGZL Digital Twin Flask API (archive deployment)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/.env
Environment=PYTHONUNBUFFERED=1
Environment=PORT=${PUBLIC_PORT}
ExecStart=${APP_DIR}/.venv/bin/gunicorn -w 2 -k gthread --threads 4 -b 0.0.0.0:${PUBLIC_PORT} --timeout 120 wsgi:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
sleep 2
systemctl status "$SERVICE_NAME" --no-pager || true

log "Health check"
curl -fsS "http://127.0.0.1:${PUBLIC_PORT}/health" || {
  journalctl -u "$SERVICE_NAME" -n 120 --no-pager || true
  fail "Health check failed."
}

log "Done. Open: http://120.55.70.218:${PUBLIC_PORT}/"
log "If browser cannot open it, add inbound TCP ${PUBLIC_PORT} in Aliyun security group."
