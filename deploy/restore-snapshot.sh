#!/usr/bin/env bash
#
# Restores the database from a snapshot produced by scripts/backup-snapshot.js.
#
#   sudo bash restore-snapshot.sh /var/backups/excel-ds/clients-2026-09-09T02-17-00Z.sqlite.gz
#
# Accepts a .sqlite.gz or a plain .sqlite file. The instance's IAM role can only *write*
# to S3, so pull the file down with your own credentials first:
#   aws s3 cp s3://excel-ds-backups-.../snapshots/<file> .
#
# The database in place now is moved aside rather than deleted, so a restore is reversible.
#
set -euo pipefail

SOURCE="${1:-}"
DATA_DIR=/var/lib/excel-ds
DB="$DATA_DIR/clients.sqlite"

if [[ -z "$SOURCE" ]]; then
  echo "Usage: sudo bash restore-snapshot.sh <snapshot.sqlite.gz>" >&2
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "No such file: $SOURCE" >&2
  exit 1
fi

read -rp "This replaces the live database with $(basename "$SOURCE"). Type RESTORE to continue: " reply
[[ "$reply" == "RESTORE" ]] || { echo "Aborted."; exit 1; }

echo "==> Stopping the service"
systemctl stop excel-ds

STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
if [[ -f "$DB" ]]; then
  echo "==> Moving the current database aside"
  # The WAL and shm files belong to the old database; leaving them would corrupt the new one.
  for suffix in '' '-wal' '-shm'; do
    [[ -f "${DB}${suffix}" ]] && mv "${DB}${suffix}" "${DB}${suffix}.replaced-${STAMP}"
  done
fi

echo "==> Writing the snapshot"
if [[ "$SOURCE" == *.gz ]]; then
  gunzip -c "$SOURCE" >"$DB"
else
  cp "$SOURCE" "$DB"
fi
chown excelds:excelds "$DB"
chmod 640 "$DB"

echo "==> Checking integrity"
sudo -u excelds node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('$DB', { readOnly: true });
  const check = db.prepare('PRAGMA integrity_check').get();
  const clients = db.prepare('SELECT COUNT(*) AS n FROM clients').get();
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  db.close();
  const status = Object.values(check)[0];
  if (status !== 'ok') { console.error('integrity_check: ' + status); process.exit(1); }
  console.log('integrity ok — ' + clients.n + ' clients, ' + users.n + ' users');
"

echo "==> Starting the service"
systemctl start excel-ds
sleep 2
curl -fsS http://127.0.0.1:4000/api/health && echo

cat <<EOF

Restored from $(basename "$SOURCE").
The previous database is still here as ${DB}.replaced-${STAMP} — delete it once you are happy.
Everyone will need to sign in again if the snapshot predates their session.
EOF
