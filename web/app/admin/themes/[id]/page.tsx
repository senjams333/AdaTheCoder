'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useCopyLessonsMutation, useDeleteLessonMutation, useMoveLessonMutation, useThemeQuery, useThemesQuery } from '@/lib/api';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { mb } from '@/lib/format';
import { useAppDispatch } from '@/lib/hooks';

export default function AdminThemePage() {
  const id = Number(useParams<{ id: string }>().id);
  const { data, error } = useThemeQuery(id);
  const { data: allThemes } = useThemesQuery();
  const [move] = useMoveLessonMutation();
  const [remove] = useDeleteLessonMutation();
  const [copy, { isLoading: copying }] = useCopyLessonsMutation();
  const [copyFrom, setCopyFrom] = useState('');
  const dispatch = useAppDispatch();
  if (error) return <FormErrors errors={errorList(error)} />;
  if (!data) return <p className="muted">Loading…</p>;
  const { theme: c, lessons, live } = data;
  const others = (allThemes || []).filter((t) => t.id !== id);

  async function run(p: Promise<{ message?: string }>, fallback?: string) {
    try {
      const res = await p;
      if (res.message || fallback) dispatch(flash('success', res.message || fallback || ''));
    } catch (err) {
      dispatch(flash('error', errorList(err).join(' ')));
    }
  }

  return (
    <>
      <p className="crumbs"><Link href="/admin/themes">Themes</Link> › {c.name}</p>
      <div className={`theme-head pack-${c.pack}`}>
        <span className={`theme-head-pics${c.images.length > 1 ? ' many' : ''}`}>{c.images.map((img) => <img key={img} src={img} alt="" />)}</span>
        <div className="theme-head-text">
          <h1>{c.name}</h1>
          <p>{c.tagline}</p>
          <p className="course-meta">
            <span className="pill">{c.packLabel}</span>
            {c.premium ? <span className="pill pill-sun">{c.price} · first {c.freeLessons} lessons free</span> : <span className="pill pill-sun">Free</span>}
            {c.published ? <span className="pill pill-green">In the app</span> : <span className="pill pill-grey">Hidden from the app</span>}
          </p>
        </div>
        <div className="theme-head-actions">
          <Link className="btn btn-small" href={`/admin/lessons/new?theme=${c.id}`}>+ Add a lesson</Link>
          <Link className="btn btn-small btn-ghost" href={`/admin/themes/${c.id}/settings`}>Theme settings</Link>
        </div>
      </div>

      {!c.published || !live ? (
        <div className="app-warning">
          <b>⚠️ The app doesn&apos;t show this theme yet</b>
          {!c.published ? <span>It&apos;s hidden. Open <Link href={`/admin/themes/${c.id}/settings`}>Theme settings</Link> and tick <i>Show this theme in the app</i>.</span> : null}
          {!live ? <span>It has no live lessons. <Link href={`/admin/lessons/new?theme=${c.id}`}>Add a lesson</Link> (with <i>Show in the app</i> ticked), or copy lessons below.</span> : null}
        </div>
      ) : (
        <div className="app-ok">✅ In the app: children see this theme the next time the app checks (within 3 minutes, or 🔄 Check for new lessons in the app&apos;s menu).</div>
      )}

      <h2 className="section-title">Lessons in this theme</h2>
      <p className="muted">
        The topics appear in the app&apos;s lesson list in this order. Use ▲ ▼ to move them. Click a topic to edit its lesson and video.
        {c.premium ? ` Lessons 1 to ${c.freeLessons} are free to try; the rest need a licence.` : ''}
      </p>

      <div className="card table-wrap">
        {lessons.length ? (
          <table>
            <thead><tr><th>Order</th><th>Topic</th><th>Lesson ID</th><th>Video</th><th>Examples</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {lessons.map((l, i) => (
                <tr key={l.id} id={`lesson-${l.id}`}>
                  <td><div className="move">
                    <button className="move-btn" title="Move up" disabled={i === 0} onClick={() => run(move({ id: l.id, direction: 'up' }).unwrap())}>▲</button>
                    <span>{i + 1}</span>
                    <button className="move-btn" title="Move down" disabled={i === lessons.length - 1} onClick={() => run(move({ id: l.id, direction: 'down' }).unwrap())}>▼</button>
                  </div></td>
                  <td>
                    {l.emoji} <Link href={`/admin/lessons/${l.id}`}>{l.name}</Link>
                    {c.premium ? (i < c.freeLessons ? <> <span className="pill pill-green">Free</span></> : <> <span className="pill pill-grey">🔒</span></>) : null}
                    <br /><span className="muted">{l.subtitle}</span>
                  </td>
                  <td><code>{l.slug}</code></td>
                  <td>
                    {l.videoFile ? <><span className="pill pill-sun">Uploaded</span> <span className="muted">{mb(l.videoSize)}</span></>
                      : l.videoBundled ? <><span className="pill">In the app</span> <span className="muted">{l.videoBundled}</span></>
                      : <span className="pill pill-grey">None</span>}
                  </td>
                  <td>{l.exampleCount}</td>
                  <td>{l.published ? <span className="pill pill-green">Live</span> : <span className="pill pill-grey">Hidden</span>}</td>
                  <td><div className="actions">
                    <Link className="btn btn-small btn-ghost" href={`/admin/lessons/${l.id}`}>Edit</Link>
                    <button className="btn btn-small btn-danger" onClick={() => {
                      if (confirm('Delete this lesson? Apps will stop showing it.')) run(remove(l.id).unwrap());
                    }}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>This theme has no lessons yet. <Link href={`/admin/lessons/new?theme=${c.id}`}>Add the first one</Link>, or start from a copy of another theme&apos;s lessons:</p>
        )}
      </div>

      {others.length ? (
        <form className="copy-lessons" onSubmit={(e) => {
          e.preventDefault();
          const from = Number(copyFrom || others[0].id);
          run(copy({ id, from }).unwrap());
        }}>
          <label htmlFor="copy-from">Copy lessons from another theme</label>
          <select id="copy-from" value={copyFrom || String(others[0].id)} onChange={(e) => setCopyFrom(e.target.value)}>
            {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-small btn-ghost" disabled={copying}>Copy lessons</button>
          <span className="help">Adds that theme&apos;s lessons and examples to this one (not uploaded videos). Lessons this theme already has are kept.</span>
        </form>
      ) : null}
    </>
  );
}
