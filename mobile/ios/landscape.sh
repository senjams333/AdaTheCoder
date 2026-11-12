#!/bin/bash
# Ada The Coder on iPhone and iPad: sideways only (landscape), full screen (no split screen on iPad).
set -e
P="ios/App/App/Info.plist"
B=/usr/libexec/PlistBuddy
for key in UISupportedInterfaceOrientations "UISupportedInterfaceOrientations~ipad"; do
  $B -c "Delete :$key" "$P" 2>/dev/null || true
  $B -c "Add :$key array" "$P"
  $B -c "Add :$key:0 string UIInterfaceOrientationLandscapeLeft" "$P"
  $B -c "Add :$key:1 string UIInterfaceOrientationLandscapeRight" "$P"
done
$B -c "Delete :UIRequiresFullScreen" "$P" 2>/dev/null || true
$B -c "Add :UIRequiresFullScreen bool true" "$P"
$B -c "Delete :UIStatusBarHidden" "$P" 2>/dev/null || true
$B -c "Add :UIStatusBarHidden bool true" "$P"
echo "Info.plist: landscape only, full screen"
