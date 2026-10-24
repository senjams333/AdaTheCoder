"""Make the next app by copying one you have.

    python apps/new_app.py python_adventure fairy_python --name "Fairy Python Adventure"
    python apps/new_app.py python_adventure fairy_python --name "Fairy Python Adventure" \
        --characters ada_girl pink_fairy unicorn --prefix FAIR

It copies the folder (app.json, lessons.py, pictures, intro video), gives the copy its own ID, name, licence
key prefix and a new licence secret (so one app's keys don't open the other), and, with --characters, puts in
pictures from apps/characters/. Then edit the new folder's app.json (texts, colours, which lessons are
locked) and lessons.py (the lessons), and open it with:  python apps/run.py fairy_python
"""
import argparse
import json
import os
import re
import secrets
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LIBRARY = os.path.join(HERE, "characters")

EMOJI = {"tom": "👦", "tom_wave": "👦", "penny": "🐍", "teddy": "🧸", "ada_girl": "👧", "pink_fairy": "🧚",
         "green_fairy": "🧚", "little_fairy": "🧚", "unicorn": "🦄", "byte_owl": "🦉"}
NAMES = {"tom_wave": "TOM", "ada_girl": "ADA", "byte_owl": "BYTE", "pink_fairy": "FAIRY ROSE",
         "green_fairy": "FAIRY FERN", "little_fairy": "FAIRY POPPY"}


def library_pictures():
    return sorted(os.path.splitext(f)[0] for f in os.listdir(LIBRARY) if f.lower().endswith(".png"))


def make_prefix(name):
    words = re.findall(r"[A-Za-z0-9]+", name)
    letters = "".join(w[0] for w in words).upper()
    if len(letters) < 4:
        letters = (letters + re.sub(r"[^A-Z0-9]", "", name.upper()))[:4]
    return (letters + "KEYS")[:4]


def duplicate(src_id, new_id, name, characters=None, prefix=None, with_videos=False):
    src = os.path.join(HERE, src_id)
    dst = os.path.join(HERE, new_id)
    if not os.path.isfile(os.path.join(src, "app.json")):
        raise SystemExit(f"No app called {src_id} in {HERE}")
    if not re.fullmatch(r"[a-z][a-z0-9_]{1,40}", new_id):
        raise SystemExit("The new app's ID: small letters, digits and _ (e.g. fairy_python)")
    if os.path.exists(dst):
        raise SystemExit(f"{dst} is there already")

    def skip(folder, names):
        out = {"licence_secret.txt", "__pycache__"}
        if not with_videos and os.path.basename(folder) == "vid":
            out |= {n for n in names if n.lower().endswith(".mp4")}
        return out & set(names)

    shutil.copytree(src, dst, ignore=skip)

    with open(os.path.join(dst, "app.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    cfg["id"] = new_id
    cfg["name"] = name
    cfg["version"] = "1.0.0"
    cfg["window_title"] = f"{name} ✨"
    cfg["hero_title"] = f"{name}! ✨"
    cfg["page_title"] = f"{name.upper()} ✨"
    cfg["login_subtitle"] = f"Login to unlock your {name} 🚀"
    cfg.setdefault("locks", {})["licence_prefix"] = (prefix or make_prefix(name)).upper()[:6]
    cfg["locks"].pop("licence_secret", None)
    cfg.setdefault("server", {})["theme_id"] = new_id

    if characters:
        missing = [c for c in characters if not os.path.exists(os.path.join(LIBRARY, c + ".png"))]
        if missing:
            shutil.rmtree(dst)
            raise SystemExit(f"Not in apps/characters/: {', '.join(missing)}. There: {', '.join(library_pictures())}")
        chars = []
        for c in characters:
            shutil.copy(os.path.join(LIBRARY, c + ".png"), os.path.join(dst, c + ".png"))
            label = NAMES.get(c, c.replace("_", " ").upper())
            chars.append({"name": f"{EMOJI.get(c, '⭐')} {label}", "image": c + ".png", "emoji": EMOJI.get(c, "⭐")})
        cfg["characters"] = chars
        cfg["oops_picture"] = chars[0]["image"]
        cfg["success_picture"] = chars[-1]["image"]
        who = [NAMES.get(c, c.replace("_", " ")).title() for c in characters]
        together = ", ".join(who[:-1]) + " & " + who[-1] if len(who) > 1 else who[0]
        cfg["page_subtitle"] = f"Learn Python with {together}! 🚀"
        cfg["characters_note"] = f"Content is AI generated from Google AI. All characters ({', '.join(who)}) are fictional."
        # pictures of the old characters that nothing uses any more
        old = {c.get("image") for c in json.load(open(os.path.join(src, "app.json"), encoding="utf-8")).get("characters", [])}
        keep = {cfg["logo"], cfg["oops_picture"], cfg["success_picture"], "tom.png"} | {c["image"] for c in chars}
        for pic in old - keep:
            p = os.path.join(dst, pic)
            if pic and os.path.exists(p):
                os.remove(p)

    with open(os.path.join(dst, "app.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(os.path.join(dst, "licence_secret.txt"), "w", encoding="utf-8") as f:
        f.write(secrets.token_urlsafe(24) + "\n")
    return dst, cfg


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", help="the app to copy (its folder name in apps/)")
    p.add_argument("new_id", help="the new app's folder name and ID, e.g. fairy_python")
    p.add_argument("--name", required=True, help='the new app\'s name, e.g. "Fairy Python Adventure"')
    p.add_argument("--characters", nargs="+", metavar="PICTURE",
                   help="pictures from apps/characters/ for the home screen, e.g. ada_girl pink_fairy unicorn")
    p.add_argument("--prefix", help="licence key prefix, 4 letters (default: from the name)")
    p.add_argument("--with-videos", action="store_true", help="copy the lesson videos in vid/ too")
    args = p.parse_args()
    dst, cfg = duplicate(args.source, args.new_id, args.name, args.characters, args.prefix, args.with_videos)
    rel = os.path.relpath(dst, os.getcwd())
    print(f"Made {rel} ✨  (licence keys start with {cfg['locks']['licence_prefix']}-)")
    print("Next:")
    print(f"  1. Edit {os.path.join(rel, 'app.json')}: texts, colours, \"locked_lessons\", admin PIN")
    print(f"  2. Edit {os.path.join(rel, 'lessons.py')}: the lessons (and put the videos in {os.path.join(rel, 'vid')})")
    print(f"  3. Try it:       python apps/run.py {cfg['id']}")
    print(f"  4. Licence keys: python apps/make_key.py {cfg['id']} --count 10")
    print(f"  5. Build:        python apps/build.py {cfg['id']}")


if __name__ == "__main__":
    sys.exit(main())
