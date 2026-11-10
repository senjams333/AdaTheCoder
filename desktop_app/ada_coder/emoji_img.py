"""What every page the app shows gets, so every computer shows the same thing:
- pictures for emojis (assets/emoji: Microsoft Fluent Emoji 3D, MIT License, and Noto Color Emoji, SIL Open Font
  License, for the few Fluent doesn't have); assets/app/emoji.js does the work;
- the app's font, Quicksand (assets/fonts, SIL Open Font License), built into the page so it is there from the
  first moment (no flash of another font while it loads)."""
import base64
import json
import os
import re

from PyQt5.QtCore import QUrl

from .paths import asset

_SCRIPT = None
_FONT = None


def font_style():
    global _FONT
    if _FONT is None:
        try:
            data = base64.b64encode(open(asset("fonts", "quicksand.woff"), "rb").read()).decode("ascii")
            _FONT = ("<style>@font-face { font-family: 'Quicksand'; font-weight: 300 700; font-style: normal; "
                     "font-display: block; src: url(data:font/woff;base64,%s) format('woff'); }</style>\n" % data)
        except OSError:
            _FONT = ""
    return _FONT


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
    """The page with the font at its start (just inside <head>) and the emoji script just before its end
    (</body>, or at the very end)."""
    font = font_style()
    if font:
        # inside the page's own <head> (only one that comes before any script: a <head> later on is part of
        # data, like the lesson page carried inside the app page), else just after <!doctype>
        m = re.search(r"<head(?:\s[^>]*)?>", page, re.I)
        first_script = page.find("<script")
        if m and (first_script < 0 or m.start() < first_script):
            at = m.end()
        else:
            d = re.match(r"\s*<!doctype[^>]*>\s*", page, re.I)
            at = d.end() if d else 0
        page = page[:at] + font + page[at:]
    script = emoji_script()
    if not script:
        return page
    i = page.rfind("</body>")
    return page[:i] + script + page[i:] if i >= 0 else page + script
