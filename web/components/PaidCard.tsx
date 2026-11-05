'use client';

import Link from 'next/link';
import { useState } from 'react';

/** The licence in a box with a Copy button (pay success page and the parent's account page). */
export function LicenceCopy({ code, big }: { code: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, () => fallback(code, done));
    else fallback(code, done);
  }
  return (
    <div className={`licence-copy${big ? ' big' : ''}`}>
      <div className="licence-copy-code"><span>Your licence</span><b>{code}</b></div>
      <button type="button" className="licence-copy-btn" onClick={copy} aria-live="polite">{copied ? 'Copied ✓' : 'Copy'}</button>
    </div>
  );
}

function fallback(code: string, done: () => void) {
  const t = document.createElement('textarea');
  t.value = code; document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); done(); } finally { t.remove(); }
}

/** How the licence reaches the app. */
export function UnlockSteps() {
  return (
    <ol className="unlock-steps">
      <li><b>Open Ada The Coder</b> on your computer. The theme unlocks by itself within a minute.</li>
      <li>Not unlocked? In the theme, press <b>Upgrade ⭐</b> → <b>I have a licence 🔑</b>, paste the licence and press OK.</li>
    </ol>
  );
}

/** The landing page after a payment: "Payment successful", the licence to copy, and how to unlock it in the app. */
export default function PaidCard({ licence, themeName, themeSlug, email, already }:
  { licence: string; themeName: string; themeSlug: string; email?: string; already?: boolean }) {
  return (
    <div className="paid-card">
      <div className="pay-done-icon" aria-hidden="true">✓</div>
      <h1>{already ? `${themeName} is yours ✓` : 'Payment successful 🎉'}</h1>
      <p className="sub">{already ? 'You already have the licence for this theme.' : <>Thank you! <b>{themeName}</b> is unlocked for your family. Every lesson is open.</>}</p>
      <LicenceCopy code={licence} big />
      {!already ? <p className="sub paid-mail">We&apos;ve emailed the licence{email ? <> to <b>{email}</b></> : null} too. Keep it safe.</p> : null}
      <h2 className="paid-h2">Unlock it in the app</h2>
      <UnlockSteps />
      <div className="paid-actions">
        <Link className="btn" href={`/account?theme=${encodeURIComponent(themeSlug)}`}>Go to my account</Link>
      </div>
    </div>
  );
}
