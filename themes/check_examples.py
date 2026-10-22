"""Runs every example in a theme pack and checks it prints what the lesson says it will.

    python3 themes/check_examples.py themes/space          one pack
    python3 themes/check_examples.py themes                every pack in the folder

Examples that use input() get "5" typed for every question; OpenCV (cv2) examples are skipped.
"""
import json
import os
import subprocess
import sys


def examples(pack_dir):
    with open(os.path.join(pack_dir, "theme.json"), encoding="utf-8") as f:
        pack = json.load(f)
    for lesson in pack.get("lessons", []):
        for n, ex in enumerate(lesson.get("examples", []), start=1):
            code = ex.get("code")
            if ex.get("codeFile"):
                with open(os.path.join(pack_dir, ex["codeFile"]), encoding="utf-8") as f:
                    code = f.read()
            yield f"{pack.get('slug')}/{lesson.get('slug')} example {n}", code or "", ex.get("output", "")


def main(target):
    packs = [target] if os.path.exists(os.path.join(target, "theme.json")) else [
        os.path.join(target, d) for d in sorted(os.listdir(target)) if os.path.exists(os.path.join(target, d, "theme.json"))]
    bad = checked = 0
    for pack in packs:
        for where, code, expected in examples(pack):
            if "cv2" in code:
                continue
            checked += 1
            run = subprocess.run([sys.executable, "-c", code], input="5\n" * 20, capture_output=True, text=True,
                                 encoding="utf-8", timeout=20, env=dict(os.environ, PYTHONIOENCODING="utf-8"))
            got = run.stdout.strip()
            if run.returncode != 0:
                bad += 1
                print(f"✗ {where}: the code has an error:\n{run.stderr.strip()}\n")
            elif expected and got != expected.strip():
                bad += 1
                print(f"✗ {where}: it prints\n{got}\n  but the lesson says\n{expected.strip()}\n")
    print(f"{checked} examples checked, {bad} problem(s).")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))))
