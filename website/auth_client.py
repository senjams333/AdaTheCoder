"""Talks to the accounts API (auth-api/, NestJS + MySQL) when AUTH_API_URL is set,
for example AUTH_API_URL=http://127.0.0.1:3000/api

The API owns parent accounts (and sends the Brevo welcome emails). The website keeps a copy of each
parent (same email) for sessions, licences, downloads and the admin's Parents page.
Without AUTH_API_URL the website works on its own, as before.

Every call answers (status, data):
    ("ok", {...})            the API agreed
    ("error", [messages])    the API said no (wrong details, email taken, wrong password...)
    ("offline", None)        the API couldn't be reached
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 15


def base_url():
    return os.environ.get("AUTH_API_URL", "").strip().rstrip("/")


def enabled():
    return bool(base_url())


def _opener(url):
    host = (urllib.parse.urlsplit(url).hostname or "").lower()
    local = host in ("localhost", "::1") or host.startswith(("127.", "10.", "192.168."))
    # a local API is reached directly even if the computer has a proxy set up
    return urllib.request.build_opener(urllib.request.ProxyHandler({})) if local else urllib.request.build_opener()


def _post(path, body):
    url = base_url() + path
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json", "Accept": "application/json"})
    try:
        with _opener(url).open(req, timeout=TIMEOUT) as resp:
            return "ok", json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            message = json.loads(e.read().decode("utf-8")).get("message")
        except ValueError:
            message = None
        if e.code >= 500 or (e.code == 404 and not message):
            return "offline", None
        if isinstance(message, str):
            message = [message]
        return "error", message or ["The accounts service said no."]
    except (urllib.error.URLError, OSError, ValueError):
        return "offline", None


def register(clean):
    """clean: the checked sign-up fields (see check_registration in app.py)."""
    body = {"name": clean["name"], "email": clean["email"], "password": clean["password"], "city": clean["city"],
            "country": clean["country"], "consent": True}
    if clean.get("child_name"):
        body["childName"] = clean["child_name"]
    if clean.get("child_age"):
        body["childAge"] = int(clean["child_age"])
    status, data = _post("/auth/register", body)
    return (status, data.get("user") if status == "ok" else data)


def login(email, password):
    status, data = _post("/auth/login", {"email": email, "password": password})
    return (status, data.get("user") if status == "ok" else data)


def change_password(email, current, new):
    return _post("/auth/change-password", {"email": email, "currentPassword": current, "newPassword": new})


def delete_account(email, password):
    return _post("/auth/delete-account", {"email": email, "password": password})
