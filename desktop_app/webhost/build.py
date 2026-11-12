"""Makes the website's copy of the desktop app's screens (adathecoder.com/learn): run it after changing the app's
pages or Python, then send the website update as usual.

    python3 desktop_app/webhost/build.py

Writes into web/public/appweb/:
  app.zip        the app's Python (ada_coder, apps/engine), its pages (assets/app, assets/web), its font, and webhost.py
  manifest.json  the names of the pictures, emojis and videos below (the app's code checks they exist)
  assets/        the pictures, emojis and the intro video, which the pages load from the website
"""
import json
import os
import shutil
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)                              # desktop_app
PROJECT = os.path.dirname(APP)
OUT = os.path.join(PROJECT, "web", "public", "appweb")


def main():
    os.makedirs(OUT, exist_ok=True)
    with zipfile.ZipFile(os.path.join(OUT, "app.zip"), "w", zipfile.ZIP_DEFLATED) as z:
        for name in sorted(os.listdir(os.path.join(APP, "ada_coder"))):
            if name.endswith(".py"):
                z.write(os.path.join(APP, "ada_coder", name), "app/ada_coder/" + name)
        for sub in ("app", "web", "fonts"):
            folder = os.path.join(APP, "assets", sub)
            for name in sorted(os.listdir(folder)):
                z.write(os.path.join(folder, name), f"app/assets/{sub}/{name}")
        engine = os.path.join(PROJECT, "apps", "engine")
        for name in sorted(os.listdir(engine)):
            if name.endswith(".py"):
                z.write(os.path.join(engine, name), "apps/engine/" + name)
        z.write(os.path.join(HERE, "webhost.py"), "app/webhost.py")
    manifest = {}
    for sub in ("images", "emoji", "video"):
        src, dest = os.path.join(APP, "assets", sub), os.path.join(OUT, "assets", sub)
        names = sorted(n for n in os.listdir(src) if not n.endswith(".ico"))
        manifest[sub] = names
        os.makedirs(dest, exist_ok=True)
        for n in names:
            if not os.path.exists(os.path.join(dest, n)) or os.path.getsize(os.path.join(dest, n)) != os.path.getsize(os.path.join(src, n)):
                shutil.copyfile(os.path.join(src, n), os.path.join(dest, n))
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f)
    print("Done:", OUT, {k: len(v) for k, v in manifest.items()}, os.path.getsize(os.path.join(OUT, "app.zip")), "bytes")


if __name__ == "__main__":
    main()
