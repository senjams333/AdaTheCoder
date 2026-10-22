"""End-to-end checks for the website. Run from the website folder:  python -m unittest discover tests"""
import io
import os
import sys
import tempfile
import unittest

TMP = tempfile.mkdtemp()
os.environ["ADA_DATABASE"] = os.path.join(TMP, "test.sqlite3")
os.environ["ADA_UPLOAD_DIR"] = os.path.join(TMP, "uploads")
os.environ["ADA_ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADA_ADMIN_PASSWORD"] = "admin-password-123"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app  # noqa: E402


class SiteTest(unittest.TestCase):
    def setUp(self):
        self.c = app.test_client()
        self.c.get("/")  # creates the CSRF token

    def token(self):
        with self.c.session_transaction() as s:
            tok = s.get("csrf_token")
        if tok is None:  # a browser would load a page (with a fresh token) before posting
            self.c.get("/")
            with self.c.session_transaction() as s:
                tok = s["csrf_token"]
        return tok

    def post(self, url, data=None, **kw):
        data = dict(data or {})
        data["csrf_token"] = self.token()
        return self.c.post(url, data=data, **kw)

    def register(self, email="parent@example.com"):
        return self.post("/register", {
            "name": "Priya Sharma", "email": email, "password": "goodpass1",
            "password2": "goodpass1", "child_name": "Anu", "child_age": "8", "consent": "1",
            "city": "Imphal", "country": "India"})

    def login_admin(self):
        return self.post("/admin/login", {"email": "admin@example.com", "password": "admin-password-123"})

    def test_01_home_lists_lessons(self):
        r = self.c.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"say hello", r.data)
        self.assertIn(b"robot eyes", r.data)

    def test_02_csrf_is_required(self):
        r = self.c.post("/login", data={"email": "x@y.z", "password": "x"})
        self.assertEqual(r.status_code, 400)

    def test_03_register_login_download_flow(self):
        r = self.register("flow@example.com")
        self.assertEqual(r.status_code, 302)
        self.assertIn("/account", r.headers["Location"])
        page = self.c.get("/account")
        self.assertIn(b"Let's get Anu coding", page.data.replace(b"&#39;", b"'"))
        # No installer yet: friendly redirect
        r = self.c.get("/download/windows")
        self.assertEqual(r.status_code, 302)
        # Duplicate email is refused
        self.post("/logout")
        r = self.register("flow@example.com")
        self.assertEqual(r.status_code, 400)
        # Wrong password refused, right one accepted
        self.assertEqual(self.post("/login", {"email": "flow@example.com", "password": "nope"}).status_code, 401)
        self.assertEqual(self.post("/login", {"email": "flow@example.com", "password": "goodpass1"}).status_code, 302)

    def test_04_download_needs_login(self):
        r = self.c.get("/download/windows")
        self.assertEqual(r.status_code, 302)
        self.assertIn("/login", r.headers["Location"])

    def test_05_parent_cannot_use_admin(self):
        self.register("notadmin@example.com")
        r = self.c.get("/admin")
        self.assertIn("/admin/login", r.headers["Location"])
        r = self.post("/admin/login", {"email": "notadmin@example.com", "password": "goodpass1"})
        self.assertEqual(r.status_code, 401)

    def test_06_admin_edits_content_lessons_and_releases(self):
        self.assertEqual(self.login_admin().status_code, 302)
        for page in ["/admin", "/admin/content", "/admin/courses", "/admin/courses/new", "/admin/courses/1",
                     "/admin/courses/1/settings", "/admin/lessons/new", "/admin/lessons/new?course=2",
                     "/admin/lessons/1", "/admin/releases", "/admin/parents", "/admin/parents/export.csv"]:
            self.assertEqual(self.c.get(page).status_code, 200, page)

        self.post("/admin/content", {"hero_title": "Code is fun", "hero_subtitle": "Sub",
                                     "site_banner": "New lessons!", "app_message": "Hello from admin",
                                     "parents_note": "Safe", "contact_email": "help@example.com"})
        home = self.c.get("/").data
        self.assertIn(b"Code is fun", home)
        self.assertIn(b"New lessons!", home)
        self.assertEqual(self.c.get("/api/v1/announcement").json["message"], "Hello from admin")

        before = self.c.get("/api/v2/lessons").json
        self.assertEqual(len(before["lessons"]), 17)
        first = before["lessons"][0]
        self.assertEqual(first["id"], "lesson1")
        self.assertEqual(first["video"], {"bundled": "vid/video1.mp4"})
        self.assertEqual(len(first["examples"]), 6)
        self.assertEqual(set(first["examples"][0]), {"label", "explain", "output", "code"})

        new_lesson = {
            "course_id": "1", "slug": "lesson_turtle", "position": "99", "emoji": "🐢", "name": "TURTLE",
            "title": "🐢 TURTLE DRAWING", "subtitle": "Draw with a turtle!", "video_bundled": "",
            "default_code": "import turtle", "published": "1", "example_count": "3",
            "ex_label_0": "1️⃣ Square", "ex_explain_0": "Walk and turn 4 times", "ex_output_0": "A square",
            "ex_code_0": "print('square')", "ex_label_1": "", "ex_explain_1": "", "ex_output_1": "", "ex_code_1": "",
            "video": (io.BytesIO(b"fake mp4 bytes"), "turtle.mp4"),
        }
        r = self.post("/admin/lessons/new", new_lesson, content_type="multipart/form-data")
        self.assertEqual(r.status_code, 302)
        after = self.c.get("/api/v2/lessons").json
        self.assertNotEqual(before["revision"], after["revision"])
        added = after["lessons"][-1]
        self.assertEqual(added["id"], "lesson_turtle")
        self.assertEqual(len(added["examples"]), 1)  # the empty example is dropped
        self.assertIn("/media/videos/lesson_turtle-", added["video"]["url"])
        video = self.c.get(added["video"]["url"].replace("http://localhost", ""))
        self.assertEqual(video.status_code, 200)
        self.assertEqual(video.data, b"fake mp4 bytes")
        video.close()
        self.assertTrue(self.c.get(f"/api/v2/lessons?since={after['revision']}").json["unchanged"])
        # Bad input is refused: no examples, wrong video type, duplicate lesson ID
        bad = dict(new_lesson, slug="lesson1", ex_label_0="", ex_explain_0="", ex_output_0="", ex_code_0="",
                   video=(io.BytesIO(b"x"), "clip.avi"))
        r = self.post("/admin/lessons/new", bad, content_type="multipart/form-data")
        self.assertEqual(r.status_code, 400)
        for msg in (b"at least one example", b".mp4", b"already uses that lesson ID"):
            self.assertIn(msg, r.data)
        self.assertEqual(self.c.get("/admin/courses/1").status_code, 200)

        # Upload a Windows release, check the update API
        r = self.post("/admin/releases", {
            "platform": "windows", "version": "1.1.0", "notes": "Turtle lessons", "min_supported": "1.0.0",
            "make_latest": "1", "file": (io.BytesIO(b"MZ fake installer"), "AdaTheCoder-Setup.exe")},
            content_type="multipart/form-data")
        self.assertEqual(r.status_code, 302)
        info = self.c.get("/api/v1/app/latest?platform=windows&version=1.0.0").json
        self.assertTrue(info["update_available"])
        self.assertFalse(info["required"])
        self.assertTrue(self.c.get("/api/v1/app/latest?platform=windows&version=0.9.0").json["required"])
        self.assertFalse(self.c.get("/api/v1/app/latest?platform=windows&version=1.1.0").json["update_available"])
        self.assertFalse(self.c.get("/api/v1/app/latest?platform=mac&version=1.0.0").json["update_available"])
        # Wrong file type for platform is refused
        self.post("/admin/releases", {"platform": "mac", "version": "1.1.0", "make_latest": "1",
                                      "file": (io.BytesIO(b"x"), "app.exe")}, content_type="multipart/form-data")
        self.assertFalse(self.c.get("/api/v1/app/latest?platform=mac&version=1.0.0").json["update_available"])

        # A parent can now download it
        self.post("/logout")
        self.register("downloader@example.com")
        r = self.c.get("/download/windows")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, b"MZ fake installer")
        self.assertIn("AdaTheCoder-Setup.exe", r.headers["Content-Disposition"])

    def test_07_parent_can_delete_account(self):
        self.register("bye@example.com")
        r = self.post("/account/delete", {"password": "goodpass1"})
        self.assertEqual(r.status_code, 302)
        self.assertEqual(self.post("/login", {"email": "bye@example.com", "password": "goodpass1"}).status_code, 401)

    def test_09_admin_sets_plan_and_licence(self):
        self.register("buyer@example.com")
        page = self.c.get("/account").data
        self.assertIn(b"Get Licence", page)
        self.assertNotIn(b"OWNED", page)
        self.post("/logout")
        self.login_admin()
        from db import get_db
        with app.app_context():
            uid = get_db().execute("SELECT id FROM users WHERE email = ?", ("buyer@example.com",)).fetchone()[0]
        self.assertEqual(self.c.get("/admin/parents").status_code, 200)
        with app.app_context():
            friends = get_db().execute("SELECT id FROM courses WHERE slug = 'friends'").fetchone()[0]
        r = self.post(f"/admin/parents/{uid}/plan", {"plan": "premium", f"licence_{friends}": "ADA-FRND-1234"})
        self.assertEqual(r.status_code, 302)
        self.post("/logout")
        self.post("/login", {"email": "buyer@example.com", "password": "goodpass1"})
        page = self.c.get("/account").data
        self.assertIn(b"ADA-FRND-1234", page)
        self.assertIn(b"Premium", page)
        self.assertEqual(page.count(b"OWNED"), 1)  # only Friends Adventure is bought

    def test_11_courses(self):
        self.login_admin()
        api = self.c.get("/api/v3/courses").json
        self.assertEqual([c["id"] for c in api["courses"]], ["friends", "fairies", "coding_club"])
        self.assertTrue(all(len(c["lessons"]) >= 17 for c in api["courses"]))  # test 06 may add one
        self.assertEqual(api["courses"][1]["pack"], "fairies")
        self.assertTrue(self.c.get(f"/api/v3/courses?since={api['revision']}").json["unchanged"])
        self.assertEqual(len(self.c.get("/api/v2/lessons?course=fairies").json["lessons"]), 17)
        self.assertEqual(self.c.get("/api/v2/lessons?course=nope").status_code, 404)

        # a new course with copied lessons and its own theme
        r = self.post("/admin/courses/new", {"name": "Space Explorers", "slug": "space", "tagline": "To the stars",
                                             "features": "Rockets\nPlanets", "pack": "coding_club", "price": "$4.99",
                                             "premium": "1", "position": "9", "published": "1", "copy_from": "1"})
        self.assertEqual(r.status_code, 302)
        bad = self.post("/admin/courses/new", {"name": "", "slug": "space", "pack": "dragons", "premium": "1",
                                               "position": "x"})
        self.assertEqual(bad.status_code, 400)
        for msg in (b"Give the theme a name", b"already uses that theme ID", b"Choose the characters",
                    b"need a price", b"whole number"):
            self.assertIn(msg, bad.data)
        api = self.c.get("/api/v3/courses").json
        space = api["courses"][-1]
        self.assertEqual((space["id"], space["pack"], space["price"], len(space["lessons"])),
                         ("space", "coding_club", "$4.99", len(api["courses"][0]["lessons"])))

        from db import get_db
        with app.app_context():
            db = get_db()
            space_id = db.execute("SELECT id FROM courses WHERE slug = 'space'").fetchone()[0]
            first, second = db.execute("SELECT id FROM lessons WHERE course_id = ? ORDER BY position LIMIT 2",
                                       (space_id,)).fetchall()
        # the same lesson ID can exist in two courses, but not twice in one
        self.assertIn(b"Space Explorers", self.c.get(f"/admin/courses/{space_id}").data)
        self.assertEqual(self.c.get(f"/admin/lessons?course={space_id}").headers["Location"], f"/admin/courses/{space_id}")
        self.post(f"/admin/lessons/{second[0]}/move", {"direction": "up"})
        ids = [l["id"] for l in self.c.get("/api/v2/lessons?course=space").json["lessons"]]
        self.assertEqual(ids[:2], ["lesson2", "lesson1"])

        # paid course shows on the account page; hidden course leaves the app
        self.post("/logout")
        self.register("space@example.com")
        self.assertIn(b"Space Explorers", self.c.get("/account").data)
        self.post("/logout")
        self.login_admin()
        self.post(f"/admin/courses/{space_id}/settings", {"name": "Space Explorers", "slug": "space", "pack": "coding_club",
                                                 "position": "9"})
        self.assertNotIn("space", [c["id"] for c in self.c.get("/api/v3/courses").json["courses"]])
        self.post(f"/admin/courses/{space_id}/delete")
        with app.app_context():
            self.assertEqual(get_db().execute("SELECT COUNT(*) FROM lessons WHERE course_id = ?",
                                              (space_id,)).fetchone()[0], 0)

    def test_12_new_theme_with_own_characters_and_app_login(self):
        import io
        self.login_admin()
        png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
        form = {"name": "Learn Coding in Space", "slug": "space2", "tagline": "Blast off", "pack": "custom",
                "price": "$2.99", "premium": "1", "free_lessons": "3", "position": "5", "published": "1",
                "copy_from": "1"}
        missing = self.post("/admin/courses/new", dict(form))
        self.assertEqual(missing.status_code, 400)
        self.assertIn(b"Upload a picture for character 1", missing.data)
        for i, name in enumerate(["Astro", "Comet", "Nova"]):
            form[f"char_name_{i}"] = name
            form[f"char_file_{i}"] = (io.BytesIO(png), f"{name}.png")
        r = self.post("/admin/courses/new", form, content_type="multipart/form-data")
        self.assertEqual(r.status_code, 302)
        page = self.c.get(r.headers["Location"])          # straight into the new theme, lessons inside
        self.assertIn(b"Lessons in this theme", page.data)
        self.assertIn(b"Astro, Comet &amp; Nova", page.data)
        space = [c for c in self.c.get("/api/v3/courses").json["courses"] if c["id"] == "space2"][0]
        self.assertEqual(space["free_lessons"], 3)
        self.assertEqual([c["name"] for c in space["characters"]], ["Astro", "Comet", "Nova"])
        self.assertTrue(space["characters"][0]["url"].startswith("http"))
        self.assertEqual(self.c.get(space["characters"][0]["url"].split("localhost", 1)[-1]).status_code, 200)
        self.assertIn("/account?theme=space2", space["buy_url"])
        self.post("/logout")

        # the app's log-in tells it which themes are unlocked
        self.register("kid-parent@example.com")
        self.post("/logout")
        self.c.delete_cookie("session") if hasattr(self.c, "delete_cookie") else None
        bad = self.c.post("/api/v3/login", json={"email": "kid-parent@example.com", "password": "wrong"})
        self.assertEqual(bad.status_code, 401)
        ok = self.c.post("/api/v3/login", json={"email": "kid-parent@example.com", "password": "goodpass1"}).json
        self.assertEqual(ok["licences"], [])
        self.login_admin()
        from db import get_db
        with app.app_context():
            db = get_db()
            uid = db.execute("SELECT id FROM users WHERE email = 'kid-parent@example.com'").fetchone()[0]
            cid = db.execute("SELECT id FROM courses WHERE slug = 'space2'").fetchone()[0]
        self.post(f"/admin/parents/{uid}/plan", {"plan": "premium", f"licence_{cid}": "ADA-SPACE-1"})
        ok = self.c.post("/api/v3/login", json={"email": "kid-parent@example.com", "password": "goodpass1"}).json
        self.assertEqual(ok["licences"], ["space2"])
        # Upgrade in the app opens the account page on that theme
        self.post("/logout")
        self.post("/login", {"email": "kid-parent@example.com", "password": "goodpass1"})
        self.assertIn(b'acct-card-wanted" id="theme-space2"', self.c.get("/account?theme=space2").data)

    def test_13_empty_theme_gets_lessons_and_shows_in_app(self):
        self.login_admin()
        r = self.post("/admin/courses/new", {"name": "Jungle", "slug": "jungle13", "pack": "friends", "position": "8"})
        theme = r.headers["Location"]
        page = self.c.get(theme).data
        self.assertIn(b"doesn't show this theme yet", page)
        self.assertNotIn("jungle13", [c["id"] for c in self.c.get("/api/v3/courses").json["courses"]])
        self.post(theme + "/settings", {"name": "Jungle", "slug": "jungle13", "pack": "friends", "position": "8",
                                        "published": "1", "free_lessons": "3"})
        self.post(theme + "/copy", {"from": "1"})
        api = {c["id"]: c for c in self.c.get("/api/v3/courses").json["courses"]}
        self.assertGreaterEqual(len(api["jungle13"]["lessons"]), 17)
        self.assertIn(b"In the app: children see this theme", self.c.get(theme).data)
        again = self.post(theme + "/copy", {"from": "1"}, follow_redirects=True)
        self.assertIn(b"Nothing new to copy", again.data)
        # the form for a new theme starts visible in the app and copying the first theme's lessons
        form = self.c.get("/admin/courses/new").data.decode()
        self.assertRegex(form, r'name="published" value="1"\s+checked')
        self.assertRegex(form, r'<option value="1"\s+selected>')

    def test_14_register_api(self):
        new = {"name": "Asha Rao", "email": "Asha@Example.com", "password": "goodpass1", "city": "Pune",
               "country": "India", "consent": True, "child_name": "Mira", "child_age": "8"}
        r = self.c.post("/api/v3/register", json=new)
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.json["ok"], r.json["email"], r.json["licences"]), (True, "asha@example.com", []))
        # the new account logs in from the app and on the website
        self.assertTrue(self.c.post("/api/v3/login", json={"email": "asha@example.com", "password": "goodpass1"}).json["ok"])
        self.assertEqual(self.post("/login", {"email": "asha@example.com", "password": "goodpass1"}).status_code, 302)
        self.post("/logout")
        again = self.c.post("/api/v3/register", json=new)
        self.assertEqual(again.status_code, 409)
        self.assertIn("already exists", again.json["errors"][0])
        bad = self.c.post("/api/v3/register", json={"name": "", "email": "nope", "password": "short",
                                                    "password2": "other", "consent": False})
        self.assertEqual(bad.status_code, 400)
        for msg in ("Enter your name", "valid email", "8 characters", "don't match", "Enter your city",
                    "Enter your country", "parent or guardian"):
            self.assertTrue(any(msg in e for e in bad.json["errors"]), msg)
        self.assertEqual(self.c.post("/api/v3/register", data="not json").status_code, 400)
        # no form token needed (the app has none), but the website's own forms still need theirs
        self.assertEqual(self.c.post("/register", data=dict(new, password2="goodpass1", email="x@example.com")).status_code, 400)

    def test_10_city_and_country(self):
        r = self.post("/register", {"name": "No Place", "email": "noplace@example.com", "password": "goodpass1",
                                    "password2": "goodpass1", "consent": "1"})
        self.assertEqual(r.status_code, 400)
        self.assertIn(b"Enter your city", r.data)
        self.register("place@example.com")
        page = self.c.get("/account").data
        self.assertIn(b"Imphal", page)
        self.assertIn(b"India", page)
        self.post("/account/details", {"name": "Priya S", "city": "Pune", "country": "India"})
        self.assertIn(b"Pune", self.c.get("/account").data)
        self.post("/logout")
        self.login_admin()
        self.assertIn(b"Pune, India", self.c.get("/admin/parents").data)
        self.assertIn(b"Pune,India", self.c.get("/admin/parents/export.csv").data)

    def test_08_open_redirect_blocked(self):
        self.register("redir@example.com")
        self.post("/logout")
        r = self.post("/login?next=//evil.example", {"email": "redir@example.com", "password": "goodpass1",
                                                     "next": "//evil.example"})
        self.assertNotIn("evil", r.headers["Location"])


