/** Python in the browser (adathecoder.com/learn): starts the worker in public/learn/py-worker.js and runs a child's
 *  code in it. input(), time.sleep() and the Stop button need shared memory, which browsers allow only on a page
 *  sent with the isolation headers (next.config.mjs adds them to /learn). Without it, code still runs; input() then
 *  explains that the browser can't ask questions, and Stop restarts Python. */

export type RunResult = { result: 'ok' | 'error' | 'stopped' | 'module'; text: string; short: string };
type Handlers = { onOut: (text: string) => void; onInput: (prompt: string) => void };

export class PythonRunner {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private inputBuf: SharedArrayBuffer | null = null;
  private stopBuf: SharedArrayBuffer | null = null;
  private sleepBuf: SharedArrayBuffer | null = null;
  private pending: { id: number; resolve: (r: RunResult) => void; h: Handlers } | null = null;
  private nextId = 1;
  private calls = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();
  /** setup and set_courses, given again to a fresh Python (after Stop had to restart it) */
  private kept = new Map<string, string>();
  /** appweb: also load the desktop app's own pages (web/public/appweb), for call() */
  constructor(private readonly appweb = false) {}
  onStatus: (s: 'loading' | 'ready' | 'failed') => void = () => undefined;

  /** True when input(), sleep and Stop work fully (the page is cross-origin isolated). */
  get shared(): boolean {
    return typeof SharedArrayBuffer !== 'undefined' && typeof window !== 'undefined' && window.crossOriginIsolated === true;
  }

  start(): Promise<void> {
    if (this.ready) return this.ready;
    this.onStatus('loading');
    const w = new Worker('/learn/py-worker.js');
    this.worker = w;
    if (this.shared) {
      this.inputBuf = new SharedArrayBuffer(8 + 16384);
      this.stopBuf = new SharedArrayBuffer(1);
      this.sleepBuf = new SharedArrayBuffer(4);
    }
    this.ready = new Promise((resolve, reject) => {
      w.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === 'ready') { this.onStatus('ready'); resolve(); }
        else if (m.type === 'failed') { this.onStatus('failed'); reject(new Error(m.error)); }
        else if (m.type === 'answer') {
          const c = this.calls.get(m.id); this.calls.delete(m.id);
          if (c) { if (m.ok) c.resolve(m.value); else c.reject(new Error(m.value)); }
        }
        else if (m.type === 'out') this.pending?.h.onOut(m.text);
        else if (m.type === 'input') this.pending?.h.onInput(m.prompt);
        else if (m.type === 'done' && this.pending && this.pending.id === m.id) {
          const p = this.pending; this.pending = null;
          p.resolve({ result: m.result, text: m.text, short: m.short });
        }
      };
      w.onerror = (e) => { this.onStatus('failed'); reject(new Error(e.message || 'Python could not start.')); };
    });
    w.postMessage({ type: 'init', inputBuf: this.inputBuf, stopBuf: this.stopBuf, sleepBuf: this.sleepBuf, appweb: this.appweb });
    for (const [fn, arg] of this.kept) this.send(fn, arg).catch(() => undefined);   // queued after init
    return this.ready;
  }

  async run(code: string, h: Handlers, echo = true): Promise<RunResult> {
    await this.start();
    if (this.pending) {                     // a program is still running: stop it and wait until it has stopped
      this.stop();
      for (let i = 0; this.pending && i < 150; i++) await new Promise((r) => setTimeout(r, 20));
      if (this.pending) { const p = this.pending; this.pending = null; this.worker?.terminate(); this.worker = null; this.ready = null; p.resolve({ result: 'stopped', text: '', short: '' }); await this.start(); }
    }
    if (this.stopBuf) new Uint8Array(this.stopBuf)[0] = 0;
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending = { id, resolve, h };
      this.worker!.postMessage({ type: 'run', id, code, echo });
    });
  }

  /** webhost.<fn>(arg) in Python (the desktop app's pages): its answer as text. */
  async call(fn: string, arg: unknown): Promise<string> {
    const text = typeof arg === 'string' ? arg : JSON.stringify(arg);
    if (fn === 'setup' || fn === 'set_courses') this.kept.set(fn, text);
    await this.start();
    return this.send(fn, text);
  }

  private send(fn: string, arg: string): Promise<string> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.calls.set(id, { resolve, reject });
      this.worker!.postMessage({ type: 'call', id, fn, arg });
    });
  }

  /** True while a program is running (or waiting for an answer). */
  get busy(): boolean { return this.pending !== null; }

  /** The child's answer to input(). */
  answer(text: string) {
    if (!this.inputBuf) return;
    const ctrl = new Int32Array(this.inputBuf, 0, 2);
    const bytes = new Uint8Array(this.inputBuf, 8);
    const enc = new TextEncoder().encode(text).slice(0, bytes.length);
    bytes.set(enc);
    Atomics.store(ctrl, 1, enc.length);
    Atomics.store(ctrl, 0, 1);
    Atomics.notify(ctrl, 0);
  }

  /** Stop the running program (a loop that never ends, or waiting for an answer). */
  stop() {
    if (!this.pending) return;
    if (this.stopBuf && this.inputBuf) {
      new Uint8Array(this.stopBuf)[0] = 2;                 // Python stops at its next step (KeyboardInterrupt)
      const ctrl = new Int32Array(this.inputBuf, 0, 2);
      Atomics.store(ctrl, 0, 2); Atomics.notify(ctrl, 0);  // ...also while it waits for an answer
      if (this.sleepBuf) Atomics.notify(new Int32Array(this.sleepBuf), 0);
      return;
    }
    // no shared memory: start a fresh Python (the old one may be stuck in a loop)
    const p = this.pending; this.pending = null;
    this.worker?.terminate(); this.worker = null; this.ready = null;
    p.resolve({ result: 'stopped', text: '', short: '' });
    void this.start();
  }

  close() { this.worker?.terminate(); this.worker = null; this.ready = null; this.pending = null; }
}
