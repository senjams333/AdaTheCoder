"""Courses and their lessons.

The app ships with the courses in data/courses.json (each using the lessons in data/lessons.json).
Once the app has been online, the courses made in the website admin (/api/v3/courses) replace them:
    {"id", "name", "tagline", "pack", "position", "premium", "price", "lessons": [...]}

Every lesson has this shape:
    {"id", "position", "emoji", "name", "title", "subtitle",
     "video": {"bundled": "vid/video1.mp4", "file": "...", "url": "..."},
     "default_code", "examples": [{"label", "explain", "output", "code"}, ...]}
"""
import json
import os

from . import sync
from .config import SERVER_URL
from .paths import project_file


def load_bundled():
    with open(project_file("data", "lessons.json"), encoding="utf-8") as f:
        return json.load(f)["lessons"]


def _clean(lessons):
    lessons = [l for l in lessons or [] if l.get("id") and l.get("title")]
    return sorted(lessons, key=lambda l: l.get("position", 0))


def load_bundled_courses():
    with open(project_file("data", "courses.json"), encoding="utf-8") as f:
        courses = json.load(f)["courses"]
    lessons = load_bundled()
    return [dict(c, lessons=[dict(l) for l in lessons]) for c in courses]


def load_courses():
    """Courses last downloaded from the website if there are any, otherwise the ones inside the app.
    Courses without any lessons are left out."""
    courses = []
    for c in sync.saved_courses() or load_bundled_courses():
        if not c.get("id"):
            continue
        c = dict(c, lessons=_clean(c.get("lessons")))
        c.setdefault("name", c["id"])
        c.setdefault("tagline", "")
        c.setdefault("pack", "friends")
        if not c.get("buy_url"):
            c["buy_url"] = f"{SERVER_URL.rstrip('/')}/account?theme={c['id']}"
        if c["lessons"]:
            courses.append(c)
    return sorted(courses, key=lambda c: c.get("position", 0))


def characters(course):
    """Who appears for this theme: a character pack built into the app, or (for themes made in the
    website admin with their own characters) the pictures the app downloaded."""
    from .themes import get_theme
    if course.get("pack") == "custom" and course.get("characters"):
        chars = []
        for c, emoji in zip(course["characters"], ("🚀", "🧑‍🚀", "🪐")):
            path = os.path.join(sync.characters_dir(), os.path.basename(c.get("file") or ""))
            # a character whose picture hasn't downloaded yet shows an emoji
            chars.append((c.get("name") or "", path if c.get("file") and os.path.exists(path) else "", emoji))
        chars = (chars * 3)[:3]
        return {"name": course.get("name", ""), "tagline": course.get("tagline", ""), "hero": chars,
                "guide": chars[0][1], "oops": chars[0][1], "success": chars[-1][1]}
    return get_theme(course.get("pack"))


def free_count(course):
    """How many lessons can be played without a licence (None = all of them)."""
    if not course.get("premium"):
        return None
    try:
        return max(0, int(course.get("free_lessons", 3) if course.get("free_lessons") is not None else 3))
    except (TypeError, ValueError):
        return 3


def is_unlocked(course, index, licences):
    """Lesson number index (0 = first) can be played: free theme, bought theme, or a free lesson to try."""
    free = free_count(course)
    return free is None or course["id"] in (licences or []) or index < free


def owns(course, licences):
    return free_count(course) is None or course["id"] in (licences or [])


def find_course(courses, course_id):
    """The course with this id, or the first course."""
    for c in courses:
        if c["id"] == course_id:
            return c
    return courses[0] if courses else None


def video_path(lesson):
    """The video to play: a newer one downloaded from the website, otherwise the one inside the app.
    Returns None if neither exists (the lesson then opens straight on the examples)."""
    video = lesson.get("video") or {}
    if video.get("file"):
        downloaded = os.path.join(sync.videos_dir(), video["file"])
        if os.path.exists(downloaded):
            return downloaded
    bundled = video.get("bundled")
    if bundled:
        path = project_file(*bundled.replace("\\", "/").split("/"))
        if os.path.exists(path):
            return path
    return None


def for_page(lesson, number, count):
    """What the lesson page needs (see updateLessonData in assets/web/lesson.js)."""
    return {
        "title": lesson["title"],
        "subtitle": lesson.get("subtitle", ""),
        "number": number,
        "count": count,
        "examples": [{"label": e.get("label", ""), "explain": e.get("explain", ""),
                      "output": e.get("output", ""), "code": e.get("code", "")}
                     for e in lesson.get("examples", [])],
        "defaultCode": lesson.get("default_code", ""),
    }
