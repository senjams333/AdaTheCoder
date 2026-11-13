#!/bin/bash
# Ada The Coder for iPhone and iPad: what the Xcode project needs after "npx cap add ios" / "npx cap sync ios".
#   - sideways only (landscape) and full screen (no split screen on iPad), no status bar
#   - App-Bound Domains: lets the app keep itself on the device and work offline (iOS runs a website's offline
#     part, its service worker, inside an app only for the domains listed here)
#   - the Ada icon (icon-1024.png)
set -e
cd "$(dirname "$0")"
P="ios/App/App/Info.plist"
B=/usr/libexec/PlistBuddy
[ -f "$P" ] || { echo "No $P: run  npx cap add ios --packagemanager SPM  first."; exit 1; }
for key in UISupportedInterfaceOrientations "UISupportedInterfaceOrientations~ipad"; do
  $B -c "Delete :$key" "$P" 2>/dev/null || true
  $B -c "Add :$key array" "$P"
  $B -c "Add :$key:0 string UIInterfaceOrientationLandscapeLeft" "$P"
  $B -c "Add :$key:1 string UIInterfaceOrientationLandscapeRight" "$P"
done
set_bool() { $B -c "Delete :$1" "$P" 2>/dev/null || true; $B -c "Add :$1 bool $2" "$P"; }
set_bool UIRequiresFullScreen true
set_bool UIStatusBarHidden true
set_bool UIViewControllerBasedStatusBarAppearance false
$B -c "Delete :WKAppBoundDomains" "$P" 2>/dev/null || true
$B -c "Add :WKAppBoundDomains array" "$P"
$B -c "Add :WKAppBoundDomains:0 string www.adathecoder.com" "$P"
$B -c "Add :WKAppBoundDomains:1 string adathecoder.com" "$P"
# no encryption beyond Apple's own (HTTPS): answers App Store Connect's export question once
set_bool ITSAppUsesNonExemptEncryption false
ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
if [ -d "$ICON_DIR" ] && [ -f icon-1024.png ]; then
  for f in "$ICON_DIR"/*.png; do cp icon-1024.png "$f"; done
  echo "App icon: icon-1024.png"
fi
echo "Info.plist: landscape only, full screen, App-Bound Domains (offline) set."
