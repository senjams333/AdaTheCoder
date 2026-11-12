"""Ada The Coder in the browser (adathecoder.com/learn): the desktop app's own screens, made by the desktop app's own
Python (ada_coder/*.py and apps/engine), running in the browser with Pyodide.

The website's page (web/app/learn/page.tsx) plays the part of the app's window (web_app.WebMainWindow): it logs in,
fetches the themes, and asks this module for the pages. Files the app would read from the computer (pictures,
videos, emojis) are on the website instead: url_for() gives their web address. PyQt isn't here, so the few PyQt
names these modules import are stand-ins.

Made into web/public/appweb/app.zip by desktop_app/webhost/build.py (run it after changing the app's pages).
"""
import json
import os
import sys
import types

ROOT = "/app"                                   # ada_coder/, assets/ (the zip unpacks here); the engine is /apps/engine
ASSETS = os.path.join(ROOT, "assets")
WEB_ASSETS = "/appweb/assets"                   # the same files on the website
MEDIA = {}                                      # file name -> web address (theme pictures and lesson videos)


def url_for(path):
    """The web address of a file the app's code points at ("" if the website doesn't have it)."""
    path = os.path.normpath(str(path))
    name = os.path.basename(path)
    if path.startswith(ASSETS + "/") or path == ASSETS:
        return WEB_ASSETS + path[len(ASSETS):]
    if name in MEDIA:
        return MEDIA[name]
    if os.path.exists(os.path.join(ASSETS, "images", name)):     # a built-in picture copied into a theme folder
        return WEB_ASSETS + "/images/" + name
    return ""


# ---------------------------------------------------------------- stand-ins for the PyQt names the modules import
class _Url:
    def __init__(self, s=""):
        self._s = s

    @staticmethod
    def fromLocalFile(path):
        return _Url(url_for(path))

    def toString(self):
        return self._s


class _Nothing:
    def __init__(self, *a, **k):
        pass

    def __getattr__(self, name):
        return _Nothing()

    def __call__(self, *a, **k):
        return _Nothing()


def _stub_pyqt():
    qt = types.ModuleType("PyQt5")
    core = types.ModuleType("PyQt5.QtCore")
    core.QUrl = _Url
    for n in ("QProcess", "QProcessEnvironment", "QTimer", "QObject", "Qt"):
        setattr(core, n, _Nothing)
    core.pyqtSignal = lambda *a, **k: None
    core.pyqtSlot = lambda *a, **k: (lambda f: f)
    qt.QtCore = core
    sys.modules["PyQt5"] = qt
    sys.modules["PyQt5.QtCore"] = core


_ready = False
COURSES = []
SITE = ""


def setup(arg):
    """Once, before anything else: {site, images, emoji, video} (the names of the files the website has)."""
    global _ready, SITE
    a = json.loads(arg)
    SITE = a["site"].rstrip("/")
    os.environ["ADA_SERVER_URL"] = SITE
    os.environ.setdefault("XDG_DATA_HOME", "/home/pyodide/.local/share")
    # the pictures, emojis and videos are on the website; the app's code only checks that they exist
    for folder, names in (("images", a["images"]), ("emoji", a["emoji"]), ("video", a["video"])):
        os.makedirs(os.path.join(ASSETS, folder), exist_ok=True)
        for n in names:
            p = os.path.join(ASSETS, folder, n)
            if not os.path.exists(p):
                open(p, "wb").close()
    _stub_pyqt()
    for p in (ROOT, "/apps/engine"):
        if p not in sys.path:
            sys.path.insert(0, p)
    from ada_coder import theme_page
    theme_page._webm = _video_url               # the browser plays the MP4 too
    _ready = True
    return "ok"


def _video_url(video):
    return url_for(video) if video else ""


def _touch(folder, name):
    if name:
        os.makedirs(folder, exist_ok=True)
        p = os.path.join(folder, os.path.basename(name))
        if not os.path.exists(p):
            open(p, "wb").close()


def set_courses(arg):
    """The themes as /api/v3/courses gives them (with the family's log-in: bought themes come in full)."""
    global COURSES
    from ada_coder import sync
    COURSES = json.loads(arg)
    for c in COURSES:
        for ch in c.get("characters") or []:
            if ch.get("file") and ch.get("url"):
                MEDIA[os.path.basename(ch["file"])] = ch["url"]
                _touch(sync.characters_dir(), ch["file"])
        cover = c.get("cover") if isinstance(c.get("cover"), dict) else None
        if cover and cover.get("file"):
            MEDIA[os.path.basename(cover["file"])] = cover["url"]
            _touch(sync.characters_dir(), cover["file"])
        for lesson in c.get("lessons") or []:
            v = lesson.get("video") or {}
            if v.get("file") and v.get("url"):
                MEDIA[os.path.basename(v["file"])] = v["url"]          # the browser plays the MP4
                _touch(sync.videos_dir(), v["file"])
    return "ok"


HOME_CHARACTERS = [("Tom", "tom.png", "🧒"), ("Ada", "girl_wave.png", "👧"), ("Unicorn", "unicorn.png", "🦄")]


def _home(answer):
    """The home screen the admin set (from /api/v1/announcement), as sync.home_screen() gives it."""
    chars = [{"name": str(c.get("name") or "").strip()[:30], "file": str(c.get("file") or ""), "url": str(c.get("url") or "")}
             for c in (answer.get("home_chars") or []) if isinstance(c, dict)][:3]
    for ch in chars:
        if ch["file"] and ch["url"]:
            MEDIA[os.path.basename(ch["file"])] = ch["url"]
    return {"welcome": (answer.get("welcome") or "").strip() or "Welcome to Ada The Coder",
            "theme": (answer.get("home_theme") or "").strip(),
            "break": answer.get("break") if isinstance(answer.get("break"), dict) else None, "chars": chars}


