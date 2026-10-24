"""Which lessons are locked, and the ways to open them.

Lesson 1 is always free. Lessons 2..N are locked or not:

  1. app.json → "locks" → "locked_lessons" says which are locked when the app is new ("2-17").
  2. A grown-up can lock or unlock single lessons in the app (avatar menu → 🔐, needs the admin PIN).
     That is saved on this computer and wins over app.json.
  3. A licence key (PAFK-XXXX-XXXX-XXXX, made with apps/make_key.py) unlocks every lesson on this
     computer, for good.
  4. A parent account from the website with a licence for this app's theme (server.theme_id) unlocks
     every lesson while the parent is logged in.

The saved file is signed with the app's licence secret, so editing it by hand does not unlock anything.
No PyQt here: the tests use it directly.
"""
import hashlib
import hmac
import json
import os
import secrets

from appconfig import parse_lesson_numbers

# No 0/O, 1/I/L: easy to read out and type
KEY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def _check_group(secret, app_id, body):
    digest = hmac.new(secret.encode(), f"{app_id}:{body}".encode(), hashlib.sha256).digest()
    return "".join(KEY_ALPHABET[b % len(KEY_ALPHABET)] for b in digest[:4])


def make_key(secret, app_id, prefix):
    body = "".join(secrets.choice(KEY_ALPHABET) for _ in range(8))
    return f"{prefix}-{body[:4]}-{body[4:]}-{_check_group(secret, app_id, body)}"


def normalise_key(key):
    return "".join(ch for ch in (key or "").upper() if ch.isalnum())


def key_is_valid(key, secret, app_id, prefix):
    if not secret:
        return False
    k = normalise_key(key)
    p = normalise_key(prefix)
    if not k.startswith(p) or len(k) != len(p) + 12:
        return False
    body, check = k[len(p):len(p) + 8], k[len(p) + 8:]
    return hmac.compare_digest(check, _check_group(secret, app_id, body))


def pretty_key(key, prefix):
    k = normalise_key(key)[len(normalise_key(prefix)):]
    return f"{prefix}-{k[:4]}-{k[4:8]}-{k[8:]}"


class LessonLocks:
    def __init__(self, config, lesson_count, path):
        locks = config["locks"]
        self.app_id = config["id"]
        self.secret = str(locks.get("licence_secret") or "")
        self.prefix = str(locks.get("licence_prefix") or "KEY")
        self.pin = str(locks.get("admin_pin") or "")
        self.theme_id = str((config.get("server") or {}).get("theme_id") or "")
        self.count = lesson_count
        self.default_locked = parse_lesson_numbers(locks.get("locked_lessons", "2-%d" % lesson_count), lesson_count)
        self.path = path
        self.overrides = {}      # lesson number -> True (locked) / False (unlocked), set by a grown-up
        self.licence_key = ""
        self.account_unlocked = False   # not saved: only while a parent with a licence is logged in
        self._load()

    # ---------- saved file ----------
    def _sign(self, data):
        text = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hmac.new((self.secret + ":" + self.app_id).encode(), text.encode(), hashlib.sha256).hexdigest()

    def _load(self):
        try:
            with open(self.path, encoding="utf-8") as f:
                saved = json.load(f)
        except (OSError, ValueError):
            return
        if not isinstance(saved, dict):
            return
        key = saved.get("licence_key") or ""
        if key and key_is_valid(key, self.secret, self.app_id, self.prefix):
            self.licence_key = pretty_key(key, self.prefix)
        data = {"overrides": saved.get("overrides") or {}}
        if hmac.compare_digest(str(saved.get("sig") or ""), self._sign(data)):
            try:
                self.overrides = {int(n): bool(v) for n, v in data["overrides"].items() if 2 <= int(n) <= self.count}
            except (TypeError, ValueError):
                self.overrides = {}

    def save(self):
        data = {"overrides": {str(n): v for n, v in sorted(self.overrides.items())}}
        out = dict(data, licence_key=self.licence_key, sig=self._sign(data))
        tmp = self.path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, indent=1)
            os.replace(tmp, self.path)
        except OSError:
            pass

    # ---------- questions ----------
    @property
    def has_full_access(self):
        return bool(self.licence_key) or self.account_unlocked

    def is_locked_by_setting(self, number):
        """Locked by app.json or by the grown-up's choice (ignores licences)."""
        if number <= 1 or number > self.count:
            return False
        if number in self.overrides:
            return self.overrides[number]
        return number in self.default_locked

    def is_locked(self, number):
        """number: 1 for the first lesson in the list."""
        if self.has_full_access:
            return False
        return self.is_locked_by_setting(number)

    def locked_numbers(self):
        return [n for n in range(2, self.count + 1) if self.is_locked(n)]

    def check_pin(self, pin):
        return bool(self.pin) and hmac.compare_digest(str(pin).strip(), self.pin)

    # ---------- changes ----------
    def set_locked(self, number, locked):
        if 2 <= number <= self.count:
            if bool(locked) == (number in self.default_locked):
                self.overrides.pop(number, None)   # same as app.json: nothing to remember
            else:
                self.overrides[number] = bool(locked)
            self.save()

    def set_many(self, locked_numbers):
        """Lock exactly these lesson numbers (2..N), unlock the rest."""
        wanted = {int(n) for n in locked_numbers}
        for n in range(2, self.count + 1):
            if (n in wanted) == (n in self.default_locked):
                self.overrides.pop(n, None)
            else:
                self.overrides[n] = n in wanted
        self.save()

    def lock_all(self):
        self.set_many(range(2, self.count + 1))

    def unlock_all(self):
        self.set_many([])

    def reset_to_app_settings(self):
        self.overrides = {}
        self.save()

    def enter_key(self, key):
        if not key_is_valid(key, self.secret, self.app_id, self.prefix):
            return False
        self.licence_key = pretty_key(key, self.prefix)
        self.save()
        return True

    def remove_key(self):
        self.licence_key = ""
        self.save()

    def set_account_licences(self, licences):
        """licences: the theme IDs the parent's website account has (from /api/v3/login)."""
        self.account_unlocked = bool(self.theme_id) and self.theme_id in (licences or [])
        return self.account_unlocked
