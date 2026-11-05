'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useLessonQuery, usePublishLessonMutation } from '@/lib/api';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch } from '@/lib/hooks';

/** The admin's look at a lesson before it goes to the app: the video, the examples and the code, laid out like the app's
 *  coding page, with Publish (or back to draft) and Edit. */
export default function LessonPreviewPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { data: l, error } = useLessonQuery(id);
  const [publish, { isLoading }] = usePublishLessonMutation();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(0);
  const [videoBad, setVideoBad] = useState(false);
  if (error) return <FormErrors errors={errorList(error)} />;
  if (!l) return <p className="muted">Loading…</p>;
  const ex = l.examples[open];

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
        <h1>Preview: {l.emoji} {l.name}</h1>
        <Link href={`/admin/themes/${l.courseId}`}>Back to the theme</Link>
      </div>
      <div className={`lesson-state ${l.published ? 'live' : 'draft'} lp-bar`}>
        <span>{l.published ? '✅ Published: children see this lesson in the app.' : '📝 Draft: only you can see it. Children see it once you publish it.'}</span>
        <span className="lesson-actions">
          <Link className="btn btn-ghost btn-small" href={`/admin/lessons/${id}`}>Edit</Link>
          {l.published
            ? <button className="btn btn-ghost btn-small" disabled={isLoading} onClick={() => toggle(false)}>Back to draft</button>
            : <button className="btn btn-small" disabled={isLoading} onClick={() => toggle(true)}>Publish to the app 🚀</button>}
        </span>
      </div>

      <div className="lp-app">
        <div className="lp-head"><h2>{l.title || l.name}</h2>{l.subtitle ? <p>{l.subtitle}</p> : null}</div>

        <div className="lp-video">
          {l.videoUrl ? (
            <>
              <video controls preload="metadata" onError={() => setVideoBad(true)} onLoadedMetadata={() => setVideoBad(false)}>
                {l.webmUrl ? <source src={l.webmUrl} type="video/webm" /> : null}
                <source src={l.videoUrl} onError={() => setVideoBad(true)} />
              </video>
              <p className="video-note">{l.webmUrl ? '✓ The app plays this video.' : '⏳ The app\'s copy of this video is still being made (needs ffmpeg on the server). Reload in a minute.'}
                {videoBad && !l.webmUrl ? ' This browser can\'t play the original file; it will play here once the app\'s copy is ready.' : ''}</p>
            </>
          ) : l.videoBundled ? (
            <p className="video-note">🎬 The app plays its own built-in video for this lesson: <code>{l.videoBundled}</code></p>
          ) : (
            <p className="video-note">🎬 No video for this lesson: the app goes straight to the coding page.</p>
          )}
        </div>

        <div className="lp-cols">
          <div className="lp-examples">
            <h3>{l.emoji} {l.name}</h3>
            {l.examples.length ? l.examples.map((e, i) => (
              <div key={i} className={`lp-ex${i === open ? ' on' : ''}`}>
                <button type="button" onClick={() => setOpen(i)}>{e.label || `Example ${i + 1}`}</button>
                {i === open ? (
                  <div className="lp-box">
                    {e.explain ? <p><b>Explanation:</b> {e.explain}</p> : null}
                    {e.output ? <><p className="lp-k">Expected Answer / Output:</p><pre>{e.output}</pre></> : null}
                  </div>
                ) : null}
              </div>
            )) : <p className="muted">No examples yet.</p>}
          </div>
          <div className="lp-editor">
            <pre className="lp-code">{(ex && ex.code) || l.defaultCode || '# the code the child starts with'}</pre>
            <div className="lp-run">▶ RUN CODE 🚀</div>
            <pre className="lp-out">{ex && ex.output ? ex.output : 'Your output will be displayed here 😊 .'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
