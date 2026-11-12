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
        else if (m.type === 'out') this.pending?.h.onOut(m.text);
        else if (m.type === 'input') this.pending?.h.onInput(m.prompt);
        else if (m.type === 'done' && this.pending && this.pending.id === m.id) {
          const p = this.pending; this.pending = null;
          p.resolve({ result: m.result, text: m.text, short: m.short });
        }
      };
      w.onerror = (e) => { this.onStatus('failed'); reject(new Error(e.message || 'Python could not start.')); };
    });
    w.postMessage({ type: 'init', inputBuf: this.inputBuf, stopBuf: this.stopBuf, sleepBuf: this.sleepBuf });
    return this.ready;
  }

  async run(code: string, h: Handlers): Promise<RunResult> {
    await this.start();
    if (this.pending) this.stop();
    if (this.stopBuf) new Uint8Array(this.stopBuf)[0] = 0;
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending = { id, resolve, h };
      this.worker!.postMessage({ type: 'run', id, code });
    });
  }

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
