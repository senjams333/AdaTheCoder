/* Ada The Coder in the browser: runs a child's Python with Pyodide (Python made for web pages), away from the page
 * so the page never freezes. The same friendly error help as the app (explain.py, a copy of apps/engine/explain.py).
 *
 * Messages in:  {type:'init', inputBuf, stopBuf, sleepBuf}   shared memory (only when the page is cross-origin isolated)
 *               {type:'run', id, code}
 * Messages out: {type:'ready'} | {type:'failed', error} | {type:'out', text} | {type:'input', prompt}
 *               {type:'done', id, result: 'ok'|'error'|'stopped'|'module', text, short}
 */
/* global loadPyodide */
importScripts('/pyodide/pyodide.js');

let py = null, ctrl = null, bytes = null, sleeper = null;
const BLOCKED = ['cv2', 'numpy', 'turtle', 'tkinter', 'pygame', 'matplotlib', 'PIL'];

function out(text) { postMessage({ type: 'out', text: String(text) }); }

/* input(): ask the page, then wait (without using the processor) until the child has typed the answer */
function readInput(prompt) {
  if (!ctrl) return null;
  Atomics.store(ctrl, 0, 0);
  postMessage({ type: 'input', prompt: String(prompt || '') });
  Atomics.wait(ctrl, 0, 0);
  if (Atomics.load(ctrl, 0) === 2) return null;            // Stop was pressed while waiting
  const n = Atomics.load(ctrl, 1);
  return new TextDecoder().decode(bytes.slice(0, n));      // a copy: TextDecoder won't read shared memory directly
}

/* time.sleep(): really waits (the rocket countdown counts down), and Stop still works */
function sleep(seconds) {
  const ms = Math.max(0, Math.min(Number(seconds) || 0, 30) * 1000);
  if (sleeper) Atomics.wait(sleeper, 0, 0, ms);
  else { const end = Date.now() + Math.min(ms, 2000); while (Date.now() < end) { /* no shared memory: a short busy wait */ } }
}

const SETUP = `
import sys, builtins, time, ada_io
sys.path.insert(0, '/home/pyodide')
from explain import explain

class _Writer:
    n = 0
    def write(self, s):
        s = str(s)
        if not s:
            return 0
        _Writer.n += len(s)
        if _Writer.n > 200000:
            raise RuntimeError("Too much printing! The program printed so much that it was stopped.")
        ada_io.write(s)
        return len(s)
    def flush(self):
        pass

sys.stdout = sys.stderr = _Writer()

class _NoInput(Exception):
    pass

_echo = [True]     # write the child's answer after the question (the app's own lesson page shows it itself: False)

def _input(prompt=''):
    if prompt:
        sys.stdout.write(str(prompt))
    if not ada_io.can_input:
        raise _NoInput()
    answer = ada_io.read_input(str(prompt))
    if answer is None:
        raise KeyboardInterrupt()
    if _echo[0]:
        sys.stdout.write(answer + '\\n')
    return answer

builtins.input = _input
time.sleep = lambda s=0: ada_io.sleep(s)

def _ada_run(src, blocked, echo=True):
    _Writer.n = 0
    _echo[0] = bool(echo)
    scope = {'__name__': '__main__', '__builtins__': builtins}
    try:
        exec(compile(src, '<lesson>', 'exec'), scope)
        return ('ok', '', '')
    except KeyboardInterrupt:
        return ('stopped', '', '')
    except _NoInput:
        return ('module', 'input', '')
    except SystemExit:
        return ('ok', '', '')
    except BaseException as e:
        name = getattr(e, 'name', None) or ''
        if isinstance(e, ImportError) and name.split('.')[0] in blocked:
            return ('module', name.split('.')[0], '')
        try:
            text, short = explain(e, src, '<lesson>')
        except Exception:
            text, short = '❌ ' + type(e).__name__ + ': ' + str(e), 'Oops! Something went wrong 💡'
        return ('error', text, short)
`;

async function init(msg) {
  if (msg.inputBuf) {
    ctrl = new Int32Array(msg.inputBuf, 0, 2);
    bytes = new Uint8Array(msg.inputBuf, 8);
  }
  if (msg.sleepBuf) sleeper = new Int32Array(msg.sleepBuf);
  py = await loadPyodide({ indexURL: '/pyodide/' });
  if (msg.stopBuf) py.setInterruptBuffer(new Uint8Array(msg.stopBuf));
  const src = await (await fetch('/learn/explain.py')).text();
  py.FS.mkdirTree('/home/pyodide');
  py.FS.writeFile('/home/pyodide/explain.py', src);
  py.registerJsModule('ada_io', { write: out, read_input: readInput, sleep, can_input: Boolean(ctrl) });
  py.runPython(SETUP);
  if (msg.appweb) {                      // the desktop app's own pages (adathecoder.com/learn)
    const zip = await (await fetch('/appweb/app.zip')).arrayBuffer();
    py.unpackArchive(zip, 'zip', { extractDir: '/' });
    py.runPython("import sys\nsys.path.insert(0, '/app')\nimport webhost");
  }
}

let ready = null;
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    ready = init(m).then(() => postMessage({ type: 'ready' }), (err) => postMessage({ type: 'failed', error: String(err) }));
    return;
  }
  if (m.type === 'call') {               // webhost.<fn>(arg) -> text (the app's pages)
    await ready;
    try {
      const f = py.pyimport('webhost')[m.fn];
      postMessage({ type: 'answer', id: m.id, ok: true, value: String(f(m.arg)) });
    } catch (err) {
      postMessage({ type: 'answer', id: m.id, ok: false, value: String(err) });
    }
    return;
  }
  if (m.type === 'run') {
    await ready;
    let result = ['error', '❌ Python could not start in this browser.', 'Oops! Something went wrong 💡'];
    try {
      const run = py.globals.get('_ada_run');
      const blocked = py.toPy(BLOCKED);
      const r = run(m.code, blocked, m.echo !== false);
      result = r.toJs();
      r.destroy(); blocked.destroy(); run.destroy();
    } catch (err) {
      result = ['error', '❌ ' + String(err).split('\n').slice(-2).join(' '), 'Oops! Something went wrong 💡'];
    }
    postMessage({ type: 'done', id: m.id, result: result[0], text: result[1], short: result[2] });
  }
};
