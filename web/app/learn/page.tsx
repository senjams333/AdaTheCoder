'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import CodeEditor from '@/components/learn/CodeEditor';
import { useGetLearnQuery } from '@/lib/api';
import { PythonRunner, type RunResult } from '@/lib/python';
import type { LearnCourse, LearnLesson } from '@/lib/types';
import { useRequireLogin } from '@/lib/useRequireLogin';

/* ---------- remembered on this device: the last theme and lesson, and each lesson's code ---------- */
const KEY = 'ada-learn';
type Saved = { theme?: string; lesson?: Record<string, number>; code?: Record<string, string> };
function load(): Saved { try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Saved; } catch { return {}; } }
function save(change: (s: Saved) => void) { try { const s = load(); change(s); localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window */ } }

const MODULE_HELP: Record<string, string> = {
  cv2: 'This lesson uses the camera and pictures (OpenCV).',
  numpy: 'This lesson uses numpy.',
  turtle: 'This lesson draws with turtle.',
  tkinter: 'This lesson opens windows (tkinter).',
  pygame: 'This lesson makes a game window (pygame).',
  matplotlib: 'This lesson draws charts.',
  PIL: 'This lesson edits pictures.',
};

export default function LearnPage() {
  const allowed = useRequireLogin();
  const { data, error, isLoading } = useGetLearnQuery(undefined, { skip: !allowed });
  const [runner, setRunner] = useState<PythonRunner | null>(null);
  const [pyStatus, setPyStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [themeId, setThemeId] = useState<string | null>(null);

  // input() and the Stop button need this page to arrive with its isolation headers. After logging in, the
  // website opens /learn without a full page load, so load it once more, properly.
  useEffect(() => {
    if (typeof window === 'undefined' || window.crossOriginIsolated) return;
    try {                                   // only once in a while, so a browser without isolation never loops
      if (Date.now() - Number(sessionStorage.getItem('ada-learn-reloaded') || 0) < 15000) return;
      sessionStorage.setItem('ada-learn-reloaded', String(Date.now()));
    } catch { return; }
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const r = new PythonRunner();
    r.onStatus = setPyStatus;
    setRunner(r);
    r.start().catch(() => undefined);
    return () => r.close();
  }, [allowed]);

  useEffect(() => { if (data && themeId === null) { const t = load().theme; if (t && data.courses.some((c) => c.id === t)) setThemeId(t); } }, [data, themeId]);

  const course = data?.courses.find((c) => c.id === themeId) || null;
  const open = (id: string | null) => { setThemeId(id); save((s) => { s.theme = id || undefined; }); window.scrollTo(0, 0); };

  return (
    <div className="lr">
      <header className="lr-top">
        <a className="lr-brand" href="/"><img src="/img/ada-face.png" alt="" /><span>Ada The Coder</span></a>
        <nav>
          {course ? <button type="button" className="lr-btn lr-btn-ghost" onClick={() => open(null)}>🏠 Themes</button> : null}
          <a className="lr-btn lr-btn-ghost" href="/account">My account</a>
        </nav>
      </header>

      {!allowed || isLoading ? <p className="lr-wait">Loading… ✨</p> : null}
      {error ? <p className="lr-wait">The lessons couldn&apos;t be loaded. Check the internet connection and refresh the page.</p> : null}
      {pyStatus === 'failed' ? <p className="lr-warn">Python couldn&apos;t start in this browser. Please update the browser (Chrome, Safari, Edge or Firefox), or use the Ada The Coder app on a computer.</p> : null}

      {data && !course ? <Themes courses={data.courses} childName={data.childName} onOpen={open} /> : null}
      {data && course && runner ? <Theme key={course.id} course={course} runner={runner} pyReady={pyStatus === 'ready'} /> : null}
    </div>
  );
}

/* ---------- the themes, as cards ---------- */
function Themes({ courses, childName, onOpen }: { courses: LearnCourse[]; childName: string; onOpen: (id: string) => void }) {
  return (
    <section className="lr-home">
      <h1>{childName ? `Hi ${childName}! ` : ''}Pick a theme 🌟</h1>
      <p className="lr-sub">Write real Python right here, on a tablet, phone or computer.</p>
      <div className="lr-cards">
        {courses.map((c) => {
          const free = c.lessons.filter((l) => !l.locked).length;
          return (
            <button type="button" key={c.id} className="lr-card" onClick={() => onOpen(c.id)}>
              {c.is_new ? <span className="lr-new">NEW</span> : null}
              <span className="lr-card-pic">
                {c.cover ? <img src={c.cover.url} alt="" /> : (c.images.length ? c.images : ['/img/ada.webp']).slice(0, 3).map((src) => <img key={src} src={src} alt="" />)}
              </span>
              <b>{c.name}</b>
              <span className="lr-card-tag">{c.tagline}</span>
              <span className={`lr-badge ${c.full ? (c.premium ? 'own' : 'free') : 'try'}`}>
                {!c.premium ? 'Free' : c.full ? 'Purchased ✓' : `${free} free lesson${free === 1 ? '' : 's'}`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- one theme: the lesson list and the open lesson ---------- */
function Theme({ course, runner, pyReady }: { course: LearnCourse; runner: PythonRunner; pyReady: boolean }) {
  const [i, setI] = useState(() => Math.min(load().lesson?.[course.id] ?? 0, course.lessons.length - 1));
  const [listOpen, setListOpen] = useState(false);
  const lesson = course.lessons[i];
  const pick = (n: number) => { setI(n); setListOpen(false); save((s) => { s.lesson = { ...(s.lesson || {}), [course.id]: n }; }); window.scrollTo(0, 0); };
  if (!lesson) return <p className="lr-wait">This theme has no lessons yet.</p>;
  return (
    <div className="lr-theme">
      <aside className={listOpen ? 'lr-side open' : 'lr-side'}>
        <button type="button" className="lr-side-toggle" onClick={() => setListOpen(!listOpen)} aria-expanded={listOpen}>
          <span>{lesson.emoji} {i + 1}. {lesson.name}</span><span aria-hidden="true">{listOpen ? '▲' : '▼'}</span>
        </button>
        <h2>{course.name}</h2>
        <ol>
          {course.lessons.map((l, n) => (
            <li key={l.id}>
              <button type="button" className={n === i ? 'on' : ''} onClick={() => pick(n)}>
                <span className="lr-emoji">{l.locked ? '🔒' : l.emoji}</span><span>{l.name}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <main className="lr-main">
        {lesson.locked
          ? <Locked course={course} lesson={lesson} />
          : <Lesson key={lesson.id} course={course} lesson={lesson} runner={runner} pyReady={pyReady}
              next={i + 1 < course.lessons.length ? () => pick(i + 1) : null} />}
      </main>
    </div>
  );
}

function Locked({ course, lesson }: { course: LearnCourse; lesson: LearnLesson }) {
  return (
    <section className="lr-locked">
      <div className="lr-locked-icon">🔒</div>
      <h1>{lesson.title || lesson.name}</h1>
      <p>This lesson opens when a grown-up buys <b>{course.name}</b>. Every lesson of the theme then opens here and in the app.</p>
      <a className="lr-btn lr-btn-sun" href={`/pay?theme=${encodeURIComponent(course.id)}`}>Unlock the theme</a>
      <p className="lr-small">Ask a grown-up to do this. It&apos;s a one-time payment.</p>
    </section>
  );
}

/* ---------- a lesson: video, examples, the code box and what it shows ---------- */
type Line = { kind: 'out' | 'err' | 'info'; text: string };

function Lesson({ course, lesson, runner, pyReady, next }: { course: LearnCourse; lesson: LearnLesson; runner: PythonRunner; pyReady: boolean; next: (() => void) | null }) {
  const codeKey = `${course.id}/${lesson.id}`;
  const [code, setCode] = useState(() => load().code?.[codeKey] ?? lesson.default_code ?? '');
  const [out, setOut] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [cheer, setCheer] = useState<{ ok: boolean; text: string } | null>(null);
  const [ex, setEx] = useState(0);
  const outBox = useRef<HTMLDivElement>(null);
  const answerBox = useRef<HTMLInputElement>(null);
  const friend = useMemo(() => course.characters[0]?.url || course.images[0] || '/img/ada.webp', [course]);
  const video = lesson.video?.url || '';

  useEffect(() => { const t = setTimeout(() => save((s) => { s.code = { ...(s.code || {}), [codeKey]: code }; }), 400); return () => clearTimeout(t); }, [code, codeKey]);
  useEffect(() => { if (outBox.current) outBox.current.scrollTop = outBox.current.scrollHeight; }, [out, asking]);
  useEffect(() => { if (asking !== null) answerBox.current?.focus(); }, [asking]);
  useEffect(() => { if (!cheer) return; const t = setTimeout(() => setCheer(null), cheer.ok ? 2600 : 4200); return () => clearTimeout(t); }, [cheer]);

  async function run(src = code) {
    if (running) return;
    setOut([]); setCheer(null); setRunning(true);
    outBox.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });   // what it shows, on screen
    const add = (l: Line) => setOut((o) => {
      if (l.kind === 'out' && o.length && o[o.length - 1].kind === 'out') return [...o.slice(0, -1), { kind: 'out', text: o[o.length - 1].text + l.text }];
      return [...o, l];
    });
    let r: RunResult;
    try {
      r = await runner.run(src, { onOut: (t) => add({ kind: 'out', text: t }), onInput: (p) => { setAnswer(''); setAsking(p); } });
    } catch {
      r = { result: 'error', text: '❌ Python could not start in this browser.', short: 'Oops! Something went wrong 💡' };
    }
    setAsking(null); setRunning(false);
    if (r.result === 'ok') setCheer({ ok: true, text: 'It works! 🎉' });
    else if (r.result === 'error') { add({ kind: 'err', text: r.text }); setCheer({ ok: false, text: r.short }); }
    else if (r.result === 'stopped') add({ kind: 'info', text: '⏹ Stopped.' });
    else if (r.result === 'module') add({ kind: 'info', text: r.text === 'input' ? '🖥️ This program asks a question (input), and this browser can\'t show the answer box. Refresh the page, or update the browser. It also works in the Ada The Coder app on a computer.' : `🖥️ ${MODULE_HELP[r.text] || 'This lesson needs an extra helper.'} That works in the Ada The Coder app on a computer; in the browser, try the other lessons!` });
  }

  function send(e: FormEvent) { e.preventDefault(); runner.answer(answer); setAsking(null); }
  const e0 = lesson.examples[ex];

  return (
    <article className="lr-lesson">
      <h1>{lesson.title || lesson.name}</h1>
      {lesson.subtitle ? <p className="lr-sub">{lesson.subtitle}</p> : null}

      {video ? (
        <details className="lr-video" open>
          <summary>🎬 Lesson video</summary>
          <video src={video} controls playsInline preload="metadata" />
        </details>
      ) : null}

      {lesson.examples.length ? (
        <section className="lr-examples">
          <h2>Examples to try</h2>
          <div className="lr-tabs" role="tablist">
            {lesson.examples.map((x, n) => (
              <button type="button" role="tab" aria-selected={n === ex} key={n} className={n === ex ? 'on' : ''} onClick={() => setEx(n)}>{x.label || `Example ${n + 1}`}</button>
            ))}
          </div>
          {e0 ? (
            <div className="lr-example">
              {e0.explain ? <p>{e0.explain}</p> : null}
              <pre>{e0.code}</pre>
              <button type="button" className="lr-btn" onClick={() => { setCode(e0.code); void run(e0.code); }} disabled={!pyReady || running}>▶ Try this example</button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="lr-code">
        <h2>Your code</h2>
        <CodeEditor value={code} onChange={setCode} onRun={() => void run()} />
        <div className="lr-actions">
          {running
            ? <button type="button" className="lr-btn lr-btn-stop" onClick={() => runner.stop()}>■ Stop</button>
            : <button type="button" className="lr-btn lr-btn-run" onClick={() => void run()} disabled={!pyReady}>{pyReady ? '▶ RUN CODE' : '⏳ Getting Python ready…'}</button>}
          <button type="button" className="lr-btn lr-btn-ghost" onClick={() => { setCode(lesson.default_code || ''); setOut([]); }} disabled={running}>↺ Start again</button>
        </div>
        <div className="lr-out" ref={outBox} aria-live="polite">
          <div className="lr-out-label">What it shows</div>
          {out.length || asking !== null ? out.map((l, n) => <pre key={n} className={`lr-${l.kind}`}>{l.text}</pre>) : <pre className="lr-info">Press RUN CODE to see what your program does.</pre>}
          {asking !== null ? (
            <form className="lr-ask" onSubmit={send}>
              <input ref={answerBox} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer…" autoCapitalize="off" autoCorrect="off" />
              <button className="lr-btn">Enter ⏎</button>
            </form>
          ) : null}
        </div>
        {next ? <div className="lr-next"><button type="button" className="lr-btn lr-btn-sun" onClick={next}>Next lesson ➜</button></div> : null}
      </section>

      {cheer ? (
        <div className={cheer.ok ? 'lr-cheer ok' : 'lr-cheer oops'} role="status" onClick={() => setCheer(null)}>
          <img src={cheer.ok ? friend : '/img/byte.webp'} alt="" />
          <span>{cheer.text}</span>
        </div>
      ) : null}
    </article>
  );
}
