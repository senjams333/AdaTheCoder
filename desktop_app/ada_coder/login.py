"""The welcome card: log in or create an account.

Three ways in:
  * Log in with the grown-up's website account (email and password). The website says which paid
    themes the family has bought, and those unlock in the app.
  * "Create an account": a grown-up makes a website account from here (/api/v3/register).
  * "Try for free": just a name. Free themes, and the free lessons of every paid theme, can be played.
Without internet, a log-in works with the themes remembered from the last time.
"""
import threading

from PyQt5.QtCore import Qt, QTimer, pyqtSignal
from PyQt5.QtWidgets import (QCheckBox, QFrame, QGraphicsDropShadowEffect, QHBoxLayout, QLabel, QLineEdit,
                             QProgressBar, QVBoxLayout, QWidget)
from PyQt5.QtGui import QColor

from . import sync
from .config import SERVER_URL
from .styles import font
from .widgets import pill, round_pixmap

CARD_QSS = """
QFrame#LoginCard { background: #ffffff; border-radius: 32px; }
QLabel { color: #1e1b4b; background: transparent; }
QLabel#FieldLabel { color: #5b2fe0; font-weight: bold; }
QLabel#Status { font-weight: bold; }
QLineEdit { background: #ffffff; color: #1e1b4b; border: 3px solid #e2dcf8; border-radius: 16px; padding: 10px 14px; }
QLineEdit:focus { border-color: #7b4dff; }
QCheckBox { color: #4c4a7a; }
QLabel#Hint { color: #0d6b4f; background: #e9fbf4; border: 2px dashed #22c997; border-radius: 12px; padding: 6px; }
QPushButton#LinkButton { background: transparent; color: #5b2fe0; border: none; text-decoration: underline; }
QPushButton#LinkButton:hover { color: #ff5fa8; }
QProgressBar { border: none; border-radius: 6px; background: #f4f1ff; }
QProgressBar::chunk { background: #7b4dff; border-radius: 6px; }
"""


