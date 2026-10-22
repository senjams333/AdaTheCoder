"""Colours, fonts and Qt style sheets for the app window (the lesson page has its own CSS)."""
from PyQt5.QtGui import QFont, QFontDatabase

LIGHT = {
    "window": "#eaf6ff",
    "window2": "#fdf2ff",
    "panel": "rgba(255, 255, 255, 0.72)",
    "panel_solid": "#ffffff",
    "ink": "#1e1b4b",
    "ink_soft": "#4c4a7a",
    "line": "#e2dcf8",
    "sidebar": "#ffffff",
    "item": "#f4f1ff",
    "item_hover": "#ffffff",
    "accent": "#7b4dff",
    "accent_dark": "#5b2fe0",
    "sun": "#ffd23f",
    "sun_dark": "#f2b500",
    "sky": "#38bdf8",
    "mint": "#22c997",
    "pink": "#ff5fa8",
}
DARK = dict(
    LIGHT,
    window="#110c2e",
    window2="#1b1446",
    panel="rgba(30, 23, 69, 0.85)",
    panel_solid="#1e1745",
    ink="#f5f3ff",
    ink_soft="#c4b5fd",
    line="#3b3280",
    sidebar="#1e1745",
    item="#2a2160",
    item_hover="#352a78",
)

_FAMILY = None


def ui_family():
    """A friendly rounded font that exists on this computer."""
    global _FAMILY
    if _FAMILY is None:
        available = set(QFontDatabase().families())
        for name in ("Comic Sans MS", "Chalkboard SE", "Comic Neue", "Segoe UI", "Helvetica Neue", "Arial"):
            if name in available:
                _FAMILY = name
                break
        else:
            _FAMILY = QFont().family()
    return _FAMILY


def font(size, bold=False):
    f = QFont(ui_family(), size)
    f.setBold(bold)
    return f


def palette(dark):
    return DARK if dark else LIGHT


