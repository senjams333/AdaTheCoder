# Ada The Coder

Python lessons for children aged 6 to 11. Three parts:

| Folder | What it is |
| --- | --- |
| `api/` | The backend: **NestJS + MySQL** (database `admin_db`). Parent accounts, the first admin, website text, themes with their lessons, characters and videos, app versions, parents and licences. Sends the **Brevo** emails when someone registers (a welcome to the parent, a notice to the admin). See `api/README.md`. |
| `web/` | The website and the admin: **Next.js + Redux Toolkit** (RTK Query). Home page, sign up, log in, the parent's account page (downloads, themes, licences), privacy, and the whole admin. Everything comes from the API. See `web/README.md`. |
| `themes/` | **Theme packs**: a folder per theme (theme.json, character pictures, example code as .py files, videos). `npm run theme -- import ../themes/space` in `api/` loads one; installed apps show it by themselves. See `themes/README.md`. |
| `apps/` | **The kids apps made from `3-General.py`**: one engine, one folder per app (Python Adventure, Fairy Python, ...). Lesson 1 free, lessons 2–17 🔒 (licence key or parent account). `python apps/new_app.py` makes the next app. See `apps/README.md`. |
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
opens the admin in your browser, and opens **Ada The Coder** connected to them (at http://127.0.0.1:5000:
the website passes `/api` on to the API, like nginx on the real server). Close the app to stop everything.
Logs: `api.log` and `web.log`.

1. **Admin:** http://127.0.0.1:5000/admin/login. The first visit says *Create the admin account*; after
   that it's a normal log-in.
2. **Themes & lessons → Add a theme** (for example *Learn Coding in Space*, with your own 3 character
   pictures, paid, 3 free lessons). Open a theme to edit its topics, lessons and videos.
3. The script opens Ada The Coder; log in with a parent account (step 4) or try for free, then **Try free** on
   the Python Adventure card opens the theme. (`KIDS_ONLY=1 bash test_on_my_computer.sh` opens just the kids app
   `apps/python_adventure`.) Lesson 1 is
   free and lessons 2–17 show 🔒. Unlock them with the licence key the script prints (also saved in
   `licence-key-for-testing.txt`) or a parent account.
4. Parent account: sign up on the website, then in **Admin → Parents** give that parent a licence for
   **Python Adventure For Kids** (the script loaded it as a theme). Log in to the app with the parent's
   email and every lesson opens.
