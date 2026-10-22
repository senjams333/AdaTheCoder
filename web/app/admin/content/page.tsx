'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useAdminSettingsQuery, useSaveSettingsMutation } from '@/lib/api';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch } from '@/lib/hooks';
import type { Settings } from '@/lib/types';

export default function AdminContent() {
  const { data } = useAdminSettingsQuery();
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
        <div className="field"><label htmlFor="contact_email">Contact email</label><input id="contact_email" type="email" value={form.contact_email || ''} onChange={set('contact_email')} /></div>
        <button className="btn" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save website text'}</button>
      </form>
    </>
  );
}