def window_qss(dark):
    c = palette(dark)
    return f"""
    QWidget#CentralWidget {{
        background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 {c['window']}, stop:1 {c['window2']});
    }}
    QLabel {{ color: {c['ink']}; background: transparent; }}
    QLabel#AppName {{ color: {c['ink']}; }}
    QLabel#Muted {{ color: {c['ink_soft']}; }}

    QPushButton#PillButton, QToolButton#PillButton {{
        background: {c['panel_solid']}; color: {c['ink']};
        border: 2px solid {c['line']}; border-radius: 22px; padding: 8px 18px;
    }}
    QPushButton#PillButton:hover, QToolButton#PillButton:hover {{ border-color: {c['accent']}; }}
    QPushButton#PillButton:disabled {{ color: {c['ink_soft']}; }}
    QPushButton#RoundButton {{
        background: {c['panel_solid']}; color: {c['ink']};
        border: 2px solid {c['line']}; border-radius: 22px;
    }}
    QPushButton#RoundButton:hover {{ border-color: {c['accent']}; }}
    QPushButton#PrimaryButton {{
        background: {c['sun']}; color: #1e1b4b; border: none;
        border-bottom: 4px solid {c['sun_dark']}; border-radius: 22px; padding: 10px 28px;
    }}
    QPushButton#PrimaryButton:hover {{ background: #ffdc5e; }}
    QPushButton#PrimaryButton:pressed {{ border-bottom-width: 1px; padding-top: 13px; }}
    QPushButton#PrimaryButton:disabled {{ background: #f3e3a3; color: #77739a; }}
    QPushButton#AccentButton {{
        background: {c['accent']}; color: white; border: none; border-radius: 20px; padding: 8px 22px;
    }}
    QPushButton#AccentButton:hover {{ background: {c['accent_dark']}; }}
    QPushButton#AccentButton:disabled {{ background: {c['line']}; color: {c['ink_soft']}; }}

    QFrame#HeroPanel {{ background: {c['panel']}; border-radius: 36px; }}
    QFrame#Sidebar {{ background: {c['sidebar']}; border: 2px solid {c['line']}; border-radius: 30px; }}
    QScrollArea, QScrollArea > QWidget > QWidget {{ background: transparent; border: none; }}
    QScrollBar:vertical {{ background: transparent; width: 10px; margin: 4px 0; }}
    QScrollBar::handle:vertical {{ background: {c['line']}; border-radius: 5px; min-height: 30px; }}
    QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}

    QPushButton#LessonButton {{
        background: {c['item']}; color: {c['ink']}; border: 2px solid transparent;
        border-radius: 16px; padding: 10px 12px; text-align: left;
    }}
    QPushButton#LessonButton:hover {{ background: {c['item_hover']}; border-color: {c['line']}; }}
    QPushButton#LessonButton[active="true"] {{ background: {c['sky']}; color: white; border-color: {c['sun']}; }}

    QPushButton#LessonButton[locked="true"] {{ color: {c['ink_soft']}; }}

    QFrame#ThemeCard {{ background: {c['panel_solid']}; border: 2px solid {c['line']}; border-radius: 22px; }}
    QFrame#ThemeCard:hover {{ border-color: {c['accent']}; }}
    QFrame#ThemeCard[current="true"] {{ border: 3px solid {c['sun']}; }}
    QFrame#ThemeCard QLabel {{ background: transparent; color: {c['ink']}; }}
    QLabel#ThemeBadge {{ background: {c['item']}; color: {c['accent_dark']}; border-radius: 9px; padding: 2px 9px; }}
    QPushButton#ThemeButton {{ background: {c['accent']}; color: white; border: none; border-radius: 17px; padding: 6px 14px; }}
    QPushButton#ThemeButton:hover {{ background: {c['accent_dark']}; }}
    QFrame#ThemeCard[current="true"] QPushButton#ThemeButton {{ background: {c['mint']}; }}
    QPushButton#UpgradeButton {{ background: {c['pink']}; color: white; border: none; border-radius: 18px; padding: 8px 14px; }}
    QPushButton#UpgradeButton:hover {{ background: {c['accent']}; }}
    QLabel#ThemesTitle {{ color: {c['ink']}; background: transparent; }}

    QProgressBar#CourseProgress {{
        background: {c['item']}; border: none; border-radius: 7px; height: 14px; text-align: center;
        color: transparent;
    }}
    QProgressBar#CourseProgress::chunk {{ background: {c['mint']}; border-radius: 7px; }}

    QFrame#LessonBar {{ background: transparent; }}

    QMenu {{
        background: {c['panel_solid']}; color: {c['ink']}; border: 2px solid {c['line']};
        border-radius: 14px; padding: 6px;
    }}
    QMenu::item {{ padding: 9px 22px; border-radius: 9px; margin: 1px 3px; }}
    QMenu::item:selected {{ background: {c['accent']}; color: white; }}
    QMenu::item:checked {{ font-weight: bold; }}
    QMenu::separator {{ height: 2px; background: {c['line']}; margin: 4px 8px; }}
    QToolTip {{ background: {c['panel_solid']}; color: {c['ink']}; border: 1px solid {c['line']}; padding: 4px 8px; }}
    """


SLIDER_QSS = """
QSlider:horizontal { min-height: 24px; max-height: 24px; }
QSlider::groove:horizontal { height: 6px; background: #3b3280; border-radius: 3px; }
QSlider::sub-page:horizontal { background: #38bdf8; border-radius: 3px; }
QSlider::handle:horizontal { background: #ffffff; border: 2px solid #ffd23f; width: 16px; height: 16px;
    margin: -6px 0; border-radius: 9px; }
QSlider::handle:horizontal:hover { background: #ffd23f; }
"""

DIALOG_QSS = """
QDialog { background: #ffffff; }
QLabel { color: #1e1b4b; }
QLabel#Muted { color: #4c4a7a; }
QFrame#InfoBox { background: #f4f1ff; border-radius: 16px; }
QPushButton { background: #7b4dff; color: white; border: none; border-radius: 16px; padding: 8px 22px; }
QPushButton:hover { background: #5b2fe0; }
QPushButton#Plain { background: #f4f1ff; color: #1e1b4b; }
QPushButton#Plain:hover { background: #e9e3ff; }
QPushButton#UpgradeButton { background: #ff5fa8; padding: 10px 26px; border-radius: 20px; }
QPushButton#UpgradeButton:hover { background: #e9408c; }
QLineEdit { border: 2px solid #e2dcf8; border-radius: 12px; padding: 8px 12px; font-size: 15px; color: #1e1b4b; background: #fff; }
QLineEdit:focus { border-color: #7b4dff; }
"""
