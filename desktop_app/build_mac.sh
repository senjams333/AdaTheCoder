#!/bin/bash
# Builds dist/AdaTheCoder-<version>-Mac.dmg on a Mac with Python 3.10-3.12 from python.org.
#   bash build_mac.sh                      uses DEFAULT_SERVER_URL in ada_coder/config.py
#   bash build_mac.sh http://your-server   this build talks to that website (for example a test server on AWS)
set -euo pipefail
cd "$(dirname "$0")"

# One build for every MacBook, old and new: an Intel (x86_64) app runs natively on Intel Macs and, through Apple's
# Rosetta, on Apple-chip Macs (M1, M2, M3, M4...). The app's lesson screens (Qt WebEngine 5.15) have no Apple-chip
# version, so on an Apple-chip Mac this script builds the Intel app under Rosetta.
if [ "$(uname -m)" = "arm64" ] && [ -z "${ADA_UNDER_ROSETTA:-}" ]; then
  /usr/bin/pgrep -q oahd || softwareupdate --install-rosetta --agree-to-license
  echo "Apple-chip Mac: building the Intel app under Rosetta (it runs on every Mac)."
  exec env ADA_UNDER_ROSETTA=1 arch -x86_64 /bin/bash "$0" "$@"
fi
export MACOSX_DEPLOYMENT_TARGET=11.0          # macOS 11 Big Sur and newer
PY=python3
if ! $PY -c "import sys; assert sys.version_info[:2] in ((3,10),(3,11),(3,12))" 2>/dev/null; then
  echo "Install Python 3.11 from python.org (the macOS 64-bit universal2 installer), then run this again."; exit 1
fi

$PY -m pip install --upgrade pip pyinstaller -r requirements.txt
$PY -m unittest discover tests
VERSION=$($PY -c "from ada_coder.config import APP_VERSION; print(APP_VERSION)")

# Mac icon from the round logo
rm -rf build/AdaTheCoder.iconset && mkdir -p build/AdaTheCoder.iconset
for s in 16 32 64 128 256 512; do
  sips -z $s $s assets/images/ada_logo.png --out build/AdaTheCoder.iconset/icon_${s}x${s}.png >/dev/null
  d=$((s * 2)); [ $d -le 512 ] && sips -z $d $d assets/images/ada_logo.png --out build/AdaTheCoder.iconset/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns build/AdaTheCoder.iconset -o build/AdaTheCoder.icns

$PY -m PyInstaller --noconfirm --clean AdaTheCoder.spec
if [ -n "${1:-}" ]; then
  echo "$1" > "dist/Ada The Coder.app/Contents/MacOS/server_url.txt"
  echo "This build uses the website at $1"
fi

# A disk image parents drag into Applications
rm -rf build/dmg && mkdir -p build/dmg
cp -R "dist/Ada The Coder.app" build/dmg/
ln -s /Applications build/dmg/Applications
hdiutil create -volname "Ada The Coder" -srcfolder build/dmg -ov -format UDZO "dist/AdaTheCoder-${VERSION}-Mac.dmg"

echo "Done: dist/AdaTheCoder-${VERSION}-Mac.dmg (Intel app: runs on Intel and Apple-chip MacBooks, macOS 11 or newer)"
echo "Upload it in the website admin under \"App versions\" as version ${VERSION}."
