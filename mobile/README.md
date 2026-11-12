# Ada The Coder for Android and iOS (phones and tablets)

The phone and tablet app is the Windows app's own screens (adathecoder.com/learn, built by the app's own Python
running on the device), installed as a real app: an icon, full screen, sideways (landscape).

- **On the device:** the app, its screens, Python, pictures, and the themes, lessons and videos once used. The
  first time needs internet; after that it opens and runs **offline** (web/public/learn-sw.js keeps it there).
  Children's code runs on the device.
- **From your website:** new lessons, themes, licences and log-in, fetched whenever there is internet (like the
  Windows app's updates). Changes in the admin reach every device without a new app version.

| Folder | What | Built on |
|---|---|---|
| `android/` | Trusted Web Activity (the app runs in the phone's own Chrome, so `input()` and Stop work fully) | your Ubuntu laptop, with Bubblewrap |
| `ios/` | Capacitor app (Apple's web view), for iPhone and iPad | a Mac with Xcode (your own, or the AWS Mac) |

Deploy the website update first (it adds the app manifest, icons and the offline part).

---

## Android

### 1. Build (Ubuntu laptop, once)
```
sudo apt-get install -y openjdk-17-jdk
npm install -g @bubblewrap/cli
mkdir -p ~/ada-android && cd ~/ada-android
bubblewrap init --manifest=https://www.adathecoder.com/learn.webmanifest
```
Bubblewrap offers to download the Android SDK: answer **Yes**. Then it asks questions; answer:

| Question | Answer |
|---|---|
| Domain | `www.adathecoder.com` |
| URL path | `/learn` |
| Application name | `Ada The Coder` |
| Short name | `Ada Coder` |
| Application ID | `com.adathecoder.app` |
| Starting version code | `1` |
| Display mode | `fullscreen` |
| Orientation | `landscape` |
| Status bar / splash colours | `#38BDF8` / `#BAE6FD` |
| Icon / maskable icon | the URLs it suggests (`/icons/ada-512.png`, `/icons/ada-maskable-512.png`) |
| Play Billing / location / notifications | **No** |
| Key store | create a new one: `./android.keystore`, alias `android`, choose passwords |

**The key store and its passwords are the app's identity: keep them private and backed up. Without them you can
never update the app on the Play Store.** (`twa-manifest.json` in this folder shows the same settings.)

```
bubblewrap build
```
It makes `app-release-signed.apk` (to install directly) and `app-release-bundle.aab` (for the Play Store).

### 2. Let the app open full screen (once, on the website)
```
bubblewrap fingerprint generateAssetLinks
```
It writes `assetlinks.json`. Put it on the website:
```
ssh -i ~/Ada55555.pem ubuntu@52.66.68.193 "mkdir -p ~/Ada/web/public/.well-known"
scp -i ~/Ada55555.pem assetlinks.json ubuntu@52.66.68.193:~/Ada/web/public/.well-known/assetlinks.json
ssh -i ~/Ada55555.pem ubuntu@52.66.68.193 "pm2 restart ada-web"
```
Check https://www.adathecoder.com/.well-known/assetlinks.json shows it. (Without it, the app shows a small
address bar at the top.)

### 3. Install on your phone or tablet
- Copy `app-release-signed.apk` to the phone (USB, Google Drive, Telegram to yourself…), tap it, allow
  "Install unknown apps" for that app when asked, then **Install**.
- Or with a USB cable and USB debugging on: `~/.bubblewrap/android_sdk/platform-tools/adb install app-release-signed.apk`

Open **Ada Coder**: log in with the parent account once; it remembers it.

### 4. Play Store (when ready)
1. play.google.com/console ($25 once) → Create app → *Ada The Coder*, app, free.
2. Upload `app-release-bundle.aab` (Internal testing first, then Production).
3. Google re-signs the app: in Play Console → *Setup → App signing*, copy the **SHA-256** of the app signing key and
   **add it** to `assetlinks.json` (a second fingerprint in the list), upload it again (step 2).
4. Fill in: privacy policy URL `https://www.adathecoder.com/privacy`, Data safety, target age (6–11 → the
   Families policy applies), content rating.
5. New app version later: raise the version code in `twa-manifest.json`, `bubblewrap update && bubblewrap build`.
   (New lessons never need a new app version.)

---

## iPhone and iPad

### 1. On the Mac (once)
- Xcode from the App Store (open it once and accept the licence).
- Node.js 20: download the macOS installer from nodejs.org, or `brew install node`.
- An Apple Developer account ($99 a year) to install on real devices and publish.

### 2. Make the Xcode project
Copy the `ios` folder to the Mac (e.g. `scp -r mobile/ios ec2-user@MAC-IP:~/ada-ios`), then:
```
cd ~/ada-ios
npm install
npx cap add ios --packagemanager SPM
npx cap sync ios
bash landscape.sh
npx cap open ios
```
`landscape.sh` makes the app sideways only and full screen.

### 3. In Xcode
1. Select **App** (left) → *Signing & Capabilities* → Team: your Apple Developer team. Bundle identifier
   `com.adathecoder.app`.
2. *General → App Icons*: drag `web/public/icons/ada-512.png` (Xcode makes the sizes; or use an icon generator for a
   1024×1024 PNG without transparency).
3. Choose an **iPad** or **iPhone simulator** at the top and press ▶ to try it. Or plug in your iPhone/iPad and choose it.
4. To give it to testers or publish: *Product → Archive → Distribute App → App Store Connect* → then **TestFlight**
   (testers install the TestFlight app) or submit for review.

---

## Before sending to the stores (important)

- **Buying inside the app.** Apple (and Google Play for digital content) want in-app purchases through their own
  payment systems; an app that sends families to pay on a website can be rejected. The usual way for apps like this:
  the store app is free, families buy on the website, and the app only unlocks what the account owns. Ask Claude to
  make a "store version" in which Upgrade simply says "a grown-up can unlock this on the website" without a pay link.
- **Apple and simple web apps.** Apple may refuse apps that are "just a website". Ada The Coder runs Python on the
  device and works offline, which helps; describe that in the review notes.
- **Kids apps.** Both stores have extra rules for apps for children (no ads, no tracking, a parental gate before
  links that leave the app). Ada The Coder has no ads or tracking.
- **Test first:** the APK on your own Android phone and TestFlight on your iPhone/iPad: log in, open themes, run code,
  answer `input()` questions, a video, then airplane mode and open it again.
