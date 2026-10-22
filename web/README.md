# Ada The Coder: website and admin (Next.js + Redux Toolkit)

The public website (home, sign up, log in, the parent's account page, privacy) and the admin, all talking
to the API in `../api`.

```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://127.0.0.1:3000/api
npm install
npm run dev                    # http://127.0.0.1:5000
```

Needs Node.js 18 or newer. `npm run build && npm start` for production (set `NEXT_PUBLIC_API_URL` before
building).

## How it's built

| | |
| --- | --- |
| `app/(site)/` | Home, register, login, privacy (with the site header and footer) |
| `app/account/` | The parent's account page (two panels: details on the left, apps and themes on the right) |
| `app/admin/` | Admin: log-in / first-admin setup, overview, website text, themes, theme page with its lessons, theme settings, lesson editor, app versions, parents |
| `lib/api.ts` | Every API call, with **RTK Query** (`useGetSiteQuery`, `useCreateThemeMutation`, ...). Saving invalidates the right lists so pages refresh by themselves |
| `lib/authSlice.ts` | The log-in (token + user), remembered in this browser (localStorage) |
| `lib/flashSlice.ts` | Short messages ("Saved.") shown at the top of the next page |
| `components/` | Header, footer, pop-up boxes, the theme form and the lesson editor |
| `app/globals.css` | All the styles |

Logging in stores the API's token; RTK Query adds it as `Authorization: Bearer ...`. Admin pages check
the user is an admin and send everyone else to `/admin/login`. Downloads ask the API for a 5-minute link,
because a plain browser link can't carry the log-in.
