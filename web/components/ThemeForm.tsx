'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useCreateThemeMutation, useDeleteThemeMutation, useGetSiteQuery, useThemesQuery, useUpdateThemeMutation } from '@/lib/api';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch } from '@/lib/hooks';
import type { Theme } from '@/lib/types';
import { FormErrors } from './Flashes';

const SLOTS = 3;
const PLACEHOLDERS = ['Astro', 'Comet', 'Nova'];

/** Add a theme, or change one ("Theme settings"). */
export default function ThemeForm({ theme }: { theme?: Theme }) {
  const { data: site } = useGetSiteQuery();
  const { data: themes } = useThemesQuery();
  const [create, { isLoading: creating }] = useCreateThemeMutation();
  const [update, { isLoading: updating }] = useUpdateThemeMutation();
  const [remove] = useDeleteThemeMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const nextPosition = Math.max(0, ...(themes || []).map((t) => t.position)) + 1;
  const [form, setForm] = useState({
    name: theme?.name || '', slug: theme?.slug || '', tagline: theme?.tagline || '', description: theme?.description || '',
    features: theme?.features || '', pack: theme?.pack || 'friends', price: theme?.price || '', premium: theme?.premium ?? false,
    freeLessons: String(theme?.freeLessons ?? 3), position: String(theme?.position ?? nextPosition),
    published: theme?.published ?? true, removeImage: false, copyFrom: '',
  });
  const [names, setNames] = useState<string[]>(Array.from({ length: SLOTS }, (_, i) => theme?.characters[i]?.name || ''));
  const [charFiles, setCharFiles] = useState<(File | null)[]>(Array(SLOTS).fill(null));
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  // a new theme starts with a copy of the first theme's lessons, so it shows in the app straight away
  const copyFrom = form.copyFrom || (themes?.[0] ? String(themes[0].id) : '');
  const packs = site?.packs || {};

  const set = (k: keyof typeof form) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? Boolean(e.target.checked) : e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    for (const k of ['name', 'slug', 'tagline', 'description', 'features', 'pack', 'price', 'freeLessons', 'position'] as const) fd.append(k, String(form[k]));
    fd.append('premium', String(form.premium));
    fd.append('published', String(form.published));
    fd.append('removeImage', String(form.removeImage));
    if (!theme && copyFrom !== 'none') fd.append('copyFrom', copyFrom);
    names.forEach((n, i) => fd.append(`charName${i}`, n));
    charFiles.forEach((f, i) => f && fd.append(`charFile${i}`, f));
    if (image) fd.append('image', image);
    try {
      const res = theme ? await update({ id: theme.id, form: fd }).unwrap() : await create(fd).unwrap();
      dispatch(flash('success', res.message || 'Saved.'));
      router.push(`/admin/themes/${res.id ?? theme?.id}`);
    } catch (err) {
      setErrors(errorList(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function del() {
    if (!theme || !confirm("Delete this theme and all its lessons? This can't be undone.")) return;
    try {
      const res = await remove(theme.id).unwrap();
      dispatch(flash('info', res.message || 'Theme deleted.'));
      router.push('/admin/themes');
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  return (
    <>
      <div className="toolbar">
        <h1>{theme ? 'Theme settings' : 'Add a theme'}</h1>
        <Link href={theme ? `/admin/themes/${theme.id}` : '/admin/themes'}>{theme ? 'Back to the theme' : 'Back to themes'}</Link>
      </div>
      <FormErrors errors={errors} />
      <form onSubmit={submit}>
        <div className="card">
          <h2>About the theme</h2>
          <div className="row-2">
            <div className="field"><label htmlFor="name">Theme name</label><input id="name" type="text" required value={form.name} onChange={set('name')} placeholder="Learn Coding in Space" /></div>
            <div className="field"><label htmlFor="slug">Theme ID</label><input id="slug" type="text" required value={form.slug} onChange={set('slug')} placeholder="space" pattern="[A-Za-z0-9_-]+" />
              <span className="help">Used by the app. Letters, numbers, - and _. Avoid changing it once the theme is live.</span></div>
          </div>
          <div className="field"><label htmlFor="tagline">One-line description</label><input id="tagline" type="text" value={form.tagline} onChange={set('tagline')} placeholder="Blast off and learn Python among the stars." />
            <span className="help">Shown on the app&apos;s home screen and on the parents&apos; account page.</span></div>
          <div className="field"><label htmlFor="description">More about it <span className="muted">(optional)</span></label><textarea id="description" rows={3} value={form.description} onChange={set('description')} /></div>
          <div className="field"><label htmlFor="features">What&apos;s included</label><textarea id="features" rows={3} placeholder="One point per line" value={form.features} onChange={set('features')} />
            <span className="help">One point per line. They appear as ✓ ticks on the account page.</span></div>
        </div>

        <div className="card">
          <h2>Characters: who appears in the app</h2>
          <p className="muted">The characters on the app&apos;s home screen, the one who celebrates working code, and the one who explains mistakes.</p>
          <div className="pack-picker">
            {Object.entries(packs).map(([key, pack]) => (
              <label className="pack-option" key={key}>
                <input type="radio" name="pack" value={key} checked={form.pack === key} onChange={set('pack')} />
                <span className={`pack-pics pack-${key}`}>
                  {pack.images.length
                    ? pack.images.map((img) => <img key={img} src={`/img/${img}`} alt="" />)
                    : theme?.characters.length
                      ? theme.characters.map((ch) => <img key={ch.file} src={ch.url} alt="" />)
                      : <span className="pack-upload-hint">⬆️ Upload</span>}
                </span>
                <b>{pack.label}</b>
                <span className="muted">{pack.note}</span>
              </label>
            ))}
          </div>
          <div className="own-chars">
            <h3>Your own characters</h3>
            <p className="muted">Used when &quot;Your own characters&quot; is chosen. The app downloads them, so a new theme needs no app update. Character 1 explains mistakes, character 3 celebrates working code. Square pictures with a clear background look best.</p>
            <div className="own-chars-grid">
              {names.map((n, i) => (
                <div className="own-char" key={i}>
                  <span className="own-char-pic">
                    {charFiles[i] ? <img src={URL.createObjectURL(charFiles[i] as File)} alt="" /> : theme?.characters[i]?.url ? <img src={theme.characters[i].url} alt="" /> : i + 1}
                  </span>
                  <div className="field"><label htmlFor={`char_name_${i}`}>Character {i + 1} name</label>
                    <input id={`char_name_${i}`} type="text" value={n} placeholder={PLACEHOLDERS[i]} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} /></div>
                  <input type="file" accept=".png,.jpg,.jpeg,.webp,image/*" aria-label={`Picture for character ${i + 1}`}
                    onChange={(e) => setCharFiles(charFiles.map((x, j) => (j === i ? e.target.files?.[0] || null : x)))} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Price and picture</h2>
          <div className="field"><label className="check"><input type="checkbox" checked={form.premium} onChange={set('premium')} /><span>Paid theme: children try the first lessons free, then parents buy a licence on their account page</span></label></div>
          <div className="row-3e">
            <div className="field"><label htmlFor="price">Price</label><input id="price" type="text" value={form.price} onChange={set('price')} placeholder="$3.69" /></div>
            <div className="field"><label htmlFor="free_lessons">Free lessons to try</label><input id="free_lessons" type="number" min={0} value={form.freeLessons} onChange={set('freeLessons')} /><span className="help">The rest show 🔒 and an Upgrade button.</span></div>
            <div className="field"><label htmlFor="position">Order</label><input id="position" type="number" value={form.position} onChange={set('position')} /><span className="help">Lowest number comes first in the app.</span></div>
          </div>
          {theme?.imageUrl ? (
            <>
              <p>Card picture: <img className="course-thumb" src={theme.imageUrl} alt="" /></p>
              <label className="check" style={{ marginBottom: 14 }}><input type="checkbox" checked={form.removeImage} onChange={set('removeImage')} /><span>Remove it and show the theme&apos;s characters instead</span></label>
            </>
          ) : null}
          <div className="field"><label htmlFor="image">{theme?.imageUrl ? 'Replace the card picture' : 'Card picture'} <span className="muted">(optional, .png .jpg .webp)</span></label>
            <input id="image" type="file" accept=".png,.jpg,.jpeg,.webp,image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
            <span className="help">Without a picture, the account page shows the theme&apos;s characters.</span></div>
        </div>

        {!theme && themes?.length ? (
          <div className="card">
            <h2>Lessons to start with</h2>
            <div className="field"><label htmlFor="copy_from">Copy lessons from</label>
              <select id="copy_from" value={copyFrom} onChange={set('copyFrom')}>
                <option value="none">Start empty, I&apos;ll add lessons</option>
                {themes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="help">Copies every lesson and example (not uploaded videos). You can then edit them for this theme.</span></div>
          </div>
        ) : null}

        <div className="card">
          <div className="field"><label className="check"><input type="checkbox" checked={form.published} onChange={set('published')} /><span>Show this theme in the app</span></label>
            <span className="help">Untick to hide it while you work on it. Children only see themes with this ticked and at least one live lesson.</span></div>
          <button className="btn" disabled={creating || updating}>{creating || updating ? 'Saving…' : theme ? 'Save theme' : 'Add theme'}</button>
        </div>
      </form>
      {theme ? <button className="btn btn-small btn-danger" onClick={del}>Delete this theme</button> : null}
    </>
  );
}
