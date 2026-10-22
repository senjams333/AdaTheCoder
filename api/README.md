# Ada The Coder: API (NestJS + MySQL)

The backend for the website (`../web`) and the desktop app (`../desktop_app`): accounts, the first admin,
website text, themes with their lessons, characters and videos, app versions, parents and licences.
When someone registers, two emails go out through **Brevo**: a welcome to the parent and a
"new parent account" notice to the admin.

## Run it on Ubuntu

Needs **Node.js 18 or newer** (20 recommended). Ubuntu's own `nodejs` package is often too old
(`node --version` says v10 or v12). Install Node 20 with nvm, no sudo needed:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

Then:

```bash
cd api
cp .env.example .env       # fill in the MySQL password, JWT_SECRET and Brevo settings
bash setup_mysql.sh        # installs MySQL if needed, creates database admin_db and user Admin (from .env)
npm install
npm run start:dev          # http://127.0.0.1:3000/api
```

Check it: `curl http://127.0.0.1:3000/api/health` → `{"ok":true,"database":"up"}`.
On first start the tables are created (`DB_SYNC=true`) and filled with the website text and the 3
built-in themes, each with the 17 beginner lessons.

## Settings (`.env`)

| Setting | Meaning |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL: `admin_db`, user `Admin` |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Log-in tokens (keep the secret private and long) |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Brevo emails. The sender must be verified in Brevo (Senders) |
| `ADMIN_NOTIFY_EMAIL` | Who gets the "new parent account" email |
| `SITE_URL` | The website (links in emails, the app's Upgrade button) |
| `API_PUBLIC_URL` | This API's own address (links to uploaded videos and pictures) |
| `CORS_ORIGINS` | Websites allowed to call the API |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Where uploads are kept, and the biggest upload allowed |

`.env` holds secrets and is never uploaded to GitHub.

## What's inside

| | |
| --- | --- |
| `src/entities/` | The MySQL tables: users, courses (themes), lessons, user_licences, releases, downloads, settings |
| `src/auth/` | Register, log in, me, first-admin setup; `AuthGuard` (logged in) and `AdminGuard` (admins) |
| `src/site/` | `GET /api/site`: everything the public pages show |
| `src/account/` | The logged-in parent: details, password, delete, download links |
| `src/admin/` | Admin: dashboard and website text, themes, lessons (video upload, move, copy), app versions, parents |
| `src/compat/` | The desktop app's addresses (`/api/v3/courses`, `/api/v3/login`, `/api/v3/register`, `/api/v1/...`) |
| `src/catalog/` | Shared theme and lesson logic |
| `src/mail/` | Brevo and the email templates (`templates.ts`) |
| `src/seed/` + `seed/default_lessons.json` | The first-start content |

Passwords are bcrypt hashes. Log-ins are limited to 8 wrong tries per 15 minutes. A failed email never
stops an account being created (the API's log says why).

## Tests

`npm run test:e2e`: the whole API against an in-memory database, emails captured instead of sent.
