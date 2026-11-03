"""The whole window's background, painted and gently moving (the same sky as the Python Adventure app).

Day (light theme): blue sky, a glowing sun, drifting clouds, a green meadow with swaying flowers.
Night (dark theme): a deep night sky, a glowing moon, twinkling stars and a shooting star.
"""
import math
import random

from PyQt5.QtCore import QPointF, Qt, QTimer
from PyQt5.QtGui import QBrush, QColor, QLinearGradient, QPainter, QPainterPath, QPen, QRadialGradient
from PyQt5.QtWidgets import QWidget


class SceneWidget(QWidget):
    """The whole window's background, painted and gently moving.

    Day (light theme): blue sky, a glowing sun, drifting clouds, a green meadow with swaying flowers.
    Night (dark theme): a deep night sky, a glowing moon and twinkling stars.
    At night a shooting star (round head, long bright tail) flies from the top right corner to the bottom
    left corner: 1 second after night mode turns on, then every 30 seconds.
    """

    SHOOT_EVERY = 30.0    # seconds between shooting stars
    SHOOT_FIRST = 1.0     # the first one comes 1 second after night mode turns on
    SHOOT_TIME = 2.2      # how long it takes to cross the window

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAutoFillBackground(False)
        self.setAttribute(Qt.WA_OpaquePaintEvent)     # it paints every pixel itself: the sky, never a plain colour
        self.dark = False
        self.t = 0.0
        self.night_since = 0.0
        rnd = random.Random(7)
        self.stars = [(rnd.random(), rnd.random() * 0.92, 0.8 + rnd.random() * 2.2, rnd.random() * 6.3, 0.8 + rnd.random() * 1.8)
                      for _ in range(150)]
        self.clouds = [(0.06, 170, 52, 14), (0.20, 120, 40, 10), (0.12, 210, 62, 8), (0.30, 140, 44, 12), (0.04, 100, 34, 9)]
        self.cloud_start = [rnd.random() for _ in self.clouds]
        colours = ["#f472b6", "#facc15", "#ffffff", "#c084fc", "#fb7185", "#fde047", "#f9a8d4", "#a78bfa"]
        self.flowers = [((i + 0.5) / 26 + (rnd.random() - 0.5) * 0.02, rnd.random(), colours[i % len(colours)],
                         7 + rnd.random() * 5, rnd.random() * 6.3) for i in range(26)]
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._tick)
        self.timer.start(50)

    def set_dark(self, dark):
        if dark and not self.dark:
            self.night_since = self.t
        self.dark = dark
        self.update()

    def _tick(self):
        self.t += 0.05
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()
        if self.dark:
            self._night(p, w, h)
        else:
            self._day(p, w, h)
        self._shooting_star(p, w, h)
        p.end()

    def _shooting_star(self, p, w, h):
        if not self.dark:
            return
        e = self.t - self.night_since - self.SHOOT_FIRST
        if e < 0:
            return
        k = (e % self.SHOOT_EVERY) / self.SHOOT_TIME
        if k > 1:
            return
        x0, y0, x1, y1 = w + 60, -60, -60, h + 60
        hx, hy = x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
        length = math.hypot(x1 - x0, y1 - y0)
        ux, uy = (x0 - x1) / length, (y0 - y1) / length       # from the head back along the tail
        tail, r = 380, 2.6
        tx, ty = hx + ux * tail, hy + uy * tail
        fade = min(1.0, k / 0.1, (1 - k) / 0.15)
        nx, ny = -uy, ux
        p.setPen(Qt.NoPen)
        # a soft, very thin halo along the tail, then the slim bright streak over it
        for width, inner, outer in ((5.0, QColor(170, 205, 255, int(70 * fade)), QColor(170, 205, 255, 0)),
                                    (r, QColor(255, 255, 255, int(255 * fade)), QColor(200, 225, 255, 0))):
            g = QLinearGradient(hx, hy, tx, ty)
            g.setColorAt(0, inner)
            g.setColorAt(0.15, inner)
            g.setColorAt(1, outer)
            path = QPainterPath()
            path.moveTo(hx + nx * width / 2, hy + ny * width / 2)
            path.lineTo(tx, ty)
            path.lineTo(hx - nx * width / 2, hy - ny * width / 2)
            path.closeSubpath()
            p.setBrush(QBrush(g))
            p.drawPath(path)
        # the small round head with a gentle glow
        self._glow(p, hx, hy, 24, QColor(220, 235, 255, int(210 * fade)), QColor(170, 205, 255, 0))
        self._glow(p, hx, hy, 9, QColor(255, 255, 255, int(255 * fade)), QColor(220, 235, 255, int(90 * fade)))
        p.setBrush(QColor(255, 255, 255, int(255 * fade)))
        p.drawEllipse(QPointF(hx, hy), 4, 4)

    def _glow(self, p, x, y, r, inner, outer):
        g = QRadialGradient(x, y, r)
        g.setColorAt(0, inner)
        g.setColorAt(1, outer)
        p.setPen(Qt.NoPen)
        p.setBrush(QBrush(g))
        p.drawEllipse(int(x - r), int(y - r), int(2 * r), int(2 * r))

    def _day(self, p, w, h):
        sky = QLinearGradient(0, 0, 0, h)
        sky.setColorAt(0, QColor("#5ec4ff"))
        sky.setColorAt(0.45, QColor("#a5dcff"))
        sky.setColorAt(0.8, QColor("#dff4ff"))
        sky.setColorAt(1, QColor("#e9fbe3"))
        p.fillRect(0, 0, w, h, sky)
        # the sun, top left, glowing
        sx, sy = 230, 80
        pulse = 1 + 0.04 * math.sin(self.t * 1.5)
        self._glow(p, sx, sy, 120 * pulse, QColor(255, 213, 79, 170), QColor(255, 170, 0, 0))
        self._glow(p, sx, sy, 52, QColor("#fff700"), QColor("#ff9d00"))
        # clouds drifting to the right
        p.setPen(Qt.NoPen)
        for (top, cw, ch, speed), start in zip(self.clouds, self.cloud_start):
            span = w + 2 * cw
            x = (start * span + self.t * speed * 6) % span - cw
            y = top * h + 40
            p.setBrush(QColor(255, 255, 255, 240))
            p.drawRoundedRect(int(x), int(y), int(cw), int(ch), ch / 2, ch / 2)
            p.drawEllipse(int(x + cw * 0.15), int(y - ch * 0.55), int(cw * 0.45), int(ch * 1.3))
            p.drawEllipse(int(x + cw * 0.48), int(y - ch * 0.35), int(cw * 0.36), int(ch * 1.05))
        # the meadow: two rolling green hills
        top = h * 0.84
        back = QPainterPath()
        back.moveTo(0, h)
        back.lineTo(0, top + 10)
        back.cubicTo(w * 0.25, top - 40, w * 0.45, top + 30, w * 0.7, top - 10)
        back.cubicTo(w * 0.85, top - 30, w * 0.95, top, w, top - 5)
        back.lineTo(w, h)
        p.setBrush(QColor("#4ade80"))
        p.drawPath(back)
        front = QPainterPath()
        front.moveTo(0, h)
        front.lineTo(0, top + 40)
        front.cubicTo(w * 0.3, top + 10, w * 0.6, top + 55, w, top + 25)
        front.lineTo(w, h)
        grass = QLinearGradient(0, top, 0, h)
        grass.setColorAt(0, QColor("#86efac"))
        grass.setColorAt(1, QColor("#16a34a"))
        p.setBrush(QBrush(grass))
        p.drawPath(front)
        # flowers swaying in the grass
        for fx, fy, colour, size, phase in self.flowers:
            x = fx * w
            y = top + 50 + fy * (h - top - 60)
            p.save()
            p.translate(x, y)
            p.rotate(7 * math.sin(self.t * 2 + phase))
            p.setPen(QPen(QColor("#15803d"), 2))
            p.drawLine(0, 0, 0, int(-size * 2.2))
            p.translate(0, -size * 2.2)
            p.setPen(Qt.NoPen)
            p.setBrush(QColor(colour))
            for k in range(5):
                a = k * 72 + 18
                p.drawEllipse(int(math.cos(math.radians(a)) * size * 0.7 - size * 0.45),
                              int(math.sin(math.radians(a)) * size * 0.7 - size * 0.45), int(size * 0.9), int(size * 0.9))
            p.setBrush(QColor("#f59e0b"))
            p.drawEllipse(int(-size * 0.35), int(-size * 0.35), int(size * 0.7), int(size * 0.7))
            p.restore()

    def _night(self, p, w, h):
        sky = QRadialGradient(w / 2, 0, max(w, h))
        sky.setColorAt(0, QColor("#2c3285"))
        sky.setColorAt(0.45, QColor("#161c52"))
        sky.setColorAt(1, QColor("#070b24"))
        p.fillRect(0, 0, w, h, sky)
        # twinkling stars
        p.setPen(Qt.NoPen)
        for sx, sy, size, phase, speed in self.stars:
            a = 0.25 + 0.75 * (0.5 + 0.5 * math.sin(self.t * speed * 2 + phase))
            x, y = sx * w, sy * h
            self._glow(p, x, y, size * 3.5, QColor(170, 205, 255, int(90 * a)), QColor(170, 205, 255, 0))
            p.setBrush(QColor(255, 255, 255, int(255 * a)))
            p.drawEllipse(int(x - size / 2), int(y - size / 2), max(int(size), 1), max(int(size), 1))
        # the moon, top left, glowing
        mx, my = 230, 80
        pulse = 1 + 0.05 * math.sin(self.t * 1.2)
        self._glow(p, mx, my, 140 * pulse, QColor(253, 230, 138, 120), QColor(253, 230, 138, 0))
        moon = QRadialGradient(mx - 15, my - 15, 70)
        moon.setColorAt(0, QColor("#ffffff"))
        moon.setColorAt(1, QColor("#fde68a"))
        p.setBrush(QBrush(moon))
        p.drawEllipse(int(mx - 50), int(my - 50), 100, 100)
        p.setBrush(QColor(234, 200, 120, 110))
        for cx, cy, cr in ((-14, -6, 11), (12, 14, 8), (8, -20, 6)):
            p.drawEllipse(int(mx + cx - cr), int(my + cy - cr), 2 * cr, 2 * cr)
