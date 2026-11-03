'use client';

import { FormEvent, useState } from 'react';
import BusinessDetails, { useContact } from '@/components/BusinessDetails';
import { API_URL } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';

/** Contact page: a short form that emails the admin (replies go straight to the person), plus the contact email. */
export default function ContactPage() {
  const { email } = useContact();
  const { user } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', subject: '', message: '', website: '' });
  const [state, setState] = useState<{ busy?: boolean; ok?: string; error?: string }>({});
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const res = await fetch(`${API_URL}/site/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m = (data as { message?: string | string[] }).message;
        throw new Error(Array.isArray(m) ? m.join(' ') : m || 'Something went wrong. Please try again.');
      }
      setState({ ok: (data as { message?: string }).message || 'Thank you! Your message has been sent.' });
      setForm({ ...form, subject: '', message: '' });
    } catch (err) {
      setState({ error: (err as Error).message });
    }
  }

  return (
    <div className="contact-page wrap">
      <div className="contact-intro">
        <img src="/img/ada-face.png" alt="" />
        <h1>Write to Ada The Coder</h1>
        <p>Questions about the lessons, the app, a payment or your licence? Send us a note and we&apos;ll reply by email.</p>
        <p className="contact-mail">Or email us at <a href={`mailto:${email}`}>{email}</a></p>
        <BusinessDetails />
      </div>
      <form className="contact-card" onSubmit={submit}>
        {state.ok ? (
          <div className="contact-done" role="status">
            <div className="contact-done-emoji">💌</div>
            <h2>Message sent!</h2>
            <p>{state.ok}</p>
            <button type="button" className="btn" onClick={() => setState({})}>Write another message</button>
          </div>
        ) : (
          <>
            <div className="field"><label htmlFor="c-name">Your name</label><input id="c-name" required maxLength={80} value={form.name} onChange={set('name')} /></div>
            <div className="field"><label htmlFor="c-email">Your email</label><input id="c-email" type="email" required maxLength={160} value={form.email} onChange={set('email')} /></div>
            <div className="field"><label htmlFor="c-subject">Subject</label>
              <select id="c-subject" value={form.subject} onChange={set('subject')}>
                <option value="">Choose one…</option>
                <option>A question about the lessons</option>
                <option>Help installing the app</option>
                <option>Payments and licences</option>
                <option>Ideas and feedback</option>
                <option>Something else</option>
              </select>
            </div>
            <div className="field"><label htmlFor="c-message">Message</label><textarea id="c-message" required rows={6} maxLength={4000} value={form.message} onChange={set('message')} /></div>
            <input className="contact-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} />
            {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
            <button className="btn" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send message ✉️'}</button>
          </>
        )}
      </form>
    </div>
  );
}
