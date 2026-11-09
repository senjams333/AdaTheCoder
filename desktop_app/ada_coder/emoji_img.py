"""Pictures for emojis (assets/emoji, from Noto Color Emoji, SIL Open Font License), so every computer shows the
same modern emojis. emoji_script() is added to each page the app shows; assets/app/emoji.js does the work."""
import json
import os

from PyQt5.QtCore import QUrl

from .paths import asset

_SCRIPT = None


def emoji_script():
    global _SCRIPT
    if _SCRIPT is None:
        folder = asset("emoji")
        try:
            names = sorted(n[:-5] for n in os.listdir(folder) if n.endswith(".webp"))
            code = open(asset("app", "emoji.js"), encoding="utf-8").read()
        except OSError:
            names, code = [], ""
        if not names or not code:
            _SCRIPT = ""
        else:
            base = QUrl.fromLocalFile(folder).toString().rstrip("/") + "/"
            data = json.dumps({"base": base, "names": names}).replace("</", "<\\/")
            _SCRIPT = "<script>window.ADA_EMOJI = %s;\n%s</script>\n" % (data, code)
    return _SCRIPT


def add_to(page):
    """The page with the emoji script just before its end (</body>, or at the very end)."""
    script = emoji_script()
    if not script:
        return page
    i = page.rfind("</body>")
    return page[:i] + script + page[i:] if i >= 0 else page + script
