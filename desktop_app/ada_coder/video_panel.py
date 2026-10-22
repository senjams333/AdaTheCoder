"""The lesson video player: video, play/pause, a seek bar and volume."""
from PyQt5.QtCore import Qt, QTimer, QUrl, pyqtSignal
from PyQt5.QtGui import QColor
from PyQt5.QtMultimedia import QMediaContent, QMediaPlayer
from PyQt5.QtMultimediaWidgets import QVideoWidget
from PyQt5.QtWidgets import QGraphicsDropShadowEffect, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from .styles import SLIDER_QSS, font
from .widgets import ClickableSlider


def _fmt(ms):
    s = max(int(ms / 1000), 0)
    return "%02d:%02d" % (s // 60, s % 60)


class VideoPanel(QWidget):
    finished = pyqtSignal()   # the video reached the end (or couldn't be played)

    def __init__(self, parent=None, show_controls=True, note=""):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        self.video = QVideoWidget()
        self.video.setAspectRatioMode(Qt.KeepAspectRatio)
        self.video.setStyleSheet("background: black;")
        glow = QGraphicsDropShadowEffect(self)
        glow.setBlurRadius(30)
        glow.setColor(QColor(255, 210, 63, 200))
        glow.setOffset(0, 0)
        self.video.setGraphicsEffect(glow)

        self.note = QLabel(note, self.video)
        self.note.setStyleSheet("background: rgba(30,27,75,.65); color: #f5f3ff; font-size: 10px; padding: 3px 8px; border-radius: 6px;")
        self.note.setVisible(bool(note))
        self.note.move(16, 10)

        self.player = QMediaPlayer(self, QMediaPlayer.VideoSurface)
        self.player.setVideoOutput(self.video)
        self.player.setNotifyInterval(250)
        self.player.mediaStatusChanged.connect(self._status)
        self.player.error.connect(self._error)
        self.player.stateChanged.connect(self._state)
        self.player.positionChanged.connect(self._position)
        self.player.durationChanged.connect(self._duration)
        self._dragging = False
        self._last_volume = 100

        self.controls = QWidget()
        self.controls.setObjectName("VideoControls")
        self.controls.setFixedHeight(58)
        self.controls.setStyleSheet("QWidget#VideoControls { background: #1e1745; border-radius: 18px; }"
                                    "QLabel { color: #e9e4ff; }")
        bar = QHBoxLayout(self.controls)
        bar.setContentsMargins(12, 6, 12, 6)
        bar.setSpacing(10)

        self.play_btn = QPushButton("⏸ Pause")
        self.play_btn.setCursor(Qt.PointingHandCursor)
        self.play_btn.setFixedWidth(116)
        self.play_btn.setFont(font(12, True))
        self.play_btn.setStyleSheet("QPushButton { background: #ffd23f; color: #1e1b4b; border: none; border-radius: 16px; padding: 7px; }"
                                    "QPushButton:hover { background: #ffdc5e; }")
        self.play_btn.clicked.connect(self.toggle)

        self.seek = ClickableSlider(Qt.Horizontal)
        self.seek.setStyleSheet(SLIDER_QSS)
        self.seek.setCursor(Qt.PointingHandCursor)
        self.seek.sliderPressed.connect(lambda: setattr(self, "_dragging", True))
        self.seek.sliderReleased.connect(self._seek_released)
        self.seek.sliderMoved.connect(lambda v: self.time.setText(_fmt(v)))

        self.time = QLabel("00:00")
        self.length = QLabel("00:00")
        for lbl in (self.time, self.length):
            lbl.setFont(font(11, True))

        self.mute_btn = QPushButton("🔊")
        self.mute_btn.setCursor(Qt.PointingHandCursor)
        self.mute_btn.setFixedSize(34, 34)
        self.mute_btn.setToolTip("Sound on / off")
        self.mute_btn.setStyleSheet("QPushButton { background: rgba(255,255,255,.9); border: none; border-radius: 17px; }")
        self.mute_btn.clicked.connect(self.toggle_mute)

        self.volume = ClickableSlider(Qt.Horizontal)
        self.volume.setRange(0, 100)
        self.volume.setValue(100)
        self.volume.setFixedWidth(96)
        self.volume.setStyleSheet(SLIDER_QSS)
        self.volume.valueChanged.connect(self._volume_changed)

        for w in (self.play_btn, self.time):
            bar.addWidget(w)
        bar.addWidget(self.seek, 1)
        for w in (self.length, self.mute_btn, self.volume):
            bar.addWidget(w)

        layout.addWidget(self.video, 1)
        layout.addWidget(self.controls)
        self.controls.setVisible(show_controls)

    # ------------------------------------------------------------------ public
    def play(self, path):
        """Plays a video file from the start. Emits finished straight away if there's nothing to play."""
        self.seek.setRange(0, 0)
        self.time.setText("00:00")
        self.length.setText("00:00")
        if not path:
            QTimer.singleShot(0, self.finished.emit)
            return
        self.player.setMedia(QMediaContent(QUrl.fromLocalFile(path)))
        self.player.setPosition(0)
        self.player.play()

    def stop(self):
        self.player.stop()

    def toggle(self):
        if self.player.state() == QMediaPlayer.PlayingState:
            self.player.pause()
        else:
            self.player.play()

    def toggle_mute(self):
        muted = not self.player.isMuted()
        self.player.setMuted(muted)
        self.mute_btn.setText("🔇" if muted else "🔊")
        self.volume.blockSignals(True)
        self.volume.setValue(0 if muted else self._last_volume)
        self.volume.blockSignals(False)

    # ------------------------------------------------------------------ internals
    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.note.move(16, 10)

    def _status(self, status):
        if status == QMediaPlayer.EndOfMedia:
            self.finished.emit()
        elif status == QMediaPlayer.InvalidMedia:
            self.finished.emit()

    def _error(self, *_):
        if self.player.error() != QMediaPlayer.NoError:
            self.finished.emit()

    def _state(self, state):
        self.play_btn.setText("⏸ Pause" if state == QMediaPlayer.PlayingState else "▶ Play")

    def _position(self, pos):
        if not self._dragging:
            self.seek.blockSignals(True)
            self.seek.setValue(pos)
            self.seek.blockSignals(False)
            self.time.setText(_fmt(pos))

    def _duration(self, dur):
        self.seek.setRange(0, max(dur, 0))
        self.length.setText(_fmt(dur))

    def _seek_released(self):
        self._dragging = False
        self.player.setPosition(self.seek.value())

    def _volume_changed(self, value):
        if value > 0 and self.player.isMuted():
            self.player.setMuted(False)
        self.player.setVolume(value)
        self.mute_btn.setText("🔇" if value == 0 else "🔊")
        if value:
            self._last_volume = value
