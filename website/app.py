"""Ada The Coder website.

Parents register, log in and download the desktop app.
Admins edit the website text, the lessons the app downloads, and the app installers.

Run locally:   python app.py            (then open http://127.0.0.1:5000)
Admin: the first visit to /admin/login creates the admin account (or: flask --app app create-admin)
"""
import hashlib
import json
import os
import re
import secrets
import time
from collections import defaultdict, deque
from functools import wraps

import click
from flask import (Flask, abort, flash, g, jsonify, redirect, render_template,
                   request, send_from_directory, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from db import close_db, get_db, get_settings, init_db, now_iso, set_setting
import auth_client

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PLATFORMS = {
    "windows": {"label": "Windows", "extensions": {".exe", ".msi", ".zip"}},
    "mac": {"label": "Mac", "extensions": {".dmg", ".pkg", ".zip"}},
}
VIDEO_EXTENSIONS = {".mp4", ".m4v"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
# Character packs built into the app. Each course picks one; it decides who appears in the app.
PACKS = {
    "friends": {"label": "Tom, Penny & Teddy", "images": ["tom.webp", "penny.webp", "teddy.webp"],
                "note": "Teddy celebrates, Tom explains mistakes"},
    "fairies": {"label": "Twinkle, Fern & Sparkle", "images": ["twinkle.webp", "fern.webp", "sparkle.webp"],
                "note": "Sparkle the unicorn celebrates, Fern explains mistakes"},
    "coding_club": {"label": "Ada, Byte & Penny", "images": ["ada.webp", "byte.webp", "penny.webp"],
                    "note": "Byte the owl celebrates and explains mistakes"},
    # A new theme (like "Learn Coding in Space") with characters uploaded in the admin. Installed apps
    # download the pictures, so the theme appears without a new version of the app.
    "custom": {"label": "Your own characters", "images": [],
               "note": "Upload 3 pictures: the first explains mistakes, the last celebrates"},
}
CHARACTER_SLOTS = 3
# Suggestions for the country box on the sign-up and account pages (parents can still type anything).
with open(os.path.join(BASE_DIR, "data", "countries.txt"), encoding="utf-8") as _f:
    COUNTRIES = [line.strip() for line in _f if line.strip()]
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SETTING_FIELDS = ["hero_title", "hero_subtitle", "site_banner", "app_message", "parents_note", "contact_email",
                  "author_name", "author_note"]


def version_tuple(v):
    try:
        return tuple(int(p) for p in (v or "").split("."))
    except ValueError:
        return (0,)


# ---------------------------------------------------------------------------
# Small in-memory login limiter (per IP). For several server processes,
# swap this for Flask-Limiter with Redis.
# ---------------------------------------------------------------------------
_failed_logins = defaultdict(deque)
MAX_FAILS, FAIL_WINDOW = 8, 15 * 60


def too_many_attempts(key):
    q = _failed_logins[key]
    cutoff = time.time() - FAIL_WINDOW
    while q and q[0] < cutoff:
        q.popleft()
    return len(q) >= MAX_FAILS


def record_failure(key):
    _failed_logins[key].append(time.time())


def create_app(test_config=None):
    app = Flask(__name__)
    secret = os.environ.get("ADA_SECRET_KEY")
    is_production = os.environ.get("ADA_ENV", "development") == "production"
    if is_production and not secret:
        raise RuntimeError("Set ADA_SECRET_KEY before running in production.")
    app.config.update(
        SECRET_KEY=secret or "dev-only-change-me",
        DATABASE=os.environ.get("ADA_DATABASE", os.path.join(BASE_DIR, "instance", "ada.sqlite3")),
        UPLOAD_DIR=os.environ.get("ADA_UPLOAD_DIR", os.path.join(BASE_DIR, "uploads")),
        MAX_CONTENT_LENGTH=int(os.environ.get("ADA_MAX_UPLOAD_MB", "500")) * 1024 * 1024,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=is_production,
        PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 14,
    )
    if test_config:
        app.config.update(test_config)
    if is_production:
        # Behind Render/Railway/nginx: trust one proxy for the real visitor IP and https links.
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.config["VIDEO_DIR"] = os.path.join(app.config["UPLOAD_DIR"], "videos")
    os.makedirs(app.config["VIDEO_DIR"], exist_ok=True)
    app.config["COURSE_IMAGE_DIR"] = os.path.join(app.config["UPLOAD_DIR"], "courses")
    os.makedirs(app.config["COURSE_IMAGE_DIR"], exist_ok=True)

    init_db(app)
    app.teardown_appcontext(close_db)
    bootstrap_admin_from_env(app)

    # ------------------------------------------------------------------ helpers
    @app.before_request
    def load_user_and_check_csrf():
        g.user = None
        uid = session.get("user_id")
        if uid:
            user = get_db().execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
            if user and user["is_active"]:
                g.user = user
            else:
                session.clear()
        # /api/ is used by the app (no cookies or forms): it is exempt from the form check.
        if request.method == "POST" and not request.path.startswith("/api/") and not app.config.get("TESTING_SKIP_CSRF"):
            sent = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token")
            if not sent or not secrets.compare_digest(sent, session.get("csrf_token", "")):
                abort(400, "This form expired. Go back, refresh the page and try again.")

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        return resp

    @app.context_processor
    def inject_globals():
        if "csrf_token" not in session:
            session["csrf_token"] = secrets.token_urlsafe(32)
        return {
            "csrf_token": session["csrf_token"],
            "current_user": g.get("user"),
            "site": get_settings(),
            "PLATFORMS": PLATFORMS,
            "PACKS": PACKS,
            "COUNTRIES": COUNTRIES,
        }

    def login_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if g.user is None:
                flash("Please log in first.", "info")
                return redirect(url_for("login", next=request.path))
            return view(*args, **kwargs)
        return wrapped

    def admin_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if g.user is None or g.user["role"] != "admin":
                return redirect(url_for("admin_login", next=request.path))
            return view(*args, **kwargs)
        return wrapped

    def start_session(user):
        session.clear()
        session.permanent = True
        session["user_id"] = user["id"]
        session["csrf_token"] = secrets.token_urlsafe(32)
        db = get_db()
        db.execute("UPDATE users SET last_login = ? WHERE id = ?", (now_iso(), user["id"]))
        db.commit()

    def safe_next(default):
        nxt = request.values.get("next", "")
        return nxt if nxt.startswith("/") and not nxt.startswith("//") else default

    def latest_releases():
        rows = get_db().execute("SELECT * FROM releases WHERE is_latest = 1").fetchall()
        return {r["platform"]: r for r in rows}

    def all_courses(published_only=False):
        sql = "SELECT * FROM courses" + (" WHERE published = 1" if published_only else "") + " ORDER BY position, id"
        return get_db().execute(sql).fetchall()

    def published_lessons(course_id=None):
        if course_id is None:
            first = get_db().execute("SELECT id FROM courses WHERE published = 1 ORDER BY position, id").fetchone()
            course_id = first["id"] if first else 0
        return get_db().execute(
            "SELECT * FROM lessons WHERE published = 1 AND course_id = ? ORDER BY position, id", (course_id,)).fetchall()

    def course_characters(row, external=False):
        """[{"name", "url"}] for a theme with its own uploaded characters, otherwise []."""
        if row["pack"] != "custom":
            return []
        try:
            chars = json.loads(row["characters"] or "[]")
        except ValueError:
            chars = []
        return [{"name": c.get("name") or "", "file": c["file"],
                 "url": url_for("course_image", filename=c["file"], _external=external)}
                for c in chars if c.get("file")]

    def course_card(row):
        """A theme as the account page and admin show it."""
        pack = PACKS.get(row["pack"], PACKS["friends"])
        chars = course_characters(row)
        if row["image_file"]:
            images = [url_for("course_image", filename=row["image_file"])]
        elif chars:
            images = [c["url"] for c in chars]
        else:
            images = [url_for("static", filename="img/" + name) for name in pack["images"]]
        names = [c["name"] for c in chars if c["name"]]
        label = (", ".join(names[:-1]) + " & " + names[-1] if len(names) > 1 else "".join(names)) if chars else pack["label"]
        return dict(row, images=images, pack_label=label or pack["label"], characters_list=chars,
                    feature_list=[f.strip() for f in (row["features"] or "").splitlines() if f.strip()])

    def mirror_parent(api_user, password):
        """The website's copy of a parent the accounts API knows (made or updated at each log-in)."""
        db = get_db()
        email = api_user["email"].strip().lower()
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            db.execute("UPDATE users SET name = ?, password_hash = ? WHERE id = ?",
                       (api_user.get("name") or row["name"], generate_password_hash(password), row["id"]))
        else:
            db.execute(
                """INSERT INTO users (email, name, password_hash, role, child_name, child_age, city, country, created_at)
                   VALUES (?, ?, ?, 'parent', ?, ?, ?, ?, ?)""",
                (email, api_user.get("name") or email, generate_password_hash(password), api_user.get("childName"),
                 api_user.get("childAge"), api_user.get("city"), api_user.get("country"), now_iso()))
        db.commit()
        return db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    def check_credentials(email, password):
        key = request.remote_addr or "unknown"
        if too_many_attempts(key):
            return None, "Too many tries. Wait 15 minutes, then try again."
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if auth_client.enabled() and not (user and user["role"] == "admin"):
            # parents log in through the accounts API; admins always log in here
            status, data = auth_client.login(email, password)
            if status == "error":
                record_failure(key)
                return None, " ".join(data)
            if status == "ok":
                user = mirror_parent(data, password)
                if not user["is_active"]:
                    return None, "This account is turned off. Contact us to turn it back on."
                return user, None
            # the API can't be reached: the website's copy of the account still works
        if not user or not check_password_hash(user["password_hash"], password):
            record_failure(key)
            return None, "That email and password don't match. Check them and try again."
        if not user["is_active"]:
            return None, "This account is turned off. Contact us to turn it back on."
        return user, None

    # ------------------------------------------------------------ public pages
    @app.route("/")
    def index():
        lessons = published_lessons()
        return render_template("index.html", lessons=lessons, lesson_count=len(lessons))

    @app.route("/privacy")
    def privacy():
        return render_template("privacy.html")

    def check_registration(data, need_password2=True):
        """Checks a new parent account (from the sign-up page or the app). Returns (clean fields, errors)."""
        get = lambda k: str(data.get(k) or "").strip()
        clean = {"name": get("name")[:80], "email": get("email").lower(), "password": str(data.get("password") or ""),
                 "child_name": get("child_name")[:40], "child_age": get("child_age"),
                 "city": get("city")[:80], "country": get("country")[:80]}
        errors = []
        if not clean["name"]:
            errors.append("Enter your name.")
        if not EMAIL_RE.match(clean["email"]):
            errors.append("Enter a valid email address.")
        if len(clean["password"]) < 8:
            errors.append("Choose a password with at least 8 characters.")
        if (need_password2 or "password2" in data) and clean["password"] != str(data.get("password2") or ""):
            errors.append("The two passwords don't match.")
        if not clean["city"]:
            errors.append("Enter your city.")
        if not clean["country"]:
            errors.append("Enter your country.")
        if clean["child_age"] and (not clean["child_age"].isdigit() or not 4 <= int(clean["child_age"]) <= 14):
            errors.append("Choose your child's age from the list.")
        if data.get("consent") in (None, "", False, "0", "false"):
            errors.append("Tick the box to confirm you are the parent or guardian.")
        if not errors and get_db().execute("SELECT 1 FROM users WHERE email = ?", (clean["email"],)).fetchone():
            errors.append("An account with this email already exists. Log in instead.")
        return clean, errors

    def register_with_api(clean):
        """With AUTH_API_URL set, the accounts API creates the account (and emails the parent and the admin).
        Returns a list of problems, empty when it worked."""
        if not auth_client.enabled():
            return []
        status, data = auth_client.register(clean)
        if status == "offline":
            return ["Accounts can't be created right now. Please try again in a few minutes."]
        return data if status == "error" else []

    def create_parent(clean):
        db = get_db()
        cur = db.execute(
            """INSERT INTO users (email, name, password_hash, role, child_name, child_age, city, country, created_at)
               VALUES (?, ?, ?, 'parent', ?, ?, ?, ?, ?)""",
            (clean["email"], clean["name"], generate_password_hash(clean["password"]), clean["child_name"] or None,
             int(clean["child_age"]) if clean["child_age"] else None, clean["city"], clean["country"], now_iso()),
        )
        db.commit()
        return db.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()

    @app.route("/register", methods=["GET", "POST"])
    def register():
        if g.user:
            return redirect(url_for("account"))
        form = request.form
        if request.method == "POST":
            clean, errors = check_registration(form)
            if not errors:
                errors = register_with_api(clean)
            if errors:
                for e in errors:
                    flash(e, "error")
                return render_template("register.html", form=form), 400
            start_session(create_parent(clean))
            flash("Your account is ready. Download the app below.", "success")
            return redirect(url_for("account"))
        return render_template("register.html", form=form)

    @app.route("/api/v3/register", methods=["POST"])
    def api_register():
        """Creates a parent account from the app. JSON in:
            {"name", "email", "password", "city", "country", "consent": true,
             optional "password2", "child_name", "child_age"}
        201 {"ok": true, "name", "email", "licences": []}  ·  400 {"ok": false, "errors": [...]}
        409 when the email already has an account  ·  429 after too many sign-ups from one place."""
        key = "register:" + (request.remote_addr or "unknown")
        if too_many_attempts(key):
            return jsonify({"ok": False, "errors": ["Too many new accounts from here. Wait 15 minutes, then try again."]}), 429
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"ok": False, "errors": ["Send the account details as JSON."]}), 400
        clean, errors = check_registration(data, need_password2=False)
        if not errors:
            errors = register_with_api(clean)
        if errors:
            exists = any("already exists" in e for e in errors)
            return jsonify({"ok": False, "errors": errors}), 409 if exists else 400
        record_failure(key)   # counts sign-ups per address, so one place can't make hundreds of accounts
        user = create_parent(clean)
        return jsonify({"ok": True, "name": user["name"], "email": user["email"], "licences": []}), 201

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if g.user:
            return redirect(url_for("account"))
        if request.method == "POST":
            user, error = check_credentials(request.form.get("email", "").strip().lower(),
                                            request.form.get("password", ""))
            if error:
                flash(error, "error")
                return render_template("login.html", email=request.form.get("email", "")), 401
            start_session(user)
            default = url_for("admin_dashboard") if user["role"] == "admin" else url_for("account")
            return redirect(safe_next(default))
        return render_template("login.html", email="")

    @app.route("/logout", methods=["POST"])
    def logout():
        session.clear()
        flash("You're logged out.", "info")
        return redirect(url_for("index"))

    @app.route("/account")
    @login_required
    def account():
        db = get_db()
        owned = {r["course_id"]: r["licence"] for r in db.execute(
            "SELECT course_id, licence FROM user_licences WHERE user_id = ?", (g.user["id"],))}
        courses = [dict(course_card(c), licence=owned.get(c["id"]))
                   for c in all_courses(published_only=True) if c["premium"]]
        return render_template("account.html", releases=latest_releases(), courses=courses,
                               wanted=request.args.get("theme", ""))

    @app.route("/account/details", methods=["POST"])
    @login_required
    def update_details():
        name = request.form.get("name", "").strip()[:80]
        city = request.form.get("city", "").strip()[:80]
        country = request.form.get("country", "").strip()[:80]
        if not name or not city or not country:
            flash("Fill in your name, city and country.", "error")
        else:
            db = get_db()
            db.execute("UPDATE users SET name = ?, city = ?, country = ? WHERE id = ?",
                       (name, city, country, g.user["id"]))
            db.commit()
            flash("Your details are saved.", "success")
        return redirect(url_for("account"))

    @app.route("/account/password", methods=["POST"])
    @login_required
    def change_password():
        current, new = request.form.get("current", ""), request.form.get("new", "")
        api_status = None
        if auth_client.enabled() and g.user["role"] != "admin" and len(new) >= 8:
            api_status, api_data = auth_client.change_password(g.user["email"], current, new)
        if api_status == "offline":
            flash("Passwords can't be changed right now. Please try again in a few minutes.", "error")
        elif api_status == "error" or (api_status is None and not check_password_hash(g.user["password_hash"], current)):
            flash("Your current password isn't right.", "error")
        elif len(new) < 8:
            flash("Choose a new password with at least 8 characters.", "error")
        else:
            db = get_db()
            db.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                       (generate_password_hash(new), g.user["id"]))
            db.commit()
            flash("Password changed.", "success")
        return redirect(url_for("admin_dashboard" if g.user["role"] == "admin" else "account") +
                        ("" if g.user["role"] == "admin" else "#settings"))

    @app.route("/account/delete", methods=["POST"])
    @login_required
    def delete_account():
        if g.user["role"] == "admin":
            abort(403)
        password = request.form.get("password", "")
        if auth_client.enabled():
            status, _ = auth_client.delete_account(g.user["email"], password)
            if status == "offline":
                flash("Accounts can't be deleted right now. Please try again in a few minutes.", "error")
                return redirect(url_for("account") + "#settings")
            if status == "error":
                flash("Your password isn't right, so the account was not deleted.", "error")
                return redirect(url_for("account") + "#settings")
        elif not check_password_hash(g.user["password_hash"], password):
            flash("Your password isn't right, so the account was not deleted.", "error")
            return redirect(url_for("account") + "#settings")
        db = get_db()
        db.execute("DELETE FROM users WHERE id = ?", (g.user["id"],))
        db.commit()
        session.clear()
        flash("Your account and details have been deleted.", "info")
        return redirect(url_for("index"))

    @app.route("/download/<platform>")
    @login_required
    def download(platform):
        if platform not in PLATFORMS:
            abort(404)
        release = latest_releases().get(platform)
        if not release:
            flash(f"The {PLATFORMS[platform]['label']} app isn't available yet. Check back soon.", "info")
            return redirect(url_for("account"))
        db = get_db()
        db.execute("UPDATE releases SET downloads = downloads + 1 WHERE id = ?", (release["id"],))
        db.execute("INSERT INTO downloads (user_id, release_id, created_at) VALUES (?, ?, ?)",
                   (g.user["id"], release["id"], now_iso()))
        db.commit()
        return send_from_directory(app.config["UPLOAD_DIR"], release["filename"],
                                   as_attachment=True, download_name=release["original_name"])

    # --------------------------------------------------------------- app API
    # The desktop app calls these. They are read-only and public on purpose:
    # they only expose lesson content and version numbers.
    def lesson_payload(row):
        video = {"bundled": row["video_bundled"]}
        if row["video_file"]:
            video.update(file=row["video_file"], size=row["video_size"],
                         url=url_for("lesson_video", filename=row["video_file"], _external=True))
        return {
            "id": row["slug"], "position": row["position"], "emoji": row["emoji"], "name": row["name"],
            "title": row["title"], "subtitle": row["subtitle"], "video": video,
            "default_code": row["default_code"], "examples": json.loads(row["examples"] or "[]"),
        }

    def revision_of(data):
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:16]

    @app.route("/api/v3/courses")
    def api_courses():
        """Every published course with its lessons. The app downloads this to stay up to date."""
        courses = []
        for c in all_courses(published_only=True):
            courses.append({
                "id": c["slug"], "name": c["name"], "tagline": c["tagline"], "pack": c["pack"],
                "position": c["position"], "premium": bool(c["premium"]), "price": c["price"],
                "free_lessons": c["free_lessons"] if c["premium"] else None,
                "buy_url": url_for("account", theme=c["slug"], _external=True) if c["premium"] else "",
                "characters": [{"name": ch["name"], "file": ch["file"], "url": ch["url"]}
                               for ch in course_characters(c, external=True)],
                "lessons": [lesson_payload(row) for row in published_lessons(c["id"])],
            })
        revision = revision_of(courses)
        if request.args.get("since") == revision:
            return jsonify({"revision": revision, "unchanged": True})
        return jsonify({"revision": revision, "unchanged": False, "courses": courses})

    @app.route("/api/v3/login", methods=["POST"])
    def api_login():
        """The app's log-in. Answers with the parent's name and the themes they hold a licence for."""
        data = request.get_json(silent=True) or {}
        email = str(data.get("email", "")).strip().lower()
        user, error = check_credentials(email, str(data.get("password", "")))
        if error:
            return jsonify({"ok": False, "error": error}), 401
        rows = get_db().execute(
            """SELECT c.slug FROM user_licences l JOIN courses c ON c.id = l.course_id
               WHERE l.user_id = ? AND l.licence IS NOT NULL AND l.licence != ''""", (user["id"],)).fetchall()
        return jsonify({"ok": True, "name": user["name"], "email": user["email"],
                        "licences": [r["slug"] for r in rows]})

    @app.route("/api/v2/lessons")
    def api_lessons():
        """Lessons of one course (?course=friends), or of the first course. Kept for apps from before courses."""
        course = None
        if request.args.get("course"):
            course = get_db().execute("SELECT id FROM courses WHERE slug = ? AND published = 1",
                                      (request.args["course"],)).fetchone()
            if course is None:
                return jsonify({"error": "no such course"}), 404
        lessons = [lesson_payload(row) for row in published_lessons(course["id"] if course else None)]
        revision = revision_of(lessons)
        if request.args.get("since") == revision:
            return jsonify({"revision": revision, "unchanged": True})
        return jsonify({"revision": revision, "unchanged": False, "lessons": lessons})

    @app.route("/media/courses/<path:filename>")
    def course_image(filename):
        return send_from_directory(app.config["COURSE_IMAGE_DIR"], filename)

    @app.route("/media/videos/<path:filename>")
    def lesson_video(filename):
        # Lesson videos are public so installed apps can download them without a login.
        return send_from_directory(app.config["VIDEO_DIR"], filename, conditional=True)

    @app.route("/api/v1/app/latest")
    def api_latest():
        platform = request.args.get("platform", "")
        if platform not in PLATFORMS:
            return jsonify({"error": "platform must be 'windows' or 'mac'"}), 400
        current = request.args.get("version", "0.0.0")
        release = latest_releases().get(platform)
        if not release:
            return jsonify({"update_available": False, "required": False})
        return jsonify({
            "latest_version": release["version"],
            "notes": release["notes"],
            "released_at": release["created_at"],
            "update_available": version_tuple(release["version"]) > version_tuple(current),
            "required": bool(release["min_supported"]) and
                        version_tuple(current) < version_tuple(release["min_supported"]),
            "download_page": url_for("account", _external=True),
        })

    @app.route("/api/v1/announcement")
    def api_announcement():
        return jsonify({"message": get_settings().get("app_message", "")})

    # ----------------------------------------------------------------- admin
    @app.route("/admin/login", methods=["GET", "POST"])
    def admin_login():
        if g.user and g.user["role"] == "admin":
            return redirect(url_for("admin_dashboard"))
        db = get_db()
        if not db.execute("SELECT 1 FROM users WHERE role = 'admin'").fetchone():
            # A brand-new website has no admin yet: the first visit here creates the admin account.
            if request.method == "POST":
                f = request.form
                name, email = f.get("name", "").strip()[:80], f.get("email", "").strip().lower()
                password = f.get("password", "")
                errors = []
                if not name:
                    errors.append("Type your name.")
                if not EMAIL_RE.match(email):
                    errors.append("Type a real email address.")
                elif db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
                    errors.append("A parent account already uses that email. Use a different email for the admin.")
                if len(password) < 10:
                    errors.append("Choose a password with at least 10 characters.")
                elif password != f.get("password2", ""):
                    errors.append("The two passwords are different.")
                if errors:
                    for e in errors:
                        flash(e, "error")
                    return render_template("admin/login.html", setup=True, name=name, email=email), 400
                make_admin(email, name, password)
                start_session(db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone())
                flash("Your admin account is ready. Log in at this same page next time.", "success")
                return redirect(url_for("admin_dashboard"))
            return render_template("admin/login.html", setup=True, name="", email="")
        if request.method == "POST":
            user, error = check_credentials(request.form.get("email", "").strip().lower(),
                                            request.form.get("password", ""))
            if not error and user["role"] != "admin":
                record_failure(request.remote_addr or "unknown")
                error = "That account isn't an admin account."
            if error:
                flash(error, "error")
                return render_template("admin/login.html"), 401
            start_session(user)
            return redirect(safe_next(url_for("admin_dashboard")))
        return render_template("admin/login.html")

    @app.route("/admin")
    @admin_required
    def admin_dashboard():
        db = get_db()
        stats = {
            "parents": db.execute("SELECT COUNT(*) FROM users WHERE role = 'parent'").fetchone()[0],
            "new_parents": db.execute(
                "SELECT COUNT(*) FROM users WHERE role = 'parent' AND created_at >= datetime('now', '-7 days')"
            ).fetchone()[0],
            "downloads": db.execute("SELECT COUNT(*) FROM downloads").fetchone()[0],
            "lessons": db.execute("SELECT COUNT(*) FROM lessons WHERE published = 1").fetchone()[0],
            "drafts": db.execute("SELECT COUNT(*) FROM lessons WHERE published = 0").fetchone()[0],
            "courses": db.execute("SELECT COUNT(*) FROM courses WHERE published = 1").fetchone()[0],
        }
        recent = db.execute(
            "SELECT name, email, child_age, created_at FROM users WHERE role = 'parent' "
            "ORDER BY created_at DESC LIMIT 6").fetchall()
        return render_template("admin/dashboard.html", stats=stats, releases=latest_releases(), recent=recent)

    @app.route("/admin/content", methods=["GET", "POST"])
    @admin_required
    def admin_content():
        if request.method == "POST":
            for key in SETTING_FIELDS:
                set_setting(key, request.form.get(key, "").replace("\r\n", "\n").strip())
            flash("Website text saved. The app picks up the new message next time it opens.", "success")
            return redirect(url_for("admin_content"))
        return render_template("admin/content.html")

    # ---------------------------------------------------------- admin: courses
    def remove_upload(folder, filename):
        if filename:
            try:
                os.remove(os.path.join(app.config[folder], filename))
            except FileNotFoundError:
                pass

    def remove_video(filename):
        remove_upload("VIDEO_DIR", filename)

    @app.route("/admin/courses")
    @admin_required
    def admin_courses():
        db = get_db()
        counts = {r["course_id"]: (r["total"], r["live"]) for r in db.execute(
            "SELECT course_id, COUNT(*) AS total, SUM(published) AS live FROM lessons GROUP BY course_id")}
        courses = [dict(course_card(c), total=counts.get(c["id"], (0, 0))[0], live=counts.get(c["id"], (0, 0))[1] or 0)
                   for c in all_courses()]
        return render_template("admin/courses.html", courses=courses)

    @app.route("/admin/courses/<int:course_id>")
    @admin_required
    def admin_course(course_id):
        """One theme, with its lessons (topics, lessons and videos) inside it."""
        db = get_db()
        course = db.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
        if not course:
            abort(404)
        rows = db.execute("SELECT * FROM lessons WHERE course_id = ? ORDER BY position, id", (course_id,)).fetchall()
        lessons = [dict(r, example_count=len(json.loads(r["examples"] or "[]"))) for r in rows]
        live = sum(1 for r in rows if r["published"])
        return render_template("admin/lessons.html", lessons=lessons, course=course_card(course), courses=all_courses(),
                               live=live)

    @app.route("/admin/courses/new", methods=["GET", "POST"])
    @app.route("/admin/courses/<int:course_id>/settings", methods=["GET", "POST"])
    @admin_required
    def admin_course_edit(course_id=None):
        db = get_db()
        course = None
        if course_id is not None:
            course = db.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
            if not course:
                abort(404)
        if request.method == "POST":
            f = request.form
            data = {
                "slug": f.get("slug", "").strip(),
                "name": f.get("name", "").strip(),
                "tagline": f.get("tagline", "").strip(),
                "description": f.get("description", "").replace("\r\n", "\n").strip(),
                "features": f.get("features", "").replace("\r\n", "\n").strip(),
                "pack": f.get("pack", ""),
                "price": f.get("price", "").strip(),
                "premium": 1 if f.get("premium") else 0,
                "free_lessons": f.get("free_lessons", "3").strip() or "0",
                "position": f.get("position", "0").strip(),
                "published": 1 if f.get("published") else 0,
            }
            errors = []
            if not data["name"]:
                errors.append("Give the theme a name, like Learn Coding in Space.")
            if not re.fullmatch(r"[A-Za-z0-9_-]+", data["slug"]):
                errors.append("The theme ID can only use letters, numbers, - and _, like space.")
            elif db.execute("SELECT 1 FROM courses WHERE slug = ? AND id != ?", (data["slug"], course_id or 0)).fetchone():
                errors.append("Another theme already uses that theme ID.")
            if data["pack"] not in PACKS:
                errors.append("Choose the characters for this theme.")
            if data["premium"] and not data["price"]:
                errors.append("Paid themes need a price, like $3.69.")
            if not data["position"].lstrip("-").isdigit():
                errors.append("Order must be a whole number.")
            if not data["free_lessons"].isdigit():
                errors.append("Free lessons must be a whole number, like 3.")
            # the theme's own characters (pack "custom")
            try:
                old_chars = json.loads(course["characters"] or "[]") if course else []
            except ValueError:
                old_chars = []
            chars, char_uploads = [], []
            for i in range(CHARACTER_SLOTS):
                old = old_chars[i] if i < len(old_chars) else {}
                up = request.files.get(f"char_file_{i}")
                up_ext = os.path.splitext(up.filename)[1].lower() if up and up.filename else ""
                if up_ext and up_ext not in IMAGE_EXTENSIONS:
                    errors.append(f"Character {i + 1}: pictures must be .png, .jpg or .webp files.")
                chars.append({"name": f.get(f"char_name_{i}", "").strip()[:30], "file": old.get("file", "")})
                char_uploads.append((up, up_ext))
            if data["pack"] == "custom":
                for i, (c, (up, up_ext)) in enumerate(zip(chars, char_uploads)):
                    if not c["name"]:
                        errors.append(f"Give character {i + 1} a name.")
                    if not c["file"] and not up_ext:
                        errors.append(f"Upload a picture for character {i + 1}.")
            upload = request.files.get("image")
            ext = os.path.splitext(upload.filename)[1].lower() if upload and upload.filename else ""
            if ext and ext not in IMAGE_EXTENSIONS:
                errors.append("Card pictures must be .png, .jpg or .webp files.")
            copy_from = f.get("copy_from", "")
            if errors:
                for e in errors:
                    flash(e, "error")
                shown = dict(data, image_file=course["image_file"] if course else "")
                return render_template("admin/course_form.html", course=shown, course_id=course_id,
                                       courses=all_courses(), copy_from=copy_from, chars=chars), 400
            data["position"] = int(data["position"])
            data["free_lessons"] = int(data["free_lessons"])
            for c, (up, up_ext) in zip(chars, char_uploads):
                if up_ext:
                    stored = f"{data['slug']}-char-{secrets.token_hex(4)}{up_ext}"
                    up.save(os.path.join(app.config["COURSE_IMAGE_DIR"], stored))
                    remove_upload("COURSE_IMAGE_DIR", c["file"])
                    c["file"] = stored
            data["characters"] = json.dumps(chars, ensure_ascii=False)
            data["image_file"] = course["image_file"] if course else ""
            if ext:
                stored = f"{data['slug']}-{secrets.token_hex(4)}{ext}"
                upload.save(os.path.join(app.config["COURSE_IMAGE_DIR"], stored))
                remove_upload("COURSE_IMAGE_DIR", data["image_file"])
                data["image_file"] = stored
            elif f.get("remove_image") and data["image_file"]:
                remove_upload("COURSE_IMAGE_DIR", data["image_file"])
                data["image_file"] = ""
            cols = list(data)
            if course_id is None:
                cur = db.execute(
                    f"INSERT INTO courses ({', '.join(cols)}, updated_at) VALUES ({', '.join('?' * len(cols))}, ?)",
                    [data[c] for c in cols] + [now_iso()])
                course_id = cur.lastrowid
                copied = 0
                if copy_from.isdigit():
                    copied = db.execute(
                        """INSERT INTO lessons (course_id, slug, position, emoji, name, title, subtitle, video_bundled,
                               default_code, examples, published, updated_at)
                           SELECT ?, slug, position, emoji, name, title, subtitle, video_bundled, default_code,
                               examples, published, ? FROM lessons WHERE course_id = ?""",
                        (course_id, now_iso(), int(copy_from))).rowcount
                flash(f"Theme '{data['name']}' added" + (f" with {copied} lessons copied." if copied else ". Now add its lessons."),
                      "success")
            else:
                db.execute(f"UPDATE courses SET {', '.join(c + ' = ?' for c in cols)}, updated_at = ? WHERE id = ?",
                           [data[c] for c in cols] + [now_iso(), course_id])
                flash(f"Theme '{data['name']}' saved. Installed apps get the change next time they open.", "success")
            db.commit()
            return redirect(url_for("admin_course", course_id=course_id))
        if course is None:
            next_pos = db.execute("SELECT COALESCE(MAX(position), 0) + 1 FROM courses").fetchone()[0]
            course = {"slug": "", "name": "", "tagline": "", "description": "", "features": "", "pack": "friends",
                      "price": "", "premium": 0, "free_lessons": 3, "image_file": "", "position": next_pos,
                      "published": 1, "characters": "[]"}
        try:
            chars = json.loads(course["characters"] or "[]")
        except ValueError:
            chars = []
        chars = (chars + [{"name": "", "file": ""}] * CHARACTER_SLOTS)[:CHARACTER_SLOTS]
        existing = all_courses()
        # a new theme starts with a copy of the first theme's lessons, so it shows in the app straight away
        default_copy = "" if course_id or not existing else str(existing[0]["id"])
        return render_template("admin/course_form.html", course=course, course_id=course_id,
                               courses=existing, copy_from=default_copy, chars=chars)

    @app.route("/admin/courses/<int:course_id>/copy", methods=["POST"])
    @admin_required
    def admin_course_copy(course_id):
        """Copies another theme's lessons into this one (lessons it already has with the same ID are kept)."""
        db = get_db()
        source = request.form.get("from", "")
        if not db.execute("SELECT 1 FROM courses WHERE id = ?", (course_id,)).fetchone():
            abort(404)
        if not source.isdigit() or int(source) == course_id:
            flash("Choose which theme to copy the lessons from.", "error")
            return redirect(url_for("admin_course", course_id=course_id))
        start = db.execute("SELECT COALESCE(MAX(position), 0) FROM lessons WHERE course_id = ?", (course_id,)).fetchone()[0]
        copied = db.execute(
            """INSERT OR IGNORE INTO lessons (course_id, slug, position, emoji, name, title, subtitle, video_bundled,
                   default_code, examples, published, updated_at)
               SELECT ?, slug, ? + position, emoji, name, title, subtitle, video_bundled, default_code, examples,
                   published, ? FROM lessons WHERE course_id = ?""",
            (course_id, start, now_iso(), int(source))).rowcount
        db.commit()
        flash(f"Copied {copied} lessons. Edit them to fit this theme." if copied else
              "Nothing new to copy: this theme already has those lessons.", "success" if copied else "info")
        return redirect(url_for("admin_course", course_id=course_id))

    @app.route("/admin/courses/<int:course_id>/delete", methods=["POST"])
    @admin_required
    def admin_course_delete(course_id):
        db = get_db()
        course = db.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
        if course:
            if db.execute("SELECT COUNT(*) FROM courses").fetchone()[0] <= 1:
                flash("You can't delete the only theme. Add another one first.", "error")
                return redirect(url_for("admin_courses"))
            for row in db.execute("SELECT video_file FROM lessons WHERE course_id = ?", (course_id,)).fetchall():
                remove_video(row["video_file"])
            remove_upload("COURSE_IMAGE_DIR", course["image_file"])
            for ch in json.loads(course["characters"] or "[]"):
                remove_upload("COURSE_IMAGE_DIR", ch.get("file"))
            db.execute("DELETE FROM courses WHERE id = ?", (course_id,))
            db.commit()
            flash(f"Theme '{course['name']}' and its lessons were deleted.", "info")
        return redirect(url_for("admin_courses"))

    # ---------------------------------------------------------- admin: lessons
    def current_course():
        """The course chosen in the admin (?course=ID), or the first one."""
        courses = all_courses()
        wanted = request.values.get("course", "")
        for c in courses:
            if str(c["id"]) == wanted:
                return c, courses
        return (courses[0] if courses else None), courses

    @app.route("/admin/lessons")
    @admin_required
    def admin_lessons():
        """Older links: lessons now live inside their theme."""
        course, _ = current_course()
        if course is None:
            flash("Add a theme first.", "info")
            return redirect(url_for("admin_course_edit"))
        return redirect(url_for("admin_course", course_id=course["id"]))

    @app.route("/admin/lessons/<int:lesson_id>/move", methods=["POST"])
    @admin_required
    def admin_lesson_move(lesson_id):
        """Moves a lesson one place up or down in its course."""
        db = get_db()
        lesson = db.execute("SELECT * FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
        if not lesson:
            abort(404)
        rows = db.execute("SELECT id FROM lessons WHERE course_id = ? ORDER BY position, id",
                          (lesson["course_id"],)).fetchall()
        order = [r["id"] for r in rows]
        i = order.index(lesson_id)
        j = i - 1 if request.form.get("direction") == "up" else i + 1
        if 0 <= j < len(order):
            order[i], order[j] = order[j], order[i]
            for pos, lid in enumerate(order, start=1):
                db.execute("UPDATE lessons SET position = ?, updated_at = ? WHERE id = ?", (pos, now_iso(), lid))
            db.commit()
        return redirect(url_for("admin_course", course_id=lesson["course_id"]) + f"#lesson-{lesson_id}")

    @app.route("/admin/lessons/new", methods=["GET", "POST"])
    @app.route("/admin/lessons/<int:lesson_id>", methods=["GET", "POST"])
    @admin_required
    def admin_lesson_edit(lesson_id=None):
        db = get_db()
        lesson = None
        if lesson_id is not None:
            lesson = db.execute("SELECT * FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
            if not lesson:
                abort(404)
        courses = all_courses()
        if not courses:
            flash("Add a theme first.", "info")
            return redirect(url_for("admin_course_edit"))
        if request.method == "POST":
            f = request.form
            clean = lambda k: f.get(k, "").replace("\r\n", "\n")
            data = {
                "course_id": f.get("course_id", "").strip(),
                "slug": f.get("slug", "").strip(),
                "position": f.get("position", "0").strip(),
                "emoji": f.get("emoji", "").strip()[:12],
                "name": f.get("name", "").strip(),
                "title": f.get("title", "").strip(),
                "subtitle": f.get("subtitle", "").strip(),
                "video_bundled": f.get("video_bundled", "").strip().replace("\\", "/"),
                "default_code": clean("default_code").rstrip(),
                "published": 1 if f.get("published") else 0,
            }
            examples, errors = [], []
            count = min(int(f.get("example_count", "0") or 0), 30)
            for i in range(count):
                ex = {k: clean(f"ex_{k}_{i}").strip() if k != "code" else clean(f"ex_code_{i}").rstrip()
                      for k in ("label", "explain", "output", "code")}
                if not any(ex.values()):
                    continue
                if not ex["label"] or not ex["code"]:
                    errors.append(f"Example {i + 1} needs a button label and some code.")
                examples.append(ex)
            if not any(str(c["id"]) == data["course_id"] for c in courses):
                errors.append("Choose which theme this lesson belongs to.")
            if not data["name"]:
                errors.append("Give the topic a name, like PRINT HELLO.")
            if not data["title"]:
                errors.append("Give the lesson a title.")
            if not re.fullmatch(r"[A-Za-z0-9_-]+", data["slug"]):
                errors.append("The lesson ID can only use letters, numbers, - and _, like lesson_loops.")
            if not data["position"].lstrip("-").isdigit():
                errors.append("Order must be a whole number.")
            if not examples:
                errors.append("Add at least one example.")
            upload = request.files.get("video")
            ext = os.path.splitext(upload.filename)[1].lower() if upload and upload.filename else ""
            if ext and ext not in VIDEO_EXTENSIONS:
                errors.append("Lesson videos must be .mp4 files.")
            if data["course_id"].isdigit() and db.execute(
                    "SELECT 1 FROM lessons WHERE course_id = ? AND slug = ? AND id != ?",
                    (int(data["course_id"]), data["slug"], lesson_id or 0)).fetchone():
                errors.append("Another lesson in this theme already uses that lesson ID. Choose a different one.")
            if errors:
                for e in errors:
                    flash(e, "error")
                shown = dict(data, examples=json.dumps(examples), video_file=lesson["video_file"] if lesson else "",
                             video_size=lesson["video_size"] if lesson else 0)
                return render_template("admin/lesson_form.html", lesson=shown, lesson_id=lesson_id,
                                       examples=examples, courses=courses), 400
            data["course_id"] = int(data["course_id"])
            data["position"] = int(data["position"])
            data["examples"] = json.dumps(examples, ensure_ascii=False)
            old_video = lesson["video_file"] if lesson else ""
            data["video_file"], data["video_size"] = old_video, lesson["video_size"] if lesson else 0
            if ext:
                stored = f"{data['slug']}-{secrets.token_hex(4)}{ext}"
                path = os.path.join(app.config["VIDEO_DIR"], stored)
                upload.save(path)
                remove_video(old_video)
                data["video_file"], data["video_size"] = stored, os.path.getsize(path)
            elif f.get("remove_video") and old_video:
                remove_video(old_video)
                data["video_file"], data["video_size"] = "", 0
            cols = list(data.keys())
            if lesson_id is None:
                db.execute(
                    f"INSERT INTO lessons ({', '.join(cols)}, updated_at) VALUES ({', '.join('?' * len(cols))}, ?)",
                    [data[c] for c in cols] + [now_iso()])
                flash(f"Lesson '{data['name']}' added. Installed apps get it next time they open.", "success")
            else:
                db.execute(
                    f"UPDATE lessons SET {', '.join(c + ' = ?' for c in cols)}, updated_at = ? WHERE id = ?",
                    [data[c] for c in cols] + [now_iso(), lesson_id])
                flash(f"Lesson '{data['name']}' saved. Installed apps get it next time they open.", "success")
            db.commit()
            return redirect(url_for("admin_course", course_id=data["course_id"]))
        if lesson is None:
            course, _ = current_course()
            next_pos = db.execute("SELECT COALESCE(MAX(position), 0) + 1 FROM lessons WHERE course_id = ?",
                                  (course["id"],)).fetchone()[0]
            lesson = {"course_id": course["id"], "slug": f"lesson{next_pos}", "position": next_pos, "emoji": "",
                      "name": "", "title": "", "subtitle": "", "video_bundled": "", "video_file": "", "video_size": 0,
                      "default_code": "", "examples": "[]", "published": 1}
        return render_template("admin/lesson_form.html", lesson=lesson, lesson_id=lesson_id,
                               examples=json.loads(lesson["examples"] or "[]"), courses=courses)

    @app.route("/admin/lessons/<int:lesson_id>/delete", methods=["POST"])
    @admin_required
    def admin_lesson_delete(lesson_id):
        db = get_db()
        row = db.execute("SELECT video_file, course_id FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
        course_id = row["course_id"] if row else None
        if row:
            remove_video(row["video_file"])
        db.execute("DELETE FROM lessons WHERE id = ?", (lesson_id,))
        db.commit()
        flash("Lesson deleted.", "info")
        return redirect(url_for("admin_course", course_id=course_id) if course_id else url_for("admin_courses"))

    @app.route("/admin/releases", methods=["GET", "POST"])
    @admin_required
    def admin_releases():
        db = get_db()
        if request.method == "POST":
            platform = request.form.get("platform", "")
            version = request.form.get("version", "").strip()
            min_supported = request.form.get("min_supported", "").strip()
            upload = request.files.get("file")
            errors = []
            if platform not in PLATFORMS:
                errors.append("Choose Windows or Mac.")
            if not VERSION_RE.match(version):
                errors.append("Write the version as three numbers, like 1.2.0.")
            if min_supported and not VERSION_RE.match(min_supported):
                errors.append("Write the oldest allowed version as three numbers, like 1.0.0, or leave it empty.")
            ext = os.path.splitext(upload.filename)[1].lower() if upload and upload.filename else ""
            if not upload or not upload.filename:
                errors.append("Choose the installer file to upload.")
            elif platform in PLATFORMS and ext not in PLATFORMS[platform]["extensions"]:
                allowed = ", ".join(sorted(PLATFORMS[platform]["extensions"]))
                errors.append(f"{PLATFORMS[platform]['label']} installers must be one of: {allowed}.")
            if not errors and db.execute("SELECT 1 FROM releases WHERE platform = ? AND version = ?",
                                         (platform, version)).fetchone():
                errors.append(f"Version {version} for {PLATFORMS[platform]['label']} already exists. "
                              "Use a higher version number.")
            if errors:
                for e in errors:
                    flash(e, "error")
                return redirect(url_for("admin_releases"))
            stored = f"{platform}-{version}-{secrets.token_hex(4)}{ext}"
            path = os.path.join(app.config["UPLOAD_DIR"], stored)
            upload.save(path)
            make_latest = bool(request.form.get("make_latest"))
            if make_latest:
                db.execute("UPDATE releases SET is_latest = 0 WHERE platform = ?", (platform,))
            db.execute(
                """INSERT INTO releases (platform, version, notes, filename, original_name, size,
                       min_supported, is_latest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (platform, version, request.form.get("notes", "").strip(), stored,
                 secure_filename(upload.filename) or stored, os.path.getsize(path),
                 min_supported, 1 if make_latest else 0, now_iso()))
            db.commit()
            msg = f"Uploaded {PLATFORMS[platform]['label']} version {version}."
            if make_latest:
                msg += " Installed apps will offer this update next time they open."
            flash(msg, "success")
            return redirect(url_for("admin_releases"))
        releases = db.execute("SELECT * FROM releases ORDER BY platform, created_at DESC").fetchall()
        return render_template("admin/releases.html", releases=releases)

    @app.route("/admin/releases/<int:release_id>/latest", methods=["POST"])
    @admin_required
    def admin_release_latest(release_id):
        db = get_db()
        rel = db.execute("SELECT * FROM releases WHERE id = ?", (release_id,)).fetchone()
        if not rel:
            abort(404)
        db.execute("UPDATE releases SET is_latest = 0 WHERE platform = ?", (rel["platform"],))
        db.execute("UPDATE releases SET is_latest = 1 WHERE id = ?", (release_id,))
        db.commit()
        flash(f"Version {rel['version']} is now the {PLATFORMS[rel['platform']]['label']} download.", "success")
        return redirect(url_for("admin_releases"))

    @app.route("/admin/releases/<int:release_id>/delete", methods=["POST"])
    @admin_required
    def admin_release_delete(release_id):
        db = get_db()
        rel = db.execute("SELECT * FROM releases WHERE id = ?", (release_id,)).fetchone()
        if not rel:
            abort(404)
        if rel["is_latest"]:
            flash("Make another version the current download before deleting this one.", "error")
            return redirect(url_for("admin_releases"))
        try:
            os.remove(os.path.join(app.config["UPLOAD_DIR"], rel["filename"]))
        except FileNotFoundError:
            pass
        db.execute("DELETE FROM releases WHERE id = ?", (release_id,))
        db.commit()
        flash(f"Deleted version {rel['version']}.", "info")
        return redirect(url_for("admin_releases"))

    @app.route("/admin/parents")
    @admin_required
    def admin_parents():
        q = request.args.get("q", "").strip()
        sql = """SELECT u.*, (SELECT COUNT(*) FROM downloads d WHERE d.user_id = u.id) AS download_count
                 FROM users u WHERE role = 'parent'"""
        params = []
        if q:
            sql += " AND (email LIKE ? OR name LIKE ?)"
            params = [f"%{q}%", f"%{q}%"]
        db = get_db()
        parents = db.execute(sql + " ORDER BY created_at DESC", params).fetchall()
        licences = {}
        for r in db.execute("SELECT user_id, course_id, licence FROM user_licences"):
            licences.setdefault(r["user_id"], {})[r["course_id"]] = r["licence"]
        paid = [c for c in all_courses() if c["premium"]]
        return render_template("admin/parents.html", parents=parents, q=q, licences=licences, paid_courses=paid)

    @app.route("/admin/parents/<int:user_id>/toggle", methods=["POST"])
    @admin_required
    def admin_parent_toggle(user_id):
        db = get_db()
        db.execute("UPDATE users SET is_active = 1 - is_active WHERE id = ? AND role = 'parent'", (user_id,))
        db.commit()
        flash("Account updated.", "success")
        return redirect(url_for("admin_parents"))

    @app.route("/admin/parents/<int:user_id>/plan", methods=["POST"])
    @admin_required
    def admin_parent_plan(user_id):
        plan = "premium" if request.form.get("plan") == "premium" else "free"
        db = get_db()
        if not db.execute("SELECT 1 FROM users WHERE id = ? AND role = 'parent'", (user_id,)).fetchone():
            abort(404)
        db.execute("UPDATE users SET plan = ? WHERE id = ?", (plan, user_id))
        for course in all_courses():
            licence = request.form.get(f"licence_{course['id']}", "").strip()[:120]
            if licence:
                db.execute("""INSERT INTO user_licences (user_id, course_id, licence, created_at) VALUES (?, ?, ?, ?)
                              ON CONFLICT(user_id, course_id) DO UPDATE SET licence = excluded.licence""",
                           (user_id, course["id"], licence, now_iso()))
            else:
                db.execute("DELETE FROM user_licences WHERE user_id = ? AND course_id = ?", (user_id, course["id"]))
        db.commit()
        flash("Plan and licences saved.", "success")
        return redirect(url_for("admin_parents"))

    @app.route("/admin/parents/<int:user_id>/delete", methods=["POST"])
    @admin_required
    def admin_parent_delete(user_id):
        db = get_db()
        db.execute("DELETE FROM users WHERE id = ? AND role = 'parent'", (user_id,))
        db.commit()
        flash("Parent account deleted.", "info")
        return redirect(url_for("admin_parents"))

    @app.route("/admin/parents/export.csv")
    @admin_required
    def admin_parents_csv():
        import csv
        import io
        rows = get_db().execute(
            "SELECT name, email, city, country, child_age, created_at, last_login, is_active FROM users "
            "WHERE role = 'parent' ORDER BY created_at").fetchall()
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["name", "email", "city", "country", "child_age", "registered", "last_login", "active"])
        for r in rows:
            w.writerow([r["name"], r["email"], r["city"] or "", r["country"] or "", r["child_age"] or "", r["created_at"], r["last_login"] or "",
                        "yes" if r["is_active"] else "no"])
        return app.response_class(buf.getvalue(), mimetype="text/csv",
                                  headers={"Content-Disposition": "attachment; filename=parents.csv"})

    # --------------------------------------------------------------- errors
    @app.errorhandler(404)
    def not_found(_e):
        return render_template("error.html", code=404,
                               message="We couldn't find that page. It may have moved."), 404

    @app.errorhandler(400)
    def bad_request(e):
        return render_template("error.html", code=400, message=e.description), 400

    @app.errorhandler(413)
    def too_large(_e):
        mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return render_template("error.html", code=413,
                               message=f"That file is bigger than {mb} MB. Upload a smaller installer."), 413

    # ------------------------------------------------------------------ CLI
    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.option("--name", prompt=True, default="Admin")
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True)
    def create_admin(email, name, password):
        """Create an admin account, or promote an existing account to admin."""
        if len(password) < 10:
            raise click.ClickException("Admin passwords need at least 10 characters.")
        with app.app_context():
            make_admin(email, name, password)
        click.echo(f"Admin ready: {email}")

    return app


def make_admin(email, name, password):
    db = get_db()
    email = email.strip().lower()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        db.execute("UPDATE users SET role = 'admin', password_hash = ?, is_active = 1 WHERE id = ?",
                   (generate_password_hash(password), existing["id"]))
    else:
        db.execute("INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
                   (email, name, generate_password_hash(password), now_iso()))
    db.commit()


def bootstrap_admin_from_env(app):
    """On hosts without a shell, set ADA_ADMIN_EMAIL and ADA_ADMIN_PASSWORD once.
    The admin is only created if no admin exists yet."""
    email, password = os.environ.get("ADA_ADMIN_EMAIL"), os.environ.get("ADA_ADMIN_PASSWORD")
    if not email or not password:
        return
    with app.app_context():
        if not get_db().execute("SELECT 1 FROM users WHERE role = 'admin'").fetchone():
            make_admin(email, "Admin", password)


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("ADA_ENV", "development") != "production")
