"""Make licence keys for one app. A key unlocks every lesson of that app on the computer it's typed into.

    python apps/make_key.py python_adventure            one key
    python apps/make_key.py python_adventure --count 50 > keys.txt

Keys are made with the app's licence_secret.txt (made here the first time). Keep that file safe and never put
it on GitHub: anyone who has it can make keys. If you change it, old keys stop working in new builds.
"""
import argparse
import os
import secrets
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "engine"))
from appconfig import load_config  # noqa: E402
from locks import key_is_valid, make_key  # noqa: E402


def ensure_secret(app_dir):
    path = os.path.join(app_dir, "licence_secret.txt")
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(secrets.token_urlsafe(24) + "\n")
        print(f"Made {path} (keep it safe, it is not uploaded to GitHub)", file=sys.stderr)
    return path


def main():
    p = argparse.ArgumentParser(description="Make licence keys")
    p.add_argument("app")
    p.add_argument("--count", type=int, default=1)
    p.add_argument("--check", metavar="KEY", help="say whether a key works for this app")
    args = p.parse_args()
    app_dir = os.path.join(HERE, args.app)
    if not os.path.isfile(os.path.join(app_dir, "app.json")):
        sys.exit(f"No app called {args.app} in {HERE}")
    if not args.check:
        ensure_secret(app_dir)
    cfg = load_config(app_dir)
    locks = cfg["locks"]
    if args.check:
        ok = key_is_valid(args.check, locks["licence_secret"], cfg["id"], locks["licence_prefix"])
        print("works ✅" if ok else "does not work ❌")
        sys.exit(0 if ok else 1)
    for _ in range(args.count):
        print(make_key(locks["licence_secret"], cfg["id"], locks["licence_prefix"]))


if __name__ == "__main__":
    main()
