#!/usr/bin/env bash
#
# Nightly backup: snapshot the SQLite database, then copy it to S3.
# Installed as /usr/local/bin/excel-ds-backup and run from /etc/cron.d/excel-ds-backup.
#
# Local snapshots are kept for 14 nights; S3 versioning plus a lifecycle rule keeps the
# long tail. If the upload fails the local snapshot still exists, and the exit code is
# non-zero so cron mails the failure.
#
set -euo pipefail

APP_DIR=/opt/excel-ds
BACKUP_DIR=/var/backups/excel-ds
KEEP=14

# EXCEL_DB_PATH and EXCEL_S3_TARGET come from the same file the service uses.
if [[ -f /etc/excel-ds.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/excel-ds.env
  set +a
fi

SNAPSHOT=$(
  cd "$APP_DIR" &&
    sudo -H -u excelds --preserve-env=EXCEL_DB_PATH \
      node scripts/backup-snapshot.js --out-dir="$BACKUP_DIR" --keep="$KEEP"
)

echo "Snapshot: $SNAPSHOT"

if [[ -z "${EXCEL_S3_TARGET:-}" ]]; then
  echo "EXCEL_S3_TARGET is not set in /etc/excel-ds.env — keeping the local snapshot only." >&2
  exit 0
fi

if ! command -v aws >/dev/null; then
  echo "The AWS CLI is not installed — keeping the local snapshot only." >&2
  exit 1
fi

# The bucket has default encryption on, and --sse makes it explicit if that ever changes.
aws s3 cp "$SNAPSHOT" "${EXCEL_S3_TARGET%/}/$(basename "$SNAPSHOT")" \
  --only-show-errors \
  --sse AES256 \
  --storage-class STANDARD_IA

echo "Uploaded to ${EXCEL_S3_TARGET%/}/$(basename "$SNAPSHOT")"
