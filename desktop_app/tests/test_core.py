"""Checks for the parts of the app that don't need a screen. Run from the project folder:
    python -m unittest discover tests
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.environ["XDG_DATA_HOME"] = tempfile.mkdtemp()   # keep test settings away from real ones (Linux)
os.environ["APPDATA"] = os.environ["XDG_DATA_HOME"]  # (Windows)

from ada_coder import child, lessons, sync          # noqa: E402
from ada_coder.friendly import explain             # noqa: E402
from ada_coder.settings import Settings            # noqa: E402
from ada_coder.themes import THEMES                # noqa: E402


def run_program(source, typed=""):
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "p.py")
        with open(path, "w", encoding="utf-8") as f:
            f.write(source)
        env = dict(os.environ, PYTHONPATH=ROOT, PYTHONIOENCODING="utf-8")
        out = subprocess.run([sys.executable, "-u", "-m", "ada_coder.child", path], input=typed,
                             capture_output=True, text=True, encoding="utf-8", cwd=tmp, env=env, timeout=30)
    return child.parse(out.stdout)


class LessonTests(unittest.TestCase):
    def test_bundled_course(self):
        course = lessons.load_bundled()
        self.assertEqual(len(course), 17)
        ids = [l["id"] for l in course]
        self.assertEqual(len(ids), len(set(ids)))
        for lesson in course:
            self.assertTrue(lesson["title"] and lesson["name"])
            self.assertTrue(lesson["examples"], lesson["id"])
            for ex in lesson["examples"]:
                self.assertEqual(set(ex), {"label", "explain", "output", "code"})

    def test_page_data(self):
        info = lessons.for_page(lessons.load_bundled()[1], 2, 17)
        self.assertEqual((info["number"], info["count"]), (2, 17))
        self.assertEqual(set(info), {"title", "subtitle", "number", "count", "examples", "defaultCode"})

    def test_missing_video_is_none(self):
        self.assertIsNone(lessons.video_path({"video": {"bundled": "vid/not-here.mp4"}}))

    def test_bundled_courses(self):
        courses = lessons.load_courses()
        self.assertEqual([c["id"] for c in courses], ["friends", "fairies", "coding_club"])
        for c in courses:
            self.assertIn(c["pack"], THEMES)
            self.assertEqual(len(c["lessons"]), 17)
        self.assertEqual(lessons.find_course(courses, "fairies")["name"], "Fairies & Angels")
        self.assertEqual(lessons.find_course(courses, "gone")["id"], "friends")

    def test_downloaded_courses_win(self):
        lesson = {"id": "new1", "position": 1, "emoji": "🐢", "name": "TURTLE", "title": "🐢 TURTLE",
                  "examples": [{"label": "1", "explain": "", "output": "", "code": "print(1)"}]}
        downloaded = [{"id": "space", "name": "Space Coders", "tagline": "To the stars", "pack": "coding_club",
                       "position": 2, "lessons": [lesson]},
                      {"id": "empty", "name": "Nothing yet", "pack": "friends", "position": 1, "lessons": []}]
        cache = os.path.join(sync.data_dir(), "courses_cache.json")
        with open(cache, "w", encoding="utf-8") as f:
            json.dump({"revision": "x", "courses": downloaded}, f)
        try:
            courses = lessons.load_courses()
            self.assertEqual([c["id"] for c in courses], ["space"])   # a course with no lessons is left out
            self.assertEqual([l["id"] for l in courses[0]["lessons"]], ["new1"])
        finally:
            os.remove(cache)
        self.assertEqual(len(lessons.load_courses()), 3)

    def test_free_lessons_and_licences(self):
        paid = {"id": "space", "premium": True, "free_lessons": 3, "lessons": []}
        free = {"id": "club", "premium": False, "lessons": []}
        self.assertEqual([lessons.is_unlocked(paid, i, []) for i in range(5)], [True, True, True, False, False])
        self.assertTrue(lessons.is_unlocked(paid, 10, ["space"]))   # bought
        self.assertTrue(lessons.is_unlocked(free, 10, []))
        self.assertFalse(lessons.owns(paid, []))
        self.assertTrue(lessons.owns(free, []))
        self.assertIn("/account?theme=", lessons.load_courses()[0]["buy_url"])

    def test_theme_with_own_characters(self):
        course = {"id": "space", "pack": "custom", "characters": [
            {"name": "Astro", "file": "astro-test.png"}, {"name": "Comet", "file": ""}, {"name": "Nova", "file": "x.png"}]}
        path = os.path.join(sync.characters_dir(), "astro-test.png")
        open(path, "wb").close()
        try:
            chars = lessons.characters(course)
        finally:
            os.remove(path)
        self.assertEqual([c[0] for c in chars["hero"]], ["Astro", "Comet", "Nova"])
        self.assertEqual(chars["guide"], path)
        self.assertEqual(chars["success"], "")          # not downloaded yet: an emoji shows instead
        self.assertEqual(lessons.characters({"pack": "fairies"})["success"], "sparkle.png")

    def test_server_option_works_on_first_launch(self):
        """run.py --server must take effect straight away, not only from the second launch."""
        data = tempfile.mkdtemp()
        env = dict(os.environ, XDG_DATA_HOME=data, APPDATA=data, PYTHONIOENCODING="utf-8")
        env.pop("ADA_SERVER_URL", None)
        out = subprocess.run([sys.executable, os.path.join(ROOT, "run.py"), "--server", "http://127.0.0.1:9", "--check"],
                             capture_output=True, text=True, encoding="utf-8", env=env, cwd=ROOT, timeout=60).stdout
        self.assertIn("Website the app uses: http://127.0.0.1:9", out)
        self.assertIn("FAILED, can't reach", out)

    def test_login_without_internet(self):
        old = sync.SERVER_URL
        sync.SERVER_URL = "http://127.0.0.1:9"   # nothing listens here
        try:
            self.assertIsNone(sync.login("kid@example.com", "pw"))
            self.assertIsNone(sync.register({"name": "A", "email": "a@example.com", "password": "goodpass1"}))
        finally:
            sync.SERVER_URL = old

    def test_every_example_runs(self):
        """Every example in the course runs without an error (OpenCV ones are skipped: they need a screen)."""
        for lesson in lessons.load_bundled():
            for ex in lesson["examples"]:
                if "cv2" in ex["code"]:
                    continue  # needs a screen for the picture windows
                typed = "5\n6\n" * 5 if "int(" in ex["code"] else "Ada\n" * 10
                result = run_program(ex["code"], typed=typed)
                self.assertIsNone(result["error"], f"{lesson['id']} {ex['label']}: {result['error']}")
                self.assertTrue(result["ok"], f"{lesson['id']} {ex['label']}")


class RunnerTests(unittest.TestCase):
    def test_print(self):
        r = run_program('print("Hello World! 🌍")')
        self.assertEqual(r["text"], "Hello World! 🌍\n")
        self.assertTrue(r["ok"])

    def test_input(self):
        r = run_program('name = input("Name? ")\nprint("Hi", name)', typed="Ada\n")
        self.assertIn("Hi Ada", r["text"])

    def test_waiting_for_input(self):
        state = child.parse("Hello\nWhat is your name? " + child.WAIT + "\n")
        self.assertTrue(state["waiting"])
        self.assertEqual((state["text"], state["prompt"]), ("Hello\n", "What is your name? "))

    def test_errors_have_line_numbers(self):
        cases = {
            'print("hi"': ("SyntaxError", 1, "bracket"),
            'x = 1\nprnt(x)': ("NameError", 2, "spelling"),
            'age = 8\nprint("I am " + age)': ("TypeError", 2, "str("),
            'for i in range(3):\nprint(i)': ("IndentationError", 2, "4 spaces"),
            'if 3 > 2\n    print(1)': ("SyntaxError", 1, "colon"),
            'print(5/0)': ("ZeroDivisionError", 1, "zero"),
            'n = int("abc")': ("ValueError", 1, "whole number"),
            'x = [1, 2]\nprint(x[5])': ("IndexError", 2, "starts at 0"),
        }
        for source, (_, line, word) in cases.items():
            err = run_program(source)["error"]
            self.assertIsNotNone(err, source)
            self.assertEqual(err["line"], line, source)
            self.assertIn(word, err["hint"], source)

    def test_output_before_an_error_is_kept(self):
        r = run_program('print("one")\nprint(1/0)')
        self.assertEqual(r["text"], "one\n")
        self.assertIsNotNone(r["error"])


class FriendlyTests(unittest.TestCase):
    def test_curly_quotes(self):
        self.assertIn("straight quotes", explain("SyntaxError", "invalid character '“' (U+201C)", 1, 'print(“hi”)')["hint"])

    def test_missing_module(self):
        self.assertIn("OpenCV", explain("ModuleNotFoundError", "No module named 'cv2'")["hint"])

    def test_unknown_error(self):
        info = explain("WeirdError", "something odd", 3)
        self.assertEqual(info["line"], 3)


class SettingsTests(unittest.TestCase):
    def test_saved_between_runs(self):
        path = os.path.join(tempfile.mkdtemp(), "settings.json")
        s = Settings(path)
        s["dark_mode"] = True
        self.assertTrue(s.mark_completed("friends", "lesson1"))
        self.assertFalse(s.mark_completed("friends", "lesson1"))
        s.set_last_lesson("fairies", "lesson3")
        again = Settings(path)
        self.assertTrue(again["dark_mode"])
        self.assertTrue(again.is_completed("friends", "lesson1"))
        self.assertFalse(again.is_completed("fairies", "lesson1"))   # progress is kept per course
        self.assertEqual(again.last_lesson("fairies"), "lesson3")

    def test_progress_from_older_version_kept(self):
        path = os.path.join(tempfile.mkdtemp(), "settings.json")
        with open(path, "w") as f:
            json.dump({"theme": "fairies", "completed": ["lesson1", "lesson2"], "last_lesson": "lesson2"}, f)
        s = Settings(path)
        self.assertEqual(s["course"], "fairies")
        self.assertTrue(s.is_completed("fairies", "lesson2"))
        self.assertEqual(s.last_lesson("fairies"), "lesson2")

    def test_broken_file_falls_back_to_defaults(self):
        path = os.path.join(tempfile.mkdtemp(), "settings.json")
        with open(path, "w") as f:
            f.write("{not json")
        self.assertEqual(Settings(path)["completed"], [])


class AssetTests(unittest.TestCase):
    def test_theme_pictures_exist(self):
        for key, theme in THEMES.items():
            pictures = [p for _, p, _ in theme["hero"]] + [theme["guide"], theme["success"], theme["oops"]]
            for picture in pictures:
                self.assertTrue(os.path.exists(os.path.join(ROOT, "assets", "images", picture)), f"{key}: {picture}")

    def test_app_files(self):
        for path in ("assets/web/lesson.html", "assets/web/lesson.css", "assets/web/lesson.js",
                     "assets/images/ada_logo.png", "assets/video/intro.mp4"):
            self.assertTrue(os.path.exists(os.path.join(ROOT, path)), path)


if __name__ == "__main__":
    unittest.main()
