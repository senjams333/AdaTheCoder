"""Connects the app to the Ada The Coder website.

  * Courses, topics, lessons and videos edited in the website admin are downloaded in the
    background and used from the next time the app opens.
  * Tells the child and their grown-up when a new version of the app is ready.
  * Shows the website's "Message in the app" once per new message.

Only the standard library is used for the network part. If the computer is offline nothing
changes and the app keeps working with the lessons it has.
"""
import json
import os
import shutil
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request

from .config import APP_NAME, APP_VERSION, SERVER_URL, SYNC_EVERY
from .paths import data_dir

TIMEOUT = 8
USER_AGENT = f"AdaTheCoder/{APP_VERSION}"
NETWORK_ERRORS = (urllib.error.URLError, OSError, ValueError)


def videos_dir():
    path = os.path.join(data_dir(), "videos")
    os.makedirs(path, exist_ok=True)
    return path


def characters_dir():
    """Pictures of themes made in the website admin with their own characters."""
    path = os.path.join(data_dir(), "characters")
    os.makedirs(path, exist_ok=True)
    return path


def platform_key():
    if sys.platform.startswith("win"):
        return "windows"
    if sys.platform == "darwin":
        return "mac"
    return "other"


def _cache_path():
    return os.path.join(data_dir(), "courses_cache.json")


def _state_path():
    return os.path.join(data_dir(), "sync_state.json")


def _read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def _write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)


def saved_courses():
    """Courses downloaded on an earlier run, or [] if there are none."""
    return (_read_json(_cache_path(), None) or {}).get("courses") or []


# ------------------------------------------------------------------ talking to the website
def _is_local(url):
    host = (urllib.parse.urlsplit(url).hostname or "").lower()
    return host in ("localhost", "::1") or host.startswith("127.") or host.startswith("192.168.") or host.startswith("10.")


def _open(req, timeout):
    """Opens a web address. A website on this computer (or the home network) is reached directly,
    even when the computer has a proxy set up, which would otherwise block it."""
    if _is_local(req.full_url):
        return urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=timeout)
    return urllib.request.urlopen(req, timeout=timeout)