def _data(a):
    """What the app's page shows: the same as web_app.WebMainWindow._data."""
    from ada_coder import lessons as course
    from ada_coder.config import APP_VERSION
    from ada_coder.paths import image
    from ada_coder.themes import THEMES
    _url = lambda p: url_for(p if (not p or os.path.isabs(p)) else image(p)) if p else ""
    packs = {k: {"name": v["name"], "tagline": v["tagline"], "hero": [list(h) for h in v["hero"]],
                 "guide": v["guide"], "success": v["success"], "oops": v["oops"]} for k, v in THEMES.items()}
    names = {"ada_logo.png", "byte.png", "tom.png", "girl_wave.png", "unicorn.png", "fairy.png", "ada.png"}
    names |= {h[1] for p in packs.values() for h in p["hero"]} | {p[k] for p in packs.values() for k in ("guide", "success", "oops")}
    images = {n: _url(n) for n in names if n}
    courses = []
    for c in COURSES:
        hero = course.characters(c)["hero"]
        cover = c.get("cover") if isinstance(c.get("cover"), dict) else {}
        courses.append({
            "id": c["id"], "name": c.get("name", ""), "tagline": c.get("tagline", ""), "description": c.get("description", ""),
            "pack": c.get("pack") or "friends", "position": c.get("position", 0), "premium": bool(c.get("premium")),
            "free_lessons": course.free_count(c), "price": c.get("price", ""),
            "heroPics": [_url(h[1]) for h in hero],
            "cover": MEDIA.get(os.path.basename(cover.get("file") or ""), "") if cover else "",
            "is_new": bool(c.get("is_new")),
        })
    first = COURSES[0] if COURSES else {"lessons": []}
    lessons = [{k: l.get(k) for k in ("id", "emoji", "name", "title", "subtitle", "default_code", "examples", "video")}
               for l in first.get("lessons", [])]
    home = _home(a.get("announcement") or {})
    chosen = next((c for c in COURSES if c["id"] == home["theme"]), None) if home["theme"] else None
    if chosen:
        chars = course.characters(chosen)["hero"]
    else:
        chars = []
        for i, (name, picture, emoji) in enumerate(HOME_CHARACTERS):
            ch = home["chars"][i] if i < len(home["chars"]) else {}
            own = MEDIA.get(os.path.basename(ch.get("file") or ""), "")
            chars.append((ch.get("name") or name, own or picture, emoji))
    return {
        "courses": courses, "packs": packs, "images": images, "lessons": lessons, "version": APP_VERSION,
        "home": {"welcome": home["welcome"], "chars": [[n, p if p.startswith(("/", "http")) else _url(p), e] for n, p, e in chars],
                 "break": home.get("break")},
        "user": a.get("user"), "licences": list(a.get("licences") or []),
        "licenceCodes": dict(a.get("licenceCodes") or {}), "appLicence": a.get("appLicence") or "",
        "site": SITE, "lastCourse": a.get("lastCourse") or "",
    }


def _lesson_page():
    import re
    from ada_coder.emoji_img import add_to as with_emoji
    from ada_coder.paths import asset
    web = asset("web")
    page = open(os.path.join(web, "lesson.html"), encoding="utf-8").read()
    css = open(os.path.join(web, "lesson.css"), encoding="utf-8").read() + "\nhtml { background: transparent; color-scheme: light; }\n"
    js = open(os.path.join(web, "lesson.js"), encoding="utf-8").read()
    page = page.replace('<link rel="stylesheet" href="lesson.css">', "<style>" + css + "</style>")
    page = re.sub(r'<script src="qrc:[^"]*"></script>', "", page)
    page = page.replace('<script src="lesson.js"></script>', "<script>" + js + "</script>")
    return with_emoji(re.sub(r'src="\.\./images/([^"]+)"', lambda m: 'src="%s"' % (WEB_ASSETS + "/images/" + m.group(1)), page))


def app_page(arg):
    """The app's main page (home screen, log-in, theme cards): assets/app/app.html with its data."""
    from ada_coder.emoji_img import add_to as with_emoji
    from ada_coder.paths import asset
    a = json.loads(arg)
    data = dict(_data(a), lessonPage=_lesson_page())
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    return with_emoji(open(asset("app", "app.html"), encoding="utf-8").read().replace("__DATA__", blob))


def data(arg):
    """New data for the open page (dataChanged): the page updates without reloading."""
    d = _data(json.loads(arg))
    return json.dumps({k: d[k] for k in ("courses", "packs", "home", "licences", "licenceCodes", "appLicence", "site")}, ensure_ascii=False)


def theme_page(arg):
    """A theme's page ("Try free" / Play), made exactly as the app makes it."""
    from ada_coder import lessons as course
    from ada_coder.theme_page import theme_page as make
    a = json.loads(arg)
    c = course.find_course(COURSES, a["id"])
    page, _ = make(c, a.get("licences") or [])
    return page


def theme_update(arg):
    """The open theme's lessons again (after it was bought): themeUpdate."""
    from ada_coder import lessons as course
    from ada_coder.theme_page import theme_data
    a = json.loads(arg)
    c = course.find_course(COURSES, a["id"])
    fresh = theme_data(c, a.get("licences") or [])
    return json.dumps({k: fresh[k] for k in ("topics", "lessons", "locked", "videos")}, ensure_ascii=False)
