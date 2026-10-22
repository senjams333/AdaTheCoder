"""The short welcome video that plays when the app opens. A big "Skip" button is always there."""
import os

from PyQt5.QtCore import Qt, QTimer, pyqtSignal
from PyQt5.QtWidgets import QFrame, QHBoxLayout, QVBoxLayout

from .paths import asset
from .video_panel import VideoPanel
from .widgets import pill


class IntroSplash(QFrame):
    done = pyqtSignal()

    def __init__(self, parent):
        super().__init__(parent)
        self.setObjectName("IntroSplash")
        self.setStyleSheet("QFrame#IntroSplash { background: #110c2e; }")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(14)

        self.panel = VideoPanel(self, show_controls=False)
        self.panel.finished.connect(self.finish)

        self.skip = pill("Skip  ⏭", "PrimaryButton", size=14)
        self.skip.clicked.connect(self.finish)
        buttons = QHBoxLayout()
        buttons.addStretch()
        buttons.addWidget(self.skip)

        layout.addWidget(self.panel, 1)
        layout.addLayout(buttons)
        self._done = False
        self.hide()

    def start(self):
        path = asset("video", "intro.mp4")
        if not os.path.exists(path):
            QTimer.singleShot(0, self.finish)
            return
        self.setGeometry(self.parent().rect())
        self.show()
        self.raise_()
        self.skip.setFocus()
        self.panel.play(path)
        QTimer.singleShot(30000, self.finish)  # never get stuck here, whatever the video does

    def keyPressEvent(self, event):
        if event.key() in (Qt.Key_Escape, Qt.Key_Space, Qt.Key_Return, Qt.Key_Enter):
            self.finish()
        else:
            super().keyPressEvent(event)

    def finish(self):
        if self._done:
            return
        self._done = True
        self.panel.stop()
        self.hide()
        self.done.emit()
