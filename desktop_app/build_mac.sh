#!/bin/bash
# Builds dist/AdaTheCoder-<version>-Mac.dmg on a Mac with Python 3.10-3.12 from python.org.
# Put the lesson videos in the "vid" folder first (see vid/README.txt).
set -euo pipefail
cd "$(dirname "$0")"

python3 -m pip install --upgrade pip pyinstaller -r requirements.txt
python3 -m unittest discover tests
VERSION=$(python3 -c "from ada_coder.config import APP_VERSION; print(APP_VERSION)")

# Mac icon from the round logo
rm -rf build/AdaTheCoder.iconset && mkdir -p build/AdaTheCoder.iconset
for s in 16 32 64 128 256 512; do
  sips -z $s $s assets/images/ada_logo.png --out build/AdaTheCoder.iconset/icon_${s}x${s}.png >/dev/null
  d=$((s * 2)); [ $d -le 512 ] && sips -z $d $d assets/images/ada_logo.png --out build/AdaTheCoder.iconset/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns build/AdaTheCoder.iconset -o build/AdaTheCoder.icns

python3 -m PyInstaller --noconfirm --clean AdaTheCoder.spec

# A disk image parents drag into Applications
rm -rf build/dmg && mkdir -p build/dmg
cp -R "dist/Ada The Coder.app" build/dmg/
ln -s /Applications build/dmg/Applications
hdiutil create -volname "Ada The Coder" -srcfolder build/dmg -ov -format UDZO "dist/AdaTheCoder-${VERSION}-Mac.dmg"

echo "Done: dist/AdaTheCoder-${VERSION}-Mac.dmg"
echo "Upload it in the website admin under \"App versions\" as version ${VERSION}."