def _get_json(path, params=None):
    url = SERVER_URL.rstrip("/") + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with _open(req, TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _download(url, dest):
    tmp = dest + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with _open(req, 60) as resp, open(tmp, "wb") as out:
        shutil.copyfileobj(resp, out, 1024 * 256)
    os.replace(tmp, dest)


def sync_courses():
    """Downloads the courses (with their lessons and any new videos). Returns True if anything changed."""
    cache = _read_json(_cache_path(), {})
    try:
        data = _get_json("/api/v3/courses", {"since": cache.get("revision", "")})
    except NETWORK_ERRORS:
        return False
    if data.get("unchanged") or not data.get("courses"):
        return False
    videos = videos_dir()
    wanted = set()
    for course in data["courses"]:
        for lesson in course.get("lessons") or []:
            video = lesson.get("video") or {}
            if video.get("file") and video.get("url"):
                name = os.path.basename(video["file"])
                wanted.add(name)
                dest = os.path.join(videos, name)
                if not os.path.exists(dest):
                    try:
                        _download(video["url"], dest)
                    except NETWORK_ERRORS:
                        pass  # the bundled video plays until the download works next time
    pictures = characters_dir()
    for course in data["courses"]:
        for char in course.get("characters") or []:
            name = os.path.basename(char.get("file") or "")
            if name and char.get("url") and not os.path.exists(os.path.join(pictures, name)):
                try:
                    _download(char["url"], os.path.join(pictures, name))
                except NETWORK_ERRORS:
                    pass  # the theme shows emoji until the picture arrives
    _write_json(_cache_path(), {"revision": data.get("revision"), "courses": data["courses"]})
    for name in os.listdir(videos):  # tidy away videos no lesson uses any more
        if name not in wanted:
            try:
                os.remove(os.path.join(videos, name))
            except OSError:
                pass
    return True


def login(email, password):
    """Checks the parent's email and password with the website.
    Returns {"ok": True, "name", "email", "licences": [theme ids]}, {"ok": False, "error"} for a wrong
    password, or None when the website can't be reached."""
    body = json.dumps({"email": email, "password": password}).encode("utf-8")
    req = urllib.request.Request(SERVER_URL.rstrip("/") + "/api/v3/login", data=body, method="POST",
                                 headers={"User-Agent": USER_AGENT, "Content-Type": "application/json",
                                          "Accept": "application/json"})
    try:
        with _open(req, TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403, 429):
            try:
                return {"ok": False, "error": json.loads(e.read().decode("utf-8")).get("error") or "Wrong email or password."}
            except ValueError:
                return {"ok": False, "error": "Wrong email or password."}
        return None
    except NETWORK_ERRORS:
        return None


def register(details):
    """Creates a parent account on the website (/api/v3/register).
    details: {"name", "email", "password", "city", "country", "consent": True}.
    Returns {"ok": True, "name", "email", "licences"}, {"ok": False, "errors": [...]}, or None when offline."""
    body = json.dumps(details).encode("utf-8")
    req = urllib.request.Request(SERVER_URL.rstrip("/") + "/api/v3/register", data=body, method="POST",
                                 headers={"User-Agent": USER_AGENT, "Content-Type": "application/json",
                                          "Accept": "application/json"})
    try:
        with _open(req, TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            answer = json.loads(e.read().decode("utf-8"))
        except ValueError:
            return None if e.code == 404 else {"ok": False, "errors": ["The website couldn't create the account."]}
        return {"ok": False, "errors": answer.get("errors") or ["The website couldn't create the account."]}
    except NETWORK_ERRORS:
        return None


def check_for_update():
    if platform_key() == "other":
        return None
    try:
        info = _get_json("/api/v1/app/latest", {"platform": platform_key(), "version": APP_VERSION})
    except NETWORK_ERRORS:
        return None
    return info if info.get("update_available") else None


def new_announcement():
    """The website's message for the app, if the child hasn't seen it yet."""
    try:
        message = (_get_json("/api/v1/announcement").get("message") or "").strip()
    except NETWORK_ERRORS:
        return ""
    state = _read_json(_state_path(), {})
    if not message or message == state.get("last_message"):
        return ""
    state["last_message"] = message
    _write_json(_state_path(), state)
    return message


def run_checks():
    """Everything the app asks the website, in one go. Safe to run in a background thread."""
    return {"lessons_updated": sync_courses(), "update": check_for_update(), "message": new_announcement()}


# ------------------------------------------------------------------ pop-ups in the app
def start(window):
    """Call once the main window is showing. Checks the website without slowing the app down."""
    from PyQt5.QtCore import QTimer, QUrl
    from PyQt5.QtGui import QDesktopServices
    from PyQt5.QtWidgets import QMessageBox

    results = {}
    worker = threading.Thread(target=lambda: results.update(run_checks()), daemon=True)
    worker.start()
    timer = QTimer(window)

    def show_results():
        if worker.is_alive():
            return
        timer.stop()
        update = results.get("update")
        if update:
            box = QMessageBox(window)
            box.setWindowTitle(APP_NAME)
            box.setIcon(QMessageBox.Information)
            text = f"A new version of {APP_NAME} ({update['latest_version']}) is ready! 🎉\n\nAsk a grown-up to download it."
            if update.get("required"):
                text = (f"Please update {APP_NAME} to version {update['latest_version']} so everything keeps "
                        "working.\n\nAsk a grown-up to download it.")
            if update.get("notes"):
                text += f"\n\nWhat's new: {update['notes']}"
            box.setText(text)
            open_btn = box.addButton("Open download page", QMessageBox.AcceptRole)
            box.addButton("Later", QMessageBox.RejectRole)
            box.exec_()
            if box.clickedButton() is open_btn and update.get("download_page"):
                QDesktopServices.openUrl(QUrl(update["download_page"]))
        if results.get("lessons_updated"):
            window.reload_courses()   # new themes and lessons appear straight away
        if results.get("message"):
            QMessageBox.information(window, APP_NAME, results["message"])

    timer.timeout.connect(show_results)
    timer.start(500)
    window._sync_timer = timer  # keep a reference so it isn't garbage-collected

    # Keep checking while the app is open, so themes and lessons the admin adds or edits arrive by themselves.
    repeat = QTimer(window)
    repeat.timeout.connect(lambda: check_now(window, quiet=True))
    repeat.start(SYNC_EVERY * 1000)
    window._sync_repeat = repeat


def check_now(window, quiet=False):
    """Downloads new or changed themes, lessons and videos now ("Check for new lessons" in the menu).
    quiet: no pop-up (the automatic check)."""
    from PyQt5.QtCore import QTimer
    from PyQt5.QtWidgets import QMessageBox

    if getattr(window, "_checking", False):
        return
    window._checking = True
    result = {}
    worker = threading.Thread(target=lambda: result.update(changed=sync_courses(), online=_online()), daemon=True)
    worker.start()
    timer = QTimer(window)

    def done():
        if worker.is_alive():
            return
        timer.stop()
        window._checking = False
        if result.get("changed") or not quiet:
            window.reload_courses()   # (a manual check always refreshes what's on screen)
        if quiet:
            return
        if not result.get("online"):
            QMessageBox.warning(window, APP_NAME, f"Can't reach the website: {SERVER_URL}\n\n"
                                "If you're testing on this computer, start the website first "
                                "(test_on_my_computer.sh starts both).")
            return
        from .lessons import load_courses
        names = "\n".join(f"  • {c['name']}  ({len(c['lessons'])} lessons)" for c in load_courses())
        head = "New themes and lessons are here! ✨" if result.get("changed") else "You have the newest lessons. 👍"
        wait = "\nThey'll appear when you go back to 🏠 Home." if getattr(window, "_reload_waiting", False) else ""
        QMessageBox.information(window, APP_NAME, f"{head}{wait}\n\nWebsite: {SERVER_URL}\nThemes:\n{names}\n\n"
                                "A theme only shows here when it's ticked \"Show this theme in the app\" "
                                "and has at least one live lesson.")
    timer.timeout.connect(done)
    timer.start(300)
    window._check_timer = timer


def _online():
    try:
        _get_json("/api/v1/announcement")
        return True
    except NETWORK_ERRORS:
        return False


# ------------------------------------------------------------------ "python run.py --check"
def diagnose():
    """Prints, step by step, whether the app can reach the website and what it gets. No window needed."""
    import traceback
    from .lessons import load_courses
    print(f"Ada The Coder {APP_VERSION}: connection check")
    print(f"1. Website the app uses: {SERVER_URL}")
    src = "--server / server_url.txt" if os.environ.get("ADA_SERVER_URL") or os.path.exists(
        os.path.join(data_dir(), "server_url.txt")) else "built in (config.py)"
    print(f"   (set by: {src}; data folder: {data_dir()})")
    proxies = {k: v for k, v in os.environ.items() if k.lower() in ("http_proxy", "https_proxy", "no_proxy")}
    if proxies:
        print(f"   Proxy settings on this computer: {proxies}" + (" (skipped for this local website)" if _is_local(SERVER_URL) else ""))
    ok = True
    for step, path in (("2. Website answers", "/api/v1/announcement"), ("3. Themes feed", "/api/v3/courses")):
        url = SERVER_URL + path
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with _open(req, TIMEOUT) as resp:
                raw = resp.read().decode("utf-8", "replace")
            data = json.loads(raw)
            if path.endswith("courses"):
                themes = data.get("courses") or []
                print(f"{step}: OK, {len(themes)} themes")
                for c in themes:
                    print(f"     - {c.get('id')}: {c.get('name')}  ({len(c.get('lessons') or [])} lessons, pack {c.get('pack')})")
            else:
                print(f"{step}: OK")
        except urllib.error.HTTPError as e:
            ok = False
            print(f"{step}: FAILED, the website answered {e.code} for {url}")
            if e.code == 404:
                print("   This address answers, but it isn't the Ada The Coder website (or it's an older version of it).")
            else:
                print("   " + e.read().decode("utf-8", "replace")[:400].replace("\n", "\n   "))
        except ValueError:
            ok = False
            print(f"{step}: FAILED, {url} did not send JSON (is this the Ada The Coder website?). It sent:")
            print("   " + raw[:300].replace("\n", " "))
        except Exception as e:  # noqa: BLE001 - this is a diagnosis, show everything
            ok = False
            print(f"{step}: FAILED, can't reach {url}: {e!r}")
            if _is_local(SERVER_URL):
                print("   Is the website running? Start it with:  bash test_on_my_computer.sh")
            break
    if ok:
        try:
            changed = sync_courses()
            print(f"4. Download into the app: OK ({'new changes saved' if changed else 'already up to date'})")
            print("5. Themes the app will show:")
            for c in load_courses():
                print(f"     - {c['name']}  ({len(c['lessons'])} lessons)")
        except Exception:  # noqa: BLE001
            print("4. Download into the app: FAILED")
            traceback.print_exc()
    print("Done. If something failed, send this whole text.")
    return 0 if ok else 1