class LoginOverlay(QFrame):
    logged_in = pyqtSignal(dict)   # {"full_name", "email"}

    def __init__(self, parent, settings):
        super().__init__(parent)
        self.settings = settings
        self.mode = "login"
        self.pending = None
        self.setObjectName("LoginOverlay")
        self.setStyleSheet("QFrame#LoginOverlay { background: rgba(17, 12, 46, 0.45); }")

        outer = QVBoxLayout(self)
        outer.setAlignment(Qt.AlignCenter)

        self.card = QFrame()
        self.card.setObjectName("LoginCard")
        self.card.setStyleSheet(CARD_QSS)
        self.card.setFixedWidth(440)
        shadow = QGraphicsDropShadowEffect(self.card)
        shadow.setBlurRadius(50)
        shadow.setOffset(0, 12)
        shadow.setColor(QColor(30, 27, 75, 90))
        self.card.setGraphicsEffect(shadow)

        lay = QVBoxLayout(self.card)
        lay.setContentsMargins(34, 26, 34, 24)
        lay.setSpacing(8)

        logo = QLabel()
        logo.setAlignment(Qt.AlignCenter)
        pix = round_pixmap("ada_logo.png", 96)
        if pix:
            logo.setPixmap(pix)
        else:
            logo.setText("👧")
            logo.setFont(font(40))

        self.title = QLabel("Welcome back! 🎉")
        self.title.setAlignment(Qt.AlignCenter)
        self.title.setFont(font(22, True))
        self.subtitle = QLabel("Log in to continue your Python adventure 🚀")
        self.subtitle.setAlignment(Qt.AlignCenter)
        self.subtitle.setWordWrap(True)
        self.subtitle.setFont(font(12))

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Your name")
        self.name_box = self._field("Your name 👤", self.name_input)
        self.name_box.hide()

        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText("grown-up@example.com")
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Password")
        self.password_input.setEchoMode(QLineEdit.Password)
        self.city_input = QLineEdit()
        self.city_input.setPlaceholderText("City")
        self.country_input = QLineEdit()
        self.country_input.setPlaceholderText("Country")
        for box in (self.name_input, self.email_input, self.password_input, self.city_input, self.country_input):
            box.setFont(font(13))
            box.returnPressed.connect(self.submit)
        places = QWidget()
        places_row = QHBoxLayout(places)
        places_row.setContentsMargins(0, 0, 0, 0)
        places_row.setSpacing(10)
        places_row.addWidget(self._field("City 🏙️", self.city_input))
        places_row.addWidget(self._field("Country 🌍", self.country_input))
        self.places_box = places
        self.places_box.hide()
        self.consent = QCheckBox("I'm the parent or guardian, and I agree to the privacy policy")
        self.consent.setFont(font(10))
        self.consent.hide()

        self.remember = QCheckBox("Keep me logged in on this computer")
        self.remember.setFont(font(11))
        self.remember.setChecked(bool(settings["remember_me"]))

        site = SERVER_URL.replace("https://", "").replace("http://", "")
        self.hint = QLabel(f"Grown-ups: use your {site} account to unlock the themes you bought ⭐")
        self.hint.setObjectName("Hint")
        self.hint.setWordWrap(True)
        self.hint.setAlignment(Qt.AlignCenter)
        self.hint.setFont(font(10, True))

        self.status = QLabel("")
        self.status.setObjectName("Status")
        self.status.setAlignment(Qt.AlignCenter)
        self.status.setWordWrap(True)
        self.status.setFont(font(12, True))

        self.busy = QProgressBar()
        self.busy.setRange(0, 0)
        self.busy.setFixedHeight(10)
        self.busy.setTextVisible(False)
        self.busy.hide()

        self.go_btn = pill("🚀  Let's code!", "PrimaryButton", size=14)
        self.go_btn.setMinimumHeight(48)
        self.go_btn.clicked.connect(self.submit)
        self.switch_btn = pill("No account? Try for free ✨", "LinkButton", size=11)
        self.switch_btn.clicked.connect(self.toggle_mode)
        self.signup_btn = pill("Grown-up? Create an account 📝", "LinkButton", size=11)
        self.signup_btn.clicked.connect(lambda: self.set_mode("login" if self.mode == "signup" else "signup"))

        lay.addWidget(logo)
        lay.addWidget(self.title)
        lay.addWidget(self.subtitle)
        lay.addSpacing(6)
        lay.addWidget(self.name_box)
        self.email_box = self._field("Email 📧", self.email_input)
        self.password_box = self._field("Password 🔑", self.password_input)
        lay.addWidget(self.email_box)
        lay.addWidget(self.password_box)
        lay.addWidget(self.places_box)
        lay.addWidget(self.consent)
        lay.addWidget(self.remember)
        lay.addWidget(self.hint)
        lay.addWidget(self.status)
        lay.addWidget(self.busy)
        lay.addWidget(self.go_btn)
        lay.addWidget(self.switch_btn, alignment=Qt.AlignCenter)
        lay.addWidget(self.signup_btn, alignment=Qt.AlignCenter)

        row = QHBoxLayout()
        row.addStretch()
        row.addWidget(self.card)
        row.addStretch()
        outer.addLayout(row)
        self.hide()

    @staticmethod
    def _field(label, box):
        holder = QWidget()
        lay = QVBoxLayout(holder)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(3)
        lbl = QLabel(label)
        lbl.setObjectName("FieldLabel")
        lbl.setFont(font(11, True))
        lay.addWidget(lbl)
        lay.addWidget(box)
        return holder

    # ------------------------------------------------------------------ showing
    def open(self):
        user = self.settings["user"] or {}
        self.email_input.setText(user.get("email", ""))
        self.password_input.clear()
        self._set_status("", "#1e1b4b")
        self.setGeometry(self.parent().rect())
        self.show()
        self.raise_()
        QTimer.singleShot(50, (self.password_input if self.email_input.text() else self.email_input).setFocus)

    def toggle_mode(self):
        self.set_mode("register" if self.mode == "login" else "login")

    def set_mode(self, mode):
        """login: website account · register: "Try for free" (just a name) · signup: create a website account."""
        self.mode = mode
        guest, signup = mode == "register", mode == "signup"
        self.name_box.setVisible(guest or signup)
        self.email_box.setVisible(not guest)
        self.password_box.setVisible(not guest)
        self.places_box.setVisible(signup)
        self.consent.setVisible(signup)
        self.hint.setVisible(mode == "login")
        self.title.setText({"register": "Let's try it! 🚀", "signup": "Create an account 📝"}.get(mode, "Welcome back! 🎉"))
        self.subtitle.setText({
            "register": "Type your name and start coding. Free lessons in every theme ✨",
            "signup": "For grown-ups: one account for the app and the website, where you can unlock more themes ⭐",
        }.get(mode, "Log in to continue your Python adventure 🚀"))
        self.name_box.findChild(QLabel).setText("Grown-up's name 👤" if signup else "Your name 👤")
        self.password_input.setPlaceholderText("At least 8 characters" if signup else "Password")
        self.go_btn.setText({"register": "🚀  Start for free", "signup": "📝  Create account"}.get(mode, "🚀  Let's code!"))
        self.switch_btn.setText("No account? Try for free ✨" if mode == "login" else "Have an account? Log in 🔑")
        self.signup_btn.setVisible(mode == "login")
        self._set_status("", "#1e1b4b")
        (self.name_input if guest or signup else self.email_input).setFocus()

    # ------------------------------------------------------------------ checking
    def submit(self):
        if self.mode == "signup":
            return self._submit_signup()
        if self.mode == "register":
            name = self.name_input.text().strip()
            if not name:
                return self._error("Please type your name.")
            self.settings["licences"] = []
            return self._welcome({"full_name": name, "email": ""})
        email = self.email_input.text().strip()
        password = self.password_input.text()
        if not email or "@" not in email:
            return self._error("Please type an email address, like grown-up@example.com")
        if not password:
            return self._error("Please type a password.")
        self._busy(True, "Logging in… ⏳")
        self.pending = {"email": email}
        result = {}
        worker = threading.Thread(target=lambda: result.update(answer=sync.login(email, password)), daemon=True)
        worker.start()
        self._wait = QTimer(self)

        def poll():
            if not worker.is_alive():
                self._wait.stop()
                self._check(result.get("answer"))
        self._wait.timeout.connect(poll)
        self._wait.start(150)

    def _submit_signup(self):
        details = {"name": self.name_input.text().strip(), "email": self.email_input.text().strip(),
                   "password": self.password_input.text(), "city": self.city_input.text().strip(),
                   "country": self.country_input.text().strip(), "consent": bool(self.consent.isChecked())}
        if not details["name"]:
            return self._error("Please type the grown-up's name.")
        if "@" not in details["email"]:
            return self._error("Please type an email address, like grown-up@example.com")
        if len(details["password"]) < 8:
            return self._error("Choose a password with at least 8 characters.")
        if not details["city"] or not details["country"]:
            return self._error("Please type your city and country.")
        if not details["consent"]:
            return self._error("Please tick the box to confirm you're the parent or guardian.")
        self._busy(True, "Creating your account… ⏳")
        result = {}
        worker = threading.Thread(target=lambda: result.update(answer=sync.register(details)), daemon=True)
        worker.start()
        self._wait = QTimer(self)

        def poll():
            if not worker.is_alive():
                self._wait.stop()
                self._signed_up(result.get("answer"))
        self._wait.timeout.connect(poll)
        self._wait.start(150)

    def _signed_up(self, answer):
        """answer: what the website said (see sync.register), or None when it couldn't be reached."""
        if answer is None:
            self._busy(False, "")
            return self._error("Can't reach the website to create the account. Check the internet and try again, "
                               "or choose Try for free.")
        if not answer.get("ok"):
            self._busy(False, "")
            return self._error(" ".join(answer.get("errors") or ["The account couldn't be created."]))
        self.settings["licences"] = list(answer.get("licences") or [])
        self._welcome({"full_name": answer.get("name") or self.name_input.text().strip(),
                       "email": answer.get("email") or ""}, note="Your account is ready.")

    def _check(self, answer):
        """answer: what the website said (see sync.login), or None when it couldn't be reached."""
        email = (self.pending or {}).get("email", "")
        self.pending = None
        saved = self.settings["user"] or {}
        same_person = bool(email) and saved.get("email", "").lower() == email.lower()
        if answer is None:
            # offline: let the child in, with the themes remembered from the last log-in
            if not same_person:
                self.settings["licences"] = []
            user = {"full_name": saved.get("full_name") if same_person else email.split("@")[0].title(), "email": email}
            return self._welcome(user, note="(offline: we'll check your themes next time) ")
        if not answer.get("ok"):
            self._busy(False, "")
            return self._error(answer.get("error") or "That email and password don't match.")
        self.settings["licences"] = list(answer.get("licences") or [])
        self._welcome({"full_name": answer.get("name") or email.split("@")[0].title(), "email": answer.get("email") or email})

    def _welcome(self, user, note=""):
        self.settings["remember_me"] = bool(self.remember.isChecked())
        self.settings["user"] = user
        self._busy(False, f"Welcome, {user['full_name']}! 🎉 {note}".strip())
        self.status.setStyleSheet("color: #0d8a63;")
        QTimer.singleShot(600, lambda: (self.hide(), self.logged_in.emit(user)))

    def _busy(self, on, message):
        self.busy.setVisible(on)
        for w in (self.go_btn, self.switch_btn, self.name_input, self.email_input, self.password_input):
            w.setEnabled(not on)
        self._set_status(message, "#5b2fe0")

    def _error(self, message):
        self._set_status("❌ " + message, "#d6336c")

    def _set_status(self, text, colour):
        self.status.setText(text)
        self.status.setStyleSheet(f"color: {colour};")
        self.status.setVisible(bool(text))
