"""Profile, About and Upgrade pop-ups."""
from PyQt5.QtCore import Qt, QUrl
from PyQt5.QtGui import QDesktopServices
from PyQt5.QtWidgets import QDialog, QFrame, QGridLayout, QHBoxLayout, QLabel, QPushButton, QVBoxLayout

from .config import APP_NAME, APP_VERSION, CONTACT_EMAIL, SERVER_URL
from .styles import DIALOG_QSS, font
from .widgets import round_pixmap


def _info_box(rows):
    box = QFrame()
    box.setObjectName("InfoBox")
    grid = QGridLayout(box)
    grid.setContentsMargins(16, 12, 16, 12)
    grid.setHorizontalSpacing(18)
    grid.setVerticalSpacing(8)
    for i, (label, value) in enumerate(rows):
        a = QLabel(label)
        a.setObjectName("Muted")
        a.setFont(font(11, True))
        b = QLabel(str(value))
        b.setFont(font(12, True))
        b.setTextInteractionFlags(Qt.TextSelectableByMouse)
        b.setWordWrap(True)
        grid.addWidget(a, i, 0, Qt.AlignLeft | Qt.AlignTop)
        grid.addWidget(b, i, 1)
    return box


def _dialog(parent, title, picture, heading, subheading):
    dlg = QDialog(parent)
    dlg.setWindowTitle(title)
    dlg.setStyleSheet(DIALOG_QSS)
    dlg.setMinimumWidth(420)
    lay = QVBoxLayout(dlg)
    lay.setContentsMargins(26, 22, 26, 20)
    lay.setSpacing(12)
    head = QHBoxLayout()
    pic = QLabel()
    pix = round_pixmap(picture, 76)
    if pix:
        pic.setPixmap(pix)
    texts = QVBoxLayout()
    h = QLabel(heading)
    h.setFont(font(18, True))
    s = QLabel(subheading)
    s.setObjectName("Muted")
    s.setFont(font(11))
    s.setWordWrap(True)
    texts.addWidget(h)
    texts.addWidget(s)
    head.addWidget(pic)
    head.addSpacing(10)
    head.addLayout(texts, 1)
    lay.addLayout(head)
    return dlg, lay


def _buttons(dlg, lay, *extra):
    row = QHBoxLayout()
    for btn in extra:
        row.addWidget(btn)
    row.addStretch()
    ok = QPushButton("OK")
    ok.setCursor(Qt.PointingHandCursor)
    ok.clicked.connect(dlg.accept)
    row.addWidget(ok)
    lay.addLayout(row)


def show_profile(parent, user, done_count, lesson_count, course_name):
    name = user.get("full_name") or "Coder"
    dlg, lay = _dialog(parent, "My profile", "ada_logo.png", f"{name} 🌟", "Your Ada The Coder profile")
    lay.addWidget(_info_box([
        ("Email", user.get("email") or "–"),
        ("Lessons finished", f"{done_count} of {lesson_count} ⭐"),
        ("Course", course_name),
    ]))
    _buttons(dlg, lay)
    dlg.exec_()


def show_about(parent):
    dlg, lay = _dialog(parent, f"About {APP_NAME}", "ada_logo.png", f"{APP_NAME} 🐍",
                       f"Version {APP_VERSION} · Python lessons for children aged 6 to 11")
    lay.addWidget(_info_box([
        ("Website", SERVER_URL.replace("https://", "")),
        ("Help", CONTACT_EMAIL),
        ("Licence", "Personal and educational use"),
    ]))
    note = QLabel("Lesson videos include content generated with Google AI. All characters are fictional.\n"
                  "This software is provided \"as is\", without warranty of any kind.")
    note.setObjectName("Muted")
    note.setWordWrap(True)
    note.setFont(font(10))
    lay.addWidget(note)
    site = QPushButton("Open website")
    site.setObjectName("Plain")
    site.setCursor(Qt.PointingHandCursor)
    site.clicked.connect(lambda: QDesktopServices.openUrl(QUrl(SERVER_URL)))
    _buttons(dlg, lay, site)
    dlg.exec_()


def show_upgrade(parent, course, free_count, lesson_count, picture="ada_logo.png"):
    """Shown when a child opens a locked lesson. Returns "upgrade", "login" or None."""
    dlg, lay = _dialog(parent, "Unlock more lessons", picture or "ada_logo.png",
                       f"You finished the free lessons! 🌟",
                       f"{course['name']}: {free_count} of {lesson_count} lessons are free to try")
    text = QLabel(f"Ask a grown-up to unlock all {lesson_count} lessons of {course['name']}"
                  f"{' for ' + course['price'] if course.get('price') else ''}. "
                  "The Upgrade button opens our website, where they can get a licence.\n\n"
                  "Already bought it? Log in again with the grown-up's account.")
    text.setWordWrap(True)
    text.setFont(font(12))
    lay.addWidget(text)
    choice = {}
    upgrade = QPushButton("⭐  Upgrade")
    upgrade.setObjectName("UpgradeButton")
    upgrade.setCursor(Qt.PointingHandCursor)
    upgrade.setFont(font(12, True))
    login = QPushButton("🔑  Log in again")
    login.setObjectName("Plain")
    login.setCursor(Qt.PointingHandCursor)

    def pick(what):
        choice["what"] = what
        if what == "upgrade" and course.get("buy_url"):
            QDesktopServices.openUrl(QUrl(course["buy_url"]))
        dlg.accept()
    upgrade.clicked.connect(lambda: pick("upgrade"))
    login.clicked.connect(lambda: pick("login"))
    row = QHBoxLayout()
    row.addWidget(upgrade)
    row.addWidget(login)
    row.addStretch()
    later = QPushButton("Later")
    later.setCursor(Qt.PointingHandCursor)
    later.clicked.connect(dlg.reject)
    row.addWidget(later)
    lay.addLayout(row)
    dlg.exec_()
    return choice.get("what")
