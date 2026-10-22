"""The website with the accounts API switched on (AUTH_API_URL). A stand-in server here follows the same
requests and answers as auth-api/ (NestJS), so these tests run without Node or MySQL."""
import json
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from test_site import app  # same app and test database as the other tests

ACCOUNTS, EMAILS = {}, []


class StandInAPI(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body):
        raw = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])) or b"{}")
        email = str(body.get("email", "")).lower()
        if self.path == "/api/auth/register":
            if email in ACCOUNTS:
                return self._send(409, {"statusCode": 409, "message": "An account with this email already exists. Log in instead."})
            if len(body.get("password", "")) < 8 or body.get("consent") is not True:
                return self._send(400, {"statusCode": 400, "message": ["Choose a password with at least 8 characters."]})
            user = {"id": len(ACCOUNTS) + 1, "name": body["name"], "email": email, "city": body["city"],
                    "country": body["country"], "childName": body.get("childName"), "childAge": body.get("childAge"),
                    "role": "parent"}
            ACCOUNTS[email] = dict(user, password=body["password"])
            EMAILS.extend([("welcome", email), ("admin", "admin@example.com")])
            return self._send(201, {"ok": True, "user": user, "token": "t"})
        acct = ACCOUNTS.get(email)
        if self.path == "/api/auth/login":
            if not acct or acct["password"] != body.get("password"):
                return self._send(401, {"statusCode": 401, "message": "That email and password don't match. Check them and try again."})
            return self._send(200, {"ok": True, "user": {k: v for k, v in acct.items() if k != "password"}, "token": "t"})
        if self.path == "/api/auth/change-password":
            if not acct or acct["password"] != body.get("currentPassword"):
                return self._send(401, {"statusCode": 401, "message": "Your current password is wrong."})
            acct["password"] = body["newPassword"]
            return self._send(200, {"ok": True})
        if self.path == "/api/auth/delete-account":
            if not acct or acct["password"] != body.get("password"):
                return self._send(401, {"statusCode": 401, "message": "wrong"})
            del ACCOUNTS[email]
            return self._send(200, {"ok": True})
        self._send(404, {"statusCode": 404, "message": "Cannot POST " + self.path})


class AuthApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), StandInAPI)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_address[1]}/api"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        os.environ["AUTH_API_URL"] = self.url
        self.c = app.test_client()
        self.c.get("/")

    def tearDown(self):
        os.environ.pop("AUTH_API_URL", None)

    def post(self, url, data):
        with self.c.session_transaction() as s:
            tok = s["csrf_token"]
        return self.c.post(url, data=dict(data, csrf_token=tok))

    def test_website_signup_login_password_delete(self):
        form = {"name": "Ravi Kumar", "email": "ravi@example.com", "password": "goodpass1", "password2": "goodpass1",
                "city": "Chennai", "country": "India", "consent": "1", "child_name": "Anu", "child_age": "9"}
        r = self.post("/register", form)
        self.assertEqual(r.status_code, 302)
        self.assertIn("ravi@example.com", ACCOUNTS)                      # made in the accounts API
        self.assertIn(("welcome", "ravi@example.com"), EMAILS)            # which emails parent and admin
        self.assertIn(("admin", "admin@example.com"), EMAILS)
        self.assertEqual(ACCOUNTS["ravi@example.com"]["childAge"], 9)
        self.assertIn(b"Ravi", self.c.get("/account").data)             # and the website's copy is logged in
        self.post("/logout", {})
        self.c.get("/")
        # a password changed in the API (say, from another website) is what counts at log-in
        ACCOUNTS["ravi@example.com"]["password"] = "changed-elsewhere"
        self.assertEqual(self.post("/login", {"email": "ravi@example.com", "password": "goodpass1"}).status_code, 401)
        self.assertEqual(self.post("/login", {"email": "ravi@example.com", "password": "changed-elsewhere"}).status_code, 302)
        # change the password on the website: the API changes too
        self.post("/account/password", {"current": "changed-elsewhere", "new": "brandnew123"})
        self.assertEqual(ACCOUNTS["ravi@example.com"]["password"], "brandnew123")
        # delete: gone from both
        self.post("/account/delete", {"password": "brandnew123"})
        self.assertNotIn("ravi@example.com", ACCOUNTS)

    def test_app_api_uses_accounts_api(self):
        new = {"name": "Lina", "email": "lina@example.com", "password": "goodpass1", "city": "Goa",
               "country": "India", "consent": True}
        self.assertEqual(self.c.post("/api/v3/register", json=new).status_code, 201)
        self.assertIn("lina@example.com", ACCOUNTS)
        ok = self.c.post("/api/v3/login", json={"email": "lina@example.com", "password": "goodpass1"}).json
        self.assertTrue(ok["ok"])
        self.assertEqual(self.c.post("/api/v3/login", json={"email": "lina@example.com", "password": "nope-nope"}).status_code, 401)

    def test_parent_made_elsewhere_can_log_in(self):
        ACCOUNTS["omar@example.com"] = {"id": 99, "name": "Omar", "email": "omar@example.com", "city": "Pune",
                                        "country": "India", "childName": None, "childAge": None, "role": "parent",
                                        "password": "goodpass1"}
        self.assertEqual(self.post("/login", {"email": "omar@example.com", "password": "goodpass1"}).status_code, 302)
        self.assertIn(b"Omar", self.c.get("/account").data)

    def test_api_down(self):
        os.environ["AUTH_API_URL"] = "http://127.0.0.1:9/api"
        r = self.post("/register", {"name": "X", "email": "x-down@example.com", "password": "goodpass1",
                                    "password2": "goodpass1", "city": "A", "country": "B", "consent": "1"})
        self.assertEqual(r.status_code, 400)
        self.assertIn(b"be created right now", r.data)

    def test_admin_still_logs_in_on_the_website(self):
        r = self.post("/admin/login", {"email": "admin@example.com", "password": "admin-password-123"})
        self.assertEqual(r.headers["Location"], "/admin")
