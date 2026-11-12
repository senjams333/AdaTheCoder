#!/bin/bash
# Ada The Coder: puts a full backup back on a NEW Ubuntu server (22.04 or 24.04).
#   1. copy ada-full-backup-DATE.tar to the new server's home folder
#   2. tar -xf ada-full-backup-*.tar --wildcards '*/restore_server.sh' --strip-components=1
#   3. bash restore_server.sh ada-full-backup-*.tar
# It installs everything (nginx, MySQL, Node.js, pm2), and puts back the code, secrets, database, uploads, nginx,
# HTTPS certificates, scripts and the nightly backup. It never touches an existing ~/Ada (it stops instead).
set -euo pipefail
FILE="$(readlink -f "${1:-}")"
[ -f "$FILE" ] || { echo "Usage: bash restore_server.sh ada-full-backup-DATE.tar"; exit 1; }
[ -e ~/Ada ] && { echo "~/Ada already exists on this server. This is for a NEW server, so nothing was changed."; exit 1; }
step() { echo; echo "######## $*"; }
WORK=$(mktemp -d ~/ada-restore.XXXX); chmod 700 "$WORK"

step "1/7 Unpacking the backup"
tar -xf "$FILE" -C "$WORK"
KIT=$(ls -d "$WORK"/ada-kit-* | head -1)
tar -xzf "$KIT/code.tar.gz" -C ~
cd ~/Ada/api
v() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r"' || true; }
cp .env "$WORK/api.env"; [ -f ../web/.env.local ] && cp ../web/.env.local "$WORK/web.env" || true
URL=$(v SITE_URL); HOST="${URL#*://}"; HOST="${HOST%%/*}"
echo "Website address: $URL"

step "2/7 Uploads"
UP=$(v UPLOAD_DIR); UP=${UP:-./uploads}; case "$UP" in /*) ;; *) UP="$HOME/Ada/api/${UP#./}";; esac
mkdir -p "$UP" && tar -xf "$KIT/uploads.tar" -C "$UP"
echo "$(du -sh "$UP" | cut -f1) in $UP"

step "3/7 Installing the server (nginx, MySQL, Node.js, pm2) and building: about 10 minutes"
bash ~/Ada/deploy/aws_server_setup.sh "$HOST"

step "4/7 Your own settings and secrets back"
cp "$WORK/api.env" ~/Ada/api/.env; chmod 600 ~/Ada/api/.env
[ -f "$WORK/web.env" ] && cp "$WORK/web.env" ~/Ada/web/.env.local
(cd ~/Ada/api && npm run build --silent) && (cd ~/Ada/web && npm run build >/dev/null) && echo "Built with $URL"

step "5/7 Database"
CNF=$(mktemp); chmod 600 "$CNF"
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' "$(v DB_HOST)" "$(v DB_PORT)" "$(v DB_USER)" "$(v DB_PASSWORD)" > "$CNF"
zcat "$KIT/database.sql.gz" | mysql --defaults-extra-file="$CNF" "$(v DB_NAME)"
echo "$(mysql --defaults-extra-file="$CNF" -N -e 'SELECT COUNT(*) FROM users' "$(v DB_NAME)") accounts restored"
rm -f "$CNF"

step "6/7 nginx and HTTPS certificates"
sudo tar -xzf "$KIT/server-config.tar.gz" -C /
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
command -v certbot >/dev/null || sudo apt-get install -y -qq certbot python3-certbot-nginx >/dev/null

step "7/7 Scripts, nightly backup, restart"
cp -n "$KIT"/scripts/* ~/ 2>/dev/null || true; cp -n "$KIT"/scripts/.ada-backup.conf ~/ 2>/dev/null || true
[ -s "$KIT/crontab.txt" ] && crontab "$KIT/crontab.txt"
command -v aws >/dev/null || sudo snap install aws-cli --classic >/dev/null 2>&1 || true
pm2 restart ada-api ada-web >/dev/null && pm2 save >/dev/null
sleep 5
curl -s -m 5 http://127.0.0.1:3000/api/health | grep -q '"ok":true' && echo "API: OK" || echo "API not answering yet: pm2 logs ada-api"
rm -rf "$WORK"
cat <<DONE

RESTORE DONE. Last steps (in the AWS console / your domain company):
  1. Point $HOST to this server: move the Elastic IP to it, or change the domain's A record to $(curl -s -m 3 https://checkip.amazonaws.com || echo "this server's IP").
  2. EC2 → this instance → Actions → Security → Modify IAM role → the backup role (for the S3 backups).
  3. Security group: allow ports 22, 80 and 443.
  4. Open $URL and log in to the admin to check.
DONE
