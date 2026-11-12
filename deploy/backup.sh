#!/bin/bash
# Ada The Coder: daily backup of the website.
#   bash backup.sh            → backup now (do this before every website update too)
#   bash backup.sh install    → every night at 2:30 AM India time
#   bash backup.sh s3 BUCKET  → also copy every backup to that Amazon S3 bucket
#   bash backup.sh status     → shows the backups and the last runs
set -uo pipefail
export AWS_DEFAULT_REGION=ap-south-1
ADA=~/Ada; OUT=~/backups; CONF=~/.ada-backup.conf; KEEP_DAYS=14; LOG="$OUT/backup.log"
mkdir -p "$OUT"; chmod 700 "$OUT"
S3=""; [ -f "$CONF" ] && S3=$(grep -E '^S3_BUCKET=' "$CONF" | cut -d= -f2- | tr -d '\r" ')
case "${1:-}" in
  install)
    cp "$(readlink -f "$0")" ~/ada-backup.sh 2>/dev/null; chmod 700 ~/ada-backup.sh
    ( crontab -l 2>/dev/null | grep -v 'ada-backup.sh'; echo "0 21 * * * bash $HOME/ada-backup.sh >/dev/null 2>>$LOG" ) | crontab -
    echo "INSTALLED: a backup runs every night at 2:30 AM India time. Check it with: bash ~/ada-backup.sh status"; exit 0 ;;
  s3)
    [ -n "${2:-}" ] || { echo "Give the bucket name: bash ~/backup.sh s3 BUCKET-NAME"; exit 1; }
    command -v aws >/dev/null || { echo "Install the AWS tool first: sudo snap install aws-cli --classic"; exit 1; }
    aws s3 ls "s3://$2" >/dev/null 2>"$OUT/.err" || { echo "Can't reach s3://$2: $(head -c 200 "$OUT/.err")"; echo "Check the bucket name and that the server has the ada-backup-role."; exit 1; }
    # old database and settings copies are removed by S3 itself after 60 days
    aws s3api put-bucket-lifecycle-configuration --bucket "$2" --lifecycle-configuration '{"Rules":[{"ID":"old-db","Status":"Enabled","Filter":{"Prefix":"database/"},"Expiration":{"Days":60}},{"ID":"old-settings","Status":"Enabled","Filter":{"Prefix":"settings/"},"Expiration":{"Days":60}}]}' \
      || { echo "Couldn't set the 60-day clean-up (check the role's permissions)."; exit 1; }
    echo "S3_BUCKET=$2" > "$CONF"; chmod 600 "$CONF"
    echo "S3 SET: backups will also go to s3://$2"; exit 0 ;;
  status)
    echo "== Backups on the server:"; ls -lh "$OUT" | grep -E 'ada-' || echo "  none yet"
    echo "== Nightly backup installed: $(crontab -l 2>/dev/null | grep -q ada-backup.sh && echo yes || echo NO)"
    echo "== Copies off the server: $([ -n "$S3" ] && echo "s3://$S3" || echo "not set up")"
    echo "== Last runs:"; grep -E 'BACKUP (OK|FAILED)' "$LOG" 2>/dev/null | tail -5 || echo "  none yet"; exit 0 ;;
esac
STAMP=$(date -u +%Y-%m-%d_%H%M)
fail() { echo "$(date -u '+%F %T') BACKUP FAILED: $*" | tee -a "$LOG"; exit 1; }
cd "$ADA/api" || fail "no website folder at $ADA/api"
v() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r"'; }
CNF=$(mktemp); chmod 600 "$CNF"; trap 'rm -f "$CNF"' EXIT
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' "$(v DB_HOST)" "$(v DB_PORT)" "$(v DB_USER)" "$(v DB_PASSWORD)" > "$CNF"
DB="$OUT/ada-db-$STAMP.sql.gz"
mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --no-tablespaces --set-gtid-purged=OFF "$(v DB_NAME)" 2>"$OUT/.err" | gzip > "$DB.part" \
  || mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --no-tablespaces "$(v DB_NAME)" 2>"$OUT/.err" | gzip > "$DB.part"
[ "$(zcat "$DB.part" 2>/dev/null | grep -c 'CREATE TABLE')" -gt 0 ] || { rm -f "$DB.part"; fail "database: $(head -c 300 "$OUT/.err")"; }
mv "$DB.part" "$DB"; chmod 600 "$DB"
SET="$OUT/ada-settings-$STAMP.tar.gz"
tar -czf "$SET" -C "$ADA" $(cd "$ADA" && ls api/.env web/.env* 2>/dev/null) 2>/dev/null; chmod 600 "$SET"
UP=$(v UPLOAD_DIR); UP=${UP:-./uploads}; case "$UP" in /*) ;; *) UP="$ADA/api/${UP#./}";; esac
mkdir -p "$OUT/uploads"; rsync -a "$UP/" "$OUT/uploads/" 2>/dev/null || cp -ru "$UP/." "$OUT/uploads/"
find "$OUT" -maxdepth 1 -name 'ada-*' -mtime +$KEEP_DAYS -delete
WHERE="server"
if [ -n "$S3" ]; then
  aws s3 cp "$DB" "s3://$S3/database/" --only-show-errors --sse AES256 \
   && aws s3 cp "$SET" "s3://$S3/settings/" --only-show-errors --sse AES256 \
   && aws s3 sync "$UP/" "s3://$S3/uploads/" --only-show-errors --sse AES256 --storage-class STANDARD_IA \
   && WHERE="server + s3://$S3" || fail "copy to S3 (the backup is still on the server in $OUT)"
fi
echo "$(date -u '+%F %T') BACKUP OK: database $(du -h "$DB" | cut -f1), uploads $(du -sh "$OUT/uploads" | cut -f1) → $WHERE" | tee -a "$LOG"
rm -f "$OUT/.err"
