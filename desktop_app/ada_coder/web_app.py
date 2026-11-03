"""Ada The Coder's window, made from the preview itself (assets/app/app.html): the same log-in card, sky,
greeting, friends and theme cards, drawn by the same HTML, here filled with the real data and connected to
the real website.

    the page    assets/app/app.html, written with this computer's data to <data_dir>/app_page.html
    the bridge  Host below (Qt web channel "host"): log-in, log-out, open a theme, open website pages
    a theme     "Try free" opens it in the Python Adventure app (kids_launch.py), where the code really runs

The website keeps it up to date (sync.py, at start and every 3 minutes): new themes and lessons, prices,
licences, the home screen's greeting and characters.
"""
import json
import os
import re
import threading

from PyQt5.QtCore import QObject, QTimer, QUrl, Qt, pyqtSignal, pyqtSlot
from PyQt5.QtGui import QDesktopServices
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtWebEngineWidgets import QWebEngineSettings, QWebEngineView
from PyQt5.QtWidgets import QMainWindow

from . import lessons as course
from . import sync
from .config import APP_NAME, APP_VERSION, SERVER_URL
from .paths import asset, data_dir, image
from .settings import Settings
from .themes import THEMES

HOME_CHARACTERS = [("Tom", "tom.png", "🧒"), ("Ada", "girl_wave.png", "👧"), ("Unicorn", "unicorn.png", "🦄")]


def _url(picture):
    """A picture (a name in assets/images, or a full path to a downloaded one) as a file:// address, or ""."""
    if not picture:
        return ""
    path = picture if os.path.isabs(picture) else image(picture)
    return QUrl.fromLocalFile(path).toString() if os.path.exists(path) else ""


def _lesson_page():
    """The lesson page (assets/web) in one piece, for the hidden frame the preview keeps (the music lives there)."""
    web = asset("web")
    page = open(os.path.join(web, "lesson.html"), encoding="utf-8").read()
    css = open(os.path.join(web, "lesson.css"), encoding="utf-8").read() + "\nhtml { background: transparent; color-scheme: light; }\n"
    js = open(os.path.join(web, "lesson.js"), encoding="utf-8").read()
    page = page.replace('<link rel="stylesheet" href="lesson.css">', "<style>" + css + "</style>")
    page = re.sub(r'<script src="qrc:[^"]*"></script>', "", page)
    page = page.replace('<script src="lesson.js"></script>', "<script>" + js + "</script>")
    return re.sub(r'src="\.\./images/([^"]+)"', lambda m: 'src="%s"' % _url(m.group(1)), page)


class Host(QObject):
    """What the page can ask the app to do. Answers come back as signals carrying JSON."""
    loginDone = pyqtSignal(str)
    dataChanged = pyqtSignal(str)
    themeClosed = pyqtSignal(bool)
    message = pyqtSignal(str)

    def __init__(self, window):
        super().__init__(window)
        self.window = window

    @pyqtSlot(str, str)
    def login(self, email, password):
        self.window.check_login(email.strip(), password)

    @pyqtSlot()
    def logout(self):
        self.window.logout()

    @pyqtSlot(str)
    def playTheme(self, course_id):
        self.window.play_theme(course_id)

    @pyqtSlot(str)
    def openUrl(self, url):
        if url.startswith("http"):
            QDesktopServices.openUrl(QUrl(url))

    @pyqtSlot(str)
    def forgotPassword(self, email):
        from urllib.parse import quote
        QDesktopServices.openUrl(QUrl(SERVER_URL.rstrip("/") + "/forgot-password" + ("?email=" + quote(email) if email else "")))

    @pyqtSlot()
    def checkNow(self):
        sync.check_now(self.window, quiet=True)
        self.message.emit("🔄 Checking the website for new lessons…")


class WebMainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle(f"{APP_NAME} 🐍")
        self.resize(1280, 800)
        self.settings = Settings()
        self.courses = course.load_courses()
        self.kids_proc = None
        self._checking = False
        self._reload_waiting = False

        self.view = QWebEngineView(self)
        s = self.view.settings()
        for attr in (QWebEngineSettings.LocalContentCanAccessFileUrls, QWebEngineSettings.LocalContentCanAccessRemoteUrls):
            s.setAttribute(attr, True)
        self.view.page().setBackgroundColor(Qt.transparent)
        self.host = Host(self)
        self.channel = QWebChannel(self.view.page())
        self.channel.registerObject("host", self.host)
        self.view.page().setWebChannel(self.channel)
        self.setCentralWidget(self.view)
        self._load_page()

    # ------------------------------------------------------------------ the page and its data
    def _user(self):
        user = dict(self.settings["user"] or {})
        return user if user.get("email") and self.settings["app_token"] else None

    def _data(self):
        """What the page shows, in the same shape as the preview's data."""
        packs = {k: {"name": v["name"], "tagline": v["tagline"], "hero": [list(h) for h in v["hero"]],
                     "guide": v["guide"], "success": v["success"], "oops": v["oops"]} for k, v in THEMES.items()}
        names = {"ada_logo.png", "byte.png", "tom.png", "girl_wave.png", "unicorn.png", "fairy.png", "ada.png"}
        names |= {h[1] for p in packs.values() for h in p["hero"]} | {p[k] for p in packs.values() for k in ("guide", "success", "oops")}
        images = {n: _url(n) for n in names if n}
        courses = []
        for c in self.courses:
            hero = course.characters(c)["hero"]
            courses.append({
                "id": c["id"], "name": c.get("name", ""), "tagline": c.get("tagline", ""), "description": c.get("description", ""),
                "pack": c.get("pack") or "friends", "position": c.get("position", 0), "premium": bool(c.get("premium")),
                "free_lessons": course.free_count(c), "price": c.get("price", ""),
                "heroPics": [_url(h[1]) for h in hero],
            })
        first = self.courses[0] if self.courses else {"lessons": []}
        lessons = [{k: l.get(k) for k in ("id", "emoji", "name", "title", "subtitle", "default_code", "examples", "video")}
                   for l in first.get("lessons", [])]
        home = sync.home_screen()
        chosen = next((c for c in self.courses if c["id"] == home["theme"]), None) if home["theme"] else None
        chars = course.characters(chosen)["hero"] if chosen else HOME_CHARACTERS
        return {
            "courses": courses, "packs": packs, "images": images, "lessons": lessons, "version": APP_VERSION,
            "home": {"welcome": home["welcome"], "chars": [[n, _url(p), e] for n, p, e in chars]},
            "user": self._user(), "licences": list(self.settings["licences"] or []), "site": SERVER_URL.rstrip("/"),
        }

    def _load_page(self):
        data = dict(self._data(), lessonPage=_lesson_page())
        blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
        html = open(asset("app", "app.html"), encoding="utf-8").read().replace("__DATA__", blob)
        path = os.path.join(data_dir(), "app_page.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        self.view.load(QUrl.fromLocalFile(path))

    def _push(self):
        """New data from the website: the page updates without reloading (the child doesn't lose their place)."""
        data = self._data()
        self.host.dataChanged.emit(json.dumps({k: data[k] for k in ("courses", "packs", "home", "licences", "site")}, ensure_ascii=False))

    # sync.py calls these
    def reload_courses(self):
        courses = course.load_courses()
        if courses:
            self.courses = courses
        self._push()

    def apply_theme(self):
        self._push()

    def refresh_licences(self, quiet=True):
        token = self.settings["app_token"]
        if not token:
            return
        answer = {}
        worker = threading.Thread(target=lambda: answer.update(sync.fetch_licences(token) or {}), daemon=True)
        worker.start()
        timer = QTimer(self)

        def done():
            if worker.is_alive():
                return
            timer.stop()
            new = answer.get("licences")
            if new is not None and sorted(new) != sorted(self.settings["licences"] or []):
                gained = [c["name"] for c in self.courses if c["id"] in set(new) - set(self.settings["licences"] or [])]
                self.settings["licences"] = list(new)
                self._push()
                if gained and not quiet:
                    self.host.message.emit("🎉 Unlocked: " + ", ".join(gained))
        timer.timeout.connect(done)
        timer.start(300)
        self._licence_timer = timer

    # ------------------------------------------------------------------ log-in
    def check_login(self, email, password):
        if not email or not password:
            self.host.loginDone.emit(json.dumps({"ok": False, "error": "Please type the email and the password."}))
            return
        result = {}
        worker = threading.Thread(target=lambda: result.update(answer=sync.login(email, password)), daemon=True)
        worker.start()
        timer = QTimer(self)

        def done():
            if worker.is_alive():
                return
            timer.stop()
            answer = result.get("answer")
            if answer is None:
                out = {"ok": False, "error": f"Can't reach the website ({SERVER_URL}). Check the internet and try again."}
            elif not answer.get("ok"):
                out = {"ok": False, "error": answer.get("error") or "That email and password don't match."}
            else:
                user = {"full_name": answer.get("name") or email.split("@")[0].title(), "email": answer.get("email") or email,
                        "child_name": answer.get("child_name") or ""}
                self.settings["user"] = user
                self.settings["licences"] = list(answer.get("licences") or [])
                self.settings["app_token"] = answer.get("app_token") or ""
                self.settings["remember_me"] = True
                out = {"ok": True, "user": user, "licences": self.settings["licences"]}
            self.host.loginDone.emit(json.dumps(out, ensure_ascii=False))
        timer.timeout.connect(done)
        timer.start(150)
        self._login_timer = timer

    def logout(self):
        self.settings["user"] = {}
        self.settings["app_token"] = ""
        self.settings["licences"] = []
        self.settings["remember_me"] = False

    # ------------------------------------------------------------------ a theme
    def play_theme(self, course_id):
        from . import kids_launch
        c = course.find_course(self.courses, course_id)
        if self.kids_proc is not None and self.kids_proc.state() != 0:
            return
        self.settings["course"] = c["id"]
        user = dict(self.settings["user"] or {}, app_token=self.settings["app_token"])
        self.kids_proc = kids_launch.launch(self, c, self.settings["licences"] or [], user, self._theme_closed)
        if self.kids_proc is None:
            self.host.message.emit("The lessons app isn't in this copy of Ada The Coder.")
            self.host.themeClosed.emit(False)
            return
        QTimer.singleShot(1200, self.showMinimized)          # the theme opens in its own window

    def _theme_closed(self, logged_out=False):
        self.kids_proc = None
        self.showMaximized()
        self.raise_()
        self.activateWindow()
        if logged_out:
            self.logout()
        self.host.themeClosed.emit(bool(logged_out))
        self.refresh_licences(quiet=False)                   # paid for it from the theme's Upgrade? its card shows Purchased

    def start(self):
        """Called once the window shows (run.py)."""
