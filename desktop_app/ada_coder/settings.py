"""Remembers the child's choices and progress between visits (settings.json in the data folder)."""
import json
import os

from .paths import data_dir

DEFAULTS = {
    "dark_mode": False,
    "music": False,
    "voice": True,
    "course": None,       # id of the course the child is doing
    "completed": [],      # "course:lesson" for every lesson finished (ran code without errors)
    "last_lessons": {},   # course id -> the lesson the child had open last
    "theme": None,        # from older versions: the character pack picked from the menu
    "last_lesson": None,  # from older versions
    "remember_me": False,
    "user": {},           # {"full_name": ..., "email": ...}
    "licences": [],       # ids of the paid themes the family has bought (from the website log-in)
    "intro_seen": False,
}


class Settings:
    def __init__(self, path=None):
        self.path = path or os.path.join(data_dir(), "settings.json")
        self.values = dict(DEFAULTS)
        try:
            with open(self.path, encoding="utf-8") as f:
                saved = json.load(f)
            if isinstance(saved, dict):
                self.values.update({k: v for k, v in saved.items() if k in DEFAULTS})
        except (OSError, ValueError):
            pass
        self._upgrade()

    def _upgrade(self):
        """Settings from version 1.1 had one course: keep the child's progress in the course they used."""
        old = [c for c in self.values["completed"] if ":" not in str(c)]
        if old or self.values["theme"] or self.values["last_lesson"]:
            course = self.values["course"] or self.values["theme"] or "friends"
            self.values["course"] = course
            self.values["completed"] = [c for c in self.values["completed"] if ":" in str(c)] + \
                [f"{course}:{c}" for c in old]
            if self.values["last_lesson"]:
                self.values["last_lessons"] = dict(self.values["last_lessons"], **{course: self.values["last_lesson"]})
            self.values["theme"] = self.values["last_lesson"] = None
            self.save()

    def __getitem__(self, key):
        return self.values[key]

    def __setitem__(self, key, value):
        self.values[key] = value
        self.save()

    def save(self):
        tmp = self.path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.values, f, ensure_ascii=False, indent=1)
            os.replace(tmp, self.path)
        except OSError:
            pass  # a read-only disk shouldn't stop the lesson

    def mark_completed(self, course_id, lesson_id):
        key = f"{course_id}:{lesson_id}"
        done = list(self.values["completed"])
        if key not in done:
            done.append(key)
            self["completed"] = done
            return True
        return False

    def is_completed(self, course_id, lesson_id):
        return f"{course_id}:{lesson_id}" in self.values["completed"]

    def last_lesson(self, course_id):
        return (self.values["last_lessons"] or {}).get(course_id)

    def set_last_lesson(self, course_id, lesson_id):
        self["last_lessons"] = dict(self.values["last_lessons"] or {}, **{course_id: lesson_id})
