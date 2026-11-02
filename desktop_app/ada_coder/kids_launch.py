"""Opens a theme in the Python Adventure app (apps/engine/kids_app.py).

When a child presses Play on a theme card, Ada The Coder writes that theme as a kids-app folder (app.json with
the theme's name and characters, lessons.py with its lessons, and the pictures), then starts the kids app on it,
already logged in with the same account. Every theme gets the same look; only the characters and lessons change.

    folder      <data_dir>/kids_apps/<theme id>/
    engine      ../apps/engine/kids_app.py next to this project, or kids_engine/ inside the packaged app
"""
import json
import os
import shutil
import sys

from PyQt5.QtCore import QProcess, QProcessEnvironment

from . import lessons as course
from .config import SERVER_URL
from .paths import FROZEN, base_dir, data_dir, image


def engine_path():
    """Where kids_app.py is, or None if this copy of the app doesn't have it."""
    here = base_dir()
    for path in (os.path.join(here, "kids_engine", "kids_app.py"),                         # packaged app
                 os.path.join(os.path.dirname(here), "apps", "engine", "kids_app.py")):    # the project folder
        if os.path.exists(path):
            return path
    return None


def _picture(name, folder):
    """Copies a picture (a name in assets/images, or a full path to a downloaded one) into the folder."""
    if not name:
        return ""
    src = name if os.path.isabs(name) else image(name)
    if not os.path.exists(src):
        return ""
    dest = os.path.basename(src)
    shutil.copyfile(src, os.path.join(folder, dest))
    return dest


def write_app_folder(c, licences):
    """Writes theme c (a course from lessons.load_courses) as a kids-app folder and returns its path."""
    folder = os.path.join(data_dir(), "kids_apps", c["id"])
    os.makedirs(folder, exist_ok=True)
    theme = course.characters(c)
    hero = theme["hero"]
    chars = [{"name": f"{emoji} {name.upper()}", "image": _picture(pic, folder), "emoji": emoji}
             for name, pic, emoji in hero]
    names = [h[0] for h in hero]
    lessons = c["lessons"]
    n = len(lessons)
    free = course.free_count(c)
    owned = course.owns(c, licences)
    locked = [] if owned or free is None or free >= n else list(range(max(free, 1) + 1, n + 1))
    site = SERVER_URL.rstrip("/")
    app = {
        "id": c["id"],
        "name": c["name"],
        "window_title": f"{c['name']} ✨",
        "hero_title": f"{c['name']}! ✨",
        "hero_subtitle": c.get("tagline") or theme.get("tagline") or "Fun coding lessons for little learners 🚀✨",
        "page_title": c["name"].upper() + " ✨",
        "page_subtitle": "Learn Python with " + ", ".join(names[:-1]) + " & " + names[-1] + "! 🚀",
        "sidebar_title": "📚 " + c["name"] + " 🌟",
        "logo": _picture("ada_logo.png", folder),
        "characters": chars,
        "profile_picture": _picture("byte.png", folder),
        "license_picture": chars[0]["image"] if chars else "",
        "success_picture": _picture(theme.get("success"), folder),
        "oops_picture": _picture(theme.get("oops"), folder),
        "lesson_picture": _picture(theme.get("guide"), folder),
        "intro_video": "",
        "characters_note": "All characters (" + ", ".join(names) + ") are fictional.",
        "locks": {"locked_lessons": locked, "upgrade_url": site + "/account"},
        "register_url": site + "/register",
        "password_url": site + "/forgot-password",
        "server": {"url": "", "theme_id": c["id"]},
    }
    with open(os.path.join(folder, "app.json"), "w", encoding="utf-8") as f:
        json.dump(app, f, ensure_ascii=False, indent=1)

    data, topics = {}, []
    for i, lesson in enumerate(lessons, start=1):
        key = "lesson%d" % i
        data[key] = {
            "title": lesson.get("title", ""),
            "subtitle": lesson.get("subtitle", ""),
            "video": course.video_path(lesson) or "",          # a full path: the kids app plays it from there
            "examples": {"ex%d" % k: {"label": e.get("label", ""), "explain": e.get("explain", ""),
                                      "output": e.get("output", ""), "code": e.get("code", "")}
                         for k, e in enumerate(lesson.get("examples", []), start=1)},
            "default_code": lesson.get("default_code", ""),
        }
        topics.append({"emoji": lesson.get("emoji", "⭐"), "name": lesson.get("name") or lesson.get("title", ""), "id": key})
    with open(os.path.join(folder, "lessons.py"), "w", encoding="utf-8") as f:
        f.write('"""Written by Ada The Coder for the theme %s. Changes here are replaced next time."""\n' % c["name"])
        f.write("LESSONS_DATA = %r\n\nTOPICS = %r\n" % (data, topics))
    return folder


def launch(parent, c, licences, user, on_closed=None):
    """Starts the kids app on theme c. Returns the QProcess, or None when the kids app isn't available."""
    engine = engine_path()
    if not engine:
        return None
    folder = write_app_folder(c, licences)
    env = QProcessEnvironment.systemEnvironment()
    env.insert("KIDS_APP_DIR", folder)
    env.insert("KIDS_APP_ENGINE", engine)
    env.insert("KIDS_APP_LOGIN", json.dumps({k: user.get(k, "") for k in ("full_name", "email", "child_name")}))
    if FROZEN:
        env.insert("KIDS_APP_HOST_RUNS_CODE", "1")
        program, args = sys.executable, ["--kids-app", folder]
    else:
        program, args = sys.executable, [os.path.join(base_dir(), "run.py"), "--kids-app", folder]
    proc = QProcess(parent)
    proc.setProcessEnvironment(env)
    proc.setProcessChannelMode(QProcess.ForwardedChannels)
    if on_closed:
        # exit code 3: the child chose Log out in the theme's menu
        proc.finished.connect(lambda code, *_: on_closed(code == 3))
        proc.errorOccurred.connect(lambda *_: on_closed(False))
    proc.start(program, args)
    return proc
