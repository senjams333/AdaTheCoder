'use client';

/* Ada The Coder in the browser (adathecoder.com/learn): the Windows app's own screens (desktop_app/assets/app,
 * built by the app's own Python running in the browser, see desktop_app/webhost), on tablets, phones held
 * sideways and computers. This page plays the part of the app's window (desktop_app/ada_coder/web_app.py):
 * it logs in, fetches the themes, gives the pages to the app's screen and runs the children's code. */

import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '@/lib/hooks';
import { AppWindow, MIN_H, MIN_W } from '@/lib/appWindow';
import { PythonRunner } from '@/lib/python';
import { useRequireLogin } from '@/lib/useRequireLogin';

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

