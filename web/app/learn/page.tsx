'use client';

/* Ada The Coder in the browser (adathecoder.com/learn): the Windows app's own screens (desktop_app/assets/app,
 * built by the app's own Python running in the browser, see desktop_app/webhost), on tablets, phones held
 * sideways and computers. This page plays the part of the app's window (desktop_app/ada_coder/web_app.py):
 * it logs in, fetches the themes, gives the pages to the app's screen and runs the children's code. */

import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';
import { PythonRunner, type RunResult } from '@/lib/python';
import { useRequireLogin } from '@/lib/useRequireLogin';

const MIN_W = 1180, MIN_H = 700;          // the app's window is drawn at least this big, then scaled to the screen
const TIME_LIMIT = 20000;                 // ms a program may run while not waiting for an answer (as in the app)
const MISSED = 'You missed to type input 🙈';

type Signal = { connect: (f: (...a: any[]) => void) => void; emit: (...a: any[]) => void };  // eslint-disable-line @typescript-eslint/no-explicit-any
function signal(): Signal {
  const fns: ((...a: unknown[]) => void)[] = [];
  return { connect: (f) => { fns.push(f); }, emit: (...a) => fns.forEach((f) => { try { f(...a); } catch (e) { console.warn(e); } }) };
}
type Login = { ok: boolean; error?: string; name?: string; email?: string; child_name?: string; licences?: string[];
  licence_codes?: Record<string, string>; app_licence?: string; app_token?: string };

export default function LearnPage() {
  const allowed = useRequireLogin();
  const token = useAppSelector((s) => s.auth.token);
  const frame = useRef<HTMLIFrameElement>(null);
  const [stage, setStage] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [why, setWhy] = useState('');
  const [box, setBox] = useState({ w: MIN_W, h: MIN_H, s: 1 });

  // input(), sleep and Stop need this page to arrive with its isolation headers; after logging in, the website
  // opens /learn without a full page load, so load it once more, properly
  useEffect(() => {
    if (window.crossOriginIsolated) return;
    try {
      if (Date.now() - Number(sessionStorage.getItem('ada-learn-reloaded') || 0) < 15000) return;
      sessionStorage.setItem('ada-learn-reloaded', String(Date.now()));
    } catch { return; }
    window.location.reload();
  }, []);

  // keeps the app on the phone or tablet (public/learn-sw.js): after the first time it opens and runs offline
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/learn-sw.js').catch(() => undefined);
  }, []);

  // the app's window, scaled to fit the screen
  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const s = Math.min(1, vw / MIN_W, vh / MIN_H);
      setBox({ w: Math.round(vw / s), h: Math.round(vh / s), s });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (!allowed || !token) return;
    const py = new PythonRunner(true);
    const app = new AppWindow(py, token, (html) => { if (frame.current) frame.current.srcdoc = html; });
    app.start().then(() => setStage('ready'), (e: Error) => { setWhy(e.message); setStage('failed'); });
    return () => app.close();
  }, [allowed, token]);

  return (
    <div className="lw">
      <iframe ref={frame} className="lw-frame" title="Ada The Coder" allow="fullscreen; autoplay"
        style={{ width: box.w, height: box.h, transform: `scale(${box.s})`, visibility: stage === 'ready' ? 'visible' : 'hidden' }} />
      {stage !== 'ready' ? (
        <div className="lw-wait">
          <img src="/img/ada.webp" alt="" />
          {stage === 'loading'
            ? <><b>Getting Ada The Coder ready…</b><span className="lw-bar"><i /></span><small>The first time takes a little longer.</small></>
            : <><b>Ada The Coder couldn&apos;t start here.</b><small>{why || 'Check the internet connection, then refresh the page.'} Please use an up-to-date browser (Chrome, Safari or Edge).</small><a href="/account">My account</a></>}
        </div>
      ) : null}
      <div className="lw-turn"><span>🔄</span><b>Turn your tablet or phone sideways</b><small>Ada The Coder works best in landscape.</small></div>
    </div>
  );
}

