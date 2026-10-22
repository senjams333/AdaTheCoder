# Ada The Coder: desktop app

A Python learning app for children aged 6 to 11. Each lesson starts with a short video, then the
child clicks through worked examples, edits the code and presses **Run**. Working code gets a
celebration; mistakes get a short, kind explanation that points at the line to fix.

## Run it

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate      Mac: source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

Use Python 3.10 to 3.12 (PyQt5 has no builds for newer versions yet).
Log in with a parent's website account (it unlocks the themes they bought), create one from the app
(**Grown-up? Create an account**), or choose **Try for free** and type a name.

## What's in the project

```
run.py                  starts the app (and runs children's programs in the packaged app)
ada_coder/
  main_window.py        the window: home screen with theme cards, lesson screen, lesson list, Upgrade
  bridge.py             runs the child's code in a separate process and reports back to the page
  child.py              the small program that actually runs the child's code
  friendly.py           turns Python errors into child-friendly hints, with the line number
  lessons.py            loads the themes (data/courses.json + data/lessons.json, or newer ones from the website)
  video_panel.py        the lesson video player
  splash.py             the welcome video when the app opens
  login.py              log in or create a website account, or Try for free
  dialogs.py            profile and about pop-ups
  themes.py             character packs (themes can also bring their own, from the website)
  settings.py           remembers progress and choices between visits
  sync.py               downloads themes, lessons and characters, logs in, checks for app updates, shows website messages
  styles.py, widgets.py looks and small building blocks
  config.py             version number, the API's address, run-time limit
assets/
  web/                  the lesson page (lesson.html, lesson.css, lesson.js)
  images/               characters, logo and icon
  video/intro.mp4       the welcome video
data/courses.json       the themes inside the app (until it has been online)
data/lessons.json       the 17 lessons and 102 examples
vid/                    lesson videos (add your own, see vid/README.txt)
tests/                  checks that run without a screen
```

## Themes, topics, lessons and videos

Everything is managed in the website admin under **Themes & lessons**:

- **Themes**: add (for example "Learn Coding in Space"), edit, hide or delete a theme. Pick its characters:
  one of the packs built into the app, or **your own characters** (3 uploaded pictures, which the app
  downloads, so a new theme needs no new app version). Set the price, how many lessons are free to try
  (3 by default) and the order.
- **Open a theme** to see its lessons inside it: edit each lesson's topic (emoji and name in the app's
  lesson list), title, starting code, examples and video; add lessons; move them up or down.

The app downloads the themes in the background (`/api/v3/courses`) when it opens and every 3 minutes
(`SYNC_EVERY` in `config.py`), and the avatar menu has **🔄 Check for new lessons**. New and changed themes
show straight away (if the child is in a lesson, when they go back Home).

To test against the API on your own computer: `python run.py --server http://127.0.0.1:3000`
(remembered; `python run.py --server default` goes back to the real one). `python run.py --check` prints
whether the app can reach the API and which themes it gets.

## Try free and Upgrade

- The home screen shows every theme as a card: **Try free** for paid themes, **Play** for free or bought ones.
- In a paid theme, the first lessons (3 unless the admin changes it) can be played. The rest show 🔒.
  Opening one, or the sidebar's **Upgrade** button, shows a pop-up whose **Upgrade** button opens the
  parent's account page on the website at that theme (`/account?theme=<id>`), where they get a licence.
- When the parent logs into the app with their website account (`/api/v3/login`), the themes they hold a
  licence for unlock. Without internet, the app remembers the themes from the last log-in.
- Progress is kept separately for each theme.

Before the app has been online it uses `data/courses.json`, with the lessons in `data/lessons.json`.
`python -m unittest discover tests` runs every example to make sure none of them has a mistake.

## Character packs

| Pack | Home screen | Celebrates | Explains mistakes |
| --- | --- | --- | --- |
| Friends Adventure | Tom, Penny, Teddy | Teddy | Tom |
| Fairies & Angels | Twinkle, Fern, Sparkle | Sparkle | Fern |
| Ada's Coding Club | Ada, Byte, Penny | Byte | Byte |

Add a pack by putting pictures in `assets/images`, adding an entry to `ada_coder/themes.py`, and adding
it to `PACKS` in `api/src/common/constants.ts` so the admin can choose it. (Or skip all that: choose
"Your own characters" for the theme in the admin and upload three pictures.)

## How children's code runs

The app never runs the child's code inside itself. Each press of **Run** starts a separate process
(`ada_coder/child.py`), so a mistake or an endless loop can't freeze the app:

- `input()` shows a typing box in the output area.
- A program that runs longer than 12 seconds (without waiting for typing) is stopped with a hint about
  endless loops. Change `RUN_TIME_LIMIT` in `config.py`.
- OpenCV picture windows stay open until the child closes them (or presses Esc).
- Programs run in a "playground" folder in the app's data folder, which has the lesson pictures
  (`tom.png` and friends) for the OpenCV lessons.

## Building installers

1. Put the lesson videos in `vid/`.
2. Raise `APP_VERSION` in `ada_coder/config.py` and check `DEFAULT_SERVER_URL` (the API's address, e.g. `https://api.adathecoder.com`).
3. Windows: run `build_windows.bat` (with [Inno Setup 6](https://jrsoftware.org/isdl.php) installed you get
   `dist\AdaTheCoder-<version>-Windows-Setup.exe`, otherwise a zip).
   Mac: run `bash build_mac.sh` to get `dist/AdaTheCoder-<version>-Mac.dmg`.
4. Upload the file in the admin under **App versions** with the same version number.
   Installed apps will tell families an update is ready.

## Where the app keeps its data

| | |
| --- | --- |
| Windows | `%APPDATA%\AdaTheCoder` |
| Mac | `~/Library/Application Support/AdaTheCoder` |
| Linux | `~/.local/share/AdaTheCoder` |

`settings.json` (progress per theme, unlocked themes, day/night, music), `courses_cache.json`, `videos/` and `characters/`
(downloaded from the website), and `playground/` (where children's programs run).

## Keyboard

- **Ctrl + Enter**: run the code. **Tab**: indent by 4 spaces (new lines keep the indent, and indent after `:`).
- **Esc / Space / Enter** during the welcome video: skip it. **F11**: full screen.
