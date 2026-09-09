#!/usr/bin/env bash
#
# One-time server setup for Excel Driving School on Ubuntu 24.04 (Lightsail, ap-south-1).
# Installs Node 22 and Caddy, creates the service account and directories, and installs
# the systemd unit. Safe to re-run: every step checks before acting.
#
# Usage, on the instance — a domain, or the static IP if you do not have one:
#   sudo bash provision.sh app.example.com admin@example.com
#   sudo bash provision.sh 203.0.113.10   admin@example.com
#
set -euo pipefail

ADDRESS="${1:-}"
EMAIL="${2:-}"

if [[ -z "$ADDRESS" || -z "$EMAIL" ]]; then
  echo "Usage: sudo bash provision.sh <domain-or-static-ip> <email-for-lets-encrypt>" >&2
  exit 1
fi

# Let's Encrypt will certify an IP address, but only under its six-day profile, so the
# two cases need different Caddy configuration.
if [[ "$ADDRESS" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  ADDRESS_KIND=ip
else
  ADDRESS_KIND=domain
fi

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

REPO_URL="${REPO_URL:-https://github.com/nand-codes/Excel.git}"
APP_DIR=/opt/excel-ds
DATA_DIR=/var/lib/excel-ds
BACKUP_DIR=/var/backups/excel-ds

echo "==> Updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https unzip

echo "==> Installing Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
# node:sqlite is still experimental, so the major version stays where we tested it.
apt-mark hold nodejs
node -v

echo "==> Installing Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi
caddy version
if [[ "$ADDRESS_KIND" == ip ]]; then
  echo "    IP certificates need Caddy 2.11 or newer; if issuance fails, run: sudo caddy upgrade"
fi

echo "==> Installing the AWS CLI (for the nightly S3 backup)"
if ! command -v aws >/dev/null; then
  arch=$(uname -m)
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${arch}.zip" -o /tmp/awscli.zip
  unzip -q -o /tmp/awscli.zip -d /tmp
  /tmp/aws/install --update
  rm -rf /tmp/awscli.zip /tmp/aws
fi

echo "==> Creating the service account and directories"
if ! id excelds >/dev/null 2>&1; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin excelds
fi
mkdir -p "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR" /var/log/caddy
chown -R excelds:excelds "$DATA_DIR" "$BACKUP_DIR"
chmod 750 "$DATA_DIR" "$BACKUP_DIR"

# Caddy runs as its own user and refuses to start if it cannot open its log file.
if id caddy >/dev/null 2>&1; then
  chown caddy:caddy /var/log/caddy
  chmod 750 /var/log/caddy
fi

echo "==> Fetching the application"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
chown -R excelds:excelds "$APP_DIR"

echo "==> Installing the environment file"
if [[ ! -f /etc/excel-ds.env ]]; then
  install -m 640 -o root -g excelds "$APP_DIR/deploy/excel-ds.env.example" /etc/excel-ds.env
  echo "    wrote /etc/excel-ds.env (review it now if you want non-default settings)"
fi

echo "==> Installing the systemd unit"
install -m 644 "$APP_DIR/deploy/excel-ds.service" /etc/systemd/system/excel-ds.service
systemctl daemon-reload
systemctl enable excel-ds

echo "==> Writing the Caddy configuration for $ADDRESS"
if [[ "$ADDRESS_KIND" == ip ]]; then
  TEMPLATE="$APP_DIR/deploy/Caddyfile.ip"
else
  TEMPLATE="$APP_DIR/deploy/Caddyfile"
fi
sed -e "s/app\.example\.com/${ADDRESS}/g" \
  -e "s/203\.0\.113\.10/${ADDRESS}/g" \
  -e "s/admin@example\.com/${EMAIL}/g" \
  "$TEMPLATE" >/etc/caddy/Caddyfile
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile

# Validating provisions the logging module, which creates the log file as root; the
# service then runs as caddy and cannot open it. Hand the whole directory back.
chown -R caddy:caddy /var/log/caddy

echo "==> Building and starting"
sudo -H -u excelds bash -c "cd '$APP_DIR' && npm ci --omit=dev"
sudo -H -u excelds bash -c "cd '$APP_DIR/web' && npm ci && npm run build"
systemctl restart excel-ds
systemctl reload caddy || systemctl restart caddy

echo "==> Installing the nightly backup job"
install -m 755 "$APP_DIR/deploy/backup-to-s3.sh" /usr/local/bin/excel-ds-backup
install -m 644 "$APP_DIR/deploy/excel-ds-backup.cron" /etc/cron.d/excel-ds-backup

sleep 2
echo
echo "Local health check:"
curl -fsS http://127.0.0.1:4000/api/health && echo

if [[ "$ADDRESS_KIND" == ip ]]; then
  ADDRESS_STEP="2. Nothing to do for DNS. Caddy is asking Let's Encrypt for a six-day
     certificate for ${ADDRESS} and renews it automatically, so leave 80 and 443
     open permanently. Watch the first issuance:  journalctl -u caddy -f"
else
  ADDRESS_STEP="2. Point an A record for ${ADDRESS} at this instance's static IP, then wait
     for DNS to resolve before loading the site (Caddy needs it for the certificate)."
fi

cat <<EOF

Done. Remaining manual steps:

  1. Lightsail → Networking: allow HTTPS 443 and HTTP 80 from anywhere, and
     restrict SSH 22 to your own IP address.
  ${ADDRESS_STEP}
  3. Create the staff accounts:
       sudo -u excelds EXCEL_DB_PATH=${DATA_DIR}/clients.sqlite \\
         node ${APP_DIR}/scripts/user-cli.js add --username admin --role admin
  4. Configure the S3 bucket name in /etc/excel-ds.env (EXCEL_S3_TARGET) and put
     the instance's IAM credentials in place, then test:  sudo excel-ds-backup

EOF
