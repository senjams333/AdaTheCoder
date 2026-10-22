"""SQLite database helpers for Ada The Coder (standard library only)."""
import json
import os
import sqlite3
from datetime import datetime, timezone

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'admin')),
    child_name TEXT,
    child_age INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    plan TEXT NOT NULL DEFAULT 'free',
    license_friends TEXT,
    license_fairies TEXT,
    city TEXT,
    country TEXT,
    created_at TEXT NOT NULL,
    last_login TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,              -- the course id the app uses, e.g. friends
    name TEXT NOT NULL,                     -- e.g. Friends Adventure
    tagline TEXT NOT NULL DEFAULT '',       -- one line, shown in the app and on the account page
    description TEXT NOT NULL DEFAULT '',
    features TEXT NOT NULL DEFAULT '',      -- one selling point per line
    pack TEXT NOT NULL DEFAULT 'friends',   -- which characters the app shows (see PACKS in app.py)
    price TEXT NOT NULL DEFAULT '',         -- e.g. $3.69
    premium INTEGER NOT NULL DEFAULT 0,     -- 1 = parents buy a licence for it on the account page
    image_file TEXT NOT NULL DEFAULT '',    -- optional card picture uploaded in the admin
    free_lessons INTEGER NOT NULL DEFAULT 3, -- paid themes: how many lessons children can try for free
    characters TEXT NOT NULL DEFAULT '[]',  -- pack 'custom': [{"name", "file"}] uploaded in the admin
    position INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,                     -- the lesson id the app uses, e.g. lesson1
    position INTEGER NOT NULL DEFAULT 0,    -- order in the app's lesson list
    emoji TEXT NOT NULL DEFAULT '',         -- topic emoji in the lesson list
    name TEXT NOT NULL,                     -- topic name in the lesson list, e.g. PRINT HELLO
    title TEXT NOT NULL,                    -- big title above the lesson
    subtitle TEXT NOT NULL DEFAULT '',
    video_bundled TEXT NOT NULL DEFAULT '', -- video shipped inside the app, e.g. vid/video1.mp4
    video_file TEXT NOT NULL DEFAULT '',    -- video uploaded in the admin (wins over the bundled one)
    video_size INTEGER NOT NULL DEFAULT 0,
    default_code TEXT NOT NULL DEFAULT '',
    examples TEXT NOT NULL DEFAULT '[]',    -- JSON list of {label, explain, output, code}
    published INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    UNIQUE (course_id, slug)
);

CREATE TABLE IF NOT EXISTS user_licences (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    licence TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL CHECK (platform IN ('windows', 'mac')),
    version TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    min_supported TEXT NOT NULL DEFAULT '',
    is_latest INTEGER NOT NULL DEFAULT 0,
    downloads INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE (platform, version)
);

CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    release_id INTEGER REFERENCES releases(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
);
"""

DEFAULT_SETTINGS = {
    "hero_title": "Your child's first lines of real code",
    "hero_subtitle": (
        "Ada The Coder teaches Python to children aged 6 to 11 with short, playful "
        "lessons. Grown-ups sign up and install the app; kids start making things "
        "in the very first lesson."
    ),
    "site_banner": "",
    "app_message": "",
    "parents_note": (
        "There are no ads, no chat and no strangers in Ada The Coder. Your child "
        "never needs an account, and their progress is saved on your own computer."
    ),
    "contact_email": "ada@adathecoder.com",
    "author_name": "Senjam SD",
    "author_note": (
        "I made Ada The Coder because I believe every child can learn to code, and that "
        "the very first steps should feel like play, not homework.\n\n"
        "Many coding tools for young children use blocks. Blocks are a fine start, but lots "
        "of kids are ready to type real code much earlier than we expect. They just need a "
        "patient, friendly place to begin. That's what Ada, Byte and Twinkle are here for: "
        "short lessons, simple words, and a cheer for every small win.\n\n"
        "There are no ads, no chats and nothing to buy inside the app. Just your child, "
        "their ideas, and a computer that does what they tell it to.\n\n"
        "If you have a question, an idea, or a story about your child's first program, "
        "I'd love to hear it."
    ),
}


DEFAULT_COURSES = [
    {"slug": "friends", "name": "Friends Adventure", "pack": "friends", "price": "$3.69", "premium": 1,
     "tagline": "Code, explore and learn together with fun friends and exciting challenges.",
     "description": "Tom, Penny the snake and Teddy join your child on a coding adventure. Every lesson "
                    "becomes a little quest, with friends cheering from the side.",
     "features": "Tom, Penny and Teddy guide every lesson\nBright adventure colours\nAll 17 beginner lessons"},
    {"slug": "fairies", "name": "Fairies & Angels", "pack": "fairies", "price": "$3.69", "premium": 1,
     "tagline": "Enter a magical world where imagination and coding grow together.",
     "description": "Twinkle, Fern and Sparkle the unicorn turn coding practice into a magical garden, "
                    "with a shiny star for every challenge solved.",
     "features": "Twinkle cheers on every success\nSparkly pink and gold look\nAll 17 beginner lessons"},
    {"slug": "coding_club", "name": "Ada's Coding Club", "pack": "coding_club", "price": "", "premium": 0,
     "tagline": "Code along with Ada and Byte the owl. Included free.",
     "description": "The free course that comes with every download.",
     "features": "Ada and Byte the owl\nAll 17 beginner lessons\nFree with the app"},
]


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(current_app.config["DATABASE"])
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


def close_db(_exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def _seed_lessons(app):
    seed_path = os.path.join(app.root_path, "data", "default_lessons.json")
    if not os.path.exists(seed_path):
        return []
    with open(seed_path, encoding="utf-8") as f:
        return json.load(f)["lessons"]


def _insert_lessons(conn, course_id, lessons):
    for item in lessons:
        conn.execute(
            """INSERT INTO lessons (course_id, slug, position, emoji, name, title, subtitle, video_bundled,
                   default_code, examples, published, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
            (course_id, item["slug"], item["position"], item["emoji"], item["name"], item["title"],
             item["subtitle"], item.get("video_bundled", ""), item["default_code"],
             json.dumps(item["examples"], ensure_ascii=False), now_iso()),
        )


