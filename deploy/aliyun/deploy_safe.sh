#!/usr/bin/env bash
set -euo pipefail

# Non-destructive deployment for a shared Aliyun ECS.
# It does NOT stop existing frontend/backend processes.
# It does NOT overwrite Nginx configs.
# It does NOT bind to 80/443/5000 by default.

REPO_URL="${REPO_URL:-https://github.com/wanderingbackorforward/ygzl_2026_1.git}"
BRANCH="${BRANCH:-deploy/aliyun-single-machine}"
APP_DIR="${APP_DIR:-/opt/ygzl_2026_1_aliyun}"
SERVICE_NAME="${SERVICE_NAME:-ygzl-aliyun}"
APP_USER="${APP_USER:-ygzl}"
PUBLIC_PORT="${PUBLIC_PORT:-18080}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
ALLOW_NODE_UPGRADE="${ALLOW_NODE_UPGRADE:-0}"

log() {
  printf '\n[ygzl-deploy] %s\n' "$*"
}

fail() {
  printf '\n[ygzl-deploy][ERROR] %s\n' "$*" >&2
  exit 1
}

need_root() {
  if [ "$(id -u)" != "0" ]; then
    fail "Please run as root. Example: sudo bash deploy/aliyun/deploy_safe.sh"
  fi
}

port_in_use() {
  ss -ltnp 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${PUBLIC_PORT}$"
}

check_safe_port() {
  case "$PUBLIC_PORT" in
    80|443|5000|5173|3000|8080)
      fail "PUBLIC_PORT=$PUBLIC_PORT looks likely to conflict with existing projects. Use an unused high port, e.g. PUBLIC_PORT=18080."
      ;;
  esac
  if port_in_use; then
    ss -ltnp | grep -E "(^|:)${PUBLIC_PORT}[[:space:]]" || true
    fail "Port $PUBLIC_PORT is already in use. Pick another one, e.g. PUBLIC_PORT=18081."
  fi
}

install_base_packages() {
  log "Installing base packages if missing"
  apt-get update
  apt-get install -y git curl ca-certificates build-essential "$PYTHON_BIN" python3-venv python3-pip
}

node_major() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi
  node -v | sed 's/^v//' | cut -d. -f1
}

ensure_node() {
  local major
  major="$(node_major)"
  if [ "$major" -ge 18 ] 2>/dev/null; then
    log "Node.js detected: $(node -v)"
    return
  fi

  if command -v node >/dev/null 2>&1 && [ "$ALLOW_NODE_UPGRADE" != "1" ]; then
    fail "Existing Node.js is $(node -v), but Vite needs Node >= 18. To avoid breaking other projects, I will not upgrade it automatically. Re-run with ALLOW_NODE_UPGRADE=1 if you accept upgrading global Node.js."
  fi

  log "Installing Node.js 20.x"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  log "Node.js installed: $(node -v)"
}

ensure_app_user() {
  if ! id "$APP_USER" >/dev/null 2>&1; then
    log "Creating system user: $APP_USER"
    useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
  fi
}

sync_code() {
  log "Syncing code into $APP_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" checkout "$BRANCH"
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  else
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
}

prepare_env() {
  log "Checking .env"
  if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    log "Created $APP_DIR/.env from .env.example. Edit it later for real Supabase/API keys if needed."
  fi
}

install_python_deps() {
  log "Installing Python dependencies"
  cd "$APP_DIR"
  "$PYTHON_BIN" -m venv .venv
  . "$APP_DIR/.venv/bin/activate"
  pip install --upgrade pip setuptools wheel
  pip install -r backend/requirements.aliyun.txt
}

build_frontend() {
  log "Building frontend"
  cd "$APP_DIR/frontend"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  npm run build
}

write_service() {
  log "Writing systemd service: $SERVICE_NAME"
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=YGZL Digital Twin Flask API (safe Aliyun deployment)
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
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
}

start_service() {
  log "Starting service: $SERVICE_NAME"
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
  sleep 2
  systemctl status "$SERVICE_NAME" --no-pager || true
}

smoke_test() {
  log "Smoke testing"
  curl -fsS "http://127.0.0.1:${PUBLIC_PORT}/health" || {
    journalctl -u "$SERVICE_NAME" -n 120 --no-pager || true
    fail "Health check failed. See logs above."
  }
  log "Deployment finished. Local health check passed."
  log "Try opening: http://$(curl -fsS ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):${PUBLIC_PORT}/"
  log "If it is unreachable from your browser, open TCP ${PUBLIC_PORT} in the Aliyun security group."
}

main() {
  need_root
  check_safe_port
  install_base_packages
  ensure_node
  ensure_app_user
  sync_code
  prepare_env
  install_python_deps
  build_frontend
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  write_service
  start_service
  smoke_test
}

main "$@"
