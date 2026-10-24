"""Open one of the kids apps.

    python apps/run.py                      the only app, or a list to choose from
    python apps/run.py python_adventure     that app
    python apps/run.py python_adventure --server http://127.0.0.1:3000   log in with the website's accounts

Needs: pip install -r apps/requirements.txt
"""
import argparse
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "engine", "kids_app.py")


def app_folders():
    return sorted(d for d in os.listdir(HERE)
                  if os.path.isfile(os.path.join(HERE, d, "app.json")))


def main():
    p = argparse.ArgumentParser(description="Open a kids app")
    p.add_argument("app", nargs="?", help="the app's folder name in apps/")
    p.add_argument("--server", help="the API's address (overrides app.json → server.url for this run)")
    args = p.parse_args()
    apps = app_folders()
    name = args.app or (apps[0] if len(apps) == 1 else None)
    if not name or name not in apps:
        print("Which app? python apps/run.py <app>   Apps here:", ", ".join(apps) or "(none)")
        sys.exit(1)
    os.environ["KIDS_APP_DIR"] = os.path.join(HERE, name)
    if args.server is not None:
        os.environ["KIDS_APP_SERVER"] = args.server
    sys.argv = [ENGINE]
    runpy.run_path(ENGINE, run_name="__main__")


if __name__ == "__main__":
    main()
