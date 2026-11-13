# Ada The Coder for Android and iOS (Flutter)

The Windows app, on phones and tablets: its own screens (desktop_app/assets/app), built by its own Python
(desktop_app/ada_coder, apps/engine) running **on the device** with Pyodide, full screen and sideways.

- `lib/main.dart`: the app: one full-screen web view, sideways only; website pages open in the phone's browser.
- `lib/local_server.dart`: the app's own little server on the device: serves the app (assets/www), passes `/api` to
  adathecoder.com and keeps the answers (works offline), keeps lesson pictures and videos, and lets a child's program
  wait for `input()` answers and `time.sleep()`.
- `web_shell/`: the start page; it uses the same "window" as the website's /learn page (web/lib/appWindow.ts).
- `tool/prepare.sh`: puts everything inside the app (assets/www), makes `android/` and `ios/` with `flutter create`
  if needed, and sets them up (internet, the local server, sideways).

## Build

GitHub: **Actions → Build apps → Run workflow →** `android` or `ios` (the files are under the run's Artifacts).

On your own computer (Flutter, Node.js and Python 3 installed):
```
bash flutter_app/tool/prepare.sh
cd flutter_app
flutter build apk --release          # Android: build/app/outputs/flutter-apk/app-release.apk
flutter build ios --release          # iPhone/iPad, on a Mac with Xcode (then Xcode → Product → Archive)
```
Run `prepare.sh` again after changing the desktop app or the website's /learn files.
