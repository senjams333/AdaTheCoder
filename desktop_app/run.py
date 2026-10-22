"""Start Ada The Coder:  python run.py"""
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


def main():
    # The packaged app also runs the children's programs: "AdaTheCoder --ada-run my_code.py".
    # This keeps working on computers that don't have Python installed.
    if len(sys.argv) >= 3 and sys.argv[1] == "--ada-run":
        from ada_coder import child
        sys.exit(child.main(sys.argv[2:]))

    choose_server(sys.argv)

    if "--check" in sys.argv:
        from ada_coder import sync
        sys.exit(sync.diagnose())

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
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(APP_VERSION)
    app.setOrganizationName("Ada The Coder")
    app.setWindowIcon(QIcon(image("ada_logo.png")))

    from ada_coder import sync
    from ada_coder.main_window import MainWindow

    window = MainWindow()
    window.showMaximized()
    window.start()
    sync.start(window)  # new lessons, app updates and messages from the website, in the background
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
