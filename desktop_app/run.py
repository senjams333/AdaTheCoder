"""Start Ada The Coder:  python run.py"""
import os
import sys


def choose_server(args):
    """--server http://127.0.0.1:5000 points the app at a test website (remembered); --server default undoes it."""
    if "--server" not in args:
        return
    i = args.index("--server")
    url = args[i + 1] if i + 1 < len(args) else "default"
    del args[i:i + 2]
    import os
    from ada_coder.paths import data_dir
    path = os.path.join(data_dir(), "server_url.txt")
    if url == "default":
        if os.path.exists(path):
            os.remove(path)
        os.environ.pop("ADA_SERVER_URL", None)
        print("The app uses its normal website again.")
    else:
        with open(path, "w", encoding="utf-8") as f:
            f.write(url)
        os.environ["ADA_SERVER_URL"] = url
        print(f"The app now uses {url} (until you run: python run.py --server default)")
    # The website address is read when the app's settings load; read it again now that it changed.
    from ada_coder import config
    config.SERVER_URL = config._server_url()


def use_light_look(app):
    """The same bright look on every computer: Qt's Fusion style with a light palette, so a dark desktop theme
    (common on Ubuntu) can't paint the app's panels black or grey behind the sky."""
    from PyQt5.QtGui import QColor, QPalette
    app.setStyle("Fusion")
    pal = QPalette()
    for role, colour in ((QPalette.Window, "#dff4ff"), (QPalette.WindowText, "#1e1b4b"), (QPalette.Base, "#ffffff"),
                         (QPalette.AlternateBase, "#f0f9ff"), (QPalette.Text, "#1e1b4b"), (QPalette.Button, "#ffffff"),
                         (QPalette.ButtonText, "#1e1b4b"), (QPalette.ToolTipBase, "#ffffff"), (QPalette.ToolTipText, "#1e1b4b"),
                         (QPalette.Highlight, "#7b4dff"), (QPalette.HighlightedText, "#ffffff"), (QPalette.Link, "#0284c7")):
        pal.setColor(role, QColor(colour))
    app.setPalette(pal)


def setup_log():
    """The installed app has no console window, so what it prints, its errors and Qt's own messages go to
    app.log in its data folder (Windows: %APPDATA%\\AdaTheCoder\\app.log). Kept small: started fresh each launch."""
    import os
    import time
    import traceback
    from ada_coder.paths import data_dir
    path = os.path.join(data_dir(), "app.log")
    try:
        log = open(path, "w", encoding="utf-8", buffering=1)
    except OSError:
        return
    sys.stdout = sys.stderr = log
    print(f"Ada The Coder started {time.strftime('%Y-%m-%d %H:%M:%S')} on {sys.platform}", flush=True)

    def hook(kind, value, tb):
        print("[error] " + "".join(traceback.format_exception(kind, value, tb)), flush=True)
    sys.excepthook = hook
    try:
        from PyQt5.QtCore import qInstallMessageHandler
        qInstallMessageHandler(lambda mode, ctx, msg: print(f"[qt] {msg}", flush=True))
    except Exception:
        pass


def main():
    # The packaged app also runs the children's programs: "AdaTheCoder --ada-run my_code.py".
    # This keeps working on computers that don't have Python installed.
    if len(sys.argv) >= 3 and sys.argv[1] == "--ada-run":
        from ada_coder import child
        sys.exit(child.main(sys.argv[2:]))

    # A theme opened in the Python Adventure app (see ada_coder/kids_launch.py): "--kids-app <folder>"
    if len(sys.argv) >= 3 and sys.argv[1] == "--kids-app":
        import os
        import runpy
        from ada_coder.kids_launch import engine_path
        os.environ["KIDS_APP_DIR"] = sys.argv[2]
        engine = os.environ.get("KIDS_APP_ENGINE") or engine_path()
        sys.argv = [engine]
        runpy.run_path(engine, run_name="__main__")
        return

    # The packaged app also runs the Python Adventure app's programs: "--ada-run-script runner.py code.py"
    if len(sys.argv) >= 4 and sys.argv[1] == "--ada-run-script":
        import runpy
        sys.argv = sys.argv[2:]
        runpy.run_path(sys.argv[0], run_name="__main__")
        return

    choose_server(sys.argv)
    if getattr(sys, "frozen", False) or __import__("os").environ.get("ADA_LOG") == "1":
        setup_log()

    if "--check" in sys.argv:
        from ada_coder import sync
        sys.exit(sync.diagnose())

    # Ubuntu's Wayland desktop: Qt 5 shows videos and the see-through sky more reliably through X11 (XWayland)
    import os
    if sys.platform.startswith("linux") and os.environ.get("WAYLAND_DISPLAY") and not os.environ.get("QT_QPA_PLATFORM"):
        os.environ["QT_QPA_PLATFORM"] = "xcb"

    from PyQt5.QtCore import QCoreApplication, Qt
    from PyQt5.QtGui import QIcon
    from PyQt5.QtWidgets import QApplication

    # Sharp text and pictures on high-resolution screens; required before QtWebEngine starts.
    QCoreApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QCoreApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
    QCoreApplication.setAttribute(Qt.AA_ShareOpenGLContexts, True)

    from ada_coder.config import APP_NAME, APP_VERSION
    from ada_coder.paths import image

    app = QApplication(sys.argv)
    use_light_look(app)
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(APP_VERSION)
    app.setOrganizationName("Ada The Coder")
    app.setWindowIcon(QIcon(image("ada_logo.png")))

    from ada_coder import sync
    if os.environ.get("ADA_CLASSIC") == "1":            # the earlier, hand-built window (kept for comparison)
        from ada_coder.main_window import MainWindow
    else:                                               # the window made from the preview (assets/app/app.html)
        from ada_coder.web_app import WebMainWindow as MainWindow

    window = MainWindow()
    window.showMaximized()
    window.start()
    sync.start(window)  # new lessons, app updates and messages from the website, in the background
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
