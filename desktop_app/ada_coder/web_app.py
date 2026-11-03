"""Ada The Coder's window, made from the preview itself (assets/app/app.html): the same log-in card, sky,
greeting, friends and theme cards, drawn by the same HTML, here filled with the real data and connected to
the real website.

    the page    assets/app/app.html, written with this computer's data to <data_dir>/app_page.html
    the bridge  Host below (Qt web channel "host"): log-in, log-out, open a theme, open website pages
    a theme     "Try free" opens it as the next page of this same window (theme_page.py: the Python Adventure
                look, as in the preview); the child's code really runs (LessonRunner below)

The website keeps it up to date (sync.py, at start and every minute): new themes and lessons, prices,
licences, the home screen's greeting and characters.
"""
import json
import os
import re
import sys
import tempfile
import threading

from PyQt5.QtCore import QObject, QProcess, QTimer, QUrl, Qt, pyqtSignal, pyqtSlot
from PyQt5.QtGui import QDesktopServices
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtWebEngineWidgets import QWebEngineSettings, QWebEngineView
from PyQt5.QtWidgets import QMainWindow

from . import lessons as course
from . import sync
from .config import APP_NAME, APP_VERSION, SERVER_URL
from .paths import FROZEN, asset, data_dir, image, playground_dir
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


RUNNER = """import sys, os, builtins, runpy
real = sys.stdout

class Out:
    def write(self, x):
        if x:
            real.write(x)
            real.flush()
    def flush(self):
        real.flush()

def inp(prompt=''):
    if prompt:
        real.write(str(prompt))
    real.write('\\n<<WAITING_INPUT>>\\n')
    real.flush()
    x = sys.stdin.readline()
    if x == '':
        raise EOFError('Input cancelled')
    return x.rstrip('\\r\\n')

sys.stdout = Out()
builtins.input = inp
try:
    runpy.run_path(sys.argv[1], run_name='__main__')
except SystemExit:
    pass
except Exception as e:
    try:
        with open(sys.argv[1], encoding='utf-8') as f:
            src = f.read()
        print("\\n" + explain(e, src, sys.argv[1])[0])
    except Exception:
        print("\\n\u274c Error: " + str(e))
"""

TIME_LIMIT = 20000      # ms a program may run while not waiting for an answer


def _explain_source():
    """explain.py (the Python Adventure engine's friendly error messages), for the runner."""
    from . import kids_launch
    engine = kids_launch.engine_path()
    for path in ([os.path.join(os.path.dirname(engine), "explain.py")] if engine else []):
        try:
            with open(path, encoding="utf-8") as f:
                return f.read()
        except OSError:
            pass
    return "def explain(e, src, name=''):\n    return ('\u274c ' + type(e).__name__ + ': ' + str(e), type(e).__name__)\n"


class LessonRunner(QObject):
    """Runs the child's code for real, in its own Python process (the same messages as the Python Adventure
    app), and tells the lesson page what happened: handleCodeOutput / showInputLessonOutput / showGiantTeddy."""

    def __init__(self, call):
        super().__init__()
        self.call = call            # call(js function name, [arguments]) on the open lesson page
        self.process = None
        self.files = []
        self.output = ""
        self.waiting = False
        self.used_input = False
        self.timer = QTimer(self)
        self.timer.setSingleShot(True)
        self.timer.timeout.connect(self._too_long)

    def run(self, code):
        if not "\n".join(l for l in code.splitlines() if l.strip() and not l.strip().startswith("#")).strip():
            msg = "You missed to type input 🙈"
            self.call("handleCodeOutput", ["❌ " + msg, True, msg, True])
            return
        self.stop()
        fd, code_file = tempfile.mkstemp(suffix=".py")
        os.close(fd)
        with open(code_file, "w", encoding="utf-8") as f:
            f.write(code)
        runner = code_file + ".runner.py"
        with open(runner, "w", encoding="utf-8") as f:
            f.write(_explain_source() + "\n\n" + RUNNER)
        self.files = [code_file, runner]
        self.output, self.waiting, self.used_input = "", False, False
        self.process = QProcess(self)
        self.process.setWorkingDirectory(playground_dir())
        self.process.readyReadStandardOutput.connect(self._read_out)
        self.process.readyReadStandardError.connect(self._read_err)
        self.process.finished.connect(self._done)
        if FROZEN:      # the packaged app runs children's programs itself (no Python needed on the computer)
            self.process.start(sys.executable, ["--ada-run-script", runner, code_file])
        else:
            self.process.start(sys.executable, ["-u", runner, code_file])
        self.timer.start(TIME_LIMIT)

    def _read_out(self):
        chunk = bytes(self.process.readAllStandardOutput()).decode("utf-8", "replace")
        if "<<WAITING_INPUT>>" in chunk:
            parts = chunk.split("<<WAITING_INPUT>>")
            self.output += parts[0].rstrip("\r\n")
            self.waiting = self.used_input = True
            self.timer.stop()                       # the child is thinking: no time limit while it types
            rest = "".join(parts[1:]).lstrip("\r\n")
            self.output += rest
        else:
            self.output += chunk
        if self.used_input:
            self.call("showInputLessonOutput", [self.output, self.waiting, ""])

    def _read_err(self):
        text = bytes(self.process.readAllStandardError()).decode("utf-8", "replace")
        if text.strip():
            self.output += ("\n" if self.output and not self.output.endswith("\n") else "") + text

    def submit(self, value):
        if self.process and self.process.state() != QProcess.NotRunning:
            self.output += " " + value + "\n"
            self.waiting = False
            self.call("showInputLessonOutput", [self.output, False, ""])
            self.process.write((value + "\n").encode("utf-8"))
            self.timer.start(TIME_LIMIT)

    def empty(self):
        msg = "You missed to type input 🙈"
        self.call("handleCodeOutput", ["❌ " + msg, True, msg, True])
        self.stop()

    def _too_long(self):
        if self.process and self.process.state() != QProcess.NotRunning and not self.waiting:
            self.output += "\n⏹ Stopped: the program took too long. Is there a loop that never ends?"
            self.process.kill()

    def _done(self, *_):
        self.timer.stop()
        if self.process:
            self.output += bytes(self.process.readAllStandardOutput()).decode("utf-8", "replace").replace("<<WAITING_INPUT>>", "")
        text = self.output.strip("\n")
        error = "❌" in text or "Traceback" in text or "⏹ Stopped" in text
        msg = ""
        if error:
            line = next((l for l in text.splitlines() if "❌" in l), "Something went wrong 💡")
            msg = line.replace("❌", "").strip()
        if self.used_input:
            self.call("showInputLessonOutput", [text, False, ""])
            if not error:
                self.call("showGiantTeddy", [False])
        else:
            self.call("handleCodeOutput", [text or "✅ Code Ran Successfully! 🎉", error, msg, True])
        self.waiting = False
        self._cleanup()

    def stop(self):
        self.timer.stop()
        if self.process and self.process.state() != QProcess.NotRunning:
            try:
                self.process.finished.disconnect()
            except TypeError:
                pass
            self.process.kill()
            self.process.waitForFinished(1000)
        self._cleanup()

    def _cleanup(self):
        for f in self.files:
            try:
                os.remove(f)
            except OSError:
                pass
        self.files = []


