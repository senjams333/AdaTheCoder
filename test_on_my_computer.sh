#!/bin/bash
# Try everything on one Ubuntu (or Mac) computer: the website with its admin, and the app, talking to each other.
#   bash test_on_my_computer.sh
# Ubuntu 22.04 / 24.04: uses the Python that comes with Ubuntu. The first run asks for your password once,
# to install the system pieces the app window and lesson videos need, then takes a few minutes to download.
set -euo pipefail
cd "$(dirname "$0")"
HERE="$(pwd)"
URL=http://127.0.0.1:5000

# ---- 1. system pieces (Ubuntu / Debian only)
if command -v apt-get >/dev/null 2>&1; then
  ALSA=libasound2t64; apt-cache show libasound2t64 >/dev/null 2>&1 || ALSA=libasound2
  NEED=(python3-venv python3-pip
        libxcb-xinerama0 libxkbcommon-x11-0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1
        libxcb-render-util0 libxcb-shape0 libxcb-randr0 libgl1 libegl1 libnss3 libxcomposite1 libxdamage1
        libxrandr2 libxtst6 libxkbfile1 "$ALSA"
        libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good
        gstreamer1.0-plugins-bad gstreamer1.0-libav)
  MISSING=()
  for p in "${NEED[@]}"; do
    dpkg -s "$p" >/dev/null 2>&1 && continue
    apt-cache show "$p" >/dev/null 2>&1 && MISSING+=("$p")   # skip names this Ubuntu doesn't have
  done
  if [ ${#MISSING[@]} -gt 0 ]; then
    echo "Installing system pieces for the app window and videos (asks for your password):"
    echo "  ${MISSING[*]}"
    sudo apt-get update -qq
    sudo apt-get install -y "${MISSING[@]}"
  fi
fi

# ---- 2. a private Python environment in .venv (Ubuntu doesn't allow pip outside one)
PY=python3
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' || {
  echo "Python 3.10 or newer is needed. On Ubuntu: sudo apt install python3"; exit 1; }
if [ ! -x .venv/bin/python ]; then
  echo "Making a Python environment in .venv ..."
  "$PY" -m venv .venv
fi
VPY="$HERE/.venv/bin/python"
echo "Installing what the website and the app need (slow only the first time)..."
"$VPY" -m pip install -q --upgrade pip
"$VPY" -m pip install -q -r website/requirements.txt -r desktop_app/requirements.txt

# ---- 3. the website
if curl -s -o /dev/null "$URL" 2>/dev/null; then
  echo "A website is already running at $URL, using it."
  SITE=""
else
  echo "Starting the website at $URL  (log: website.log)"
  (cd website && exec "$VPY" app.py > "$HERE/website.log" 2>&1) &
  SITE=$!
  trap '[ -n "$SITE" ] && kill $SITE 2>/dev/null; pkill -f "$HERE/website/app.py" 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do curl -s -o /dev/null "$URL" 2>/dev/null && break; sleep 0.5; done
fi

# ---- 4. the admin in the browser, and the app
(xdg-open "$URL/admin/login" >/dev/null 2>&1 || open "$URL/admin/login" >/dev/null 2>&1 || \
  echo "Open $URL/admin/login in your browser.") &
echo
echo "Admin:  $URL/admin/login   (first visit: create the admin account)"
cd desktop_app
echo
"$VPY" run.py --server "$URL" --check || true
echo
echo "Starting the app, connected to that website. Closing the app also stops the website."
"$VPY" run.py --server "$URL"