/** The app's window (web_app.WebMainWindow and Host): log-in, themes, licences, the theme page and the runner. */
class AppWindow {
  host = {
    loginDone: signal(), dataChanged: signal(), themeClosed: signal(), message: signal(), themePage: signal(),
    themeUpdate: signal(), themeUnlock: signal(), lessonCall: signal(), licenceResult: signal(), fullLoading: signal(),
    login: (email: string, password: string) => void this.login(email.trim(), password),
    logout: () => void this.logout(),
    playTheme: (id: string) => void this.openTheme(id),
    themeClosedByPage: () => this.closeTheme(),
    runCode: (code: string) => this.run(code),
    submitInput: (v: string) => this.submit(v),
    emptyInput: () => this.empty(),
    upgrade: (id: string) => { this.openUrl(`${this.site}/pay?theme=${encodeURIComponent(id)}`); this.watchPayment(); },
    redeemLicence: (id: string, code: string) => void this.redeem(id, code),
    setVideoFull: (on: boolean) => this.videoFull(on),
    openUrl: (url: string) => { if (/^https?:/.test(url)) this.openUrl(url); },
    changePassword: () => this.openUrl(`${this.site}/account?change=password`),
    forgotPassword: (email: string) => this.openUrl(`${this.site}/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`),
    checkNow: () => { this.host.message.emit('🔄 Checking the website for new lessons…'); void this.refresh(true); },
  };
  private site = window.location.origin;
  private user: { full_name: string; email: string; child_name: string } | null = null;
  private appToken = '';
  private licences: string[] = [];
  private codes: Record<string, string> = {};
  private appLicence = '';
  private announcement: Record<string, unknown> = {};
  private openId: string | null = null;
  private timers: number[] = [];
  private payUntil = 0;
  // the program the child is running (LessonRunner)
  private out = ''; private waiting = false; private usedInput = false; private tooLong = false; private limit = 0;

  constructor(private py: PythonRunner, private webToken: string, private show: (html: string) => void) {}