class Host(QObject):
    """What the page can ask the app to do. Answers come back as signals carrying JSON."""
    loginDone = pyqtSignal(str)
    dataChanged = pyqtSignal(str)
    themeClosed = pyqtSignal(bool)
    message = pyqtSignal(str)
    themePage = pyqtSignal(str)            # the theme's page (srcdoc) for "Try free"
    themeUpdate = pyqtSignal(str)          # the open theme's new lessons (the admin changed them)
    themeUnlock = pyqtSignal()             # the open theme was paid for
    lessonCall = pyqtSignal(str, str)      # (js function, JSON arguments) for the open lesson page

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
        self.window.open_theme(course_id)

    @pyqtSlot()
    def themeClosedByPage(self):
        self.window.close_theme()

    @pyqtSlot(str)
    def runCode(self, code):
        self.window.runner.run(code)

    @pyqtSlot(str)
    def submitInput(self, value):
        self.window.runner.submit(value)

    @pyqtSlot()
    def emptyInput(self):
        self.window.runner.empty()

    @pyqtSlot(str)
    def upgrade(self, course_id):
        QDesktopServices.openUrl(QUrl(sync.pay_page(course_id)))
        self.window.watch_payment()

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
        self.open_theme_id = None
        self._checking = False
        self._reload_waiting = False

        self.view = QWebEngineView(self)
        s = self.view.settings()
        for attr in (QWebEngineSettings.LocalContentCanAccessFileUrls, QWebEngineSettings.LocalContentCanAccessRemoteUrls):
            s.setAttribute(attr, True)
        self.view.page().setBackgroundColor(Qt.transparent)
        self.host = Host(self)
        self.runner = LessonRunner(lambda fn, args: self.host.lessonCall.emit(fn, json.dumps(args, ensure_ascii=False)))
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
            "lastCourse": self.settings["course"] or "",
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
        if self.open_theme_id:          # the open theme's lessons change in place too
            c = next((c for c in self.courses if c["id"] == self.open_theme_id), None)
            if c:
                from .theme_page import theme_data
                fresh = theme_data(c, self.settings["licences"] or [])
                self.host.themeUpdate.emit(json.dumps({k: fresh[k] for k in ("topics", "lessons", "locked")}, ensure_ascii=False))

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
            old = list(self.settings["licences"] or [])
            if new is not None and sorted(new) != sorted(old):
                gained = [c["name"] for c in self.courses if c["id"] in set(new) - set(self.settings["licences"] or [])]
                self.settings["licences"] = list(new)
                self._push()
                if self.open_theme_id and self.open_theme_id in set(new) - set(old):
                    self.host.themeUnlock.emit()
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

    # ------------------------------------------------------------------ a theme, as the next page of this window
    def open_theme(self, course_id):
        from .theme_page import theme_page
        c = course.find_course(self.courses, course_id)
        self.settings["course"] = c["id"]                    # opened last: its card comes first next time
        try:
            page, _ = theme_page(c, self.settings["licences"] or [])
        except Exception as error:                          # never leave the child on the loading card
            self.host.message.emit(f"That theme couldn't open ({error}).")
            self.host.themeClosed.emit(False)
            return
        self.open_theme_id = c["id"]
        self.host.themePage.emit(page)

    def close_theme(self):
        self.runner.stop()
        self.open_theme_id = None
        self.refresh_licences(quiet=True)

    def watch_payment(self):
        """After Upgrade: checks the licences every 15 seconds for 20 minutes; the theme unlocks by itself."""
        if not hasattr(self, "_pay_watch"):
            self._pay_watch = QTimer(self)
            self._pay_watch.setInterval(15000)
            self._pay_watch.timeout.connect(self._pay_tick)
        self._pay_left = 80
        self._pay_watch.start()

    def _pay_tick(self):
        self._pay_left -= 1
        if self._pay_left <= 0:
            self._pay_watch.stop()
            return
        self.refresh_licences(quiet=False)

    def start(self):
        """Called once the window shows (run.py)."""
