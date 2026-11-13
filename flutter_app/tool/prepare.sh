#!/bin/bash
# Puts everything the app needs inside it (assets/www), then makes the Android and iOS folders if they aren't there
# yet and sets them up (internet, sideways only, the local server). Run from anywhere:
#     bash flutter_app/tool/prepare.sh
# Needs: Python 3 and Node.js (for esbuild); Flutter for the last part.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"          # flutter_app
ROOT="$(dirname "$HERE")"
WWW="$HERE/assets/www"

echo "== 1/4 The desktop app's screens and Python (desktop_app/webhost/build.py)"
python3 "$ROOT/desktop_app/webhost/build.py"

echo "== 2/4 Into the app: start page, Python (Pyodide), the app's screens"
rm -rf "$WWW" && mkdir -p "$WWW/learn"
cp "$HERE/web_shell/index.html" "$WWW/index.html"
cp -R "$ROOT/web/public/pyodide" "$WWW/pyodide"
cp "$ROOT/web/public/learn/py-worker.js" "$ROOT/web/public/learn/explain.py" "$WWW/learn/"
cp -R "$ROOT/web/public/appweb" "$WWW/appweb"
npx --yes esbuild@0.24.0 "$HERE/web_shell/shell.ts" --bundle --format=iife --target=es2019 --outfile="$WWW/shell.js" \
  --define:process.env.NEXT_PUBLIC_API_URL='"/api"' --define:process.env.NODE_ENV='"production"' --log-level=warning
echo "   $(du -sh "$WWW" | cut -f1) inside the app"

cd "$HERE"
if ! command -v flutter >/dev/null; then echo "Flutter isn't installed: install it (flutter.dev), then run this again for steps 3-4."; exit 0; fi

echo "== 3/4 Android and iOS folders"
if [ ! -d android ] || [ ! -d ios ]; then
  flutter create --platforms=android,ios --org com.adathecoder --project-name ada_the_coder .
  rm -f test/widget_test.dart          # Flutter's sample test (for its sample app, not this one)
fi
flutter pub get

echo "== 4/4 Settings: internet, the app's local server, sideways only"
M=android/app/src/main/AndroidManifest.xml
grep -q 'android.permission.INTERNET' "$M" || perl -0pi -e 's#<application#<uses-permission android:name="android.permission.INTERNET"/>\n    <application#' "$M"
grep -q 'usesCleartextTraffic' "$M" || perl -0pi -e 's#<application#<application android:usesCleartextTraffic="true"#' "$M"
grep -q 'screenOrientation' "$M" || perl -0pi -e 's#<activity#<activity android:screenOrientation="sensorLandscape"#' "$M"
perl -0pi -e 's#android:label="ada_the_coder"#android:label="Ada The Coder"#' "$M"
P=ios/Runner/Info.plist
if [ -f "$P" ] && [ -x /usr/libexec/PlistBuddy ]; then
  B=/usr/libexec/PlistBuddy
  for key in UISupportedInterfaceOrientations "UISupportedInterfaceOrientations~ipad"; do
    $B -c "Delete :$key" "$P" 2>/dev/null || true
    $B -c "Add :$key array" "$P"
    $B -c "Add :$key:0 string UIInterfaceOrientationLandscapeLeft" "$P"
    $B -c "Add :$key:1 string UIInterfaceOrientationLandscapeRight" "$P"
  done
  $B -c "Delete :NSAppTransportSecurity" "$P" 2>/dev/null || true
  $B -c "Add :NSAppTransportSecurity dict" "$P"
  $B -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" "$P"
  $B -c "Delete :UIRequiresFullScreen" "$P" 2>/dev/null || true
  $B -c "Add :UIRequiresFullScreen bool true" "$P"
  $B -c "Set :CFBundleDisplayName Ada The Coder" "$P" 2>/dev/null || $B -c "Add :CFBundleDisplayName string Ada The Coder" "$P"
fi
echo "Ready: flutter build apk   (Android)   ·   flutter build ios   (iPhone/iPad, on a Mac)"
