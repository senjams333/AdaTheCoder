#!/bin/bash
# Ada The Coder: ONE file with everything needed to rebuild this server somewhere else.
#   bash ~/full_backup.sh
# Makes ~/ada-full-backup-DATE.tar with:
#   code.tar.gz          the website + API + app code (~/Ada), with api/.env and web/.env.local (the SECRETS)
#   database.sql.gz      the whole database (parents, licences, payments, themes, lessons, settings)
#   uploads.tar          lesson videos, pictures, covers and app installers
#   server-config.tar.gz nginx and the HTTPS certificates
#   scripts/, crontab.txt the backup and check scripts and the nightly schedule
#   restore_server.sh    puts it all back on a new Ubuntu server
#   server-info.txt      versions and settings of this server, for reference
# KEEP THIS FILE PRIVATE: it holds the passwords and keys (Razorpay, Brevo, database).
set -uo pipefail
export PATH="$PATH:/snap/bin:/usr/local/bin" AWS_DEFAULT_REGION=ap-south-1
ADA=~/Ada; STAMP=$(date +%Y-%m-%d_%H%M); NAME="ada-kit-$STAMP"; KIT=~/"$NAME"; OUT=~/"ada-full-backup-$STAMP.tar"
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
fail() { echo "FULL BACKUP FAILED: $*"; rm -rf "$KIT"; exit 1; }
step() { echo "==== $*"; }

cd "$ADA/api" 2>/dev/null || fail "no website folder at $ADA/api"
[ -f .env ] || fail "no $ADA/api/.env"
v() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r"'; }
UP=$(v UPLOAD_DIR); UP=${UP:-./uploads}; case "$UP" in /*) ;; *) UP="$ADA/api/${UP#./}";; esac
[ -f "$HERE/restore_server.sh" ] || fail "put restore_server.sh next to full_backup.sh (both are in the deploy folder)"

# enough room? the kit needs about the size of the uploads + code, twice for a moment
NEED=$(( $(du -sk "$UP" 2>/dev/null | cut -f1) * 2 + 500000 ))
FREE=$(df -Pk ~ | awk 'NR==2{print $4}')
[ "$FREE" -gt "$NEED" ] || fail "not enough free disk: need about $((NEED/1024)) MB, have $((FREE/1024)) MB. Delete old zips in ~ first."

mkdir -p "$KIT/scripts" && chmod 700 "$KIT"

step "1/6 Database"
CNF=$(mktemp); chmod 600 "$CNF"; trap 'rm -f "$CNF"' EXIT
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' "$(v DB_HOST)" "$(v DB_PORT)" "$(v DB_USER)" "$(v DB_PASSWORD)" > "$CNF"
mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --no-tablespaces --set-gtid-purged=OFF "$(v DB_NAME)" 2>"$KIT/.err" | gzip > "$KIT/database.sql.gz" \
  || mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --no-tablespaces "$(v DB_NAME)" 2>"$KIT/.err" | gzip > "$KIT/database.sql.gz"
[ "$(zcat "$KIT/database.sql.gz" 2>/dev/null | grep -c 'CREATE TABLE')" -gt 0 ] || fail "database: $(head -c 300 "$KIT/.err")"
rm -f "$KIT/.err"; echo "    $(zcat "$KIT/database.sql.gz" | grep -c 'CREATE TABLE') tables"

step "2/6 Code and secrets (without node_modules and build folders)"
tar -czf "$KIT/code.tar.gz" -C ~ --exclude='node_modules' --exclude='Ada/web/.next' --exclude='Ada/api/dist' \
  --exclude='Ada/api/uploads' --exclude='*.zip' --exclude='__pycache__' Ada || fail "code"
echo "    $(du -h "$KIT/code.tar.gz" | cut -f1)"

step "3/6 Uploads (videos, pictures, installers)"
tar -cf "$KIT/uploads.tar" -C "$UP" . || fail "uploads at $UP"
echo "    $(du -h "$KIT/uploads.tar" | cut -f1)"

step "4/6 nginx and HTTPS certificates"
sudo tar -czf "$KIT/server-config.tar.gz" -C / etc/nginx/sites-available etc/nginx/sites-enabled $(sudo test -d /etc/letsencrypt && echo etc/letsencrypt) \
  && sudo chown "$USER" "$KIT/server-config.tar.gz" || fail "nginx settings"

step "5/6 Scripts and nightly schedule"
for f in ada-backup.sh backup.sh check_theme.sh upload_video.sh .ada-backup.conf full_backup.sh; do [ -f ~/"$f" ] && cp ~/"$f" "$KIT/scripts/"; done
crontab -l > "$KIT/crontab.txt" 2>/dev/null || true
cp "$HERE/restore_server.sh" "$KIT/"
{
  echo "Ada The Coder server backup, $(date)"
  echo "Server: $(hostname), $(lsb_release -ds 2>/dev/null), $(uname -m)"
  echo "Website address: $(v SITE_URL)"
  echo "Node $(node -v 2>/dev/null), npm $(npm -v 2>/dev/null), pm2 $(pm2 -v 2>/dev/null | tail -1), $(mysql --version 2>/dev/null)"
  echo "Uploads folder: $UP"
  echo; echo "Disk:"; df -h ~ | tail -1
  echo; echo "Running:"; pm2 list 2>/dev/null
} > "$KIT/server-info.txt"

step "6/6 One file"
tar -cf "$OUT" -C ~ "$NAME" || fail "making $OUT"
rm -rf "$KIT"; chmod 600 "$OUT"
S3=$(grep -E '^S3_BUCKET=' ~/.ada-backup.conf 2>/dev/null | cut -d= -f2- | tr -d '\r" ')
if [ -n "$S3" ] && command -v aws >/dev/null; then
  aws s3 cp "$OUT" "s3://$S3/full/" --only-show-errors --sse AES256 && echo "    also copied to s3://$S3/full/" || echo "    (couldn't copy to S3; the file is still on the server)"
fi
echo
echo "FULL BACKUP OK: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Download it to your laptop (run this ON YOUR LAPTOP), then you can delete it from the server:"
echo "  scp -i Ada55555.pem ubuntu@$(curl -s -m 3 https://checkip.amazonaws.com || echo SERVER-IP):$OUT ."
