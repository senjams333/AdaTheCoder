"""A theme's page inside Ada The Coder's window ("Try free"): the Python Adventure look (assets/app/theme.html,
the same page as the preview), with this theme's characters, lessons, videos and locks.

The theme is first written as a kids-app folder (kids_launch.write_app_folder); its lesson page is made by the
Python Adventure engine's own HTML (BASE_CSS, COMMON_JS, MASTER_HTML_TEMPLATE in kids_app.py), so the lessons
look and behave exactly as in that app.
"""
import ast
import html
import json
import os
import sys

from PyQt5.QtCore import QUrl

from . import kids_launch
from .paths import asset

_TEMPLATE_NODES = None


def _engine_dir():
    path = kids_launch.engine_path()
    return os.path.dirname(path) if path else None


def _engine_modules():
    """appconfig (app.json and lessons.py of a theme folder) from the Python Adventure engine."""
    folder = _engine_dir()
    if folder and folder not in sys.path:
        sys.path.insert(0, folder)
    import appconfig
    return appconfig


def _url(path):
    return QUrl.fromLocalFile(path).toString() if path and os.path.exists(path) else ""


def _template(cfg, app_dir):
    """The engine's lesson page for this theme, worked out the same way the engine does it."""
    global _TEMPLATE_NODES
    if _TEMPLATE_NODES is None:
        with open(kids_launch.engine_path(), encoding="utf-8") as f:
            tree = ast.parse(f.read())
        wanted = {"BASE_CSS", "COMMON_JS", "MASTER_HTML_TEMPLATE"}
        _TEMPLATE_NODES = [n for n in tree.body if isinstance(n, ast.Assign) and len(n.targets) == 1
                           and getattr(n.targets[0], "id", None) in wanted]
    cfg = json.loads(json.dumps(cfg))
    if cfg.get("lesson_picture"):
        cfg["lesson_picture"] = _url(os.path.join(app_dir, cfg["lesson_picture"]))
    ns = {"html": html, "json": json, "CONFIG": cfg, "LOGO": cfg["logo"]}
    for node in _TEMPLATE_NODES:
        exec(compile(ast.Module([node], []), "kids_app", "exec"), ns)
    page = ns["MASTER_HTML_TEMPLATE"]
    for pic in {cfg["logo"], cfg["success_picture"], cfg["oops_picture"]}:
        if pic:
            page = page.replace('src="%s"' % pic, 'src="%s"' % _url(os.path.join(app_dir, pic)))
    return page


def _webm(video):
    """Qt's web view plays WebM: the .webm next to a lesson's .mp4 (bundled, or downloaded with it)."""
    if not video:
        return ""
    base, _ = os.path.splitext(video)
    for candidate in (base + ".webm", video):
        if os.path.exists(candidate):
            return _url(candidate)
    return ""


def theme_data(c, licences):
    """The theme as the page needs it (the same shape as the preview's APPS entries)."""
    appconfig = _engine_modules()
    folder = kids_launch.write_app_folder(c, licences)
    cfg = appconfig.load_config(folder)
    lessons, topics = appconfig.load_lessons(folder)
    return {
        "id": c["id"],
        "cfg": {k: cfg.get(k, "") for k in ("name", "version", "window_title", "hero_title", "hero_subtitle", "sidebar_title",
                                             "login_subtitle", "characters_note", "colors", "register_url", "password_url")},
        "locked": sorted(appconfig.parse_lesson_numbers(cfg["locks"]["locked_lessons"], len(topics))),
        "prefix": cfg["locks"].get("licence_prefix", "ADA"),
        "logo": _url(os.path.join(folder, cfg["logo"])),
        "byte": _url(os.path.join(folder, cfg.get("profile_picture") or "")),
        "chars": [{"name": ch["name"], "img": _url(os.path.join(folder, ch["image"])) if ch.get("image") else "",
                   "emoji": ch.get("emoji", "")} for ch in cfg["characters"]],
        "topics": topics,
        "lessons": {t["id"]: {"title": lessons[t["id"]]["title"], "subtitle": lessons[t["id"]]["subtitle"],
                              "video": lessons[t["id"]].get("video", ""),
                              "examples": lessons[t["id"]]["examples"],
                              "default_code": lessons[t["id"]]["default_code"]} for t in topics},
        "template": _template(cfg, folder),
        "videos": {os.path.basename(lessons[t["id"]].get("video") or ""): _webm(lessons[t["id"]].get("video"))
                   for t in topics if lessons[t["id"]].get("video")},
    }


def theme_page(c, licences):
    """The whole page for the app's theme frame (srcdoc), and the theme's data."""
    data = theme_data(c, licences)
    shell = open(asset("app", "theme.html"), encoding="utf-8").read()
    glue = open(asset("app", "theme.js"), encoding="utf-8").read()
    blob = json.dumps([data], ensure_ascii=False).replace("</", "<\\/")
    page = shell.replace("/*__APPS__*/null", blob).replace("__INTRO__", "")
    if "</script>\n</body>" in page:
        page = page.replace("</script>\n</body>", glue + "\n</script>\n</body>")
    else:
        page = page.rstrip() + "\n<script>" + glue + "</script>\n"
    head = ('<!doctype html>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<script>window.EMBED_THEME = %s; window.VIDEO_URLS = %s; window.EMBED_PRICE = %s;</script>\n'
            '<style>body { margin: 0; } .strip, .note, #login { display: none !important; } '
            '#logoutBtn { background: #f8fdff; color: #0c4a6e; border: 2px solid #38bdf8; box-shadow: 0 3px 10px rgba(3, 105, 161, .25); } '
            '#logoutBtn:hover { background: #e0f2fe; color: #0c4a6e; } '
            '.wrap { padding: 0 !important; max-width: none !important; margin: 0 !important; } '
            # inside the app's own window: no drawn title bar, and the page fits the window's 1280 x 748 exactly
            '.titlebar { display: none !important; } .win { height: 748px !important; } .central { top: 0 !important; } '
            '.overlay, .modal { top: 0 !important; inset: 0 !important; } #logoutBtn { top: 18px !important; }</style>\n'
            % (json.dumps(c["id"]), json.dumps(data["videos"]), json.dumps(c.get("price", ""))))
    return head + page, data
