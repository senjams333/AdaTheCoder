"""Build one app into a program children can install (Windows .exe, Mac .app).

    pip install -r apps/requirements.txt pyinstaller
    python apps/build.py python_adventure

The result is in apps/dist/<App name>/ (Windows: the .exe inside it; Mac: apps/dist/<App name>.app).
Everything in the app's folder goes in: app.json, lessons.py, pictures, intro.mp4, vid/*.mp4 and
licence_secret.txt (so licence keys work). Build on Windows for Windows and on a Mac for Mac.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.path.join(HERE, "engine")
sys.path.insert(0, ENGINE_DIR)
from appconfig import load_config, load_lessons  # noqa: E402


def check(app_dir, cfg):
    """Say what's missing before building, so nobody ships an app with holes."""
    problems, notes = [], []
    lessons, topics = load_lessons(app_dir)
    for pic in [cfg["logo"], cfg["success_picture"], cfg["oops_picture"]] + [c.get("image") for c in cfg["characters"]]:
        if pic and not os.path.exists(os.path.join(app_dir, pic)):
            problems.append(f"picture missing: {pic}")
    if cfg.get("intro_video") and not os.path.exists(os.path.join(app_dir, cfg["intro_video"])):
        notes.append(f"no intro video ({cfg['intro_video']}): the app opens on the log-in")
    no_video = [t["name"] for t in topics if not os.path.exists(lessons[t["id"]]["video_path"] or "-")]
    if no_video:
        notes.append(f"{len(no_video)} of {len(topics)} lessons have no video (they open on the coding page)")
    if not cfg["locks"].get("licence_secret"):
        notes.append("no licence_secret.txt: licence keys are off (python apps/make_key.py makes one)")
    return problems, notes


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("app")
    p.add_argument("--check", action="store_true", help="only check the app's folder")
    args = p.parse_args()
    app_dir = os.path.join(HERE, args.app)
    if not os.path.isfile(os.path.join(app_dir, "app.json")):
        sys.exit(f"No app called {args.app} in {HERE}")
    cfg = load_config(app_dir)
    problems, notes = check(app_dir, cfg)
    for n in notes:
        print("note:", n)
    for pr in problems:
        print("PROBLEM:", pr)
    if problems:
        sys.exit(1)
    print(f"{cfg['name']} {cfg['version']}: ready to build ✅")
    if args.check:
        return

    import PyInstaller.__main__  # pip install pyinstaller

    datas = []
    for root, dirs, files in os.walk(app_dir):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            if f.endswith((".pyc", ".md")):
                continue
            full = os.path.join(root, f)
            dest = os.path.relpath(root, app_dir)
            datas += ["--add-data", f"{full}{os.pathsep}{dest}"]

    icon = []
    logo = os.path.join(app_dir, cfg["logo"])
    try:
        from PIL import Image
        work = os.path.join(HERE, "build", cfg["id"])
        os.makedirs(work, exist_ok=True)
        ico = os.path.join(work, "icon.ico" if os.name == "nt" else "icon.icns" if sys.platform == "darwin" else "icon.png")
        Image.open(logo).convert("RGBA").save(ico)
        icon = ["--icon", ico]
    except Exception as e:  # no Pillow, or no .icns support: build without an icon
        print("note: no icon:", e)

    PyInstaller.__main__.run([
        os.path.join(ENGINE_DIR, "kids_app.py"),
        "--name", cfg["name"],
        "--windowed", "--noconfirm",
        "--paths", ENGINE_DIR,
        "--hidden-import", "appconfig", "--hidden-import", "locks",
        # the children's code can use these (lesson 17 is OpenCV)
        "--hidden-import", "cv2", "--hidden-import", "numpy",
        "--distpath", os.path.join(HERE, "dist"),
        "--workpath", os.path.join(HERE, "build", cfg["id"]),
        "--specpath", os.path.join(HERE, "build", cfg["id"]),
        *icon, *datas,
    ])
    print(f"Done: {os.path.join(HERE, 'dist', cfg['name'])}")


if __name__ == "__main__":
    main()