  private api(path: string, init: RequestInit = {}, auth = this.appToken) {
    const headers: Record<string, string> = { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) };
    if (auth) headers.Authorization = `Bearer ${auth}`;
    return fetch(`${API_URL}${path}`, { ...init, headers });
  }
  private async json<T>(path: string, init: RequestInit = {}, auth = this.appToken): Promise<T> {
    const r = await this.api(path, init, auth);
    return (await r.json()) as T;
  }
  private state() {
    let last = '';
    try { last = localStorage.getItem('ada-learn-last') || ''; } catch { /* private window */ }
    return { user: this.user, licences: this.licences, licenceCodes: this.codes, appLicence: this.appLicence, announcement: this.announcement, lastCourse: last };
  }
  private take(a: Login) {
    this.user = { full_name: a.name || (a.email || '').split('@')[0], email: a.email || '', child_name: a.child_name || '' };
    this.licences = [...(a.licences || [])]; this.codes = { ...(a.licence_codes || {}) };
    this.appLicence = a.app_licence || ''; this.appToken = a.app_token || '';
  }
  private async loadCourses() {
    const r = await this.json<{ courses?: unknown[] }>('/v3/courses');
    await this.py.call('set_courses', r.courses || []);
  }

  async start() {
    (window as unknown as { ADA_HOST: unknown }).ADA_HOST = this.host;
    const [manifest, login, announcement] = await Promise.all([
      fetch('/appweb/manifest.json').then((r) => r.json()),
      this.json<Login>('/account/app-login', {}, this.webToken).catch(() => ({ ok: false } as Login)),
      this.json<Record<string, unknown>>('/v1/announcement', {}, '').catch(() => ({})),
    ]);
    if (login.ok) this.take(login);
    this.announcement = announcement;
    await this.py.start();
    await this.py.call('setup', { site: this.site, ...manifest });
    await this.loadCourses();
    let html = await this.py.call('app_page', this.state());
    // the app's page talks to its window through Qt's web channel: here, through this page
    const shim = '<script>window.qt={webChannelTransport:{}};window.QWebChannel=function(t,cb){cb({objects:{host:parent.ADA_HOST}});};' +
      'window.open=function(u){try{parent.ADA_HOST.openUrl(String(u));}catch(e){}return null;};</script>';
    html = html.replace(/<script src="qrc:[^"]*"><\/script>/g, '');
    // at the very start (after <!doctype>): a "<head>" further on can be inside the page's data
    const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
    html = doctype ? doctype[0] + shim + html.slice(doctype[0].length) : shim + html;
    this.show(html);
    this.timers.push(window.setInterval(() => void this.refresh(false), 5 * 60 * 1000));
    window.addEventListener('focus', this.onFocus);
  }

  close() {
    this.timers.forEach((t) => window.clearInterval(t));
    window.removeEventListener('focus', this.onFocus);
    this.py.close();
  }

  private onFocus = () => { if (this.payUntil > Date.now()) void this.checkLicences(false); };
  private openUrl(url: string) { window.open(url, '_blank', 'noopener'); }

  private async push() {
    this.host.dataChanged.emit(await this.py.call('data', this.state()));
  }

  /* ------------------------------------------------ log-in and log-out */
  private async login(email: string, password: string) {
    if (!email || !password) return this.host.loginDone.emit(JSON.stringify({ ok: false, error: 'Please type the email and the password.' }));
    let a: Login;
    try {
      const r = await this.api('/v3/login', { method: 'POST', body: JSON.stringify({ email, password }) }, '');
      a = (await r.json()) as Login;
    } catch {
      return this.host.loginDone.emit(JSON.stringify({ ok: false, error: "Can't reach the website. Check the internet and try again." }));
    }
    if (!a.ok) return this.host.loginDone.emit(JSON.stringify({ ok: false, error: a.error || "That email and password don't match." }));
    this.take(a);
    await this.loadCourses();
    this.host.loginDone.emit(JSON.stringify({ ok: true, user: this.user, licences: this.licences, licenceCodes: this.codes, appLicence: this.appLicence }));
    await this.push();
  }

  private async logout() {
    this.user = null; this.appToken = ''; this.licences = []; this.codes = {}; this.appLicence = '';
    await this.loadCourses();                       // bought themes go back to their free lessons
    await this.push();
  }

  /* ------------------------------------------------ themes */
  private async openTheme(id: string) {
    try { localStorage.setItem('ada-learn-last', id); } catch { /* private window */ }
    try {
      const page = await this.py.call('theme_page', { id, licences: this.licences });
      this.openId = id;
      this.host.themePage.emit(page);
    } catch (e) {
      this.host.message.emit(`That theme couldn't open (${e instanceof Error ? e.message.split('\n').pop() : e}).`);
      this.host.themeClosed.emit(false);
    }
  }

  private closeTheme() {
    this.py.stop();
    this.openId = null;
    void this.checkLicences(true);
  }

  /** New themes and lessons from the website (every 5 minutes, and "Check now"). */
  private async refresh(loud: boolean) {
    try {
      this.announcement = await this.json<Record<string, unknown>>('/v1/announcement', {}, '');
      await this.loadCourses();
      await this.push();
      if (loud) this.host.message.emit('✅ Everything is up to date.');
    } catch { if (loud) this.host.message.emit("The website can't be reached right now."); }
  }

  /* ------------------------------------------------ licences and paying */
  private watchPayment() {
    this.payUntil = Date.now() + 20 * 60 * 1000;
    const t = window.setInterval(() => {
      if (Date.now() > this.payUntil) { window.clearInterval(t); return; }
      void this.checkLicences(false);
    }, 15000);
    this.timers.push(t);
  }

  private async checkLicences(quiet: boolean) {
    if (!this.appToken) return;
    let a: Login;
    try { a = await this.json<Login>('/v3/licences'); } catch { return; }
    if (!a || !a.licences) return;
    const gained = a.licences.filter((l) => !this.licences.includes(l));
    const changed = gained.length || a.licences.length !== this.licences.length || JSON.stringify(a.licence_codes || {}) !== JSON.stringify(this.codes);
    this.codes = { ...(a.licence_codes || this.codes) };
    if (a.app_licence) this.appLicence = a.app_licence;
    if (!changed) return;
    this.licences = [...a.licences];
    if (gained.length) await this.fullChapters();
    else { await this.loadCourses(); await this.push(); }
    if (gained.length && !quiet) this.host.message.emit('🎉 Unlocked!');
  }

  /** After a theme is bought: its other lessons arrive, and the open theme unlocks in place. */
  private async fullChapters() {
    const open = this.openId;
    if (open) this.host.fullLoading.emit(true); else this.host.message.emit('📚 Making the full lessons available…');
    const started = Date.now();
    await this.loadCourses();
    await this.push();
    if (open) {
      this.host.themeUpdate.emit(await this.py.call('theme_update', { id: open, licences: this.licences }));
      await new Promise((r) => setTimeout(r, Math.max(0, 4000 - (Date.now() - started))));
      this.host.fullLoading.emit(false);
      if (this.licences.includes(open)) this.host.themeUnlock.emit();
    }
  }

  private async redeem(id: string, code: string) {
    if (!this.appToken) return this.host.licenceResult.emit(JSON.stringify({ ok: false, error: 'Please log in again, then type the licence.' }));
    let a: Login & { theme?: string };
    try {
      a = await this.json('/v3/licence', { method: 'POST', body: JSON.stringify({ licence: code, theme: id }) });
    } catch {
      a = { ok: false, error: "Can't reach the website. Check the internet connection and try again." };
    }
    if (a.licence_codes) this.codes = { ...a.licence_codes };
    const gained = (a.licences || []).some((l) => !this.licences.includes(l));
    if (a.licences) this.licences = [...a.licences];
    if (a.ok || gained) await this.fullChapters();
    this.host.licenceResult.emit(JSON.stringify({ ok: Boolean(a.ok), error: a.error || '', theme: a.theme || '' }));
  }

  private videoFull(on: boolean) {
    try {
      if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.();
      if (!on && document.fullscreenElement) void document.exitFullscreen?.();
    } catch { /* not on this device */ }
  }

  /* ------------------------------------------------ the child's program (web_app.LessonRunner) */
  private call(fn: string, args: unknown[]) { this.host.lessonCall.emit(fn, JSON.stringify(args)); }

  private run(code: string) {
    const real = code.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).join('\n').trim();
    if (!real) return this.call('handleCodeOutput', [`❌ ${MISSED}`, true, MISSED, true]);
    this.py.stop();
    this.out = ''; this.waiting = false; this.usedInput = false; this.tooLong = false;
    this.restartLimit();
    void this.py.run(code, {
      onOut: (t) => { this.out += t; if (this.usedInput) this.call('showInputLessonOutput', [this.out, this.waiting, '']); },
      onInput: () => {
        this.waiting = true; this.usedInput = true; window.clearTimeout(this.limit);     // no time limit while the child types
        this.call('showInputLessonOutput', [this.out, true, '']);
      },
    }, false).then((r) => this.done(r));
  }

  private restartLimit() {
    window.clearTimeout(this.limit);
    this.limit = window.setTimeout(() => { if (!this.waiting) { this.tooLong = true; this.py.stop(); } }, TIME_LIMIT);
  }

  private submit(v: string) {
    if (!this.waiting) return;
    this.out += ' ' + v + '\n';
    this.waiting = false;
    this.call('showInputLessonOutput', [this.out, false, '']);
    this.py.answer(v);
    this.restartLimit();
  }

  private empty() {
    this.call('handleCodeOutput', [`❌ ${MISSED}`, true, MISSED, true]);
    this.py.stop();
  }

  private done(r: RunResult) {
    window.clearTimeout(this.limit);
    const nl = () => (this.out && !this.out.endsWith('\n') ? '\n' : '');
    if (r.result === 'error') this.out += nl() + '\n' + r.text;
    else if (r.result === 'stopped' && this.tooLong) this.out += '\n⏹ Stopped: the program took too long. Is there a loop that never ends?';
    else if (r.result === 'module') this.out += nl() + (r.text === 'input'
      ? "🖥️ This program asks a question, and this browser can't show the answer box. Refresh the page or update the browser."
      : '🖥️ This program uses the camera or pictures (OpenCV), which works in the Ada The Coder app on a computer.');
    const text = this.out.replace(/^\n+|\n+$/g, '');
    const error = text.includes('❌') || text.includes('Traceback') || text.includes('⏹ Stopped');
    let msg = '';
    if (error) msg = (text.split('\n').find((l) => l.includes('❌')) || 'Something went wrong 💡').replace('❌', '').trim();
    if (this.usedInput) {
      this.call('showInputLessonOutput', [text, false, '']);
      if (!error) this.call('showGiantTeddy', [false]);
    } else {
      this.call('handleCodeOutput', [text || '✅ Code Ran Successfully! 🎉', error, msg, true]);
    }
    this.waiting = false;
  }
}
