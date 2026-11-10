'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useAdminSettingsQuery, useSaveSettingsMutation, useThemesQuery } from '@/lib/api';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch } from '@/lib/hooks';
import type { Settings } from '@/lib/types';

export default function AdminContent() {
  const { data } = useAdminSettingsQuery();
  const { data: themes } = useThemesQuery();
  const [form, setForm] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [save, { isLoading }] = useSaveSettingsMutation();
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);
  if (!form) return <p className="muted">Loading…</p>;
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await save(form!).unwrap();
      dispatch(flash('success', res.message || 'Website text saved.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  return (
    <>
      <h1>Website text</h1>
      <FormErrors errors={errors} />
      <form className="card" onSubmit={submit}>
        <div className="field"><label htmlFor="hero_title">Main headline</label><input id="hero_title" type="text" value={form.hero_title || ''} onChange={set('hero_title')} /></div>
        <div className="field"><label htmlFor="hero_subtitle">Text under the headline</label><textarea id="hero_subtitle" rows={3} value={form.hero_subtitle || ''} onChange={set('hero_subtitle')} /></div>
        <div className="field">
          <label htmlFor="site_banner">Website banner</label>
          <input id="site_banner" type="text" value={form.site_banner || ''} onChange={set('site_banner')} />
          <span className="help">A yellow strip at the top of every page, for news like &quot;New turtle lessons are here!&quot;. Leave empty to hide it.</span>
        </div>
        <div className="field">
          <label htmlFor="app_message">Message in the app</label>
          <input id="app_message" type="text" value={form.app_message || ''} onChange={set('app_message')} />
          <span className="help">Kids see this as a pop-up the next time they open the app, once per new message. Keep it short and friendly, or leave it empty for no pop-up.</span>
        </div>
        <h2 style={{ marginTop: 26 }}>Ada The Coder app: home screen</h2>
        <div className="field">
          <label htmlFor="app_welcome">Greeting</label>
          <input id="app_welcome" type="text" value={form.app_welcome || ''} onChange={set('app_welcome')} placeholder="Welcome to Ada The Coder" />
          <span className="help">The big line on the app&apos;s home screen. When a child is logged in, it starts with &quot;Hi Alex !&quot;.</span>
        </div>
        <div className="field">
          <label htmlFor="app_home_theme">Characters on the home screen</label>
          <select id="app_home_theme" value={form.app_home_theme || ''} onChange={set('app_home_theme')}>
            <option value="">Tom, Ada and Unicorn (built into the app)</option>
            {(themes || []).map((t) => <option key={t.slug} value={t.slug}>{t.name}&apos;s characters</option>)}
          </select>
          <span className="help">Pick a theme to show its characters instead. New themes are added on the Themes page: tick &quot;Show this theme in the app&quot; and give it at least one live lesson, and it appears in every installed app the next time the app checks the website (at start, then every few minutes).</span>
        </div>
        <h2 style={{ marginTop: 26 }}>Ada The Coder app: break reminder</h2>
        <p className="muted">After this many minutes of using the app, children see a short break (&quot;The Quick Reset&quot;). Installed apps pick up changes within a minute.</p>
        <div className="field">
          <label htmlFor="break_minutes">Show a break every (minutes)</label>
          <input id="break_minutes" type="number" min={0} max={240} value={form.break_minutes ?? '30'} onChange={set('break_minutes')} />
          <span className="help">30 is the default. 0 turns the break reminder off.</span>
        </div>
        <div className="field"><label htmlFor="break_title">Title</label><input id="break_title" type="text" value={form.break_title || ''} onChange={set('break_title')} /></div>
        <div className="field">
          <label htmlFor="break_intro">Message under the title</label>
          <textarea id="break_intro" rows={2} value={form.break_intro || ''} onChange={set('break_intro')} />
          <span className="help">{'{minutes}'} is replaced with the number of minutes.</span>
        </div>
        <div className="field">
          <label htmlFor="break_steps">Steps (one per line)</label>
          <textarea id="break_steps" className="code" rows={6} spellCheck={false} value={form.break_steps || ''} onChange={set('break_steps')} />
          <span className="help">Each line: <code>emoji | title | what to do</code>, for example <code>💧 | 4. Drink (Hydration) | Take 3 big sips of water.</code> Up to 8 steps.</span>
        </div>
        <div className="field"><label htmlFor="break_button">Button</label><input id="break_button" type="text" value={form.break_button || ''} onChange={set('break_button')} /></div>
        <div className="field">
          <label className="check"><input type="checkbox" checked={(form.break_lock ?? '1') === '1'}
            onChange={(e) => setForm({ ...form, break_lock: e.target.checked ? '1' : '0' })} />
            <span>Lock the app during the break: children can&apos;t close it until the break time is over (good for their eyes and health)</span></label>
          <span className="help">Untick to let children close the break at once and carry on coding.</span>
        </div>
        {(form.break_lock ?? '1') === '1' ? (
          <div className="field">
            <label htmlFor="break_lock_minutes">Break length (minutes)</label>
            <input id="break_lock_minutes" type="number" min={1} max={30} value={form.break_lock_minutes ?? '5'} onChange={set('break_lock_minutes')} />
            <span className="help">5 is the default. The button shows a countdown and works when it reaches 0.</span>
          </div>
        ) : null}
        {(() => {
          const steps = (form.break_steps || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.some(Boolean)).slice(0, 8);
          return (
            <div className="brk-admin-preview" aria-label="Preview of the break">
              <b>{form.break_title}</b>
              <p>{(form.break_intro || '').replace(/\{minutes\}/g, form.break_minutes || '30')}</p>
              <ul>{steps.map((p, i) => <li key={i}><span>{p.length >= 3 ? p[0] : '⭐'}</span> <b>{p.length >= 3 ? p[1] : p[0]}</b> {p.length >= 3 ? p.slice(2).join(' | ') : p[1] || ''}</li>)}</ul>
              <span className="brk-admin-btn">{form.break_button}</span>
            </div>
          );
        })()}

        <h2 style={{ marginTop: 26 }}>Website</h2>
        <div className="field">
          <label htmlFor="parents_note">Note for parents</label>
          <textarea id="parents_note" rows={3} value={form.parents_note || ''} onChange={set('parents_note')} />
          <span className="help">Shown in the &quot;Made with parents in mind&quot; section on the home page.</span>
        </div>
        <div className="field">
          <label htmlFor="author_name">Author&apos;s name</label>
          <input id="author_name" type="text" value={form.author_name || ''} onChange={set('author_name')} />
          <span className="help">Signs the &quot;A note from the author&quot; letter near the end of the home page.</span>
        </div>
        <div className="field">
          <label htmlFor="author_note">Note from the author</label>
          <textarea id="author_note" rows={10} value={form.author_note || ''} onChange={set('author_note')} />
          <span className="help">Leave an empty line between paragraphs. Your signature is added below it automatically.</span>
        </div>
        <div className="field">
          <label htmlFor="business_details">Business details</label>
          <textarea id="business_details" rows={4} value={form.business_details || ''} onChange={set('business_details')} />
          <span className="help">Your legal name, postal address and phone, one per line. Shown on the Terms and Policies pages (Razorpay and PayPal ask for these).</span>
        </div>
        <div className="field">
          <label htmlFor="policy_purchases">Purchases and cancellation (Policies page)</label>
          <textarea id="policy_purchases" rows={12} value={form.policy_purchases || ''} onChange={set('policy_purchases')} />
          <span className="help">Leave an empty line between paragraphs. Start a line with &quot;- &quot; for a bullet point; &quot;Title: text&quot; in a bullet makes the title bold. Write {'{email}'} where the contact email should go.</span>
        </div>
        <div className="field">
          <label htmlFor="install_video_url">Installation tutorial video (YouTube link)</label>
          <input id="install_video_url" type="url" placeholder="https://www.youtube.com/watch?v=…" value={form.install_video_url || ''} onChange={set('install_video_url')} />
          <span className="help">Linked from Byte&apos;s bubble next to &quot;Up and coding in three steps&quot; on the home page.</span>
        </div>
        <div className="row-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="field"><label htmlFor="social_youtube">YouTube channel link</label><input id="social_youtube" type="url" value={form.social_youtube || ''} onChange={set('social_youtube')} /></div>
          <div className="field"><label htmlFor="social_x">X (Twitter) link</label><input id="social_x" type="url" value={form.social_x || ''} onChange={set('social_x')} /></div>
          <div className="field"><label htmlFor="social_facebook">Facebook page link</label><input id="social_facebook" type="url" value={form.social_facebook || ''} onChange={set('social_facebook')} /></div>
        </div>
        <p className="help muted" style={{ marginTop: -8 }}>The footer shows YouTube, X and Facebook buttons; empty links stay on the page until you add them.</p>
        <div className="field"><label htmlFor="contact_email">Contact email</label><input id="contact_email" type="email" value={form.contact_email || ''} onChange={set('contact_email')} /></div>
        <button className="btn" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save website text'}</button>
      </form>
    </>
  );
}
