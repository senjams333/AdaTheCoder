"""Tests for the kids apps without PyQt: app folders, lessons, locks, licence keys, duplicating.

    python -m unittest discover apps/tests
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
APPS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(APPS, "engine"))
sys.path.insert(0, APPS)

from appconfig import load_config, load_lessons, parse_lesson_numbers  # noqa: E402
from locks import LessonLocks, key_is_valid, make_key  # noqa: E402
import new_app  # noqa: E402

APP_DIRS = sorted(d for d in os.listdir(APPS) if os.path.isfile(os.path.join(APPS, d, "app.json")))


def config_with_secret(app="python_adventure", secret="test-secret"):
    cfg = load_config(os.path.join(APPS, app))
    cfg["locks"]["licence_secret"] = secret
    return cfg


class AppFolders(unittest.TestCase):
    def test_every_app_loads_and_has_its_pictures(self):
        self.assertIn("python_adventure", APP_DIRS)
        for name in APP_DIRS:
            d = os.path.join(APPS, name)
            cfg = load_config(d)
            self.assertEqual(cfg["id"], name, "the folder name and app.json id must match")
            lessons, topics = load_lessons(d)
            self.assertGreaterEqual(len(topics), 2)
            for pic in [cfg["logo"], cfg["success_picture"], cfg["oops_picture"]] + [c["image"] for c in cfg["characters"]]:
                self.assertTrue(os.path.exists(os.path.join(d, pic)), f"{name}: {pic} missing")
            for lesson in lessons.values():
                self.assertIn("title", lesson)
                self.assertIsInstance(lesson["examples"], dict)

    def test_python_adventure_has_the_17_lessons_of_3_general(self):
        lessons, topics = load_lessons(os.path.join(APPS, "python_adventure"))
        self.assertEqual(len(topics), 17)
        self.assertEqual(topics[0]["id"], "lesson1")
        self.assertEqual(topics[-1]["id"], "lesson_opencv")
        self.assertTrue(lessons["lesson1"]["video_path"].endswith(os.path.join("vid", "video1.mp4")))
        self.assertEqual(len(lessons["lesson2"]["examples"]), 6)

    def test_lesson_numbers(self):
        self.assertEqual(parse_lesson_numbers("2-17", 17), set(range(2, 18)))
        self.assertEqual(parse_lesson_numbers("1-3, 9", 17), {2, 3, 9})   # 1 is always free
        self.assertEqual(parse_lesson_numbers([2, 40], 17), {2})
        self.assertEqual(parse_lesson_numbers([], 17), set())


class Locks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.path = os.path.join(self.tmp, "locks.json")
        self.cfg = config_with_secret()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def locks(self, cfg=None):
        return LessonLocks(cfg or self.cfg, 17, self.path)

    def test_lesson_1_free_2_to_17_locked(self):
        lk = self.locks()
        self.assertFalse(lk.is_locked(1))
        self.assertEqual(lk.locked_numbers(), list(range(2, 18)))

    def test_grown_up_unlocks_and_locks_single_lessons_and_it_is_remembered(self):
        lk = self.locks()
        lk.set_locked(3, False)
        lk.set_many([n for n in range(2, 18) if n not in (3, 4, 5)])
        self.assertEqual(self.locks().locked_numbers(), [2] + list(range(6, 18)))
        lk.unlock_all()
        self.assertEqual(self.locks().locked_numbers(), [])
        lk.lock_all()
        self.assertEqual(len(self.locks().locked_numbers()), 16)
        lk.reset_to_app_settings()
        self.assertEqual(self.locks().locked_numbers(), list(range(2, 18)))

    def test_lesson_1_cannot_be_locked(self):
        lk = self.locks()
        lk.set_locked(1, True)
        lk.set_many([1, 2])
        self.assertFalse(lk.is_locked(1))

    def test_editing_the_saved_file_by_hand_unlocks_nothing(self):
        lk = self.locks()
        lk.set_locked(2, False)
        with open(self.path, encoding="utf-8") as f:
            saved = json.load(f)
        saved["overrides"] = {str(n): False for n in range(2, 18)}
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(saved, f)
        self.assertEqual(self.locks().locked_numbers(), list(range(2, 18)))

    def test_licence_key_unlocks_everything_for_good(self):
        lk = self.locks()
        key = make_key("test-secret", "python_adventure", "PAFK")
        self.assertRegex(key, r"^PAFK-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$")
        self.assertFalse(lk.enter_key("PAFK-AAAA-BBBB-CCCC"))
        self.assertTrue(lk.enter_key(key.lower().replace("-", " ")))   # typed any old way
        self.assertEqual(lk.locked_numbers(), [])
        self.assertEqual(self.locks().locked_numbers(), [])               # after a restart too
        lk.remove_key()
        self.assertEqual(self.locks().locked_numbers(), list(range(2, 18)))

    def test_one_apps_key_does_not_open_another_app(self):
        key = make_key("test-secret", "python_adventure", "PAFK")
        self.assertTrue(key_is_valid(key, "test-secret", "python_adventure", "PAFK"))
        self.assertFalse(key_is_valid(key, "other-secret", "python_adventure", "PAFK"))
        self.assertFalse(key_is_valid(key, "test-secret", "fairy_python", "PAFK"))
        self.assertFalse(key_is_valid(key, "", "python_adventure", "PAFK"))   # no secret: keys off

    def test_parent_account_with_licence_unlocks_while_logged_in(self):
        lk = self.locks()
        self.assertFalse(lk.set_account_licences(["space"]))
        self.assertEqual(len(lk.locked_numbers()), 16)
        self.assertTrue(lk.set_account_licences(["space", "python_adventure"]))
        self.assertEqual(lk.locked_numbers(), [])
        self.assertEqual(len(self.locks().locked_numbers()), 16)   # not saved: log-in only
        lk.set_account_licences([])
        self.assertEqual(len(lk.locked_numbers()), 16)

    def test_admin_pin(self):
        lk = self.locks()
        self.assertTrue(lk.check_pin("2468"))
        self.assertFalse(lk.check_pin("0000"))

    def test_locked_lessons_setting_from_app_json(self):
        cfg = config_with_secret()
        cfg["locks"]["locked_lessons"] = "10-17"
        self.assertEqual(self.locks(cfg).locked_numbers(), list(range(10, 18)))
        cfg["locks"]["locked_lessons"] = []
        self.assertEqual(self.locks(cfg).locked_numbers(), [])


class Duplicate(unittest.TestCase):
    NEW = "zz_test_copy"

    def tearDown(self):
        shutil.rmtree(os.path.join(APPS, self.NEW), ignore_errors=True)

    def test_copy_gets_its_own_id_prefix_secret_and_characters(self):
        dst, cfg = new_app.duplicate("python_adventure", self.NEW, "Space Coders",
                                     characters=["byte_owl", "unicorn"], prefix="SPCE")
        self.assertEqual(load_config(dst)["id"], self.NEW)
        self.assertEqual(cfg["locks"]["licence_prefix"], "SPCE")
        self.assertEqual(cfg["server"]["theme_id"], self.NEW)
        self.assertEqual([c["image"] for c in cfg["characters"]], ["byte_owl.png", "unicorn.png"])
        self.assertTrue(os.path.exists(os.path.join(dst, "byte_owl.png")))
        self.assertFalse(os.path.exists(os.path.join(dst, "penny.png")))   # old character removed
        self.assertTrue(os.path.exists(os.path.join(dst, "tom.png")))      # the OpenCV lesson uses it
        _, topics = load_lessons(dst)
        self.assertEqual(len(topics), 17)
        mine = load_config(dst)["locks"]["licence_secret"]
        theirs = load_config(os.path.join(APPS, "python_adventure"))["locks"]["licence_secret"]
        self.assertTrue(mine)
        self.assertNotEqual(mine, theirs)
        self.assertEqual(cfg["locks"]["locked_lessons"], "2-17")

    def test_refuses_bad_ids_and_existing_folders(self):
        with self.assertRaises(SystemExit):
            new_app.duplicate("python_adventure", "Bad Name", "X")
        with self.assertRaises(SystemExit):
            new_app.duplicate("python_adventure", "python_adventure", "X")


if __name__ == "__main__":
    unittest.main()
