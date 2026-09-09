#!/usr/bin/env bash
#
# Deploys the current main branch on the server: pull, install, build, restart, verify.
# The database lives outside /opt/excel-ds, so nothing here can touch your data.
#
# Usage, on the instance:
#   sudo bash /opt/excel-ds/deploy/deploy.sh
#
set -euo pipefail

APP_DIR=/opt/excel-ds
HEALTH_URL=http://127.0.0.1:4000/api/health

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

PREVIOUS=$(git -C "$APP_DIR" rev-parse --short HEAD)
echo "==> Currently deployed: $PREVIOUS"

echo "==> Taking a database snapshot first"
/usr/local/bin/excel-ds-backup || echo "    (snapshot failed; continuing, but check the backup job)"

echo "==> Pulling"
sudo -H -u excelds git -C "$APP_DIR" pull --ff-only

echo "==> Installing dependencies"
sudo -H -u excelds bash -c "cd '$APP_DIR' && npm ci --omit=dev"

echo "==> Building the front end"
# Vite needs its dev dependencies, and roughly 700 MB of free memory.
sudo -H -u excelds bash -c "cd '$APP_DIR/web' && npm ci && npm run build"

echo "==> Restarting"
systemctl restart excel-ds
sleep 2

if curl -fsS --max-time 10 "$HEALTH_URL" >/dev/null; then
  echo "==> Healthy at $(git -C "$APP_DIR" rev-parse --short HEAD)"
else
  echo "!! Health check failed — rolling back to $PREVIOUS" >&2
  sudo -H -u excelds git -C "$APP_DIR" reset --hard "$PREVIOUS"
  sudo -H -u excelds bash -c "cd '$APP_DIR' && npm ci --omit=dev"
  sudo -H -u excelds bash -c "cd '$APP_DIR/web' && npm ci && npm run build"
  systemctl restart excel-ds
  echo "!! Rolled back. Logs:  journalctl -u excel-ds -n 80 --no-pager" >&2
  exit 1
fi
