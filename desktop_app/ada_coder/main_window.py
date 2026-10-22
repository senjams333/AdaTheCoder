"""The app window: home screen, lesson screen (video + coding page) and the course list."""
import os

from PyQt5.QtCore import Qt, QTimer, QUrl
from PyQt5.QtGui import QColor, QIcon, QKeySequence
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtWebEngineWidgets import QWebEngineSettings, QWebEngineView
from PyQt5.QtWidgets import (QAction, QActionGroup, QFrame, QHBoxLayout, QLabel, QMainWindow, QMenu, QProgressBar,
                             QScrollArea, QShortcut, QStackedWidget, QToolButton, QVBoxLayout, QWidget)

from . import lessons as course
from .bridge import CodeBridge
from .config import APP_NAME
from .dialogs import show_about, show_profile, show_upgrade
from .login import LoginOverlay
from .paths import asset, image
from .settings import Settings
from .splash import IntroSplash
from .styles import font, window_qss
from .video_panel import VideoPanel
from .widgets import CharacterCard, LessonButton, ThemeCard, pill, round_button, round_pixmap

VIDEO, CODE = 0, 1          # pages of the lesson screen
HOME, LESSON = 0, 1         # pages of the centre area


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.settings = Settings()
        self.courses = course.load_courses()
        self.course = course.find_course(self.courses, self.settings["course"])
        self.settings["course"] = self.course["id"]
        self.lessons = self.course["lessons"]
        self.index = self._start_index()
        self.page_ready = False
        self.user = {}

        self.setWindowTitle(f"{APP_NAME} 🐍")
        self.setMinimumSize(900, 600)
        self.setWindowIcon(QIcon(image("ada_logo.png")))

        self.central = QWidget()
        self.central.setObjectName("CentralWidget")
        self.setCentralWidget(self.central)
        root = QVBoxLayout(self.central)
        root.setContentsMargins(16, 12, 16, 16)
        root.setSpacing(12)

        root.addLayout(self._build_top_bar())
        body = QHBoxLayout()
        body.setSpacing(16)
        self.center = QStackedWidget()
        self.center.addWidget(self._build_home())
        self.center.addWidget(self._build_lesson_screen())
        body.addWidget(self.center, 1)
        body.addWidget(self._build_sidebar())
        root.addLayout(body, 1)

        self.splash = IntroSplash(self.central)
        self.splash.done.connect(self._after_intro)
        self.login = LoginOverlay(self.central, self.settings)
        self.login.logged_in.connect(self._on_logged_in)

        QShortcut(QKeySequence("F11"), self, activated=self.toggle_full_screen)

        self.apply_theme()
        self.apply_style()
        self.refresh_sidebar()
        self._set_signed_in(False)

    # ================================================================== building the window
    def _build_top_bar(self):
        bar = QHBoxLayout()
        bar.setSpacing(10)
        logo = QLabel()
        pix = round_pixmap("ada_logo.png", 46)
        if pix:
            logo.setPixmap(pix)
        name = QLabel(APP_NAME)
        name.setObjectName("AppName")
        name.setFont(font(19, True))

        self.home_btn = pill("🏠  Home")
        self.home_btn.clicked.connect(self.show_home)
        self.course_btn = pill("📚  Lessons")
        self.course_btn.setToolTip("Show or hide the lesson list")
        self.course_btn.clicked.connect(self.toggle_sidebar)
        self.theme_btn = round_button("☀️", "Day or night")
        self.theme_btn.clicked.connect(self.toggle_dark)
        self.music_btn = round_button("🔈", "Background music on or off")
        self.music_btn.clicked.connect(self.toggle_music)

        self.avatar = QToolButton()
        self.avatar.setCursor(Qt.PointingHandCursor)
        self.avatar.setFixedSize(48, 48)
        self.avatar.setIconSize(self.avatar.size() * 0.9)
        self.avatar.setPopupMode(QToolButton.InstantPopup)
        self.avatar.setToolTip("My account")
        self.avatar.setStyleSheet("QToolButton { border: 3px solid #ffd23f; border-radius: 24px; background: white; }"
                                  "QToolButton:hover { border-color: #7b4dff; } QToolButton::menu-indicator { image: none; }")
        avatar_pix = round_pixmap("ada.png", 42)
        if avatar_pix:
            self.avatar.setIcon(QIcon(avatar_pix))
        self.avatar.setMenu(self._build_menu())

        bar.addWidget(logo)
        bar.addWidget(name)
        bar.addStretch()
        for w in (self.home_btn, self.course_btn, self.theme_btn, self.music_btn, self.avatar):
            bar.addWidget(w)
        return bar

    def _build_menu(self):
        menu = QMenu(self)
        menu.setFont(font(12))
        self.profile_action = menu.addAction("👤  My profile", self.open_profile)
        menu.addMenu(self._build_course_menu())
        self.voice_action = QAction("🗣️  Read messages aloud", self, checkable=True)
        self.voice_action.setChecked(bool(self.settings["voice"]))
        self.voice_action.toggled.connect(self.toggle_voice)
        menu.addAction(self.voice_action)
        menu.addAction("🔄  Check for new lessons", self.check_for_lessons)
        menu.addAction("🎬  Watch the intro again", self.replay_intro)
        menu.addSeparator()
        menu.addAction("ℹ️  About & licence", lambda: show_about(self))
        menu.addSeparator()
        self.logout_action = menu.addAction("🚪  Log out", self.logout)
        return menu

    def _build_course_menu(self):
        """A "Themes" menu. There are two (avatar menu and the sidebar title); both are refilled together."""
        menu = QMenu("🎨  Themes", self)
        menu.setFont(font(12))
        if not hasattr(self, "course_menus"):
            self.course_menus = []
        self.course_menus.append(menu)
        self._fill_course_menu(menu)
        return menu

    def _fill_course_menu(self, menu):
        menu.clear()
        group = QActionGroup(menu)
        for c in self.courses:
            mark = "" if course.owns(c, self.settings["licences"]) else "  ✨ try free"
            act = QAction(c["name"] + mark, menu, checkable=True)
            act.setChecked(c["id"] == self.course["id"])
            act.triggered.connect(lambda _=False, k=c["id"]: self.choose_course(k))
            group.addAction(act)
            menu.addAction(act)

    def _build_home(self):
        self.hero = QFrame()
        self.hero.setObjectName("HeroPanel")
        lay = QVBoxLayout(self.hero)
        lay.setAlignment(Qt.AlignCenter)
        lay.setContentsMargins(30, 26, 30, 30)
        lay.setSpacing(10)

        self.hero_title = QLabel("Python Adventure For Kids! 🐍")
        self.hero_title.setAlignment(Qt.AlignCenter)
        self.hero_title.setWordWrap(True)
        self.hero_sub = QLabel("")
        self.hero_sub.setObjectName("Muted")
        self.hero_sub.setAlignment(Qt.AlignCenter)
        self.hero_sub.setWordWrap(True)

        cards = QWidget()
        self.cards_layout = QHBoxLayout(cards)
        self.cards_layout.setAlignment(Qt.AlignCenter)
        self.cards = [CharacterCard(*char) for char in course.characters(self.course)["hero"]]
        for card in self.cards:
            self.cards_layout.addWidget(card)

        self.start_btn = pill("▶  Start learning", "PrimaryButton", size=17)
        self.start_btn.setMinimumHeight(58)
        self.start_btn.clicked.connect(lambda: self.open_lesson(self.index))

        lay.addWidget(self.hero_title)
        lay.addWidget(self.hero_sub)
        lay.addWidget(cards, 1)
        lay.addWidget(self.start_btn, alignment=Qt.AlignCenter)

        # every theme from the website, with Try free / Play
        home = QWidget()
        home_lay = QVBoxLayout(home)
        home_lay.setContentsMargins(0, 0, 0, 0)
        home_lay.setSpacing(10)
        home_lay.addWidget(self.hero, 1)
        title = QLabel("🎨  Choose a theme")
        title.setObjectName("ThemesTitle")
        title.setFont(font(15, True))
        self.theme_scroll = QScrollArea()
        self.theme_scroll.setWidgetResizable(True)
        self.theme_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.theme_scroll.setFixedHeight(214)
        self.theme_cards = []
        self._fill_theme_cards()
        home_lay.addWidget(title)
        home_lay.addWidget(self.theme_scroll)
        return home

    def _fill_theme_cards(self):
        holder = QWidget()
        row = QHBoxLayout(holder)
        row.setContentsMargins(2, 2, 2, 2)
        row.setSpacing(14)
        self.theme_cards = []
        for c in self.courses:
            card = ThemeCard(c, course.characters(c)["hero"])
            card.picked.connect(self.play_theme)
            self.theme_cards.append(card)
            row.addWidget(card)
        row.addStretch()
        self.theme_scroll.setWidget(holder)
        self._refresh_theme_cards()

    def _refresh_theme_cards(self):
        for card in self.theme_cards:
            c = course.find_course(self.courses, card.course_id)
            card.set_state(current=c["id"] == self.course["id"], owned=course.owns(c, self.settings["licences"]),
                           free_count=course.free_count(c), price=c.get("price") or "")

    def _build_lesson_screen(self):
        screen = QWidget()
        lay = QVBoxLayout(screen)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(10)

        self.lesson_stack = QStackedWidget()
        self.video = VideoPanel(note="This video includes AI-generated content (Google AI)")
        self.video.finished.connect(self.show_code)

        self.web = QWebEngineView()
        self.web.page().setBackgroundColor(QColor(0, 0, 0, 0))
        s = self.web.settings()
        s.setAttribute(QWebEngineSettings.PlaybackRequiresUserGesture, False)
        s.setAttribute(QWebEngineSettings.LocalContentCanAccessFileUrls, True)
        s.setAttribute(QWebEngineSettings.JavascriptCanAccessClipboard, True)
        self.web.setContextMenuPolicy(Qt.NoContextMenu)
        self.bridge = CodeBridge(self.web, self)
        self.bridge.ran_ok.connect(self._code_worked)
        self.channel = QWebChannel(self.web.page())
        self.channel.registerObject("pyqtBridge", self.bridge)
        self.web.page().setWebChannel(self.channel)
        self.web.loadFinished.connect(self._page_loaded)
        self.web.setUrl(QUrl.fromLocalFile(asset("web", "lesson.html")))

        self.lesson_stack.addWidget(self.video)
        self.lesson_stack.addWidget(self.web)

        bar = QFrame()
        bar.setObjectName("LessonBar")
        bl = QHBoxLayout(bar)
        bl.setContentsMargins(0, 0, 0, 0)
        self.prev_btn = pill("◀  Back")
        self.prev_btn.clicked.connect(lambda: self.open_lesson(self.index - 1))
        self.video_btn = pill("🎬  Watch the video", "AccentButton", size=13)
        self.video_btn.clicked.connect(self.toggle_video)
        self.next_btn = pill("Next lesson  ▶")
        self.next_btn.clicked.connect(lambda: self.open_lesson(self.index + 1))
        bl.addWidget(self.prev_btn)
        bl.addStretch()
        bl.addWidget(self.video_btn)
        bl.addStretch()
        bl.addWidget(self.next_btn)

        lay.addWidget(self.lesson_stack, 1)
        lay.addWidget(bar)
        return screen

    def _build_sidebar(self):
        self.sidebar = QFrame()
        self.sidebar.setObjectName("Sidebar")
        self.sidebar.setFixedWidth(320)
        lay = QVBoxLayout(self.sidebar)
        lay.setContentsMargins(14, 16, 10, 14)
        lay.setSpacing(8)

        title = QToolButton()
        title.setObjectName("CourseTitle")
        title.setCursor(Qt.PointingHandCursor)
        title.setFont(font(14, True))
        title.setToolTip("Choose a theme")
        title.setPopupMode(QToolButton.InstantPopup)
        title.setMenu(self._build_course_menu())
        title.setStyleSheet("QToolButton { border: none; background: transparent; text-align: left; padding: 2px 0; }"
                            "QToolButton:hover { color: #7b4dff; } QToolButton::menu-indicator { image: none; }")
        self.course_title = title
        self.progress_label = QLabel("")
        self.progress_label.setObjectName("Muted")
        self.progress_label.setFont(font(11, True))
        self.progress = QProgressBar()
        self.progress.setObjectName("CourseProgress")
        self.progress.setTextVisible(False)
        self.progress.setFixedHeight(14)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.lesson_scroll = scroll
        self.lesson_buttons = []
        self._fill_lesson_list()

        self.upgrade_btn = pill("⭐  Upgrade to unlock every lesson", "UpgradeButton", size=11)
        self.upgrade_btn.clicked.connect(self.ask_upgrade)
        lay.addWidget(title)
        lay.addWidget(self.progress_label)
        lay.addWidget(self.progress)
        lay.addWidget(self.upgrade_btn)
        lay.addSpacing(4)
        lay.addWidget(scroll, 1)
        return self.sidebar

    def _fill_lesson_list(self):
        """(Re)builds the topics in the sidebar for the current course."""
        holder = QWidget()
        list_lay = QVBoxLayout(holder)
        list_lay.setContentsMargins(0, 4, 6, 4)
        list_lay.setSpacing(7)
        self.lesson_buttons = []
        for n, lesson in enumerate(self.lessons, start=1):
            btn = LessonButton(n, lesson)
            btn.picked.connect(self._lesson_picked)
            self.lesson_buttons.append(btn)
            list_lay.addWidget(btn)
        list_lay.addStretch()
        self.lesson_scroll.setWidget(holder)   # Qt deletes the previous list
        self.course_title.setText(f"🎨  {self.course['name']}  ▾")

    # ================================================================== start-up and accounts
    def start(self):
        """Called once the window is on screen."""
        self.splash.start()

    def _after_intro(self):
        user = self.settings["user"] or {}
        if self.settings["remember_me"] and user.get("email"):
            self._on_logged_in(user)
        else:
            self.login.open()

    def replay_intro(self):
        self.bridge.stop()
        self.video.stop()
        self.splash = IntroSplash(self.central)
        self.splash.done.connect(lambda: None)
        self.splash.start()

    def _on_logged_in(self, user):
        self.user = dict(user)
        self._set_signed_in(True)
        first = (self.user.get("full_name") or "").split(" ")[0]
        self.hero_title.setText(f"Hi {first}! Ready to code? 🐍" if first else "Python Adventure For Kids! 🐍")
        self._licences_changed()
        self.show_home()

    def _set_signed_in(self, signed_in):
        for w in (self.home_btn, self.course_btn, self.theme_btn, self.music_btn, self.avatar, self.center):
            w.setEnabled(signed_in)
        self.sidebar.setVisible(signed_in)
        self.course_btn.setText("📚  Lessons")

    def logout(self):
        self.bridge.stop()
        self.video.stop()
        self.settings["remember_me"] = False
        self.user = {}
        self.show_home()
        self._set_signed_in(False)
        self.sidebar.hide()
        self.login.open()

    def open_profile(self):
        done = sum(1 for l in self.lessons if self.settings.is_completed(self.course["id"], l["id"]))
        show_profile(self, self.user or self.settings["user"] or {}, done, len(self.lessons), self.course["name"])

    # ================================================================== lessons
    def _start_index(self):
        last = self.settings.last_lesson(self.course["id"])
        for i, lesson in enumerate(self.lessons):
            if lesson["id"] == last:
                return i
        return 0

    def _lesson_picked(self, lesson_id):
        for i, lesson in enumerate(self.lessons):
            if lesson["id"] == lesson_id:
                self.open_lesson(i)
                return

    def unlocked(self, index):
        return course.is_unlocked(self.course, index, self.settings["licences"])

    def open_lesson(self, index):
        if not self.lessons:
            return
        index = max(0, min(index, len(self.lessons) - 1))
        if not self.unlocked(index):
            self.ask_upgrade()
            return
        self.index = index
        lesson = self.lessons[self.index]
        self.settings.set_last_lesson(self.course["id"], lesson["id"])
        self.bridge.stop()
        self.center.setCurrentIndex(LESSON)
        self.refresh_sidebar()
        self.prev_btn.setEnabled(self.index > 0)
        self.next_btn.setEnabled(self.index < len(self.lessons) - 1)
        self._push_lesson()

        path = course.video_path(lesson)
        self.video_btn.setEnabled(bool(path))
        if path:
            self.lesson_stack.setCurrentIndex(VIDEO)
            self.video.play(path)
        else:
            self.show_code()
        self._update_video_button()

    def _push_lesson(self):
        if not self.page_ready or not self.lessons:
            return
        info = course.for_page(self.lessons[self.index], self.index + 1, len(self.lessons))
        self._js("updateLessonData", info)

    def show_code(self):
        self.video.stop()
        if self.center.currentIndex() == LESSON and self.lesson_stack.currentIndex() != CODE:
            self.lesson_stack.setCurrentIndex(CODE)
            self.web.setFocus()
            self._js("playTwinkleChime")
            self._js("showTutorialOverlay")
        self._update_video_button()

    def toggle_video(self):
        if self.lesson_stack.currentIndex() == VIDEO:
            self.show_code()
        else:
            path = course.video_path(self.lessons[self.index])
            if path:
                self.bridge.stop()
                self.lesson_stack.setCurrentIndex(VIDEO)
                self.video.play(path)
        self._update_video_button()

    def _update_video_button(self):
        watching = self.lesson_stack.currentIndex() == VIDEO
        self.video_btn.setText("⏭  Skip to coding" if watching else "🎬  Watch the video")

    def _code_worked(self):
        lesson = self.lessons[self.index]
        if self.settings.mark_completed(self.course["id"], lesson["id"]):
            self.refresh_sidebar()

    def refresh_sidebar(self):
        done = 0
        for i, btn in enumerate(self.lesson_buttons):
            finished = self.settings.is_completed(self.course["id"], btn.lesson_id)
            done += finished
            btn.set_state(active=(i == self.index and self.center.currentIndex() == LESSON), done=finished,
                          locked=not self.unlocked(i))
        total = len(self.lesson_buttons)
        self.progress.setRange(0, max(total, 1))
        self.progress.setValue(done)
        owned = course.owns(self.course, self.settings["licences"])
        free = course.free_count(self.course)
        if total and done == total:
            text = "All lessons finished! 🏆"
        elif not owned:
            text = f"{done} of {total} finished · {min(free, total)} free to try"
        else:
            text = f"{done} of {total} lessons finished"
        self.progress_label.setText(text)
        self.upgrade_btn.setVisible(not owned and free < total)
        if self.lesson_buttons and 0 <= self.index < len(self.lesson_buttons):
            self.lesson_scroll.ensureWidgetVisible(self.lesson_buttons[self.index], 0, 40)
        if hasattr(self, "start_btn"):
            if done == 0 and self.index == 0:
                self.start_btn.setText("▶  Start learning")
            else:
                self.start_btn.setText(f"▶  Continue: lesson {self.index + 1}")

    def show_home(self):
        self.bridge.stop()
        self.video.stop()
        self.center.setCurrentIndex(HOME)
        if getattr(self, "_reload_waiting", False):
            self.reload_courses()
        self.refresh_sidebar()

    def check_for_lessons(self):
        from . import sync
        sync.check_now(self)

    def toggle_sidebar(self):
        self.sidebar.setVisible(not self.sidebar.isVisible())
        self.course_btn.setText("📚  Lessons" if self.sidebar.isVisible() else "📚  Show lessons")

    # ================================================================== look and sound
    def _js(self, function, *args):
        import json
        self.web.page().runJavaScript(f"{function}({', '.join(json.dumps(a) for a in args)});")

    def _page_loaded(self, ok):
        self.page_ready = ok
        if not ok:
            return
        self._js("setDarkMode", bool(self.settings["dark_mode"]))
        self._js("toggleAudioEngine", bool(self.settings["music"]))
        self._js("setVoiceEnabled", bool(self.settings["voice"]))
        self._send_characters()
        self._push_lesson()

    def _send_characters(self):
        theme = course.characters(self.course)
        pictures = {}
        for k in ("guide", "success", "oops"):
            name = theme.get(k) or ""
            if os.path.isabs(name):
                pictures[k] = QUrl.fromLocalFile(name).toString()   # downloaded with a theme from the website
            elif name:
                pictures[k] = "../images/" + name
        self._js("setCharacters", pictures)

    def apply_style(self):
        dark = bool(self.settings["dark_mode"])
        self.central.setStyleSheet(window_qss(dark))
        self.theme_btn.setText("🌙" if dark else "☀️")
        self.music_btn.setText("🎵" if self.settings["music"] else "🔈")
        self._js("setDarkMode", dark)

    def apply_theme(self):
        theme = course.characters(self.course)
        for card, char in zip(self.cards, theme["hero"]):
            card.set_character(*char)
        self.hero_sub.setText(f"{self.course['name']}: {self.course.get('tagline') or theme['tagline']}")
        self._send_characters()
        self._fit_home()

    def choose_course(self, course_id):
        """Switches to another theme: its topics in the sidebar, its characters, and the child's place in it."""
        new = course.find_course(self.courses, course_id)
        if not new or new["id"] == self.course["id"]:
            return
        self.bridge.stop()
        self.video.stop()
        self.course = new
        self.settings["course"] = new["id"]
        self.lessons = new["lessons"]
        self.index = self._start_index()
        if not self.unlocked(self.index):
            self.index = 0
        for menu in self.course_menus:
            self._fill_course_menu(menu)
        self._fill_lesson_list()
        self.apply_theme()
        self._refresh_theme_cards()
        self.center.setCurrentIndex(HOME)
        self.refresh_sidebar()

    def play_theme(self, course_id):
        """A theme card was clicked (Try free / Play): switch to it and start its lessons."""
        self.choose_course(course_id)
        if not self.sidebar.isVisible():
            self.toggle_sidebar()
        self.open_lesson(self.index)

    def ask_upgrade(self):
        """The Upgrade pop-up. Upgrade opens the website's account page on this theme."""
        self.bridge.stop()
        self.video.stop()
        free = course.free_count(self.course) or 0
        hero = course.characters(self.course)["hero"]
        picture = hero[-1][1] if hero and hero[-1][1] else "ada_logo.png"
        if show_upgrade(self, self.course, free, len(self.lessons), picture) == "login":
            self.logout()

    def _licences_changed(self):
        for menu in getattr(self, "course_menus", []):
            self._fill_course_menu(menu)
        self._refresh_theme_cards()
        self.refresh_sidebar()

    def reload_courses(self):
        """New themes, topics, lessons or videos arrived from the website: show them straight away.
        While a child is in a lesson, it waits until they go back home, so their code isn't wiped."""
        if self.center.currentIndex() == LESSON and self.isVisible():
            self._reload_waiting = True
            return
        self._reload_waiting = False
        courses = course.load_courses()
        if not courses:
            return
        self.courses = courses
        playing = self.center.currentIndex() == LESSON
        current_id = self.lessons[self.index]["id"] if self.lessons else None
        self.course = course.find_course(self.courses, self.course["id"])
        self.settings["course"] = self.course["id"]
        self.lessons = self.course["lessons"]
        self.index = next((i for i, l in enumerate(self.lessons) if l["id"] == current_id), self._start_index())
        for menu in self.course_menus:
            self._fill_course_menu(menu)
        self._fill_lesson_list()
        self._fill_theme_cards()
        self.apply_theme()
        if playing:
            self._push_lesson()
        self.refresh_sidebar()

    def toggle_dark(self):
        self.settings["dark_mode"] = not self.settings["dark_mode"]
        self.apply_style()

    def toggle_music(self):
        self.settings["music"] = not self.settings["music"]
        self.apply_style()
        self._js("toggleAudioEngine", bool(self.settings["music"]))

    def toggle_voice(self, on):
        self.settings["voice"] = bool(on)
        self._js("setVoiceEnabled", bool(on))

    def toggle_full_screen(self):
        self.showMaximized() if self.isFullScreen() else self.showFullScreen()

    # ================================================================== sizes
    def _fit_home(self):
        w, h = max(self.width(), 1), max(self.height(), 1)
        scale = max(0.45, min(min(w / 1366.0, h / 820.0), 1.25))
        self.hero_title.setFont(font(max(int(38 * scale), 18), True))
        self.hero_sub.setFont(font(max(int(19 * scale), 11), True))
        self.cards_layout.setSpacing(max(int(40 * scale), 8))
        side = self.sidebar.width() if self.sidebar.isVisible() else 0
        per_card = (w - side - 160) / 3.0
        card_scale = max(0.3, min(scale, per_card / 380.0, (h - 260) * 0.5 / 400.0))  # theme cards sit below
        for card in self.cards:
            card.set_scale(card_scale)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.sidebar.setFixedWidth(max(240, min(330, int(self.width() * 0.24))))
        self._fit_home()
        for overlay in (self.splash, self.login):
            if overlay.isVisible():
                overlay.setGeometry(self.central.rect())

    def closeEvent(self, event):
        self.bridge.stop()
        self.video.stop()
        self.settings.save()
        super().closeEvent(event)
