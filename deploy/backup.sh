#!/bin/bash
# Ada The Coder: daily backup of the website.
#
#   bash backup.sh                 → makes a backup now (do this before every website update too)
#   bash backup.sh install         → runs it by itself every night at 2:30 AM India time
#   bash backup.sh drive           → also copies every backup to your Google Drive (off the server), folder AdaBackups
#   bash backup.sh s3 BUCKET-NAME  → or to an Amazon S3 bucket instead
#   bash backup.sh status          → shows the backups and the last run
#
# Each backup: the whole database, the website settings (.env files) and every uploaded video and picture.
# On the server: ~/backups, the last 14 days. In Google Drive or S3 (when set up): the database for 60 days, and every upload.
set -uo pipefail

ADA=~/Ada
OUT=~/backups
CONF=~/.ada-backup.conf
KEEP_DAYS=14
LOG="$OUT/backup.log"
mkdir -p "$OUT"; chmod 700 "$OUT"

S3=""; DRIVE=""
[ -f "$CONF" ] && S3=$(grep -E '^S3_BUCKET=' "$CONF" | cut -d= -f2- | tr -d '\r" ')
[ -f "$CONF" ] && DRIVE=$(grep -E '^DRIVE=' "$CONF" | cut -d= -f2- | tr -d '\r" ')

case "${1:-}" in
  install)
    SELF=$(readlink -f "$0"); cp "$SELF" ~/ada-backup.sh 2>/dev/null; chmod 700 ~/ada-backup.sh
    # 21:00 UTC = 2:30 AM India time (the server's clock is UTC)
    ( crontab -l 2>/dev/null | grep -v 'ada-backup.sh'; echo "0 21 * * * bash $HOME/ada-backup.sh >/dev/null 2>>$LOG" ) | crontab -
    echo "INSTALLED: a backup runs every night at 2:30 AM India time. Check it any time with: bash ~/ada-backup.sh status"
    exit 0 ;;
  drive)
    command -v rclone >/dev/null || { echo "Install rclone first: sudo apt install -y rclone"; exit 1; }
    rclone listremotes | grep -qx 'adadrive:' || { echo "Connect Google Drive first: rclone config  (name it adadrive, see the steps)"; exit 1; }
    rclone mkdir adadrive:AdaBackups && rclone lsd adadrive: | grep -q AdaBackups \
      || { echo "This server can't reach your Google Drive. Run: rclone config reconnect adadrive:"; exit 1; }
    echo "DRIVE=adadrive:AdaBackups" > "$CONF"; chmod 600 "$CONF"
    echo "GOOGLE DRIVE SET: backups will also go to the AdaBackups folder in your Google Drive"; exit 0 ;;
  s3)
    [ -n "${2:-}" ] || { echo "Give the bucket name: bash backup.sh s3 my-bucket-name"; exit 1; }
    command -v aws >/dev/null || { echo "Install the AWS tool first: sudo snap install aws-cli --classic"; exit 1; }
    if ! aws s3 ls "s3://$2" >/dev/null 2>&1; then
      echo "This server can't reach the bucket s3://$2. Check the bucket name, and that the server has the backup role (see the steps)."; exit 1
    fi
    echo "S3_BUCKET=$2" > "$CONF"; chmod 600 "$CONF"
    echo "S3 SET: backups will also go to s3://$2"; exit 0 ;;
  status)
    echo "== Backups on the server ($OUT):"; ls -lh "$OUT" | grep -E 'ada-' || echo "  none yet"
    echo "== Nightly backup installed: $(crontab -l 2>/dev/null | grep -q ada-backup.sh && echo yes || echo NO)"
    echo "== Copies off the server: ${DRIVE:-${S3:-not set up}}"
    echo "== Last runs:"; grep -E 'BACKUP (OK|FAILED)' "$LOG" 2>/dev/null | tail -5 || echo "  none yet"
    exit 0 ;;
esac

STAMP=$(date -u +%Y-%m-%d_%H%M)
fail() { echo "$(date -u '+%F %T') BACKUP FAILED: $*" | tee -a "$LOG"; exit 1; }
cd "$ADA/api" || fail "no website folder at $ADA/api"
v() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r"'; }

# 1. The database. The password goes in a private file, so it never shows in the server's process list.
CNF=$(mktemp); chmod 600 "$CNF"; trap 'rm -f "$CNF"' EXIT
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' "$(v DB_HOST)" "$(v DB_PORT)" "$(v DB_USER)" "$(v DB_PASSWORD)" > "$CNF"
DB="$OUT/ada-db-$STAMP.sql.gz"
mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --no-tablespaces --set-gtid-purged=OFF "$(v DB_NAME)" 2>"$OUT/.err" | gzip > "$DB.part" \
  || mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --no-tablespaces "$(v DB_NAME)" 2>"$OUT/.err" | gzip > "$DB.part"
[ "$(zcat "$DB.part" 2>/dev/null | grep -c 'CREATE TABLE')" -gt 0 ] || { rm -f "$DB.part"; fail "database: $(head -c 300 "$OUT/.err")"; }
mv "$DB.part" "$DB"; chmod 600 "$DB"

# 2. The website settings (passwords and keys: kept private)
SET="$OUT/ada-settings-$STAMP.tar.gz"
tar -czf "$SET" -C "$ADA" $(cd "$ADA" && ls api/.env web/.env* 2>/dev/null) 2>/dev/null; chmod 600 "$SET"

# 3. Uploaded videos and pictures: one copy on the server, updated each night (only new or changed files are copied)
UP=$(v UPLOAD_DIR); UP=${UP:-./uploads}; case "$UP" in /*) ;; *) UP="$ADA/api/${UP#./}";; esac
mkdir -p "$OUT/uploads"; rsync -a "$UP/" "$OUT/uploads/" 2>/dev/null || cp -ru "$UP/." "$OUT/uploads/"

# 4. Older than 14 days: removed from the server (S3 keeps its own copies)
find "$OUT" -maxdepth 1 -name 'ada-*' -mtime +$KEEP_DAYS -delete

# 5. Off the server: Google Drive or S3
WHERE="server"
if [ -n "$DRIVE" ]; then
  rclone copy "$DB" "$DRIVE/database/" \
   && rclone copy "$SET" "$DRIVE/settings/" \
   && rclone copy "$UP/" "$DRIVE/uploads/" \
   && rclone delete "$DRIVE/database/" --min-age 60d \
   && rclone delete "$DRIVE/settings/" --min-age 60d \
   && WHERE="server + Google Drive" || fail "copy to Google Drive (the backup is still on the server in $OUT)"
elif [ -n "$S3" ]; then
  aws s3 cp "$DB" "s3://$S3/database/" --only-show-errors --sse AES256 \
   && aws s3 cp "$SET" "s3://$S3/settings/" --only-show-errors --sse AES256 \
   && aws s3 sync "$UP/" "s3://$S3/uploads/" --only-show-errors --sse AES256 \
   && WHERE="server + s3://$S3" || fail "copy to S3 (the backup is still on the server in $OUT)"
fi
echo "$(date -u '+%F %T') BACKUP OK: database $(du -h "$DB" | cut -f1), uploads $(du -sh "$OUT/uploads" | cut -f1) → $WHERE" | tee -a "$LOG"
rm -f "$OUT/.err"
