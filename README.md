# Ada The Coder

Python lessons for children aged 6 to 11. Two parts:

| Folder | What it is |
|---|---|
| `website/` | The website. Parents sign up, log in and download the app. Admins edit the website text, the themes (with their characters, price and free lessons), each theme's topics, lessons and videos, and the app versions. |
| `auth-api/` | Optional accounts API (NestJS + MySQL `admin_db`): register and log in, with Brevo welcome emails to the parent and the admin. See `auth-api/README.md`. |
| `desktop_app/` | The Windows and Mac app children use (PyQt5, start with `run.py`): themes of 17 lessons, each with a video, six examples and a code editor. Paid themes have free lessons to try, then Upgrade. See `desktop_app/README.md`. |

They're connected: every time the app opens, it asks the website for lesson changes, new lesson videos, a message for kids, and "new version available" notices.

```
Admin edits a theme, lesson or video ──► /api/v3/courses ──► app downloads it and shows it
Admin uploads app version 1.1.0         ──► /api/v1/app/latest ──► app shows "A new version is ready" + link
Parent logs in                          ──► /account ──► downloads the installer
```

---

## Test everything on your computer (website + admin + app)

- **Ubuntu 22.04 / 24.04:** open a terminal in this folder and run `bash test_on_my_computer.sh`.
  It uses Ubuntu's own Python, asks for your password once to install the pieces the app window and
  videos need (`apt`), makes a private Python environment in `.venv`, and downloads PyQt5 and Flask
  (a few minutes the first time; later runs start straight away).
- **Mac:** `bash test_on_my_computer.sh` (needs Python 3.10–3.12 from python.org).
- **Windows:** double-click `test_on_my_computer.bat` (needs Python 3.10–3.12 from python.org, with
  *Add Python to PATH* ticked).

It installs what's needed, starts the website, opens the admin in your browser and opens the app, already
connected to that website. Then:

1. In the browser, **create the admin account** (first visit only) and log in.
2. **Themes & lessons → Add a theme**: for example *Learn Coding in Space*, choose *Your own characters*,
   upload 3 pictures, tick *Paid theme*, price $2.99, 3 free lessons, *Copy lessons from* Friends Adventure,
   *Show this theme in the app*. Save.
