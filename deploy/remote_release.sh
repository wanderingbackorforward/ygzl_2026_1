#!/usr/bin/env bash
# 后端一键发布的服务端脚本：备份 -> 解包 -> 重启 -> 健康检查 -> 失败回滚
# 用法：bash remote_release.sh <包名>
set -euo pipefail

PKG="${1:?usage: remote_release.sh <package>}"
PKG_PATH="/opt/deploy/${PKG}"
APP_DIR="/opt/ygzl_2026_1_aliyun"
BACKUP_DIR="/opt/backup"
SERVICE="ygzl-aliyun"
HEALTH_URL="http://127.0.0.1:18080/api/health"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKUP_DIR}/backend_${TS}.tar.gz"

[ -f "$PKG_PATH" ] || { echo "包不存在: $PKG_PATH" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP" -C "$APP_DIR" backend
echo "已备份: $BACKUP"

tar -xzf "$PKG_PATH" -C "$APP_DIR"
systemctl restart "$SERVICE"

for _ in $(seq 1 30); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || true)"
  if [ "$CODE" = "200" ]; then
    echo "发布成功: $PKG (备份 $BACKUP)"
    exit 0
  fi
  sleep 2
done

echo "健康检查失败，回滚到 $BACKUP" >&2
tar -xzf "$BACKUP" -C "$APP_DIR"
systemctl restart "$SERVICE"
exit 1
