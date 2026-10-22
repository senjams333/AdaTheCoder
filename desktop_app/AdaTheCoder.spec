# PyInstaller recipe for Ada The Coder. Used by build_windows.bat and build_mac.sh:
#     python -m PyInstaller --noconfirm AdaTheCoder.spec
import os
import sys

sys.path.insert(0, os.path.abspath("."))
from ada_coder.config import APP_NAME, APP_VERSION  # noqa: E402

datas = [("assets", "assets"), ("data", "data")]
if os.path.isdir("vid"):
    datas.append(("vid", "vid"))

a = Analysis(
    ["run.py"],
    pathex=["."],
    datas=datas,
    # cv2 and numpy are imported by the children's programs, not by the app, so list them here.
    hiddenimports=["ada_coder.child", "cv2", "numpy"],
    excludes=["tkinter", "matplotlib", "PyQt5.QtQml", "PyQt5.QtQuick", "PyQt5.Qt3DCore"],
)
pyz = PYZ(a.pure)

icon_win = os.path.join("assets", "images", "app_icon.ico")
icon_mac = os.path.join("build", "AdaTheCoder.icns")

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AdaTheCoder",
    console=False,
    icon=icon_win if sys.platform.startswith("win") else (icon_mac if os.path.exists(icon_mac) else None),
)
coll = COLLECT(exe, a.binaries, a.datas, name="AdaTheCoder")

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name=f"{APP_NAME}.app",
        icon=icon_mac if os.path.exists(icon_mac) else None,
        bundle_identifier="com.adathecoder.app",
        info_plist={
            "CFBundleShortVersionString": APP_VERSION,
            "CFBundleVersion": APP_VERSION,
            "NSHighResolutionCapable": True,
            "NSCameraUsageDescription": "Some lessons let children use the camera with OpenCV.",
        },
    )