3. **Open a theme**, click a topic, change its emoji, name, examples or upload a video. Save.
4. In the app: avatar menu → **🔄 Check for new lessons** (it also checks by itself every 3 minutes).
   The new theme appears on the home screen and the changed lessons appear in the list. (If the child
   is inside a lesson, the change waits until they press 🏠 Home, so their code isn't lost.)
5. Click **✨ Try free** on the new theme: lessons 1–3 open; lesson 4 shows 🔒 and **Upgrade**, which opens
   the website's account page.
6. To test a bought theme: sign up as a parent on the website, then in the admin **Parents** page give that
   parent a licence for the theme. In the app, log out and log in with the parent's email and password:
   the theme unlocks.

**If the app doesn't get the website's themes**, run the connection check (in the `desktop_app` folder):
`../.venv/bin/python run.py --check` (Windows: `python run.py --check`). It prints which website the
app uses, whether the website answers, the themes it sends, and what the app will show.

To point the app back at the real website: `python run.py --server default` in `desktop_app`.
To point an app at another test website: `python run.py --server http://that-address:5000`.

## 1. Try the website on your computer

You need Python 3.10 or newer.

```bash
cd website
pip install -r requirements.txt
python app.py                       # open http://127.0.0.1:5000
```

- Parent pages: http://127.0.0.1:5000 (Try For Free, Log in, My account)
- Admin: http://127.0.0.1:5000/admin/login (also linked as **Admin** at the bottom of every page)

**The admin account.** The first time you open the admin login page, it says *Create the admin account*:
type your name, email and a password (at least 10 characters) and you're in. From then on the same page
is a normal log-in. Change the password later on the admin's Overview page. Forgot it? On the server run
`flask --app app create-admin` with the same email to set a new password.

The website starts with the same 17 lessons as the app (`desktop_app/data/lessons.json`), word for word.

## 2. Run the app against your local website

```bash
cd desktop_app
pip install -r requirements.txt
# in ada_coder/config.py set SERVER_URL = "http://127.0.0.1:5000"
python run.py
```

Put the lesson videos in `desktop_app/vid/` (see `vid/README.txt`). The characters, logo and welcome
video are already in `desktop_app/assets/`. Everything else about the app (project layout, character
packs, how children's code runs, building) is in `desktop_app/README.md`.

## 3. Put the website online

Plain Flask with SQLite, so any Python host works. The database, installers and lesson videos must live on a **persistent disk**.

**Render (easiest):** push this folder to GitHub, then in Render choose *New → Blueprint* and pick the repo. `render.yaml` sets everything up. When it's live, open `/admin/login` straight away and create the admin account (do this before sharing the address, because the first person to open that page becomes the admin).

**Any other host:** set the variables from `website/.env.example` and start it with `gunicorn --workers 2 --timeout 300 app:app` from the `website` folder, behind HTTPS.

Then point your domain at it and check `SERVER_URL` in `desktop_app/ada_coder/config.py` (it's set to `https://www.adathecoder.com`).

## 4. Build the installers

The app uses Qt's built-in web view, which can't be packed into a single file, so:

- **Windows:** `desktop_app\build_windows.bat` builds the app and, if [Inno Setup 6](https://jrsoftware.org/isdl.php) is installed, one installer file: `AdaTheCoder-1.2.0-Windows-Setup.exe`. It installs for the current user (no admin password) and adds Start-menu and desktop shortcuts. Without Inno Setup you get a zip instead.
- **Mac:** `bash desktop_app/build_mac.sh` builds `AdaTheCoder-1.2.0-Mac.dmg`.
- **GitHub:** commit the videos (with Git LFS) and pictures, push a tag like `v1.0.0`, and `.github/workflows/build-apps.yml` builds both. Download them from the run's *Artifacts*.

Then in the admin: **App versions → Upload a new version**, choose the computer, type the same version as `APP_VERSION`, and upload.

**Test the packaged app before release**: open a lesson that uses `input()` (USER INPUT) and an OpenCV lesson, since those depend on the packaging.

### Releasing an update later

1. Change the app, and raise `APP_VERSION` in `desktop_app/ada_coder/config.py` (for example `1.3.0`).
2. Build, then upload both installers in the admin with version `1.1.0` and a "What's new" note.

Installed apps then show: *"A new version of Ada The Coder (1.1.0) is ready! Ask a grown-up to download it."* with a button to the download page.

**Lesson and video changes never need a new build.** Edit them in **Admin → Themes & lessons**. New themes (even with new characters) need no new build either.

## Accounts API (NestJS + MySQL)

`auth-api/` keeps parent accounts in MySQL (database `admin_db`, user `Admin`) and sends the Brevo
emails when someone registers: a welcome to the parent and a notice to the admin. To use it:

```bash
cd auth-api
bash setup_mysql.sh      # MySQL + database + user, from auth-api/.env
npm install
npm run start:dev        # http://127.0.0.1:3000/api
```

Then start the website with `AUTH_API_URL=http://127.0.0.1:3000/api` (`test_on_my_computer.sh` does
this by itself when the API is running). Parent sign-up, log-in, password changes and account deletion
on the website and in the app then go through the API. The admin still logs in on the website. If the
API is down, parents who have logged in before can still log in; new sign-ups wait until it's back.
Parent accounts made before the API was switched on aren't in MySQL: those parents need to sign up again.

## The website's API (used by the app)

| Address | What it does |
| --- | --- |
| `GET /api/v3/courses` | Every theme shown in the app, with its lessons, characters, price, free lessons and Upgrade link. `?since=<revision>` answers `{"unchanged": true}` when nothing changed. |
| `POST /api/v3/register` | Creates a parent account. JSON: `name`, `email`, `password` (8+ characters), `city`, `country`, `consent: true`; optional `password2`, `child_name`, `child_age`. Answers 201 `{"ok": true, "name", "email", "licences": []}`, 400 `{"ok": false, "errors": [...]}`, 409 if the email already has an account, 429 after 8 sign-ups from one address in 15 minutes. |
| `POST /api/v3/login` | JSON `email`, `password`. Answers `{"ok": true, "name", "email", "licences": [theme ids]}` or 401 `{"ok": false, "error"}`. |
| `GET /api/v1/app/latest?platform=windows&version=1.2.0` | Whether a newer app is ready to download. |
| `GET /api/v1/announcement` | The "Message in the app" from the admin. |
| `GET /media/videos/<file>`, `GET /media/courses/<file>` | Uploaded lesson videos and theme pictures. |

## 5. What the admin can do

| Page | What for |
|---|---|
| Overview | Sign-ups, downloads, current versions, change admin password |
| Website text | Headline, intro, site banner, the message kids see in the app, parents' note, author's note and name, contact email |
| Themes & lessons | All themes as cards. **Add a theme** (e.g. "Learn Coding in Space") with a name, one-line description, characters (a built-in pack or 3 uploaded pictures), price or Free, how many lessons are free to try, and order; it can start as a copy of another theme's lessons. **Open a theme** to see its lessons inside it: ▲▼ order, topic (emoji and name in the app's lesson list), title, subtitle, starting code, examples and video. **Theme settings** edits or deletes the theme. Paid themes appear on the parents' account page. |
| App versions | Upload Windows and Mac installers, choose the current download, see download counts |
| Parents | Search, turn accounts off or on, delete, export a CSV |

### Lesson videos

Each lesson plays either the video **inside the app** (the file in `vid/`, for example `vid/video1.mp4`) or a video **uploaded in the admin**. An uploaded video wins: installed apps download it in the background and play it from the next launch. Use this to fix a video or add a lesson without releasing a new app version. Uploads must be `.mp4`; keep them small (under about 100 MB) because every installed app downloads them.

## 6. Safety and privacy notes

- Children never create accounts or type personal details. The app keeps what it downloads in `%APPDATA%\AdaTheCoder` on Windows and `~/Library/Application Support/AdaTheCoder` on Mac.
- Passwords are hashed; every form has CSRF protection; logins are rate-limited; app downloads require a parent login; admin pages require an admin account. Lesson videos are public so the app can fetch them.
- `templates/privacy.html` is a starting template. Have it reviewed for the countries you serve (India's DPDP Act, GDPR, COPPA in the US) before launch.

## 7. Good to know before launch

- **Unsigned installers show warnings** ("Windows protected your PC", and Macs block the first open). The download page tells parents how to get past both. To remove the warnings, sign the Windows installer with a code-signing certificate, and sign and notarize the Mac app with an Apple Developer account.
- **Characters:** every course starts with the same 17 lessons, which mention Tom, Penny and Teddy. Edit the Fairies and Coding Club lessons to talk about their own characters.
- **Forgotten passwords:** there's no reset email yet (that needs an email provider). The login page asks parents to email you.
- **iPad and iPhone** aren't supported: Apple only allows apps there through the App Store.

## 8. Tests

```bash
cd website && python -m unittest discover tests        # website, admin, lessons, video upload, downloads
cd desktop_app && python -m unittest discover tests    # the app: lessons, code runner, settings
```
Set `ADA_TEST_SERVER=http://127.0.0.1:5000` while the website runs to also test the app against it.
