"""Reads one app's settings (app.json) and lessons (lessons.py) from the app's folder.

Every app made from this engine is a folder like apps/python_adventure/:

    app.json      name, texts, characters, intro video, colours, which lessons are locked, server
    lessons.py    LESSONS_DATA and TOPICS (the lessons and the list on the right)
    *.png, intro.mp4, vid/*.mp4   the pictures and videos app.json and lessons.py name

No PyQt here, so the tests and the tools can use it too.
"""
import copy
import json
import os
import sys

DEFAULTS = {
    "id": "my_app",
    "name": "Python Adventure For Kids",
    "version": "1.0.0",
    "window_title": "Python Adventure For Kids 🐍✨",
    "hero_title": "Python Adventure For Kids! 🐍",
    "hero_subtitle": "Fun coding lessons for little learners 🚀✨",
    "page_title": "PYTHON ADVENTURE 🐍✨",
    "page_subtitle": "Learn Python with Tom, Penny & Teddy! 🚀",
    "sidebar_title": "📚 Beginner Python Course 🌟",
    "login_subtitle": "Login to unlock your Python Adventure 🚀",
    "logo": "ada.png",
    "characters": [
        {"name": "🧒🏻 TOM", "image": "tom1.png", "emoji": "👦"},
        {"name": "🐍 PENNY", "image": "penny.png", "emoji": "🐍"},
        {"name": "🧸 TEDDY", "image": "teddy.png", "emoji": "🧸"},
    ],
    "success_picture": "teddy.png",
    "oops_picture": "tom.png",
    "intro_video": "intro.mp4",
    "characters_note": "All characters (Tom, Penny, Teddy) are fictional.",
    "video_note": "This is an AI generated content from Google AI",
    "colors": {
        "background": "#eaf8ff",
        "background_dark": "#0f172a",
        "sidebar": "#a7f3d0",
        "sidebar_dark": "#134e4a",
    },
    "locks": {
        # Lesson numbers as in the list on the right (1 = the first). Lesson 1 is always free.
        # "2-17" locks lessons 2 to 17; a list like [2, 3, 10] or "2-5, 9" works too; [] locks nothing.
        "locked_lessons": "2-17",
        # Grown-ups' PIN for avatar menu → "Lock / unlock lessons" (change it!)
        "admin_pin": "2468",
        # Licence keys look like PAFK-7Q2M-K9TD-XXXX; make them with: python apps/make_key.py <app>.
        # They are checked with the secret in the app folder's licence_secret.txt, which is kept off GitHub
        # (.gitignore) and goes into the .exe when you build. No secret: licence keys are turned off.
        "licence_prefix": "PAFK",
        # Where "Upgrade" sends parents
        "upgrade_url": "https://www.adathecoder.com/#pricing",
    },
    "server": {
        # The Ada The Coder API (e.g. https://api.adathecoder.com). Empty: demo log-in, any email works.
        "url": "",
        # A parent whose account has a licence for this theme ID (Admin → Parents) gets every lesson.
        "theme_id": "",
    },
}


def _merge(base, extra):
    out = copy.deepcopy(base)
    for k, v in (extra or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load_config(app_dir):
    path = os.path.join(app_dir, "app.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path} must hold a JSON object")
    cfg = _merge(DEFAULTS, data)
    secret_file = os.path.join(app_dir, "licence_secret.txt")
    if os.path.exists(secret_file):
        with open(secret_file, encoding="utf-8") as f:
            cfg["locks"]["licence_secret"] = f.read().strip()
    cfg["locks"].setdefault("licence_secret", "")
    env_url = os.environ.get("KIDS_APP_SERVER")
    if env_url is not None:
        cfg["server"]["url"] = env_url
    return cfg


def load_lessons(app_dir):
    """Returns (LESSONS_DATA, TOPICS) from the app's lessons.py, with every lesson's video as a full path."""
    path = os.path.join(app_dir, "lessons.py")
    with open(path, encoding="utf-8") as f:
        source = f.read()
    ns = {"__name__": "lessons", "__file__": path}
    exec(compile(source, path, "exec"), ns)
    lessons, topics = ns.get("LESSONS_DATA"), ns.get("TOPICS")
    if not isinstance(lessons, dict) or not isinstance(topics, list) or not topics:
        raise ValueError(f"{path} must define LESSONS_DATA (a dict) and TOPICS (a list)")
    for t in topics:
        if t.get("id") not in lessons:
            raise ValueError(f"{path}: TOPICS has '{t.get('id')}' but LESSONS_DATA has no lesson with that key")
    for lesson in lessons.values():
        video = lesson.get("video") or lesson.get("video_path") or ""
        lesson["video_path"] = os.path.join(app_dir, *video.replace("\\", "/").split("/")) if video else ""
        lesson.setdefault("examples", {})
        lesson.setdefault("default_code", "")
    return lessons, topics


def parse_lesson_numbers(spec, count):
    """'2-17' / '2-5, 9' / [2, 3] / [] → a set of lesson numbers between 2 and count (lesson 1 is always free)."""
    numbers = set()
    if isinstance(spec, str):
        for part in spec.replace(";", ",").split(","):
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                a, b = part.split("-", 1)
                numbers.update(range(int(a), int(b) + 1))
            else:
                numbers.add(int(part))
    elif isinstance(spec, (list, tuple, set)):
        numbers = {int(n) for n in spec}
    elif spec is True:
        numbers = set(range(2, count + 1))
    return {n for n in numbers if 2 <= n <= count}


def data_dir(app_id):
    """Where this app keeps its own files on the child's computer (lock settings)."""
    if os.name == "nt":
        root = os.environ.get("APPDATA") or os.path.expanduser("~")
    elif sys.platform == "darwin":
        root = os.path.expanduser("~/Library/Application Support")
    else:
        root = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    path = os.path.join(root, app_id)
    os.makedirs(path, exist_ok=True)
    return path
