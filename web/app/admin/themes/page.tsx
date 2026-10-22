'use client';

import Link from 'next/link';
import { FormErrors } from '@/components/Flashes';
import { useThemesQuery } from '@/lib/api';
import { errorList } from '@/lib/errors';

export default function AdminThemes() {
  const { data, error } = useThemesQuery();
  if (error) return <FormErrors errors={errorList(error)} />;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <div className="toolbar">
        <h1>Themes</h1>
        <Link className="btn btn-small" href="/admin/themes/new">+ Add a theme</Link>
      </div>
      <p className="muted">
        Each theme is its own set of lessons with its own characters. Open a theme to edit its topics, lessons and videos.
        The app shows every theme on its home screen. Paid themes have a few free lessons to try, then an Upgrade button that opens the parents&apos; account page.
      </p>
      <div className="course-grid">
        {data.map((c) => (
          <article className="course-card" key={c.id}>
            <Link className={`course-pic pack-${c.pack}${c.images.length > 1 ? ' many' : ''}`} href={`/admin/themes/${c.id}`} aria-label={`Open ${c.name}`}>
              {c.images.map((img) => <img key={img} src={img} alt="" />)}
              <span className="course-badge">{c.premium ? c.price : 'Free'}</span>
            </Link>
            <div className="course-body">
              <h2><Link href={`/admin/themes/${c.id}`}>{c.name}</Link></h2>
              <p className="muted">{c.tagline}</p>
              <p className="course-meta">
                <span className="pill">{c.packLabel}</span>
                <span className="pill pill-sun">{c.live} of {c.total} lessons live</span>
                {c.premium ? <span className="pill">{c.freeLessons} free to try</span> : null}
                {c.published && c.live ? <span className="pill pill-green">In the app</span>
                  : !c.published ? <span className="pill pill-red">⚠️ Hidden from the app</span>
                  : <span className="pill pill-red">⚠️ No live lessons: not in the app</span>}
              </p>
              <div className="actions">
                <Link className="btn btn-small" href={`/admin/themes/${c.id}`}>Open theme</Link>
                <Link className="btn btn-small btn-ghost" href={`/admin/themes/${c.id}/settings`}>Settings</Link>
              </div>
            </div>
          </article>
        ))}
        <Link className="course-card course-add" href="/admin/themes/new">
          <span className="course-add-plus">+</span>
          <b>Add a theme</b>
          <span className="muted">For example &quot;Learn Coding in Space&quot;, with your own characters</span>
        </Link>
      </div>
    </>
  );
}
