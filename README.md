# Ada The Coder

Python lessons for children aged 6 to 11. Three parts:

| Folder | What it is |
| --- | --- |
| `api/` | The backend: **NestJS + MySQL** (database `admin_db`). Parent accounts, the first admin, website text, themes with their lessons, characters and videos, app versions, parents and licences. Sends the **Brevo** emails when someone registers (a welcome to the parent, a notice to the admin). See `api/README.md`. |
| `web/` | The website and the admin: **Next.js + Redux Toolkit** (RTK Query). Home page, sign up, log in, the parent's account page (downloads, themes, licences), privacy, and the whole admin. Everything comes from the API. See `web/README.md`. |
| `themes/` | **Theme packs**: a folder per theme (theme.json, character pictures, example code as .py files, videos). `npm run theme -- import ../themes/space` in `api/` loads one; installed apps show it by themselves. See `themes/README.md`. |
| `apps/` | **The kids apps made from `3-General.py`**: one engine, one folder per app (Python Adventure, Fairy Python, ...). Lesson 1 free, lessons 2–17 🔒 (licence key, parent account, or the grown-ups' PIN screen). `python apps/new_app.py` makes the next app. See `apps/README.md`. |
| `desktop_app/` | The earlier Windows and Mac app (PyQt5). It downloads the themes and lessons from the API, logs parents in, and unlocks bought themes. See `desktop_app/README.md`. |

```
Admin edits a theme, lesson or video (web/admin) ──► API + MySQL ──► /api/v3/courses ──► the app shows it
Parent signs up (website or app)                 ──► API ──► Brevo emails to the parent and the admin
Admin uploads an app version                     ──► API ──► /api/v1/app/latest ──► "A new version is ready"
```

## Try everything on your computer (Ubuntu)

You need **Node.js 18 or newer** (20 recommended). Ubuntu's own `nodejs` is often too old; install Node 20 with nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

Then, in this folder:

```bash
bash test_on_my_computer.sh
```

It installs what's missing (asks for your password once), sets up MySQL (database `admin_db`, user `Admin`
from `api/.env`), starts the API on http://127.0.0.1:3000/api and the website on http://127.0.0.1:5000,
opens the admin in your browser, and opens the app connected to them. Close the app to stop everything.
Logs: `api.log` and `web.log`.

1. **Admin:** http://127.0.0.1:5000/admin/login. The first visit says *Create the admin account*; after
   that it's a normal log-in.
2. **Themes & lessons → Add a theme** (for example *Learn Coding in Space*, with your own 3 character
   pictures, paid, 3 free lessons). Open a theme to edit its topics, lessons and videos.
3. In the app: avatar menu → **🔄 Check for new lessons** (it also checks every 3 minutes).
4. **Try free** in the app: the free lessons open; the others show 🔒 and **Upgrade** opens the website.
5. A bought theme: sign up as a parent, give the parent a licence in **Admin → Parents**, then log in to
   the app with the parent's email: the theme unlocks.

Windows: `test_on_my_computer.bat` (needs Node 20, Python 3.10–3.12 and MySQL 8 installed).

## Running each part by hand

```bash
# API
cd api
cp .env.example .env        # then fill in MySQL, JWT_SECRET and Brevo
bash setup_mysql.sh         # once: MySQL + database + user
npm install
npm run start:dev           # http://127.0.0.1:3000/api   (health: /api/health)

# Website + admin
cd web
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://127.0.0.1:3000/api
npm install
npm run dev                 # http://127.0.0.1:5000

# Desktop app
cd desktop_app
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python run.py --server http://127.0.0.1:3000
```

## Adding themes

New themes, lessons and videos never need a new `.exe`: the installed app downloads them from the API.
Add them either way:

- **In the admin**: Themes & lessons → Add a theme, then open it to add or edit lessons.
- **As a theme pack** (a folder you write in your editor, see `themes/README.md`):
  `cd api && npm run theme -- import ../themes/space`.

