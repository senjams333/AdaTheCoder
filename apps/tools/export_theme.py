"""Put an app on the website: write it as a theme pack the API can load.

    python apps/tools/export_theme.py python_adventure --price '$4.99'
    cd api && npm run theme -- import ../apps/python_adventure/theme_pack

The website then shows the app as a theme (name, characters, price, its lessons), and in Admin → Parents
you can give a parent a licence for it. A parent with that licence who logs in to the app (with
"server.url" set in app.json) gets every lesson. The pack's ID is the app's server.theme_id.
"""
import argparse
import json
import os
import shutil
import sys

APPS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(APPS, "engine"))
from appconfig import load_config, load_lessons, parse_lesson_numbers  # noqa: E402


def export(app, price="$4.99", tagline=""):
    app_dir = os.path.join(APPS, app)
    cfg = load_config(app_dir)
    lessons, topics = load_lessons(app_dir)
    out = os.path.join(app_dir, "theme_pack")
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(os.path.join(out, "pictures"))

    chars = []
    for c in (cfg["characters"] + cfg["characters"] * 3)[:3]:     # the website shows exactly 3
        pic = c["image"]
        shutil.copy(os.path.join(app_dir, pic), os.path.join(out, "pictures", pic))
        name = c["name"].split(" ", 1)[-1].title() if " " in c["name"] else c["name"].title()
        chars.append({"name": name, "picture": "pictures/" + pic})
    shutil.copy(os.path.join(app_dir, cfg["logo"]), os.path.join(out, "pictures", "card-" + cfg["logo"]))

    locked = parse_lesson_numbers(cfg["locks"].get("locked_lessons", "2-%d" % len(topics)), len(topics))
    free = next((n - 1 for n in range(2, len(topics) + 1) if n in locked), len(topics))
    pack = {
        "slug": cfg["server"].get("theme_id") or cfg["id"],
        "name": cfg["name"],
        "tagline": tagline or cfg["page_subtitle"],
        "description": f"{cfg['name']}: {len(topics)} video lessons with examples to run. {cfg['hero_subtitle']}",
        "features": [f"{len(topics)} lessons", f"Lesson 1 free" if free == 1 else f"{free} free lessons",
                     "Videos, examples and a code editor"],
        "pack": "custom",
        "characters": chars,
        "cardPicture": "pictures/card-" + cfg["logo"],
        "premium": True,
        "price": price,
        "freeLessons": free,
        "published": True,
        "lessons": [],
    }
    for t in topics:
        lesson = lessons[t["id"]]
        examples = [{"label": e.get("label", ""), "explain": e.get("explain", ""), "output": e.get("output", ""),
                     "code": e.get("code", "") or "# ..."} for e in lesson["examples"].values()]
        pack["lessons"].append({
            "slug": f"{cfg['id']}_{t['id']}"[:60],
            "emoji": t.get("emoji", ""),
            "name": t["name"],
            "title": lesson.get("title", t["name"]),
            "subtitle": lesson.get("subtitle", ""),
            "videoBundled": (lesson.get("video") or "").replace("\\", "/"),
            "defaultCode": lesson.get("default_code", ""),
            "examples": examples or [{"label": "Try it", "code": "print('Hello!')"}],
        })
    with open(os.path.join(out, "theme.json"), "w", encoding="utf-8") as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return out, pack


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("app")
    p.add_argument("--price", default="$4.99")
    p.add_argument("--tagline", default="")
    args = p.parse_args()
    out, pack = export(args.app, args.price, args.tagline)
    print(f"Wrote {os.path.relpath(out)} (theme ID {pack['slug']}, {len(pack['lessons'])} lessons, "
          f"{pack['freeLessons']} free, {pack['price']})")
    print(f"Load it:  cd api && npm run theme -- import ../{os.path.relpath(out, os.path.dirname(APPS))}")


if __name__ == "__main__":
    main()
