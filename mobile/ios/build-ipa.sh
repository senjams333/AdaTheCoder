#!/bin/bash
# Builds the iPhone/iPad installer from the command line (no clicking in Xcode).
#   bash build-ipa.sh TEAMID testflight   -> builds and UPLOADS to App Store Connect (TestFlight)
#   bash build-ipa.sh TEAMID adhoc        -> builds an .ipa in ~/ada-ios-build/ipa for iPhones/iPads registered
#                                            in your Apple Developer account (Devices)
# TEAMID: developer.apple.com -> Account -> Membership details -> Team ID (10 letters/numbers).
set -euo pipefail
cd "$(dirname "$0")"
TEAM="${1:?Give your Team ID: bash build-ipa.sh TEAMID testflight}"
KIND="${2:-testflight}"
OUT=~/ada-ios-build
OPTS="ExportOptions-$KIND.plist"
[ -f "$OPTS" ] || { echo "Use testflight or adhoc"; exit 1; }
[ -d ios/App ] || { echo "Run  npm install && npm run setup  first."; exit 1; }
sed "s/YOUR_TEAM_ID/$TEAM/" "$OPTS" > /tmp/ada-export.plist
rm -rf "$OUT" && mkdir -p "$OUT"
PROJ=ios/App/App.xcodeproj; [ -d ios/App/App.xcworkspace ] && PROJ_ARG=(-workspace ios/App/App.xcworkspace) || PROJ_ARG=(-project "$PROJ")
echo "== 1/2 Building (a few minutes)"
xcodebuild "${PROJ_ARG[@]}" -scheme App -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUT/AdaTheCoder.xcarchive" DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates archive | tail -5
echo "== 2/2 Making the installer ($KIND)"
xcodebuild -exportArchive -archivePath "$OUT/AdaTheCoder.xcarchive" -exportPath "$OUT/ipa" \
  -exportOptionsPlist /tmp/ada-export.plist -allowProvisioningUpdates | tail -5
if [ "$KIND" = testflight ]; then
  echo "DONE: uploaded to App Store Connect. In a few minutes it appears under your app -> TestFlight."
else
  echo "DONE: installer at $OUT/ipa/App.ipa (installs on the devices registered in your Apple Developer account)."
fi