A new `.exe` is only needed when the app itself changes (a new feature or a fix): raise `APP_VERSION`,
build, and upload it in Admin → App versions; installed apps then offer the update.

## What the admin can do

| Page | What it does |
| --- | --- |
| Overview | Sign-ups, downloads, current app versions, newest parents, change the admin password |
| Website text | Headline, text under it, the yellow banner, the message shown in the app, the note for parents, the author's letter, the contact email |
| Themes & lessons | All themes as cards. **Add a theme**: name, ID, description, characters (a built-in pack or 3 uploaded pictures), price or free, free lessons to try, order, card picture, copy lessons from another theme. **Open a theme**: its lessons inside it, ▲▼ order, edit or delete. **Theme settings**: change or delete the theme |
| Lesson editor | Topic (emoji and name in the app's list), lesson ID, title, subtitle, starting code, examples (button label, explanation, code, expected output), upload or remove a video, show or hide |
| App versions | Upload Windows and Mac installers, choose the current download, oldest version still allowed |
| Parents | Search, plan (free/premium), licences per paid theme, turn accounts off or on, delete, export CSV |

## The API's addresses

All under `/api`. JSON in and out. `Bearer` = the `token` from log-in in an `Authorization` header.

| Address | For |
| --- | --- |
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Parents and admins (the answer's `user.role` says which) |
| `GET /auth/setup`, `POST /auth/setup` | The first admin of a new website (works only while there is none) |
| `GET /site` | Everything the public pages show |
| `GET/PATCH /account`, `POST /account/password`, `POST /account/delete`, `POST /account/download/:platform` | The logged-in parent (Bearer) |
| `/admin/...` | Admin only (Bearer of an admin): dashboard, settings, themes, lessons, releases, parents |
| `GET /v3/courses`, `POST /v3/login`, `POST /v3/register`, `GET /v1/app/latest`, `GET /v1/announcement` | The desktop app (same answers as before, so installed apps keep working) |
| `/media/videos/...`, `/media/courses/...` | Uploaded lesson videos and theme pictures (outside `/api`) |

## Putting it online

- **MySQL 8** (any host), with the database and user from `api/.env`.
- **API**: `cd api && npm install && npm run build && node dist/main` (keep it running with pm2 or a
  systemd service) behind HTTPS, e.g. `https://api.adathecoder.com`. In `api/.env` set
  `API_PUBLIC_URL=https://api.adathecoder.com`, `SITE_URL=https://www.adathecoder.com`,
  `CORS_ORIGINS=https://www.adathecoder.com`, a long `JWT_SECRET`, and `HOST=0.0.0.0` if a proxy in front
  needs it. Uploaded files live in `UPLOAD_DIR`: back that folder up with the database.
- **Website**: `cd web && npm install && npm run build && npm start`, with
  `NEXT_PUBLIC_API_URL=https://api.adathecoder.com/api` in `web/.env.local` (set it before `npm run build`).
  Or deploy `web/` to Vercel with that setting.
- **Desktop app**: set `DEFAULT_SERVER_URL` in `desktop_app/ada_coder/config.py` to the API's address
  (`https://api.adathecoder.com`), raise `APP_VERSION`, build (see `desktop_app/README.md`), and upload
  the installers in **Admin → App versions**.
- Then open `/admin/login` straight away and create the admin account: the first person to open it
  becomes the admin.

## Checks

Every push to GitHub runs the **Check** workflow (`.github/workflows/check.yml`): it type-checks and builds
`api/` and `web/`, runs the API's tests (in-memory database, no emails sent) and the app's tests.
Locally: `cd api && npm run test:e2e`, `cd web && npm run build`, `cd desktop_app && python -m unittest discover tests`.

## Secrets

`api/.env` (MySQL password, JWT secret, Brevo key) and `web/.env.local` are never uploaded to GitHub
(`.gitignore`). `.env.example` files show the settings without the secrets.
