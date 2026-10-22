# Ada The Coder: accounts API (NestJS + MySQL)

Register and log in for parents, used by the website (and, through it, the desktop app).
When someone registers, two emails go out through **Brevo**: a welcome email to the parent and a
"new parent account" email to the admin.

## Run it on Ubuntu

```bash
cd auth-api
bash setup_mysql.sh        # installs MySQL if needed, creates database admin_db and user Admin (from .env)
npm install
npm run start:dev          # http://127.0.0.1:3000/api
```

Check it: `curl http://127.0.0.1:3000/api/health` → `{"ok":true,"database":"up"}`.
The `users` table is created automatically (`DB_SYNC=true`).

Then start the website with `AUTH_API_URL=http://127.0.0.1:3000/api` (the test script in the project
folder does this for you when the API is running).

## Settings (`.env`)

| Setting | Meaning |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL: `admin_db`, user `Admin` |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Log-in tokens (keep the secret private) |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Brevo emails. The sender address must be verified in Brevo (Senders & IPs). |
| `ADMIN_NOTIFY_EMAIL` | Who gets the "new parent account" email |
| `SITE_URL` | The website, for links in the emails |

`.env` holds secrets and is never uploaded to GitHub. `.env.example` shows the settings without them.

## Endpoints (all JSON, under `/api`)

| | Body | Answer |
| --- | --- | --- |
| `POST /auth/register` | `name, email, password (8+), city, country, consent: true`; optional `password2, childName, childAge` | 201 `{ok, user, token, emails: {user, admin}}` · 400 `{message: [..]}` · 409 email taken |
| `POST /auth/login` | `email, password` | 200 `{ok, user, token}` · 401 · 429 after 8 wrong tries in 15 min |
| `GET /auth/me` | header `Authorization: Bearer <token>` | `{ok, user}` |
| `POST /auth/change-password` | `email, currentPassword, newPassword` | `{ok}` · 401 |
| `POST /auth/delete-account` | `email, password` | `{ok}` · 401 |
| `GET /health` | | `{ok, database}` |

Passwords are stored as bcrypt hashes. A failed email never stops an account being created
(`emails` in the answer says whether each one went out; details are in the API's log).

## Tests

`npm run test:e2e` runs the API against an in-memory database, with emails captured instead of sent.

## Email templates

`src/mail/templates.ts`: `welcomeEmail` (to the parent) and `adminNewAccountEmail` (to the admin).
Each has an HTML and a plain-text version.
