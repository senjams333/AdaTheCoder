#!/bin/bash
# Runs everything on one Ubuntu computer: MySQL, the API (NestJS), the website + admin (Next.js) and the app.
#   bash test_on_my_computer.sh
# First run: asks for your password once (system packages, MySQL) and downloads a lot (a few minutes).
# Close the app (or press Ctrl+C) to stop everything.
set -euo pipefail
cd "$(dirname "$0")"
HERE="$(pwd)"
API=http://127.0.0.1:3000
WEB=http://127.0.0.1:5000

# ---- 0. Node.js 18 or newer (via nvm if it's installed)
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; nvm use 20 >/dev/null 2>&1 || true; fi
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "Node.js 18 or newer is needed (you have: $(node --version 2>/dev/null || echo none)). Install Node 20:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "  source ~/.bashrc && nvm install 20"
  echo "Then run this script again."
  exit 1
fi

# ---- 1. system pieces for the app window and lesson videos (Ubuntu / Debian)
# SKIP_SYSTEM=1 bash test_on_my_computer.sh   skips this part (if you install them yourself)
if command -v apt-get >/dev/null 2>&1 && [ "${SKIP_SYSTEM:-}" != "1" ]; then
  NEED=(python3-venv python3-pip curl ffmpeg
        libxcb-xinerama0 libxkbcommon-x11-0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1
        libxcb-render-util0 libxcb-shape0 libxcb-randr0 libgl1 libegl1 libnss3 libxcomposite1 libxdamage1
        libxrandr2 libxtst6 libxkbfile1
        libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good
        gstreamer1.0-plugins-bad gstreamer1.0-libav)
  MISSING=()
  for p in "${NEED[@]}"; do
    dpkg -s "$p" >/dev/null 2>&1 && continue
    apt-cache show "$p" >/dev/null 2>&1 && MISSING+=("$p")   # skip names this Ubuntu doesn't have
  done
  # sound: the app needs one of these; most computers already have it, so it's never forced
  if ! dpkg -s libasound2t64 >/dev/null 2>&1 && ! dpkg -s libasound2 >/dev/null 2>&1; then
    echo "Note: no ALSA sound library (libasound2 / libasound2t64) found; lesson videos may play without sound."
  fi
  if [ ${#MISSING[@]} -gt 0 ]; then
    echo "Installing system pieces (asks for your password): ${MISSING[*]}"
    sudo apt-get update -qq || true
    # one at a time, so one package this computer can't install doesn't stop the rest
    for p in "${MISSING[@]}"; do
      sudo apt-get install -y "$p" >/dev/null 2>&1 || echo "  (skipped $p: it couldn't be installed here)"
    done
  fi
fi

# ---- 2. MySQL and the API
[ -f api/.env ] || cp api/.env.example api/.env
get() { grep -E "^$1=" api/.env | head -1 | cut -d= -f2-; }
if ! mysql -h 127.0.0.1 -u "$(get DB_USER)" -p"$(get DB_PASSWORD)" -e "SELECT 1" "$(get DB_NAME)" >/dev/null 2>&1; then
  echo "Setting up MySQL (database $(get DB_NAME), user $(get DB_USER))..."
  bash api/setup_mysql.sh
fi
[ -d api/node_modules ] || (echo "Installing the API's packages..." && cd api && npm install --no-audit --no-fund)
[ -d web/node_modules ] || (echo "Installing the website's packages..." && cd web && npm install --no-audit --no-fund)
[ -f web/.env.local ] || cp web/.env.example web/.env.local

PIDS=()
stop_all() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; }
trap stop_all EXIT

wait_for() {  # wait_for <url> <name> <log>
  for _ in $(seq 1 90); do curl -s -o /dev/null "$1" && return 0; sleep 1; done
  echo "$2 didn't start. The end of $3:"; tail -20 "$3"; exit 1
}

if curl -s "$API/api/health" | grep -q '"ok":true'; then
  echo "The API is already running."
else
  echo "Starting the API at $API/api  (log: api.log)"
  # DEV_SHOW_CODES: the sign-up page also shows the emailed code, for testing on this computer
  (cd api && DEV_SHOW_CODES=true npm run start:dev > "$HERE/api.log" 2>&1) & PIDS+=($!)
  wait_for "$API/api/health" "The API" api.log
fi

if curl -s -o /dev/null "$WEB"; then
  echo "The website is already running."
else
  echo "Starting the website at $WEB  (log: web.log)"
  (cd web && npm run dev > "$HERE/web.log" 2>&1) & PIDS+=($!)
  wait_for "$WEB" "The website" web.log
fi

# ---- 3. put the kids app on the website (theme "python_adventure": price, lessons, licences)
APP="${APP:-python_adventure}"
python3 apps/tools/export_theme.py "$APP" > /dev/null
(cd api && npm run -s theme -- import "../apps/$APP/theme_pack") || echo "(could not load the theme pack, see above)"

# ---- 4. the kids app (in a private Python environment, .venv)
[ -x .venv/bin/python ] || python3 -m venv .venv
VPY="$HERE/.venv/bin/python"
"$VPY" -m pip install -q --upgrade pip
"$VPY" -m pip install -q -r apps/requirements.txt
"$VPY" apps/make_key.py "$APP" > "$HERE/licence-key-for-testing.txt"

(xdg-open "$WEB/admin/login" >/dev/null 2>&1 || echo "Open $WEB/admin/login in your browser.") &
echo
echo "Website:  $WEB          Admin: $WEB/admin/login (first visit: create the admin account)"
echo "API:      $API/api"
echo "App:      Ada The Coder; theme $APP — lesson 1 free, 2-17 locked."
echo "          Unlock: licence key $(cat "$HERE/licence-key-for-testing.txt")"
echo "          or a parent with a licence for the theme $APP (Admin → Parents)"
echo
if [ "${KIDS_ONLY:-}" = "1" ]; then
  echo "Starting the kids app on its own. Closing it stops the website and the API too."
  "$VPY" apps/run.py "$APP" --server "$API" --site "$WEB"
else
  # Ada The Coder: one address for the website and the API (the website passes /api on), like on the real server
  "$VPY" -m pip install -q -r desktop_app/requirements.txt
  echo "Starting Ada The Coder. Closing it stops the website and the API too."
  echo "  (just the kids app: KIDS_ONLY=1 bash test_on_my_computer.sh)"
  "$VPY" desktop_app/run.py --server "$WEB"
fi
