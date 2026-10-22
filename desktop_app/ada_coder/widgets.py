"""Small reusable pieces of the app window."""
import os

from PyQt5.QtCore import QEasingCurve, QPoint, QPropertyAnimation, Qt, QTimer, pyqtSignal
from PyQt5.QtGui import QPainter, QPainterPath, QPixmap
from PyQt5.QtWidgets import QFrame, QHBoxLayout, QLabel, QPushButton, QSlider, QVBoxLayout, QWidget

from .paths import image
from .styles import font


class ClickableSlider(QSlider):
    """A slider that jumps to wherever you click, which is easier for small hands."""

    def _value_at(self, event):
        span = self.maximum() - self.minimum()
        if self.orientation() == Qt.Horizontal:
            val = self.minimum() + span * event.x() / max(self.width(), 1)
        else:
            val = self.minimum() + span * (self.height() - event.y()) / max(self.height(), 1)
        return max(self.minimum(), min(self.maximum(), int(val)))

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            val = self._value_at(event)
            self.setValue(val)
            self.sliderMoved.emit(val)
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if event.buttons() & Qt.LeftButton:
            val = self._value_at(event)
            self.setValue(val)
            self.sliderMoved.emit(val)
        super().mouseMoveEvent(event)


_PIXMAPS = {}


def load_pixmap(name):
    """Loads a picture from assets/images once and reuses it."""
    if name not in _PIXMAPS:
        path = name if os.path.isabs(name) else image(name)  # downloaded pictures come as full paths
        _PIXMAPS[name] = QPixmap(path) if os.path.exists(path) else QPixmap()
    return _PIXMAPS[name]


def round_pixmap(name, size):
    """The picture cut into a circle, for avatars and the logo."""
    pix = load_pixmap(name)
    if pix.isNull():
        return None
    ratio = 2  # sharp on high-resolution screens
    pix = pix.scaled(size * ratio, size * ratio, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)
    out = QPixmap(size * ratio, size * ratio)
    out.fill(Qt.transparent)
    painter = QPainter(out)
    painter.setRenderHint(QPainter.Antialiasing)
    path = QPainterPath()
    path.addEllipse(0, 0, size * ratio, size * ratio)
    painter.setClipPath(path)
    painter.drawPixmap((out.width() - pix.width()) // 2, (out.height() - pix.height()) // 2, pix)
    painter.end()
    out.setDevicePixelRatio(ratio)
    return out


def scaled_pixmap(name, width, height):
    pix = load_pixmap(name)
    if pix.isNull():
        return None
    ratio = 2
    out = pix.scaled(width * ratio, height * ratio, Qt.KeepAspectRatio, Qt.SmoothTransformation)
    out.setDevicePixelRatio(ratio)
    return out


class CharacterCard(QWidget):
    """A friend on the home screen: name bubble on top, picture gently bobbing underneath."""

    def __init__(self, name, picture, emoji):
        super().__init__()
        self.picture, self.emoji = picture, emoji
        self.base_size = 340
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 24, 0, 0)
        layout.setSpacing(8)
        layout.setAlignment(Qt.AlignCenter)

        self.bubble = QLabel(name)
        self.bubble.setAlignment(Qt.AlignCenter)
        self.bubble.setStyleSheet("background: white; color: #1e1b4b; padding: 8px 26px; border-radius: 20px;"
                                  "border: 3px solid #ffd23f;")
        self.holder = QWidget()
        holder_layout = QVBoxLayout(self.holder)
        holder_layout.setContentsMargins(0, 0, 0, 0)
        self.img = QLabel()
        self.img.setAlignment(Qt.AlignCenter | Qt.AlignBottom)
        holder_layout.addWidget(self.img)

        layout.addWidget(self.bubble, alignment=Qt.AlignCenter)
        layout.addWidget(self.holder, alignment=Qt.AlignCenter)
        self.anim = None
        self.set_scale(1.0)

    def set_character(self, name, picture, emoji):
        self.picture, self.emoji = picture, emoji
        self.bubble.setText(name)
        self.set_scale(getattr(self, "_scale", 1.0))

    def set_scale(self, scale):
        self._scale = scale
        size = max(int(self.base_size * scale), 90)
        self.img.setFixedSize(size, size)
        pix = scaled_pixmap(self.picture, size, size)
        if pix:
            self.img.setPixmap(pix)
        else:
            self.img.setText(self.emoji)
            self.img.setStyleSheet(f"font-size: {int(size * 0.55)}px;")
        self.bubble.setFont(font(max(int(22 * scale), 12), bold=True))

    def _start_bobbing(self):
        if self.anim is not None:
            self.anim.stop()
        self.layout().invalidate()  # put the picture back at its resting place first
        self.layout().activate()
        self.anim = QPropertyAnimation(self.holder, b"pos", self)
        self.anim.setDuration(2600)
        start = self.holder.pos()
        self.anim.setStartValue(start)
        self.anim.setKeyValueAt(0.5, start - QPoint(0, 16))
        self.anim.setEndValue(start)
        self.anim.setEasingCurve(QEasingCurve.InOutSine)
        self.anim.setLoopCount(-1)
        self.anim.start()

    def showEvent(self, event):
        super().showEvent(event)
        QTimer.singleShot(0, self._start_bobbing)  # after the layout has placed the picture

    def hideEvent(self, event):
        super().hideEvent(event)
        if self.anim is not None:
            self.anim.stop()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        if self.isVisible():
            QTimer.singleShot(0, self._start_bobbing)  # bob around the new resting place


