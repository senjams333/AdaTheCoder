# Building the Windows app (.exe) for families

This folder is only the desktop app. The website, the API and the database run on your server
(for example on AWS). The app gets everything new from that server by itself.

## What updates by itself (no new .exe needed)

Anything you do in the website's admin reaches every installed app within about a minute:
new themes, new lessons and videos, prices and free lessons, the break reminder, home screen text.
Paid lessons download when a family buys or redeems a licence.

You only build a new .exe when the app's own code changes. Then raise `APP_VERSION` in
`desktop_app/ada_coder/config.py`, build, and upload it in **Admin → App versions** with the same
version number. Installed apps then tell families a new version is ready.

## 1. Have the server running first

The website and API must answer at one address, for example `http://13.234.10.20` or
`https://www.adathecoder.com` (nginx sends `/api/` and `/media/` to the API). See "Putting it on a
server" in the main README. Check it in a browser: `http://YOUR-ADDRESS/api/v3/courses` should show
some text (JSON).

## 2. On a Windows computer, install once

- **Python 3.11** from python.org. In the installer, tick **"Add python.exe to PATH"**.
- **Inno Setup 6** from jrsoftware.org (makes the single Setup .exe). Without it you get a .zip instead.

## 3. Build

1. Unzip this folder, for example to `C:\AdaBuild`.
2. Open **Command Prompt** and run:

```
cd C:\AdaBuild\AdaTheCoder-DesktopApp\desktop_app
build_windows.bat http://YOUR-AWS-ADDRESS
```

Use your real address, with no slash at the end. Leave it out to use `DEFAULT_SERVER_URL`
from `ada_coder\config.py` (set that to your real domain before launch).

The first build takes 5 to 10 minutes. The result is:

```
desktop_app\dist\AdaTheCoder-1.2.0-Windows-Setup.exe
```

## 4. Let families download it

In the website: **Admin → App versions** → upload the Setup .exe as version `1.2.0` and make it the
current download. Parents get it from their account page.

## Good to know

- To point an already built app at another server: edit `server_url.txt` beside `AdaTheCoder.exe`
  (in `C:\Users\<name>\AppData\Local\Programs\Ada The Coder` or `C:\Program Files\Ada The Coder`).
- Windows may show "Windows protected your PC" for an unsigned installer: click **More info → Run
  anyway**. For launch, sign the installer with a code-signing certificate.
- For real families use **https** with your domain, not a bare IP address.
