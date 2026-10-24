"""Opens an app for real (no screen needed) and goes through it, saving screenshots.

    QT_QPA_PLATFORM=offscreen python apps/tests/smoke_gui.py python_adventure OUT_FOLDER

Checks: the intro plays and can be skipped, the log-in works, lesson 1 is open and 2-17 show 🔒, a locked
lesson shows the "locked" message instead of opening, the grown-ups' lock screen needs the PIN and
unlocks single lessons, a licence key unlocks everything, and all of it is still so after a restart.
Used by the Check workflow on GitHub.
"""
import os
import runpy
import sys
import tempfile

APPS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(APPS, "engine"))

app_id = sys.argv[1] if len(sys.argv) > 1 else "python_adventure"
out = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "kids-shots"))
os.makedirs(os.path.join(out, app_id), exist_ok=True)
os.environ["KIDS_APP_DIR"] = os.path.join(APPS, app_id)
os.environ["XDG_DATA_HOME"] = tempfile.mkdtemp()      # a fresh computer
os.environ["APPDATA"] = os.environ["XDG_DATA_HOME"]
os.environ.setdefault("KIDS_APP_SERVER", "")          # demo log-in

ns = runpy.run_path(os.path.join(APPS, "engine", "kids_app.py"), run_name="kids_app")

from PyQt5.QtTest import QTest  # noqa: E402
from PyQt5.QtWidgets import QApplication, QInputDialog, QMessageBox  # noqa: E402

from locks import make_key  # noqa: E402

qt_app = QApplication.instance() or QApplication(sys.argv)
MainWindow, TOPICS, CONFIG = ns["MainWindow"], ns["TOPICS"], ns["CONFIG"]
results = []
shown = []        # message boxes the app showed (instead of waiting for a click)
answers = []      # what the "type something" boxes get


def step(name, ok):
    results.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name, flush=True)


def shot(window, name):
    QTest.qWait(400)
    window.grab().save(os.path.join(out, app_id, name + ".png"))


QMessageBox.exec_ = lambda self: shown.append(self.windowTitle()) or 0
QMessageBox.information = staticmethod(lambda parent, title, text, *a, **k: shown.append(title) or 0)
QMessageBox.warning = staticmethod(lambda parent, title, text, *a, **k: shown.append(title) or 0)
QInputDialog.getText = staticmethod(lambda *a, **k: answers.pop(0) if answers else ("", False))


def new_window():
    w = MainWindow()
    w.resize(1366, 820)
    w.show()
    QTest.qWait(600)
    return w


w = new_window()
intro = getattr(w, "intro_overlay", None)
if CONFIG.get("intro_video") and os.path.exists(os.path.join(os.environ["KIDS_APP_DIR"], CONFIG["intro_video"])):
    QTest.qWait(1200)
    if intro is not None and intro.finished:
        # this computer can't play videos (no media backend): the intro must step aside by itself
        step("intro closes by itself when videos can't play", w.login_overlay.isVisible())
    else:
        step("intro video shows when the app opens", intro is not None and intro.isVisible())
    shot(w, "01-intro")
    intro.skip_btn.click()
    QTest.qWait(300)
    step("Skip closes the intro and shows the log-in", not intro.isVisible() and w.login_overlay.isVisible())
else:
    step("no intro video: the log-in shows straight away", w.login_overlay.isVisible())
step("window title from app.json", w.windowTitle() == CONFIG["window_title"])
step("home screen characters from app.json", len(w.char_widgets) == len(CONFIG["characters"]))
shot(w, "02-login")

w.email_input.setText("kid@codingfun.com")
w.password_input.setText("kid123")
w.on_submit_pressed()
for _ in range(40):
    QTest.qWait(100)
    if not w.login_overlay.isVisible():
        break
step("demo log-in opens the app", not w.login_overlay.isVisible() and w.sidebar_panel.isVisible())
n = len(TOPICS)
step("lesson 1 is open", not w.topic_widgets[0].locked)
step(f"lessons 2-{n} show a lock", all(t.locked for t in w.topic_widgets[1:]))
step("locked lessons say 🔒 in the list", w.topic_widgets[1].topic_btn.text().startswith("🔒"))
shot(w, "03-home-lessons-locked")

shown.clear()
w.load_lesson_by_index(TOPICS[1]["id"])
QTest.qWait(300)
step("a locked lesson shows the 'locked' message and does not open",
     "Locked lesson 🔒" in shown and w.center_stack.currentIndex() == 0)

w.load_lesson_by_index(TOPICS[0]["id"])
QTest.qWait(3000)
step("lesson 1 opens", w.center_stack.currentIndex() == 1 and w.current_lesson_index == 0)
shot(w, "04-lesson-1")
w.show_home()

shown.clear()
answers.append(("0000", True))
w.show_locks_dialog()
step("the lock screen needs the right PIN", "Grown-ups only 🔐" in shown)

dlg = ns["LessonLocksDialog"](w, w.locks)
dlg.resize(620, 520)
dlg.show()
QTest.qWait(300)
dlg.grab().save(os.path.join(out, app_id, "05-grown-ups-lock-screen.png"))
for i in (2, 3, 4, 5):
    dlg.boxes[i].setChecked(False)
dlg._save()
w.refresh_locks()
step("the grown-up unlocks lessons 2-5", [t.locked for t in w.topic_widgets[:6]] == [False] * 6
     and all(t.locked for t in w.topic_widgets[6:]))
shot(w, "06-lessons-2-to-5-unlocked")

secret = w.locks.secret
if secret:
    answers.append(("PAFK-AAAA-BBBB-CCCC", True))
    w.ask_licence_key()
    step("a wrong licence key unlocks nothing", w.topic_widgets[-1].locked)
    key = make_key(secret, CONFIG["id"], w.locks.prefix)
    answers.append((key, True))
    w.ask_licence_key()
    step("a licence key unlocks every lesson", not any(t.locked for t in w.topic_widgets))
    shot(w, "07-licence-key-everything-open")
    w.close()
    w2 = new_window()
    step("the licence key is remembered after a restart", not w2.locks.is_locked(n))
    w2.locks.remove_key()
    w2.refresh_locks()
    step("without the key, the grown-up's choice is still remembered",
         not w2.locks.is_locked(3) and w2.locks.is_locked(n))
    w2.close()
else:
    print("(no licence_secret.txt here: licence key steps skipped)")

failed = [name for name, ok in results if not ok]
print(f"{len(results) - len(failed)} of {len(results)} steps passed")
sys.exit(1 if failed else 0)