if __name__ == "__main__":
    unittest.main()


class FirstAdminTest(unittest.TestCase):
    """A brand-new website with no admin: the admin login page creates the admin account once."""

    def test_first_visit_creates_admin(self):
        import app as site
        tmp = tempfile.mkdtemp()
        saved = {k: os.environ.pop(k, None) for k in ("ADA_ADMIN_EMAIL", "ADA_ADMIN_PASSWORD")}
        os.environ["ADA_DATABASE"] = os.path.join(tmp, "fresh.sqlite3")
        os.environ["ADA_UPLOAD_DIR"] = os.path.join(tmp, "uploads")
        try:
            fresh = site.create_app()
        finally:
            os.environ["ADA_DATABASE"] = os.path.join(TMP, "test.sqlite3")
            os.environ["ADA_UPLOAD_DIR"] = os.path.join(TMP, "uploads")
            os.environ.update({k: v for k, v in saved.items() if v})
        c = fresh.test_client()
        page = c.get("/admin/login").data
        self.assertIn(b"Create the admin account", page)
        with c.session_transaction() as s:
            tok = s["csrf_token"]
        bad = c.post("/admin/login", data={"csrf_token": tok, "name": "Sen", "email": "boss@example.com",
                                            "password": "short", "password2": "short"})
        self.assertEqual(bad.status_code, 400)
        self.assertIn(b"at least 10 characters", bad.data)
        ok = c.post("/admin/login", data={"csrf_token": tok, "name": "Sen", "email": "boss@example.com",
                                           "password": "a-long-password", "password2": "a-long-password"})
        self.assertEqual(ok.headers["Location"], "/admin")
        self.assertEqual(c.get("/admin").status_code, 200)       # logged straight in
        c.get("/")
        with c.session_transaction() as s:
            tok = s["csrf_token"]                                # logging in gives a new form token
        c.post("/logout", data={"csrf_token": tok})
        c.get("/")
        with c.session_transaction() as s:
            tok = s["csrf_token"]
        page = c.get("/admin/login").data                       # setup is gone for good
        self.assertIn(b"Admin log in", page)
        self.assertNotIn(b"Create the admin account", page)
        r = c.post("/admin/login", data={"csrf_token": tok, "email": "boss@example.com", "password": "a-long-password"})
        self.assertEqual(r.headers["Location"], "/admin")
