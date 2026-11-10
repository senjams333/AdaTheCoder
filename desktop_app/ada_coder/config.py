"""Settings baked into each build of the app.

Before building a new version:
  (For a test build pointed at another server, e.g. on AWS, run "build_windows.bat http://your-server" instead:
   it writes server_url.txt next to AdaTheCoder.exe and that address is used.)
  1. Set DEFAULT_SERVER_URL to the website's address, without a slash at the end, for example
     https://www.adathecoder.com. The same address must answer the API (<that>/api/v3/courses and so on;
     nginx passes /api and /media to the API) and the website pages the app opens (/register, /pay ...).
  2. Raise APP_VERSION (for example 1.0.0 -> 1.1.0).
  3. Upload the new installer in the website admin under "App versions"
     with exactly the same version number.
"""
APP_NAME = "Ada The Coder"
APP_VERSION = "1.2.9"
DEFAULT_SERVER_URL = "https://www.adathecoder.com"


def _server_url():
    """The website this app talks to. Normally DEFAULT_SERVER_URL. For testing, start the app with
    "python run.py --server http://127.0.0.1:5000" (remembered in server_url.txt in the app's data
    folder until you run "--server default")."""
    import os
    import sys
    url = os.environ.get("ADA_SERVER_URL", "").strip()
    if not url:
        from .paths import data_dir
        # 1. the app's data folder (set by --server while testing)
        # 2. server_url.txt beside the installed app: "build_windows.bat http://your-server" writes it, so one
        #    build can point at a test server (for example on AWS) without changing any code
        here = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        for path in (os.path.join(data_dir(), "server_url.txt"), os.path.join(here, "server_url.txt")):
            try:
                with open(path, encoding="utf-8") as f:
                    url = f.read().strip()
            except OSError:
                url = ""
            if url:
                break
    return (url or DEFAULT_SERVER_URL).rstrip("/")


SERVER_URL = _server_url()

# How often the open app checks the website for new themes and lessons (seconds).
SYNC_EVERY = 60
CONTACT_EMAIL = "ada@adathecoder.com"

# How long a child's program may run (seconds) before the app stops it.
# Time spent waiting for the child to type an answer, or with an OpenCV picture window open, doesn't count.
RUN_TIME_LIMIT = 12

# Most text the output box keeps, so a runaway loop can't freeze the app.
OUTPUT_LIMIT = 20000

# Log-ins are checked by the website (/api/v3/login). "Try for free" needs no account.