5. Another app: `APP=fairy_python bash test_on_my_computer.sh`.

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
python run.py --server http://127.0.0.1:5000   # the website passes /api on to the API
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
| Website text | Headline, text under it, the yellow banner, the message shown in the app, the app's home screen (greeting, which characters), the note for parents, the author's letter, the contact email |
| Themes & lessons | All themes as cards. **Add a theme**: name, ID, description, characters (a built-in pack or 3 uploaded pictures), price (cards and PayPal) and price in rupees (Razorpay) or free, free lessons to try, order, card picture, copy lessons from another theme. **Open a theme**: its lessons inside it, ▲▼ order, edit or delete. **Theme settings**: change or delete the theme |
| Lesson editor | Topic (emoji and name in the app's list), lesson ID, title, subtitle, starting code, examples (button label, explanation, code, expected output), upload or remove a video, show or hide |
| App versions | Upload Windows and Mac installers, choose the current download, oldest version still allowed |
| Parents | Search, plan (free/premium), licences per paid theme, turn accounts off or on, delete, export CSV |

## The API's addresses

All under `/api`. JSON in and out. `Bearer` = the `token` from log-in in an `Authorization` header.

| Address | For |
| --- | --- |
| `POST /auth/register`, `POST /auth/verify-email` | Sign-up in two steps: register emails a link and a 6-digit code (Brevo); the website's `/verify-email` page sends the code, and only then is the account made (welcome emails to the parent and the admin) |
| `POST /auth/login`, `GET /auth/me` | Parents and admins (the answer's `user.role` says which) |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | "Forgot your password?": emails a link and a 6-digit code (Brevo, 1 hour, once); on the website's `/reset-password` page the parent types the code and the new password, which works on the website and in the app |
| `GET /auth/setup`, `POST /auth/setup` | The first admin of a new website (works only while there is none) |
| `GET /site` | Everything the public pages show |
| `GET/PATCH /account`, `POST /account/password`, `POST /account/delete`, `POST /account/download/:platform` | The logged-in parent (Bearer) |
| `/admin/...` | Admin only (Bearer of an admin): dashboard, settings, themes, lessons, releases, parents |
| `GET /v3/courses`, `POST /v3/login`, `POST /v3/register`, `GET /v1/app/latest`, `GET /v1/announcement` | The desktop app (same answers as before, so installed apps keep working). `/v3/login` also returns `app_token` |
| `GET /v3/licences` | The desktop app with its `app_token`: the family's licences again (after paying on the website) |
| `GET /pay/:theme`, `POST /pay/:theme/razorpay`, `POST /pay/:theme/paypal` | The website's `/pay` page (a parent's log-in or the app's pay link) |
| `POST /pay/razorpay/verify`, `POST /pay/razorpay/webhook`, `POST /pay/paypal/capture` | Payment confirmations, checked with the Razorpay secrets or with PayPal itself; then the family gets a licence (`ADA-XXXX-XXXX-XXXX`) |
| `/media/videos/...`, `/media/courses/...` | Uploaded lesson videos and theme pictures (outside `/api`) |

## How the website controls the installed app

| The admin does this on the website | What the installed app does (at start, then every minute) |
| --- | --- |
| **Themes & lessons → Add a theme**, ticks *Show this theme in the app*, adds at least one live lesson | A new theme card appears on the home screen; **Try free** opens it with its own characters and lessons |
| Edits or adds lessons, examples, videos; changes a theme's price or free lessons | The theme shows the new lessons, videos, price and locks |
| **Website text → Ada The Coder app: home screen**: greeting, which characters | The home screen's greeting and characters change |
| **Website text → Message in the app** | A pop-up, once per new message |
| **Parents** → gives or removes a licence (or the parent pays on the pay page) | The theme unlocks (✓ Purchased) or locks again |
| **App versions** → uploads a new installer | The app tells the family a new version is ready |

## Installing the app

- **Windows**: `desktop_app\build_windows.bat` makes `AdaTheCoder-<version>-Windows-Setup.exe` (or GitHub builds it: `.github/workflows/build-apps.yml`).
- **Mac**: `bash desktop_app/build_mac.sh` makes the `.dmg`.
- **Ubuntu / Linux**: `bash desktop_app/install_linux.sh` installs it with an icon in the app menu (search *Ada The Coder*);
  `bash desktop_app/install_linux.sh http://127.0.0.1:5000` makes it use your test website. Uninstall:
  `bash ~/.local/share/ada-the-coder/uninstall.sh`.

## Payments (Razorpay and PayPal)

**After paying (the landing page).** The pay page itself turns into **"Payment successful 🎉"** with the licence
(ADA-XXXX-XXXX-XXXX) and a **Copy** button, the "emailed to" line, and how to unlock it in the app. PayPal comes back to
`/pay/paypal-return`, which shows the same. With Razorpay's **Payment Button**, the page waits for Razorpay's webhook
and switches by itself; in the Razorpay dashboard (Payment Button → Edit → "Redirect after payment") you can set
`https://www.adathecoder.com/pay?theme=<theme>&paid=1`, which shows "Confirming your payment…" and then the licence.
The parent's account page shows each bought theme's licence with **Copy**.

**In the app.** A paid theme unlocks by itself (the app asks the website every minute, and every 15 seconds after
Upgrade). Upgrade also has **I have a licence 🔑**: the parent pastes the licence, the app checks it with
`POST /api/v3/licence`, and the theme opens. A licence only works for the account that paid for it.

A child presses a locked lesson → the Upgrade card → **⭐ Upgrade** opens the website's `/pay` page for that theme.
The parent logs in there and pays with **Razorpay** (India: UPI, cards, net banking, in rupees) or **PayPal**
(PayPal or any card). Payment happens only on the website, never in the app. Once it goes through, the family gets
a licence and the app unlocks every lesson by itself (it checks every 15 seconds for 20 minutes, and at every
website check).
Parents can also pay from their account page (Get Licence).

1. Put the keys in `api/.env` (see `.env.example`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
   `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`sandbox` to test, `live` for real money), `PAYPAL_CURRENCY`.
   A method without keys isn't shown.
2. In the admin, give each paid theme its **Price** (PayPal charges this, e.g. `$4.99`) and **Price in rupees**
   (Razorpay charges this, e.g. `399`; empty = no Razorpay for that theme).
3. Razorpay dashboard → Webhooks: `https://<your API>/api/pay/razorpay/webhook`, events `payment.captured` and
   `order.paid`, with the same secret as `RAZORPAY_WEBHOOK_SECRET` (so a closed browser tab still unlocks the theme).
4. Test with Razorpay's test keys and PayPal's sandbox accounts first.

## Putting it online

One address for everything, e.g. `https://www.adathecoder.com`: nginx sends `/api/` and `/media/` to the API
(port 3000) and everything else to the website (port 5000). The desktop app uses that one address for the API and
for the website pages it opens (sign-up, pay, forgot password).

- **MySQL 8** (on AWS: RDS), with the database and user from `api/.env`.
- **API**: `cd api && npm ci && npm run build && pm2 start dist/main.js --name ada-api`. In `api/.env` set
  `SITE_URL` and `API_PUBLIC_URL` to `https://www.adathecoder.com`, `CORS_ORIGINS=https://www.adathecoder.com`,
  a long `JWT_SECRET` (`openssl rand -hex 32`), and `DB_SYNC=true` for the very first start only (it makes the
  tables), then `false`. Never `DEV_SHOW_CODES` on a real server. Uploaded files live in `UPLOAD_DIR`: back that
  folder up with the database.
- **Website**: `NEXT_PUBLIC_API_URL=https://www.adathecoder.com/api` in `web/.env.local` (before building), then
  `cd web && npm ci && npm run build && pm2 start npm --name ada-web -- start`.
- **nginx** (then `certbot --nginx` for HTTPS):
  ```
  server {
    server_name www.adathecoder.com adathecoder.com;
    client_max_body_size 600m;
    location /api/   { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
    location /media/ { proxy_pass http://127.0.0.1:3000; }
    location /       { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; }
  }
  ```
- **Desktop app**: `DEFAULT_SERVER_URL` in `desktop_app/ada_coder/config.py` is that address; raise `APP_VERSION`,
  build (see `desktop_app/README.md`), sign the installer, and upload it in **Admin → App versions**.
- **Testing a server before the real one** (e.g. `https://test.adathecoder.com`): set it up the same way, then start
  the app with `python run.py --server https://test.adathecoder.com` (remembered until `--server default`).

## Checks

Every push to GitHub runs the **Check** workflow (`.github/workflows/check.yml`): it type-checks and builds
`api/` and `web/`, runs the API's tests (in-memory database, no emails sent) and the app's tests.
Locally: `cd api && npm run test:e2e`, `cd web && npm run build`, `cd desktop_app && python -m unittest discover tests`.

## Secrets

`api/.env` (MySQL password, JWT secret, Brevo key) and `web/.env.local` are never uploaded to GitHub
(`.gitignore`). `.env.example` files show the settings without the secrets.
