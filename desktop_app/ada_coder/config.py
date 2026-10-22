"""Settings baked into each build of the app.

Before building a new version:
  1. Set SERVER_URL to your live website address (no slash at the end).
  2. Raise APP_VERSION (for example 1.0.0 -> 1.1.0).
  3. Upload the new installer in the website admin under "App versions"
     with exactly the same version number.
"""
APP_NAME = "Ada The Coder"
APP_VERSION = "1.2.0"
DEFAULT_SERVER_URL = "https://www.adathecoder.com"


def _server_url():
    """The website this app talks to. Normally DEFAULT_SERVER_URL. For testing, start the app with
    "python run.py --server http://127.0.0.1:5000" (remembered in server_url.txt in the app's data
    folder until you run "--server default")."""
    import os
    url = os.environ.get("ADA_SERVER_URL", "").strip()
    if not url:
        from .paths import data_dir
        try:
            with open(os.path.join(data_dir(), "server_url.txt"), encoding="utf-8") as f:
                url = f.read().strip()
        except OSError:
            url = ""
    return (url or DEFAULT_SERVER_URL).rstrip("/")


SERVER_URL = _server_url()

# How often the open app checks the website for new themes and lessons (seconds).
SYNC_EVERY = 180
CONTACT_EMAIL = "ada@adathecoder.com"

# How long a child's program may run (seconds) before the app stops it.
# Time spent waiting for the child to type an answer, or with an OpenCV picture window open, doesn't count.
RUN_TIME_LIMIT = 12

# Most text the output box keeps, so a runaway loop can't freeze the app.
OUTPUT_LIMIT = 20000

# Log-ins are checked by the website (/api/v3/login). "Try for free" needs no account.
