'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';
import type { Settings } from '@/lib/types';
import { sendFile } from '@/lib/upload';
import FilePick from './FilePick';

/** patch: changes some settings, keeping everything else as it is right now (also what was typed during an upload) */
type Props = { form: Settings; patch: (changes: Settings) => void };

/** The pictures built into the app for the 3 home characters (shown until the admin uploads one). */
const BUILT_IN = [
  { name: 'Tom', pic: '/img/app-tom.webp' },
  { name: 'Ada', pic: '/img/app-ada.webp' },
  { name: 'Unicorn', pic: '/img/app-unicorn.webp' },
];

/** One home character: its picture (uploaded at once when chosen), and its name (saved with the form). */
function HomeCharacter({ slot, form, patch }: Props & { slot: 1 | 2 | 3 }) {
  const token = useAppSelector((s) => s.auth.token);
  const [sent, setSent] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const urlKey = `home_char${slot}_url`, nameKey = `home_char${slot}_name`;
  const own = form[urlKey] || '';
  const builtIn = BUILT_IN[slot - 1];
  const shownName = (form[nameKey] ?? '').trim() || builtIn.name;

  async function upload(f: File | null) {
    if (!f) return;
    const fd = new FormData();
    fd.append('picture', f);
    setMsg(null);
    setSent(0);
    try {
      const r = await sendFile<{ url: string; file: string; message?: string }>('POST', `${API_URL}/admin/home-character/${slot}`, fd, token, setSent, 'picture');
      patch({ [urlKey]: r.url, [`home_char${slot}_file`]: r.file });
      setMsg({ ok: true, text: `✓ ${r.message || 'Picture saved.'}` });
    } catch (err) {
      setMsg({ ok: false, text: `✗ ${err instanceof Error ? err.message : 'The picture could not be uploaded.'}` });
    } finally {
      setSent(null);
    }
  }
  async function reset() {
    setMsg(null);
    try {
      const r = await sendFile<{ message?: string }>('DELETE', `${API_URL}/admin/home-character/${slot}`, null, token, () => undefined, 'picture');
      patch({ [urlKey]: '', [`home_char${slot}_file`]: '' });
      setMsg({ ok: true, text: `✓ ${r.message || 'Back to the picture built into the app.'}` });
    } catch (err) {
      setMsg({ ok: false, text: `✗ ${err instanceof Error ? err.message : 'That didn’t work.'}` });
    }
  }

  return (
    <div className="homechar">
      <div className="homechar-stage">
        <span className="homechar-name">{shownName}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={own || builtIn.pic} alt={shownName} />
      </div>
      <div className="field">
        <label htmlFor={nameKey}>Name {slot}</label>
        <input id={nameKey} type="text" maxLength={30} value={form[nameKey] ?? ''} placeholder={builtIn.name}
          onChange={(e) => patch({ [nameKey]: e.target.value })} />
      </div>
      <FilePick id={`home_char${slot}_pic`} file={null} onFile={upload}
        button="Change picture…" dropHint={own ? 'Your picture' : `${builtIn.name} (built into the app)`} />
      {sent !== null ? (
        <div className="upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sent * 100)}>
          <div className="upload-bar"><span style={{ width: `${Math.round(sent * 100)}%` }} /></div>
          <span>{sent < 1 ? `Uploading… ${Math.round(sent * 100)}%` : 'Saving…'}</span>
        </div>
      ) : null}
      {own ? <button type="button" className="btn btn-small btn-ghost homechar-reset" onClick={reset}>Use the app&apos;s own {builtIn.name}</button> : null}
      {msg ? <p className={msg.ok ? 'upload-msg ok' : 'upload-msg bad'} role="status">{msg.text}</p> : null}
    </div>
  );
}

/** The 3 friends on the app's home screen: each one's picture and the name shown on top of it. */
export default function HomeCharacters({ form, patch }: Props) {
  return (
    <>
      <p className="muted">
        The 3 friends on the app&apos;s home screen, with each name shown on top of its picture. A new picture is saved as
        soon as you choose it; names are saved with <b>Save website text</b> below. A .png with a see-through background looks best.
      </p>
      {form.app_home_theme ? (
        <p className="upload-msg bad">The app shows these only when &quot;Characters on the home screen&quot; above is set to &quot;Your home characters (below)&quot;.</p>
      ) : null}
      <div className="homechars">
        {([1, 2, 3] as const).map((slot) => <HomeCharacter key={slot} slot={slot} form={form} patch={patch} />)}
      </div>
    </>
  );
}
