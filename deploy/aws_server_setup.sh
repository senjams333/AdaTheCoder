#!/bin/bash
# Puts Ada The Coder (website + admin + API + MySQL) on a fresh Ubuntu server, for example an AWS EC2 instance.
# Run it on the server, from the unzipped project folder:
#
#   bash deploy/aws_server_setup.sh 13.234.10.20                              (test with the server's IP address)
#   bash deploy/aws_server_setup.sh www.adathecoder.com you@example.com       (your domain, with free HTTPS)
#
# Running it again later (after copying a newer version of the project) updates the server the same way.
# Uploaded videos, the database and api/.env are kept.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

ADDR="${1:-}"; EMAIL="${2:-}"
if [ -z "$ADDR" ]; then
  echo "Usage: bash deploy/aws_server_setup.sh <server IP address or domain> [email for HTTPS]"; exit 1
fi
HOST="${ADDR#http://}"; HOST="${HOST#https://}"; HOST="${HOST%%/*}"
IS_IP=0; [[ "$HOST" =~ ^[0-9.]+$ ]] && IS_IP=1
SCHEME=http; [ "$IS_IP" = 0 ] && [ -n "$EMAIL" ] && SCHEME=https
URL="$SCHEME://$HOST"
step() { echo; echo "==== $*"; }

step "1/8  System packages (nginx, MySQL, ffmpeg, Node.js 20)"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx mysql-server ffmpeg curl ca-certificates build-essential openssl >/dev/null
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2 --silent
echo "Node $(node --version), npm $(npm --version)"

step "2/8  Extra memory for building the website (small servers only)"
MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
if [ "$MEM_KB" -lt 3500000 ] && ! swapon --show | grep -q .; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "Added 2 GB of swap."
else
  echo "Not needed."
fi

step "3/8  Settings (api/.env) for $URL"
[ -f api/.env ] || cp api/.env.example api/.env
set_env() {  # set_env KEY VALUE: replace the line, or add it
  if grep -qE "^$1=" api/.env; then sed -i "s|^$1=.*|$1=$2|" api/.env; else echo "$1=$2" >> api/.env; fi
}
get_env() { grep -E "^$1=" api/.env | head -1 | cut -d= -f2-; }
set_env HOST 127.0.0.1
set_env PORT 3000
set_env SITE_URL "$URL"
set_env API_PUBLIC_URL "$URL"
set_env CORS_ORIGINS "$URL"
set_env UPLOAD_DIR ./uploads
case "$(get_env JWT_SECRET)" in ""|a-long-random-string) set_env JWT_SECRET "$(openssl rand -hex 32)";; esac
case "$(get_env DB_PASSWORD)" in ""|your-mysql-password) set_env DB_PASSWORD "$(openssl rand -hex 16)";; esac
sed -i '/^DEV_SHOW_CODES=/d' api/.env          # never on a real server
chmod 600 api/.env
mkdir -p api/uploads
echo "SITE_URL=$URL  (Brevo, Razorpay and PayPal keys are kept as they are in api/.env)"

step "4/8  MySQL database"
bash api/setup_mysql.sh

step "5/8  API"
(cd api && npm install --no-audit --no-fund --silent && npm run build --silent)
pm2 delete ada-api >/dev/null 2>&1 || true
(cd api && pm2 start dist/main.js --name ada-api --time >/dev/null)

step "6/8  Website and admin"
echo "NEXT_PUBLIC_API_URL=$URL/api" > web/.env.local
(cd web && npm install --no-audit --no-fund --silent && npm run build)
pm2 delete ada-web >/dev/null 2>&1 || true
(cd web && pm2 start npm --name ada-web --time -- start >/dev/null)
pm2 save >/dev/null
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null   # starts again after a reboot

step "7/8  nginx: one address for the website and the API"
sudo tee /etc/nginx/sites-available/ada >/dev/null <<NGINX
server {
  listen 80;
  server_name $HOST;
  client_max_body_size 600m;
  location /api/   { proxy_pass http://127.0.0.1:3000; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; proxy_read_timeout 600s; }
  location /media/ { proxy_pass http://127.0.0.1:3000; }
  location /       { proxy_pass http://127.0.0.1:5000; proxy_set_header Host \$host; }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/ada /etc/nginx/sites-enabled/ada
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t -q && sudo systemctl reload nginx
if [ "$SCHEME" = https ]; then
  sudo apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  sudo certbot --nginx -d "$HOST" --non-interactive --agree-tos -m "$EMAIL" --redirect
fi

step "8/8  Check"
for _ in $(seq 1 60); do curl -s "$URL/api/health" | grep -q '"ok":true' && break; sleep 2; done
if curl -s "$URL/api/health" | grep -q '"ok":true'; then echo "API: OK"; else echo "API didn't answer yet. See: pm2 logs ada-api"; fi
if curl -s -o /dev/null -w '%{http_code}' "$URL/" | grep -qE '^(200|30)'; then echo "Website: OK"; else echo "Website didn't answer yet. See: pm2 logs ada-web"; fi

cat <<DONE

Done. Ada The Coder is at:  $URL
  Admin:            $URL/admin/login   (the first visit asks you to create the admin account)
  Server logs:      pm2 logs ada-api    /    pm2 logs ada-web
  Restart:          pm2 restart ada-api ada-web

Windows app for this server (on a Windows computer, in desktop_app):
  build_windows.bat $URL
DONE