class LessonButton(QPushButton):
    """One lesson in the course list: number, emoji, name and a tick when it's done."""
    picked = pyqtSignal(str)

    def __init__(self, number, lesson):
        super().__init__()
        self.lesson_id = lesson["id"]
        self.setObjectName("LessonButton")
        self.setCursor(Qt.PointingHandCursor)
        self.setFont(font(12, bold=True))
        self.setMinimumHeight(48)
        self.number = number
        self.label = f"{lesson.get('emoji', '')}  {lesson['name']}".strip()
        self.set_state(active=False, done=False)
        self.clicked.connect(lambda: self.picked.emit(self.lesson_id))

    def set_state(self, active, done, locked=False):
        tick = "  🔒" if locked else ("  ✅" if done else "")
        self.setText(f"{self.number}.  {self.label}{tick}")
        self.setToolTip("Upgrade to unlock this lesson ⭐" if locked else ("Finished! 🌟" if done else ""))
        self.setProperty("locked", "true" if locked else "false")
        self.setProperty("active", "true" if active else "false")
        self.style().unpolish(self)
        self.style().polish(self)


class ThemeCard(QFrame):
    """A theme on the home screen: its characters, name, price, and Try free / Play."""
    picked = pyqtSignal(str)

    def __init__(self, course, chars):
        super().__init__()
        self.course_id = course["id"]
        self.setObjectName("ThemeCard")
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedWidth(232)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(12, 10, 12, 12)
        lay.setSpacing(5)
        pics = QHBoxLayout()
        pics.setSpacing(0)
        pics.setAlignment(Qt.AlignCenter)
        for name, picture, emoji in chars[:3]:
            lbl = QLabel()
            lbl.setFixedSize(60, 60)
            lbl.setAlignment(Qt.AlignCenter)
            pix = scaled_pixmap(picture, 60, 60) if picture else None
            if pix:
                lbl.setPixmap(pix)
            else:
                lbl.setText(emoji)
                lbl.setFont(font(26))
            pics.addWidget(lbl)
        self.name = QLabel(course["name"])
        self.name.setFont(font(12, True))
        self.name.setWordWrap(True)
        self.badge = QLabel("")
        self.badge.setObjectName("ThemeBadge")
        self.badge.setFont(font(9, True))
        self.button = pill("", "ThemeButton", size=11)
        self.button.setMinimumHeight(34)
        self.button.clicked.connect(lambda: self.picked.emit(self.course_id))
        lay.addLayout(pics)
        lay.addWidget(self.name)
        lay.addWidget(self.badge, alignment=Qt.AlignLeft)
        lay.addWidget(self.button)

    def set_state(self, current, owned, free_count, price):
        """current: the theme on screen. owned: free theme or bought. free_count: lessons free to try."""
        if owned:
            self.badge.setText("✓ Unlocked" if free_count is not None else "Free")
        else:
            self.badge.setText(f"{free_count} free lessons · {price}".strip(" ·"))
        if current:
            self.button.setText("▶  Playing now")
        else:
            self.button.setText("▶  Play" if owned else "✨  Try free")
        self.setProperty("current", "true" if current else "false")
        self.style().unpolish(self)
        self.style().polish(self)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.picked.emit(self.course_id)
        super().mousePressEvent(event)


def pill(text, object_name="PillButton", size=12, bold=True):
    btn = QPushButton(text)
    btn.setObjectName(object_name)
    btn.setCursor(Qt.PointingHandCursor)
    btn.setFont(font(size, bold))
    return btn


def round_button(text, tooltip):
    btn = QPushButton(text)
    btn.setObjectName("RoundButton")
    btn.setCursor(Qt.PointingHandCursor)
    btn.setFixedSize(44, 44)
    btn.setFont(font(15))
    btn.setToolTip(tooltip)
    return btn


def row(*widgets, spacing=10, margins=(0, 0, 0, 0)):
    holder = QWidget()
    layout = QHBoxLayout(holder)
    layout.setContentsMargins(*margins)
    layout.setSpacing(spacing)
    for w in widgets:
        if w is None:
            layout.addStretch()
        else:
            layout.addWidget(w)
    return holder
