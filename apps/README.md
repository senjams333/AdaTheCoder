# Kids apps (from `3-General.py`)

One engine, many apps. The engine is your `3-General.py` (same look: home screen with three characters,
lesson list on the right, video then coding page, login card, profile and licence). Each app is a
folder with its own name, characters, intro video, colours, lessons and locks.

```
apps/
  engine/kids_app.py      the app itself (your 3-General.py, reading the app folder)
  engine/appconfig.py     reads app.json and lessons.py
  engine/locks.py         which lessons are locked, licence keys
  python_adventure/       App 1: Python Adventure For Kids (Tom, Penny, Teddy)
    app.json              name, texts, characters, intro video, colours, locks, server
    lessons.py            your 17 lessons (LESSONS_DATA) and the list on the right (TOPICS)
    ada.png tom1.png tom.png penny.png teddy.png intro.mp4
    vid/                  the lesson videos (video1.mp4 ... opencv.mp4, kept off GitHub)
  fairy_python/           App 2, made with new_app.py (Ada, Fairy Rose, Unicorn)
  characters/             pictures to use in new apps (Tom, Penny, Teddy, Ada, fairies, unicorn, Byte the owl)
  run.py  new_app.py  make_key.py  build.py  tools/clean_picture.py
```

## Open an app

```bash
pip install -r apps/requirements.txt
python apps/run.py python_adventure
```

The intro video plays first (Skip ⏭), then the login. Without a server in `app.json` the login is the
demo one from `3-General.py` (any email works, no internet needed).

## Locked lessons (2 to 17)

Lesson 1 is always free. In `app.json`:

```json
"locks": {
  "locked_lessons": "2-17",        // or "2-5, 9", or [2, 3, 10], or [] for none
  "admin_pin": "2468",             // change it
  "licence_prefix": "PAFK",
  "upgrade_url": "https://www.adathecoder.com/#pricing"
}
```

Locked lessons show **🔒** in the list. Clicking one shows *"Lesson N is locked"* with **Enter licence
key** and **Upgrade**. They can be unlocked in three ways:

| How | Who | What it opens |
| --- | --- | --- |
| Avatar menu → **🔐 Lock / unlock lessons (grown-ups)**, then the admin PIN | You or a parent | Tick or untick each of lessons 2 to 17. Also *Lock all*, *Unlock all* and *As the app came*. It's remembered on that computer |
| Avatar menu → **🔑 Enter licence key** | A family that bought it | Every lesson on that computer, for good |
| Logging in with a website account that has a licence for this app | A parent (when `server.url` is set) | Every lesson while they're logged in |

**Licence keys.** `python apps/make_key.py python_adventure --count 20` prints 20 keys
(`PAFK-7NTE-VW6A-D4HV`). The app checks them offline using the app's `licence_secret.txt`, which
`make_key.py` creates the first time. That file is **not uploaded to GitHub**. Keep it safe: anyone who
has it can make keys. It goes into the `.exe` when you build. Each app has its own secret, so keys for
one app don't open another.

**Website accounts.** Set `"server": {"url": "https://api.adathecoder.com", "theme_id": "python_adventure"}`.
Then the login and *Create an account* use the website's accounts (`/api/v3/login`, `/api/v3/register`).
Give a parent a licence for the theme `python_adventure` in **Admin → Parents** (create a paid theme with
that ID first). No internet: the child still gets in, with the free lessons only.

## Make the next app

```bash
python apps/new_app.py python_adventure space_python --name "Space Python Adventure" \
    --characters byte_owl unicorn tom_wave --prefix SPCE
```

This copies the folder, gives the copy its own ID, name, licence key prefix and secret, and uses
pictures from `apps/characters/`. Then:

1. Edit `apps/space_python/app.json` (texts, colours, `locked_lessons`, PIN) and replace `intro.mp4`.
2. Edit `apps/space_python/lessons.py` (the lessons) and put the videos in `apps/space_python/vid/`.
3. `python apps/run.py space_python` to try it.
4. `python apps/make_key.py space_python --count 20` for its keys.
5. `python apps/build.py space_python` to build it.

A fix in `engine/kids_app.py` reaches every app the next time each one is built.

**New character pictures** (made on a magenta or green background, already see-through):
`python apps/tools/clean_picture.py in.png apps/characters/name.png --screen magenta` removes the
coloured edge and makes the picture lighter.

## Build the .exe

```bash
pip install -r apps/requirements.txt pyinstaller
python apps/build.py python_adventure --check   # what's missing (videos, pictures)
python apps/build.py python_adventure           # apps/dist/Python Adventure For Kids/
```

Build on Windows for Windows, and on a Mac for Mac. Everything in the app's folder goes inside.

## Checks

`python -m unittest discover apps/tests` covers locks, keys, app folders and duplicating. On GitHub the
**Check** workflow also opens every app with no screen, goes through it (intro, login, 🔒 on lessons
2–17, locked message, PIN screen, licence key, restart) and saves screenshots to the
`ci-app-previews` branch.
