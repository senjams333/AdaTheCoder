'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormErrors } from '@/components/Flashes';
import { usePublishThemeMutation, useThemeQuery } from '@/lib/api';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch } from '@/lib/hooks';

/** The admin's look at a theme before it goes to the app: its card on the app's home screen, and its lesson list
 *  as children see it (which lessons are free, which are 🔒 until the theme is bought), with Publish. */
export default function ThemePreviewPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { data, error } = useThemeQuery(id);
  const [publish, { isLoading }] = usePublishThemeMutation();
  const dispatch = useAppDispatch();
  if (error) return <FormErrors errors={errorList(error)} />;
  if (!data) return <p className="muted">Loading…</p>;
  const { theme: c, lessons } = data;
  const shown = lessons.filter((l) => l.published);
  const free = c.premium ? Math.max(1, c.freeLessons) : Infinity;

  async function toggle(to: boolean) {
    try {
      const r = await publish({ id, published: to }).unwrap();
      dispatch(flash('success', r.message || (to ? 'Published.' : 'Back to draft.')));
    } catch (err) {
      dispatch(flash('error', errorList(err).join(' ')));
    }
  }

  return (
    <div className="lp">
      <div className="toolbar">
        <h1>Preview: {c.name}</h1>
        <Link href={`/admin/themes/${id}`}>Back to the theme</Link>
      </div>
      <div className={`lesson-state ${c.published ? 'live' : 'draft'} lp-bar`}>
        <span>{c.published ? '✅ Published: children see this theme in the app.' : '📝 Draft: only you can see it. Children see it once you publish it.'}</span>
        <span className="lesson-actions">
          <Link className="btn btn-ghost btn-small" href={`/admin/themes/${id}/settings`}>Edit</Link>
          {c.published
            ? <button className="btn btn-ghost btn-small" disabled={isLoading} onClick={() => toggle(false)}>Back to draft</button>
            : <button className="btn btn-small" disabled={isLoading || !shown.length} onClick={() => toggle(true)}>Publish to the app 🚀</button>}
        </span>
      </div>
      {!shown.length ? <p className="lesson-state draft">This theme has no published lessons yet, so the app can&apos;t show it. Publish at least one lesson first.</p> : null}

      <div className="lp-app tp">
        <div className="tp-cols">
          <div>
            <h3 className="tp-h">On the app&apos;s home screen</h3>
            <div className="tp-card">
              <div className="tp-pics">{c.images.slice(0, 3).map((i) => <img key={i} src={i} alt="" />)}</div>
              <b>{c.name}</b>
              <p>{c.tagline}</p>
              <span className="tp-badge">{c.premium ? `${c.price} · ${free} free lesson${free === 1 ? '' : 's'}` : 'Free'}</span>
              <span className="tp-try">✨ Try free</span>
            </div>
          </div>
          <div>
            <h3 className="tp-h">The lesson list in the theme</h3>
            <ol className="tp-list">
              {shown.map((l, i) => (
                <li key={l.id} className={i < free ? 'open' : 'locked'}>
                  <span>{i < free ? '' : '🔒 '}{l.emoji} {l.name}</span>
                  <small>{i < free ? 'Free: downloads with the app' : 'Downloads after the theme is bought'}</small>
                  <Link href={`/admin/lessons/${l.id}/preview`}>Preview</Link>
                </li>
              ))}
            </ol>
            {lessons.length > shown.length ? <p className="video-note">{lessons.length - shown.length} draft lesson(s) are not shown: publish them to add them to the list.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
