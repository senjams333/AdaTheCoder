# Theme packs

A theme pack is a folder with everything one theme needs: its name and price, its 3 characters, and its
lessons (topics, examples as `.py` files, videos). One command loads it into the API; installed apps
then show it by themselves (within 3 minutes, or with **🔄 Check for new lessons**). No new `.exe`.

```
themes/space/
  theme.json            the theme and its lessons
  pictures/             the 3 characters (and an optional card picture): .png .jpg .webp
  code/                 example code and starting code, as .py files
  videos/               lesson videos (.mp4), optional
```

`themes/space` is a complete example: copy it, rename the folder, and change it.

## Load a pack

In the `api` folder (it uses the database in `api/.env`):

```bash
npm run theme -- check  ../themes/space        # lists every problem, changes nothing
npm run theme -- import ../themes/space        # adds the theme, or updates it
npm run theme -- import-all ../themes          # every pack in the folder
```

- Importing again updates the theme. Lessons are matched by their `slug`: changed ones are updated,
  new ones added, and the order follows the pack.
- Lessons that are in the database but not in the pack are kept (after the pack's lessons). To delete
  them, add `--remove-missing`.
- Pictures and videos are copied only when they changed. A changed video gets a new name, so installed
  apps download the new one.

On a server without the developer tools: `npm run build` once, then `node dist/cli/theme-pack.js import ../themes/space`.

## Start from an existing theme

```bash
npm run theme -- export friends ../themes/my-theme
```

writes the theme (with all its lessons, examples as `.py` files, and any uploaded videos and pictures) as
a pack. Change `slug` and `name` in `theme.json` and edit away.

## Check the examples

```bash
python3 themes/check_examples.py themes/space
```

runs every example and checks it prints exactly the `output` the lesson shows. (The GitHub check runs it
for every pack.)

## theme.json

```jsonc
{
  "slug": "space",                    // the theme's ID: letters, numbers, - and _. Don't change it later
  "name": "Learn Coding in Space",
  "tagline": "One line for the app's home screen and the parents' account page",
  "description": "A little more about it (optional)",
  "features": ["Shown as ✓ ticks", "on the account page"],
  "pack": "custom",                   // custom = the characters below; or friends, fairies, coding_club
  "characters": [                     // exactly 3 for "custom": 1st explains mistakes, 3rd celebrates
    { "name": "Astro", "picture": "pictures/astro.png" },
    { "name": "Comet", "picture": "pictures/comet.png" },
    { "name": "Nova",  "picture": "pictures/nova.png" }
  ],
  "cardPicture": "pictures/card.png", // optional picture for the account page card
  "premium": true,                    // paid: free lessons first, then 🔒 and Upgrade
  "price": "$2.99",
  "freeLessons": 1,
  "position": 4,                      // optional: order in the app (lowest first)
  "published": true,                  // false hides the whole theme from the app
  "lessons": [
    {
      "slug": "space_hello",          // the lesson's ID (the app remembers progress by it). Don't change it later
      "emoji": "👋",                  // topic emoji in the app's lesson list
      "name": "HELLO, SPACE",         // topic name in the app's lesson list
      "title": "👋 HELLO, SPACE",     // big title above the lesson
      "subtitle": "Send your first message to the stars! 🚀",
      "video": "videos/hello.mp4",    // a video in the pack (uploaded; installed apps download it), or
      "videoBundled": "vid/video2.mp4", // a video already inside the app
      "defaultCodeFile": "code/01-hello-start.py",   // starting code in the editor (or "defaultCode": "...")
      "published": true,
      "examples": [
        {
          "label": "1️⃣ Say hello 🚀",                // the button in the lesson
          "explain": "print() shows a message on the screen.",
          "output": "Hello, space! 🚀",             // what the code prints (\n between lines)
          "codeFile": "code/01-hello-1.py"          // or "code": "print(\"Hello\")"
        }
      ]
    }
  ]
}
```

Everything a pack can do, the admin can also do on the website (and the other way round). Use whichever
is easier: packs for writing many lessons in your editor, the admin for quick changes.
