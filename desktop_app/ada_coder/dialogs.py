"""Profile, License (About) and Upgrade pop-ups, made for children: big letters, round glowing cards.

Profile and License stay open until the big red Close is pressed (no small ✕, Esc does nothing), and a
character waves gently on them. The Upgrade card glows like a sunset and has only ✕ and Upgrade.
"""
import html
import math
from urllib.parse import quote

from PyQt5.QtCore import Qt, QTimer, QUrl
from PyQt5.QtGui import QColor, QDesktopServices, QPainter, QPixmap, QTransform
from PyQt5.QtWidgets import (QApplication, QDialog, QFrame, QGraphicsDropShadowEffect, QHBoxLayout, QLabel, QPushButton,
                             QVBoxLayout)

from .config import APP_NAME, APP_VERSION, CONTACT_EMAIL, SERVER_URL
from .styles import font, ui_family
from .widgets import load_pixmap, round_pixmap


class KidWindow(QDialog):
    """A frameless window that stays open until the child presses its big red Close button."""

    def __init__(self, parent=None):
        super().__init__(parent, Qt.Dialog | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            event.ignore()
            return
        super().keyPressEvent(event)


def _glow(owner, colour):
    glow = QGraphicsDropShadowEffect(owner)
    glow.setBlurRadius(60)
    glow.setColor(colour)
    glow.setOffset(0, 0)
    return glow


def _waving(label, picture, box):
    """The character moves slowly and gently: a small sway and a soft float (about 5 seconds a swing)."""
    pix = load_pixmap(picture) if picture else QPixmap()
    if pix.isNull():
        label.setText("⭐")
        label.setStyleSheet("font-size: 150px;")
        return
    pix = pix.scaled(225, 225, Qt.KeepAspectRatio, Qt.SmoothTransformation)
    step = {"t": 0.0}

    def wave():
        step["t"] += 0.05
        turned = pix.transformed(QTransform().rotate(4 * math.sin(step["t"])), Qt.SmoothTransformation)
        canvas = QPixmap(label.size())
        canvas.fill(Qt.transparent)
        painter = QPainter(canvas)
        painter.setRenderHint(QPainter.SmoothPixmapTransform)
        dy = 7 * math.sin(step["t"] * 0.8)
        painter.drawPixmap(int((canvas.width() - turned.width()) / 2), int((canvas.height() - turned.height()) / 2 + dy), turned)
        painter.end()
        label.setPixmap(canvas)

    wave()
    timer = QTimer(box)
    timer.timeout.connect(wave)
    timer.start(40)


def kid_window(parent, title, picture, hello, heading, rows, notes="", buttons=(), row_bg="#ffffff"):
    """A big, friendly window: a character waving hello next to a table of rows.

    rows: (label, value) pairs (plain text). notes: extra HTML under the table (already escaped).
    buttons: (text, action) pairs shown at the bottom; they keep the window open. action(note) gets a label
    above the buttons where it can show a short message (hidden until used).
    """
    family = ui_family()
    info = "".join("<tr><td style='padding:5px 14px 5px 0; color:#0369a1;'><b>%s</b></td><td style='padding:5px 0;'>%s</td></tr>"
                   % (html.escape(str(k)), html.escape(str(v))) for k, v in rows)
    box = KidWindow(parent)
    box.setWindowTitle(title)
    box.setMinimumSize(880, 610)                  # the card is about 810 x 540, plus room for the glow
    frame = QVBoxLayout(box)
    frame.setContentsMargins(34, 34, 34, 34)
    card = QFrame()
    card.setObjectName("KidCard")
    card.setGraphicsEffect(_glow(box, QColor(251, 128, 114, 235)))     # a warm sunset glow
    card.setStyleSheet(f"""
        QFrame#KidCard {{ background: #f0f9ff; border: 4px solid #ffffff; border-radius: 34px; }}
        QLabel {{ color: #0f172a; background: transparent; border: none; }}
        QPushButton {{ font-family: '{family}'; font-size: 18px; font-weight: bold; border-radius: 24px; padding: 12px 30px; }}
        QPushButton#soft {{ background: #e0f2fe; color: #0f172a; border: 3px solid #38bdf8; }}
        QPushButton#soft:hover {{ background: #38bdf8; color: white; }}
        QPushButton#close {{ background: #ef4444; color: white; border: 4px solid #b91c1c; border-radius: 26px;
                            font-size: 21px; padding: 8px 22px; }}
        QPushButton#close:hover {{ background: #dc2626; }}
        QPushButton#close:pressed {{ background: #b91c1c; }}
    """)
    frame.addWidget(card)
    outer = QVBoxLayout(card)
    outer.setContentsMargins(26, 16, 20, 20)
    outer.setSpacing(10)

    top = QHBoxLayout()
    top.addStretch()
    close_btn = QPushButton("✕  Close")
    close_btn.setObjectName("close")
    close_btn.setCursor(Qt.PointingHandCursor)
    close_btn.setMinimumHeight(60)
    close_btn.setToolTip("Close this window")
    close_btn.clicked.connect(box.accept)
    top.addWidget(close_btn)
    outer.addLayout(top)

    row = QHBoxLayout()
    row.setSpacing(28)
    side = QVBoxLayout()
    side.setAlignment(Qt.AlignTop | Qt.AlignHCenter)
    bubble = QLabel(hello)
    bubble.setFont(font(17, True))
    bubble.setAlignment(Qt.AlignCenter)
    bubble.setWordWrap(True)
    bubble.setMaximumWidth(270)
    bubble.setStyleSheet("background: white; border: 3px solid #38bdf8; border-radius: 22px; padding: 10px 18px;")
    pic = QLabel()
    pic.setFixedSize(250, 270)
    pic.setAlignment(Qt.AlignCenter)
    side.addWidget(bubble, alignment=Qt.AlignHCenter)
    side.addWidget(pic, alignment=Qt.AlignHCenter)
    row.addLayout(side)

    text = QLabel()
    text.setTextFormat(Qt.RichText)
    text.setWordWrap(True)
    text.setTextInteractionFlags(Qt.TextSelectableByMouse)
    text.setText(f"<div style=\"font-family: '{family}'; font-size: 18px; color: #0f172a;\">"
                 f"<div style='color:#0284c7; font-size: 29px; font-weight: bold; margin-bottom: 8px;'>{heading}</div>"
                 f"<table style='background:{row_bg};'>{info}</table>{notes}</div>")
    row.addWidget(text, 1)
    outer.addLayout(row, 1)

    if buttons:
        note = QLabel("")
        note.setWordWrap(True)
        note.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        note.setFont(font(13, True))
        note.setStyleSheet("color: #0369a1;")
        note.hide()
        outer.addWidget(note)
        bar = QHBoxLayout()
        bar.addStretch()
        for label, action in buttons:
            btn = QPushButton(label)
            btn.setObjectName("soft")
            btn.setCursor(Qt.PointingHandCursor)
            btn.clicked.connect(lambda _=False, act=action: act(note))
            bar.addWidget(btn)
        outer.addLayout(bar)

    _waving(pic, picture, box)
    box.exec_()


def show_profile(parent, user, done_count, lesson_count, course_name):
    """Profile: Byte the owl waves and says hi to the child by their first name."""
    first = (str(user.get("child_name") or user.get("full_name") or "").split() or ["friend"])[0]
    email = user.get("email") or ""
    online = bool(email)                      # logged in with a website account (not Try for free)
    rows = [("🆔 User ID", user.get("id") or "usr_KIDS_1001"),
            ("👤 Full Name", user.get("full_name") or "Coder"),
            ("📧 Email", email or "–"),
            ("🎓 Role", user.get("role") or "Student"),
            ("🖼️ Avatar", user.get("avatar") or "Default (Ada the Teacher) 🐍"),
            ("📝 Bio", user.get("bio") or "Young coder on a coding adventure! 🚀"),
            ("⚧ Gender", user.get("gender") or "Not specified"),
            ("📍 Address", user.get("address") or "Not specified"),
            ("🔐 Auth Provider", user.get("auth_provider") or ("website" if online else "local")),
            ("⚡ Active", "✅ Yes"),
            ("🗓️ Created At", user.get("created_at") or "–"),
            ("⭐ Lessons finished", f"{done_count} of {lesson_count} ({course_name})")]
    notes = "" if online else "<p style='font-size:14px; color:#065f46;'>✨ Demo data — no internet or server needed! 🚀</p>"

    def change_password(note):
        """Asks the website to email the grown-up a password reset link (with a 6-digit code).
        The new password then works on the website and in the app. Offline: opens the website's page."""
        from . import sync
        note.setText("⏳ Asking the website…")
        note.show()
        QApplication.processEvents()
        sent = sync.forgot_password(email)
        if sent is None:
            url = SERVER_URL.rstrip("/") + "/forgot-password" + ("?email=" + quote(email) if "@" in email else "")
            QDesktopServices.openUrl(QUrl(url))
            note.setText("🌐 Can't reach the website from the app, so its Forgot password page is open in your browser.")
        elif sent:
            note.setText(f"📧 We've emailed a password reset link to {email}. Ask a grown-up to open it and choose a new password.")
        else:
            note.setText("❌ The website couldn't send the email just now. Please try again in a minute.")
    buttons = [("🔑 Change password", change_password)] if email else []
    kid_window(parent, "Profile 👤", "byte.png", f"👋 Hi, {first}!", "👤 My Profile 🌟", rows, notes, buttons=buttons)


def show_about(parent, picture="tom.png", licence_status="", theme_name="", user=None, licence_key=""):
    """License: the theme's first character waves next to this theme's licence details."""
    user = user or {}
    rows = [("🎫 License Key", licence_key or "none yet"),
            ("👤 Licensed To", user.get("full_name") or "–"),
            ("📧 Email", user.get("email") or "–"),
            ("🎯 Plan", "Personal & Educational"),
            ("⚡ Status", licence_status or "–"),
            ("🔢 Version", APP_VERSION)]
    notes = ("<p style='font-size:15px;'><b>📜 License:</b> Personal &amp; educational use only.</p><br>"
             "<p style='font-size:15px;'>This software is provided \"as is\", without warranty of any kind.</p>")
    kid_window(parent, "License 📜", picture or "tom.png", "👋 Hi, here's your license details",
               "📜 " + html.escape(theme_name or APP_NAME), rows, notes, row_bg="#fef9c3")


def show_upgrade(parent, course, free_count, lesson_count, picture="ada_logo.png"):
    """A locked lesson: a glowing sky card with a yellow sunset glow, big letters, ✕ and Upgrade.
    Upgrade opens the website's account page at this theme. Returns "upgrade" or None."""
    family = ui_family()
    box = QDialog(parent, Qt.Dialog | Qt.FramelessWindowHint)
    box.setWindowTitle("Locked lesson 🔒")
    box.setAttribute(Qt.WA_TranslucentBackground)
    outer = QVBoxLayout(box)
    outer.setContentsMargins(36, 36, 36, 36)          # room for the glow
    card = QFrame()
    card.setObjectName("SkyCard")
    card.setStyleSheet(f"""
        QFrame#SkyCard {{
            background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #f0fbff, stop:0.45 #bae6fd, stop:1 #7dd3fc);
            border: 4px solid #ffffff; border-radius: 36px;
        }}
        QLabel {{ color: #0f172a; background: transparent; border: none; }}
        QPushButton#up {{ font-family: '{family}'; font-size: 22px; font-weight: bold; background: #ffd166; color: #0f172a;
                         border: 4px solid #f59e0b; border-radius: 28px; padding: 12px 34px; }}
        QPushButton#up:hover {{ background: #ffe08a; }}
        QPushButton#x {{ font-family: '{family}'; font-size: 22px; font-weight: bold; background: #ffffff; color: #0284c7;
                        border: 3px solid #38bdf8; border-radius: 24px; }}
        QPushButton#x:hover {{ background: #38bdf8; color: white; }}
    """)
    card.setGraphicsEffect(_glow(box, QColor(251, 191, 36, 235)))     # warm, yellow sunset glow
    outer.addWidget(card)

    lay = QVBoxLayout(card)
    lay.setContentsMargins(30, 18, 18, 26)
    lay.setSpacing(10)
    top = QHBoxLayout()
    top.addStretch()
    x_btn = QPushButton("✕")
    x_btn.setObjectName("x")
    x_btn.setFixedSize(48, 48)
    x_btn.setCursor(Qt.PointingHandCursor)
    x_btn.setToolTip("Close")
    x_btn.clicked.connect(box.reject)
    top.addWidget(x_btn)
    lay.addLayout(top)

    row = QHBoxLayout()
    row.setSpacing(22)
    pix = round_pixmap(picture or "ada_logo.png", 120) or round_pixmap("ada_logo.png", 120)
    if pix:
        icon = QLabel()
        icon.setPixmap(pix)
        row.addWidget(icon, alignment=Qt.AlignTop)
    price = f" for {html.escape(course['price'])}" if course.get("price") else ""
    free = (f"{free_count} of {lesson_count} lessons are free to try." if free_count
            else "This theme needs a grown-up's licence.")
    text = QLabel(f"<div style=\"font-family: '{family}'; color: #0f172a;\">"
                  f"<div style='color:#0369a1; font-size: 30px; font-weight: bold;'>🔒 {html.escape(course['name'])}</div>"
                  f"<p style='font-size: 22px;'>This lesson is locked. {free}</p>"
                  f"<p style='font-size: 22px;'>Ask a grown-up to unlock every lesson{price} ⭐</p></div>")
    text.setTextFormat(Qt.RichText)
    text.setWordWrap(True)
    text.setMinimumWidth(460)
    row.addWidget(text, 1)
    lay.addLayout(row)
    up_btn = QPushButton("⭐ Upgrade")
    up_btn.setObjectName("up")
    up_btn.setCursor(Qt.PointingHandCursor)
    up_btn.clicked.connect(box.accept)
    lay.addWidget(up_btn, alignment=Qt.AlignRight)
    if box.exec_() == QDialog.Accepted:
        if course.get("buy_url"):
            QDesktopServices.openUrl(QUrl(course["buy_url"]))
        return "upgrade"
    return None