def init_db(app):
    os.makedirs(os.path.dirname(app.config["DATABASE"]) or ".", exist_ok=True)
    conn = sqlite3.connect(app.config["DATABASE"])
    try:
        # Lessons from the first version of the site used a different layout: keep them aside.
        cols = [r[1] for r in conn.execute("PRAGMA table_info(lessons)")]
        if cols and "examples" not in cols:
            conn.execute("ALTER TABLE lessons RENAME TO lessons_old_format")
            cols = []
        # Before courses existed, all lessons were one list: move them into the first course below.
        old_single_list = bool(cols) and "course_id" not in cols
        if old_single_list:
            conn.execute("ALTER TABLE lessons RENAME TO lessons_single_list")
        had_courses = bool(conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'courses'").fetchone())
        conn.executescript(SCHEMA)
        # Plan and theme licences were added later: upgrade older databases in place.
        user_cols = [r[1] for r in conn.execute("PRAGMA table_info(users)")]
        for col, ddl in (("plan", "TEXT NOT NULL DEFAULT 'free'"), ("license_friends", "TEXT"),
                         ("license_fairies", "TEXT"),
                         ("city", "TEXT"), ("country", "TEXT")):
            if col not in user_cols:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {ddl}")
        course_cols = [r[1] for r in conn.execute("PRAGMA table_info(courses)")]
        for col, ddl in (("free_lessons", "INTEGER NOT NULL DEFAULT 3"), ("characters", "TEXT NOT NULL DEFAULT '[]'")):
            if col not in course_cols:
                conn.execute(f"ALTER TABLE courses ADD COLUMN {col} {ddl}")
        for key, value in DEFAULT_SETTINGS.items():
            conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, value))

        if not had_courses and conn.execute("SELECT COUNT(*) FROM courses").fetchone()[0] == 0:
            seed = _seed_lessons(app)
            for position, course in enumerate(DEFAULT_COURSES, start=1):
                cur = conn.execute(
                    """INSERT INTO courses (slug, name, tagline, description, features, pack, price, premium,
                           position, published, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
                    (course["slug"], course["name"], course["tagline"], course["description"], course["features"],
                     course["pack"], course["price"], course["premium"], position, now_iso()))
                if old_single_list and position == 1:
                    # keep the lessons (and uploaded videos) the admin already edited
                    conn.execute(
                        """INSERT INTO lessons (course_id, slug, position, emoji, name, title, subtitle, video_bundled,
                               video_file, video_size, default_code, examples, published, updated_at)
                           SELECT ?, slug, position, emoji, name, title, subtitle, video_bundled, video_file,
                               video_size, default_code, examples, published, updated_at FROM lessons_single_list""",
                        (cur.lastrowid,))
                else:
                    _insert_lessons(conn, cur.lastrowid, seed)
            # licences bought before courses existed
            for slug, column in (("friends", "license_friends"), ("fairies", "license_fairies")):
                conn.execute(
                    f"""INSERT OR IGNORE INTO user_licences (user_id, course_id, licence, created_at)
                        SELECT u.id, c.id, u.{column}, ? FROM users u JOIN courses c ON c.slug = ?
                        WHERE u.{column} IS NOT NULL AND u.{column} != ''""", (now_iso(), slug))
        if old_single_list:
            conn.execute("DROP TABLE lessons_single_list")
        conn.commit()
    finally:
        conn.close()


def get_settings():
    rows = get_db().execute("SELECT key, value FROM settings").fetchall()
    data = dict(DEFAULT_SETTINGS)
    data.update({r["key"]: r["value"] for r in rows})
    return data


def set_setting(key, value):
    db = get_db()
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    db.commit()
