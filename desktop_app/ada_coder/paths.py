"""Where things live: files shipped with the app, and the child's own data."""
import os
import shutil
import sys

FROZEN = getattr(sys, "frozen", False)


def base_dir():
    """The app's own folder: next to run.py when developing, inside the bundle when packaged."""
    if FROZEN and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def project_file(*parts):
    return os.path.join(base_dir(), *parts)


def asset(*parts):
    return project_file("assets", *parts)


def image(name):
    return asset("images", name)


def data_dir():
    """A folder the app can write to (settings, downloaded lessons, the child's playground)."""
    if sys.platform.startswith("win"):
        root = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "AdaTheCoder")
    elif sys.platform == "darwin":
        root = os.path.expanduser("~/Library/Application Support/AdaTheCoder")
    else:
        root = os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"), "AdaTheCoder")
    os.makedirs(root, exist_ok=True)
    return root


# Pictures the lesson examples open with OpenCV, for example cv2.imread('tom.png').
PLAYGROUND_PICTURES = ("tom.png", "penny.png", "teddy.png", "ada.png")


def playground_dir():
    """Children's programs run here, so they can read lesson pictures and save their own files."""
    path = os.path.join(data_dir(), "playground")
    os.makedirs(path, exist_ok=True)
    for name in PLAYGROUND_PICTURES:
        dest = os.path.join(path, name)
        if not os.path.exists(dest) and os.path.exists(image(name)):
            try:
                shutil.copyfile(image(name), dest)
            except OSError:
                pass
    return path
