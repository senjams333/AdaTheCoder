"""Connects the lesson page to Python: runs the child's code and sends the results back to the page."""
import json
import os
import sys
import tempfile

from PyQt5.QtCore import QElapsedTimer, QObject, QProcess, QProcessEnvironment, QTimer, pyqtSignal, pyqtSlot

from . import child
from .config import OUTPUT_LIMIT, RUN_TIME_LIMIT
from .friendly import explain
from .paths import FROZEN, base_dir, playground_dir


def _has_code(text):
    return any(line.strip() and not line.strip().startswith("#") for line in text.splitlines())


class CodeBridge(QObject):
    """The page calls these slots through QWebChannel as window.pyqtBridge.<name>(...)."""

    ran_ok = pyqtSignal()        # the child's code worked (used to tick off the lesson)

    def __init__(self, web_view, parent=None):
        super().__init__(parent)
        self.web_view = web_view
        self.process = None
        self.code_file = None
        self.raw = ""
        self.finished_reported = False
        self.clock = QElapsedTimer()
        self.paused_ms = 0          # time spent waiting for typed answers doesn't count
        self.wait_started = None
        self.watchdog = QTimer(self)
        self.watchdog.setInterval(250)
        self.watchdog.timeout.connect(self._check_time)

    # ------------------------------------------------------------------ talking to the page
    def _js(self, function, *args):
        self.web_view.page().runJavaScript(f"{function}({', '.join(json.dumps(a) for a in args)});")

    def _show_error(self, info):
        self._js("showError", info)

    # ------------------------------------------------------------------ slots the page calls
    @pyqtSlot(str)
    def executePython(self, code):
        if not _has_code(code):
            self._show_error(explain("EmptyCode", ""))
            return
        self.stop()
        fd, self.code_file = tempfile.mkstemp(prefix="ada_", suffix=".py")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(code)

        self.raw = ""
        self.finished_reported = False
        self.paused_ms = 0
        self.wait_started = None

        proc = QProcess(self)
        proc.setWorkingDirectory(playground_dir())
        env = QProcessEnvironment.systemEnvironment()
        env.insert("PYTHONIOENCODING", "utf-8")
        env.insert("PYTHONUNBUFFERED", "1")
        if not FROZEN:
            env.insert("PYTHONPATH", base_dir() + os.pathsep + env.value("PYTHONPATH", ""))
        proc.setProcessEnvironment(env)
        proc.readyReadStandardOutput.connect(self._read_stdout)
        proc.readyReadStandardError.connect(self._read_stderr)
        proc.finished.connect(self._finished)
        proc.errorOccurred.connect(self._failed_to_start)
        self.process = proc

        if FROZEN:  # the packaged app runs the code itself (see run.py), no Python install needed
            proc.start(sys.executable, ["--ada-run", self.code_file])
        else:
            proc.start(sys.executable, ["-u", "-m", "ada_coder.child", self.code_file])
        self.clock.start()
        self.watchdog.start()
        self._js("setRunning", True)
        self._js("showOutput", "", False, "")

    @pyqtSlot(str)
    def submitInput(self, value):
        if self.process and self.process.state() != QProcess.NotRunning and child.WAIT in self.raw:
            # replace the waiting marker with what the child typed, so it stays in the transcript
            self.raw = self.raw.replace(child.WAIT + "\n", value + "\n", 1).replace(child.WAIT, value + "\n", 1)
            if self.wait_started is not None:
                self.paused_ms += self.clock.elapsed() - self.wait_started
                self.wait_started = None
            self._render()
            self.process.write((value + "\n").encode("utf-8"))

    @pyqtSlot()
    def notifyEmptyInput(self):
        self.stop()
        self._show_error(explain("EmptyInput", ""))

    @pyqtSlot()
    def stopCode(self):
        self.stop()
        self._js("showOutput", child.parse(self.raw)["text"] + "\n⏹ Stopped.", False, "")

    # ------------------------------------------------------------------ the running program
    def stop(self):
        """Stops the child's program (and closes its picture windows). Safe to call any time."""
        self.watchdog.stop()
        proc, self.process = self.process, None
        if proc is not None:
            for signal in (proc.readyReadStandardOutput, proc.readyReadStandardError, proc.finished, proc.errorOccurred):
                try:
                    signal.disconnect()
                except TypeError:
                    pass
            if proc.state() != QProcess.NotRunning:
                proc.kill()
                proc.waitForFinished(1000)
            proc.deleteLater()
        self._cleanup()
        self._js("setRunning", False)

    def _cleanup(self):
        if self.code_file:
            try:
                os.remove(self.code_file)
            except OSError:
                pass
            self.code_file = None

    def _read_stdout(self):
        if not self.process:
            return
        self.raw += bytes(self.process.readAllStandardOutput()).decode("utf-8", "replace")
        if len(self.raw) > OUTPUT_LIMIT:
            self.raw = self.raw[-OUTPUT_LIMIT:]
        self._render()

    def _read_stderr(self):
        if not self.process:
            return
        text = bytes(self.process.readAllStandardError()).decode("utf-8", "replace").strip()
        if text and not self.finished_reported:
            last = text.splitlines()[-1]
            name, _, message = last.partition(":")
            self.finished_reported = True
            self._show_error(explain(name.strip() or "Error", message.strip()))

    def _render(self):
        state = child.parse(self.raw)
        waiting = state["waiting"]
        if waiting and self.wait_started is None:
            self.wait_started = self.clock.elapsed()
        self._js("showOutput", state["text"], waiting, state["prompt"])
        if not self.finished_reported:
            if state["error"]:
                self.finished_reported = True
                self._show_error(state["error"])
            elif state["ok"]:
                self.finished_reported = True
                quiet = state["windows"]  # an OpenCV picture is open: celebrate quietly
                self._js("showSuccess", quiet)
                self.ran_ok.emit()
        if state["windows"]:
            self.watchdog.stop()          # waiting for the child to close the picture window
            self._js("setRunning", False)

    def _check_time(self):
        if not self.process or self.wait_started is not None:
            return
        if self.clock.elapsed() - self.paused_ms > RUN_TIME_LIMIT * 1000:
            self.stop()
            self._js("showOutput", child.parse(self.raw)["text"], False, "")
            self._show_error(explain("TimeoutError", ""))

    def _finished(self, *_):
        if self.process:
            self.raw += bytes(self.process.readAllStandardOutput()).decode("utf-8", "replace")
        self._render()
        self.watchdog.stop()
        if self.process:
            self.process.deleteLater()
            self.process = None
        self._cleanup()
        self._js("setRunning", False)

    def _failed_to_start(self, error):
        if error == QProcess.FailedToStart:
            self.stop()
            self._show_error({"title": "Couldn't start your program 😕",
                              "hint": "Close the app and open it again. If it keeps happening, ask a grown-up to reinstall it.",
                              "line": None})
