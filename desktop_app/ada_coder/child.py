"""Runs a child's program in its own process, so a mistake or an endless loop can never freeze the app.

Started by ada_coder/bridge.py as:
    python -m ada_coder.child my_code.py          (while developing)
    AdaTheCoder --ada-run my_code.py              (packaged app, see run.py)

It talks back on standard output. Normal print() text passes straight through, plus these markers:
    WAIT          the program called input() and is waiting for an answer on standard input
    OK            the program finished without errors
    WINDOWS       ...and OpenCV picture windows are still open (we wait until they're closed)
    ERROR{json}   the program stopped with an error: {"title", "hint", "line"}
"""
import builtins
import json
import sys
import traceback

from .friendly import explain

MARK = "\x1e"
WAIT = MARK + "WAIT" + MARK
OK = MARK + "OK" + MARK
WINDOWS = MARK + "WINDOWS" + MARK
ERROR = MARK + "ERROR" + MARK
FILENAME = "my_code.py"


def _write(text):
    sys.stdout.write(text)
    sys.stdout.flush()


def _input(prompt=""):
    if prompt:
        _write(str(prompt))
    _write(WAIT + "\n")
    answer = sys.stdin.readline()
    if answer == "":
        raise EOFError("input cancelled")
    return answer.rstrip("\r\n")


def _watch_opencv(source, opened):
    """Remember which OpenCV windows the program opens, so they can stay open after it finishes."""
    if "cv2" not in source:
        return
    try:
        import cv2
    except Exception:
        return  # the program's own import will report it
    original_show, original_named = cv2.imshow, cv2.namedWindow

    def imshow(name, *args, **kwargs):
        opened.append(name)
        return original_show(name, *args, **kwargs)

    def named_window(name, *args, **kwargs):
        opened.append(name)
        return original_named(name, *args, **kwargs)

    cv2.imshow, cv2.namedWindow = imshow, named_window


def _wait_for_windows(names):
    try:
        import cv2
    except Exception:
        return

    def any_open():
        for name in set(names):
            try:
                if cv2.getWindowProperty(name, cv2.WND_PROP_VISIBLE) >= 1:
                    return True
            except Exception:
                pass
        return False

    if not any_open():
        return
    _write("\n" + WINDOWS + "\n")
    while any_open():
        if cv2.waitKey(100) == 27:  # Esc closes the pictures too
            break
    cv2.destroyAllWindows()


def _error_line(exc, source_lines):
    if isinstance(exc, SyntaxError):
        return exc.lineno
    line = None
    for frame in traceback.extract_tb(exc.__traceback__):
        if frame.filename == FILENAME:
            line = frame.lineno
    return line


def run_file(path):
    with open(path, encoding="utf-8") as f:
        source = f.read()
    lines = source.splitlines()
    builtins.input = _input
    opened = []
    _watch_opencv(source, opened)
    try:
        code = compile(source, FILENAME, "exec")
        exec(code, {"__name__": "__main__", "__file__": FILENAME, "__builtins__": builtins})
    except SystemExit:
        pass
    except BaseException as exc:  # noqa: BLE001 - every mistake should get a friendly message
        line = _error_line(exc, lines)
        code_line = lines[line - 1] if line and 0 < line <= len(lines) else ""
        message = exc.msg if isinstance(exc, SyntaxError) else str(exc)
        info = explain(type(exc).__name__, message, line, code_line)
        _write("\n" + ERROR + json.dumps(info, ensure_ascii=False) + "\n")
        return 1
    _write("\n" + OK + "\n")
    _wait_for_windows(opened)
    return 0


_MARKER_RE = None


def parse(raw):
    """Used by the app: splits everything the program has printed so far into what to show.
    Returns {"text", "waiting", "prompt", "ok", "windows", "error"}."""
    import re
    global _MARKER_RE
    if _MARKER_RE is None:
        _MARKER_RE = re.compile(r"\n?(" + re.escape(OK) + "|" + re.escape(WINDOWS) + r")\n?|\n?" + re.escape(ERROR) + r"[^\n]*\n?")
    error = None
    if ERROR in raw:
        payload = raw.split(ERROR, 1)[1].split("\n", 1)[0]
        try:
            error = json.loads(payload)
        except ValueError:
            error = explain("Error", payload)
    waiting, prompt = False, ""
    text = raw
    if text.endswith(WAIT + "\n") or text.endswith(WAIT):
        waiting = True
        text = text[: text.rfind(WAIT)]
        cut = text.rfind("\n") + 1
        text, prompt = text[:cut], text[cut:]
    text = text.replace(WAIT + "\n", "").replace(WAIT, "")
    text = _MARKER_RE.sub("", text)
    return {"text": text, "waiting": waiting, "prompt": prompt, "ok": OK in raw,
            "windows": WINDOWS in raw, "error": error}


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print("usage: python -m ada_coder.child my_code.py")
        return 2
    # A packaged "windowed" app may start without Python streams even though the app passed pipes.
    for name, fd, mode in (("stdout", 1, "w"), ("stdin", 0, "r")):
        if getattr(sys, name) is None:
            try:
                setattr(sys, name, open(fd, mode, encoding="utf-8", errors="replace", closefd=False,
                                        buffering=1 if mode == "w" else -1))
            except OSError:
                pass
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    return run_file(argv[0])


if __name__ == "__main__":
    sys.exit(main())
