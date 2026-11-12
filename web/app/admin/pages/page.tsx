'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import FilePick from '@/components/FilePick';
import { FormErrors } from '@/components/Flashes';
import { useAdminSettingsQuery, useSaveSettingsMutation } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import type { Settings } from '@/lib/types';
import { sendFile } from '@/lib/upload';

type Item = Record<string, string>;
type Field = { key: string; label: string; kind?: 'line' | 'text' | 'picture'; rows?: number };

function parse(json: string | undefined): Item[] {
  try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** A friend's picture: shown, and a new one uploaded as soon as it's chosen (it shows on the website after Save). */
function PictureField({ value, onChange, id }: { value: string; onChange: (url: string) => void; id: string }) {
  const token = useAppSelector((s) => s.auth.token);
  const [sent, setSent] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function upload(f: File | null) {
    if (!f) return;
    const fd = new FormData();
    fd.append('picture', f);
    setMsg(null); setSent(0);
    try {
      const r = await sendFile<{ url: string; message?: string }>('POST', `${API_URL}/admin/site-picture`, fd, token, setSent, 'picture');
      onChange(r.url);
      setMsg({ ok: true, text: `✓ ${r.message || 'Picture added.'}` });
    } catch (err) {
      setMsg({ ok: false, text: `✗ ${err instanceof Error ? err.message : 'The picture could not be uploaded.'}` });
    } finally { setSent(null); }
  }
  return (
    <div className="field">
      <label htmlFor={id}>Picture</label>
      <div className="sec-pic">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" /> : <span className="muted">No picture</span>}
        <FilePick id={id} file={null} onFile={upload} button="Change picture…" dropHint="A .png or .webp with a see-through background looks best" />
      </div>
      {sent !== null ? <p className="muted">{sent < 1 ? `Uploading… ${Math.round(sent * 100)}%` : 'Saving…'}</p> : null}
      {msg ? <p className={msg.ok ? 'upload-msg ok' : 'upload-msg bad'} role="status">{msg.text}</p> : null}
    </div>
  );
}

/** A list the admin keeps in order: each item's boxes, with Move up / Move down / Remove, and Add at the end. */
function ListEditor({ name, value, fields, noun, blank, onChange }: {
  name: string; value: string; fields: Field[]; noun: string; blank: Item; onChange: (json: string) => void;
}) {
  const list = parse(value);
  const put = (next: Item[]) => onChange(JSON.stringify(next));
  const move = (i: number, by: number) => { const n = [...list]; const [x] = n.splice(i, 1); n.splice(i + by, 0, x); put(n); };
  return (
    <div className="sec-list">
      {list.map((it, i) => (
        <fieldset className="sec-item" key={i}>
          <legend>{noun} {i + 1}</legend>
          {fields.map((f) => {
            const id = `${name}-${i}-${f.key}`;
            const change = (v: string) => put(list.map((x, k) => (k === i ? { ...x, [f.key]: v } : x)));
            if (f.kind === 'picture') return <PictureField key={f.key} id={id} value={it[f.key] || ''} onChange={change} />;
            return (
              <div className="field" key={f.key}>
                <label htmlFor={id}>{f.label}</label>
                {f.kind === 'text'
                  ? <textarea id={id} rows={f.rows || 3} value={it[f.key] || ''} onChange={(e) => change(e.target.value)} />
                  : <input id={id} type="text" value={it[f.key] || ''} onChange={(e) => change(e.target.value)} />}
              </div>
            );
          })}
          <div className="sec-item-tools">
            <button type="button" className="btn btn-small btn-ghost" disabled={i === 0} onClick={() => move(i, -1)}>↑ Move up</button>
            <button type="button" className="btn btn-small btn-ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓ Move down</button>
            <button type="button" className="btn btn-small btn-ghost sec-remove" disabled={list.length <= 1}
              onClick={() => put(list.filter((_, k) => k !== i))}>Remove</button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn btn-small" onClick={() => put([...list, { ...blank }])}>+ Add {noun.toLowerCase()}</button>
    </div>
  );
}

const HELP = (
  <p className="help muted sec-help">
    In any text: <code>**bold words**</code>, <code>[link text](https://…)</code> or <code>[link text](/privacy)</code>.
    These words are filled in by the website: <code>{'{break_minutes}'}</code> the break reminder&apos;s minutes (a fact
    or question using it is hidden while breaks are off), <code>{'{computers}'}</code> &quot;Windows (Mac coming soon)&quot;
    or &quot;Windows or Mac&quot;, <code>{'{mac}'}</code> a sentence about the Mac version, <code>{'{install_video}'}</code> the
    installation video link, <code>{'{email}'}</code> the contact email.
  </p>
);

export default function AdminPages() {
  const { data } = useAdminSettingsQuery();
  const [form, setForm] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [save, { isLoading }] = useSaveSettingsMutation();
  const dispatch = useAppDispatch();
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);
  if (!form) return <p className="muted">Loading…</p>;
  const val = (k: string) => form[k] ?? '';
  const put = (k: string) => (v: string) => setForm((f) => ({ ...(f || {}), [k]: v }));
  const line = (k: string, label: string) => (
    <div className="field"><label htmlFor={k}>{label}</label><input id={k} type="text" value={val(k)} onChange={(e) => put(k)(e.target.value)} /></div>
  );
  const text = (k: string, label: string, rows = 3, help?: string) => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <textarea id={k} rows={rows} value={val(k)} onChange={(e) => put(k)(e.target.value)} />
      {help ? <span className="help">{help}</span> : null}
    </div>
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = (await save(form!).unwrap()) as { settings?: Settings };
      if (res.settings) setForm(res.settings);   // empty boxes come back with the original text
      setErrors([]);
      dispatch(flash('success', 'Saved. The website shows the new text straight away.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  const saveBtn = <button className="btn" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save website text'}</button>;

  return (
    <>
      <h1>Home &amp; policy pages</h1>
      <p className="muted">
        The sections of the home page and the Policies and Terms pages. Change any text, then click <b>Save website
        text</b> (at the end of each part). An empty box goes back to the original text. <Link href="/" target="_blank">View the website</Link>
      </p>
      <FormErrors errors={errors} />
      <form onSubmit={submit} className="sec-form">
        {HELP}

        <details className="card sec-card" open>
          <summary><h2>Meet your coding friends</h2></summary>
          {line('friends_title', 'Title')}
          {text('friends_intro', 'Text under the title', 2)}
          <ListEditor name="friends_items" value={val('friends_items')} noun="Friend" onChange={put('friends_items')}
            blank={{ name: '', role: '', text: '', pic: '' }}
            fields={[{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role (the coloured line)' }, { key: 'text', label: 'What they do', kind: 'text' }, { key: 'pic', label: 'Picture', kind: 'picture' }]} />
          {saveBtn}
        </details>

        <details className="card sec-card">
          <summary><h2>What your child will learn</h2></summary>
          {line('learn_title', 'Title')}
          {text('learn_intro', 'Text under the title', 3)}
          <ListEditor name="learn_items" value={val('learn_items')} noun="Level" onChange={put('learn_items')}
            blank={{ label: '', title: '', text: '', makes: '' }}
            fields={[{ key: 'label', label: 'Label (e.g. Level 5)' }, { key: 'title', label: 'Title' }, { key: 'text', label: 'What they learn', kind: 'text' }, { key: 'makes', label: "They'll make" }]} />
          {text('learn_note', 'Note under the levels', 2)}
          {saveBtn}
        </details>

        <details className="card sec-card">
          <summary><h2>Up and coding in three steps</h2></summary>
          {line('steps_title', 'Title')}
          {text('steps_intro', 'Text under the title', 3)}
          {text('steps_bubble', "Byte's speech bubble", 2, 'Keep [here]({install_video}) for the link to the installation video (set on the Website text page).')}
          <ListEditor name="steps_items" value={val('steps_items')} noun="Step" onChange={put('steps_items')}
            blank={{ title: '', text: '' }}
            fields={[{ key: 'title', label: 'Title' }, { key: 'text', label: 'Text', kind: 'text' }]} />
          {saveBtn}
        </details>

        <details className="card sec-card">
          <summary><h2>Made with parents in mind</h2></summary>
          {line('parents_title', 'Title')}
          {text('parents_note', 'First paragraph (note for parents)', 3)}
          {text('parents_ages', 'Second paragraph', 3)}
          {text('parents_tip', "Byte's tip", 2)}
          <ListEditor name="parents_facts" value={val('parents_facts')} noun="Point" onChange={put('parents_facts')}
            blank={{ title: '', text: '' }}
            fields={[{ key: 'title', label: 'Bold start (e.g. Works offline.)' }, { key: 'text', label: 'Text', kind: 'text' }]} />
          {saveBtn}
        </details>

        <details className="card sec-card">
          <summary><h2>Questions from parents</h2></summary>
          {line('faq_title', 'Title')}
          <ListEditor name="faq_items" value={val('faq_items')} noun="Question" onChange={put('faq_items')}
            blank={{ q: '', a: '' }}
            fields={[{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer (empty line = new paragraph)', kind: 'text', rows: 4 }]} />
          {saveBtn}
        </details>

        <details className="card sec-card">
          <summary><h2>Policies page (Privacy Policy)</h2></summary>
          <p className="help muted">
            <code># </code> page title, <code>## </code> heading, <code>#! </code> big heading, <code>- </code> bullet point,
            empty line = new paragraph. Keep these lines as they are, each on its own line: <code>{'{grievance_officer}'}</code>,{' '}
            <code>{'{purchases}'}</code> (the Refund &amp; Cancellation text below), <code>{'{business_details}'}</code>.{' '}
            <code>{'{#purchases}'}</code> after a heading is its link address (the footer&apos;s Refund &amp; Cancellation link uses it).
          </p>
          <textarea className="code sec-policy" rows={24} spellCheck={false} value={val('policy_privacy')} onChange={(e) => put('policy_privacy')(e.target.value)} aria-label="Policies page" />
          {saveBtn}
        </details>

        <details className="card sec-card">
          <summary><h2>Refund &amp; Cancellation</h2></summary>
          <p className="help muted">Shown on the Policies page where <code>{'{purchases}'}</code> is. Empty line = new paragraph; <code>- </code> bullet point; &quot;Title: text&quot; in a bullet makes the title bold. <code>{'{email}'}</code> = the contact email.</p>
          <textarea className="code sec-policy" rows={16} value={val('policy_purchases')} onChange={(e) => put('policy_purchases')(e.target.value)} aria-label="Refund and cancellation" />
          {saveBtn}
        </details>

        <details className="card sec-card">
          <summary><h2>Terms &amp; Conditions</h2></summary>
          <p className="help muted">Same marks as the Policies page. <code>{'{courts}'}</code> names the courts of your &quot;City for legal disputes&quot; (Website text page); <code>{'{grievance_officer}'}</code> and <code>{'{business_details}'}</code> on their own lines.</p>
          <textarea className="code sec-policy" rows={24} spellCheck={false} value={val('policy_terms')} onChange={(e) => put('policy_terms')(e.target.value)} aria-label="Terms and conditions" />
          {saveBtn}
        </details>
      </form>
    </>
  );
}
