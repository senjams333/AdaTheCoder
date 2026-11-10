'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { api, useCreateLessonMutation, useThemesQuery, useUpdateLessonMutation } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { mb } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import type { Example, LessonDetail } from '@/lib/types';
import { FormErrors } from './Flashes';
import FilePick from './FilePick';

const EMPTY_EXAMPLE: Example = { label: '', explain: '', output: '', code: '' };

type Saved = { ok: boolean; id: number; courseId: number; message?: string };

/** Sends the lesson with its video and reports how much has gone up (fetch can't show upload progress). */
function sendWithProgress<T = Saved>(method: 'POST' | 'PUT', url: string, body: FormData, token: string | null, progress: (done: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    if (token) x.setRequestHeader('Authorization', `Bearer ${token}`);
    x.upload.onprogress = (e) => { if (e.lengthComputable) progress(e.loaded / e.total); };
    x.onload = () => {
      let data: { message?: string | string[] } & Partial<Saved> = {};
      try { data = JSON.parse(x.responseText || '{}'); } catch { /* not JSON */ }
      if (x.status >= 200 && x.status < 300) return resolve(data as unknown as T);
      const m = data.message;
      const text = x.status === 413
        ? 'That video is too big. Make it smaller (under 500 MB), or raise MAX_UPLOAD_MB in api/.env.'
        : Array.isArray(m) ? m.join(' ') : m || `The upload didn't work (error ${x.status}). Please try again.`;
      reject(new Error(x.status === 401 ? 'Your admin log-in has ended. Log in again, then upload the video.' : text));
    };
    x.onerror = () => reject(new Error("The video couldn't be sent: the API isn't reachable. Check that the API is running, then try again."));
    x.send(body);
  });
}

/** Tab in a code box types 4 spaces instead of leaving the box. */
function tabToSpaces(e: KeyboardEvent<HTMLTextAreaElement>, change: (v: string) => void) {
  if (e.key !== 'Tab' || e.shiftKey) return;
  e.preventDefault();
  const ta = e.currentTarget;
  const { selectionStart: a, selectionEnd: b, value } = ta;
  change(value.slice(0, a) + '    ' + value.slice(b));
  requestAnimationFrame(() => ta.setSelectionRange(a + 4, a + 4));
}

export default function LessonForm({ lesson }: { lesson: LessonDetail }) {
  const isNew = !lesson.id;
  const { data: themes } = useThemesQuery();
  const [create, { isLoading: creating }] = useCreateLessonMutation();
  const [update, { isLoading: updating }] = useUpdateLessonMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [form, setForm] = useState({
    courseId: String(lesson.courseId), slug: lesson.slug, position: String(lesson.position), emoji: lesson.emoji, name: lesson.name,
    title: lesson.title, subtitle: lesson.subtitle, videoBundled: lesson.videoBundled, defaultCode: lesson.defaultCode,
    published: lesson.published, removeVideo: false,
  });
  const [examples, setExamples] = useState<Example[]>(() => {
    const list = [...lesson.examples];
    while (list.length < Math.max(lesson.examples.length + 2, 6)) list.push({ ...EMPTY_EXAMPLE });
    return list;
  });
  const [video, setVideo] = useState<File | null>(null);
  const [sent, setSent] = useState<number | null>(null);          // upload progress 0..1 while the video goes up
  const [preview, setPreview] = useState('');                    // the chosen video, playable before it's uploaded
  const token = useAppSelector((s) => s.auth.token);
  useEffect(() => {
    if (!video) { setPreview(''); return; }
    const u = URL.createObjectURL(video);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [video]);
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof typeof form) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? Boolean(e.target.checked) : e.target.value });
  const setEx = (i: number, k: keyof Example, v: string) => setExamples(examples.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  // what the save button pressed means: keep as a draft, open the preview, or publish to the app
  const [intent, setIntent] = useState<'draft' | 'preview' | 'publish'>('draft');
  const [chosenBad, setChosenBad] = useState(false);
  const [savedBad, setSavedBad] = useState(false);
  // the video on the website right now (after an upload on this page it's the new one), and the upload's status
  const [onSite, setOnSite] = useState({ file: lesson.videoFile, size: Number(lesson.videoSize), url: lesson.videoUrl, webm: lesson.webmUrl });
  const [upMsg, setUpMsg] = useState<{ ok: boolean; text: string } | null>(null);
  type VideoAnswer = { ok: boolean; videoFile: string; videoSize: number; videoUrl: string; message?: string };

  /** Sends the chosen video to the website straight away (its own request, with a progress bar). */
  async function uploadVideo(id: number, file: File): Promise<boolean> {
    const fd = new FormData();
    fd.append('video', file);
    setUpMsg(null);
    setSent(0);
    try {
      const r = await sendWithProgress<VideoAnswer>('POST', `${API_URL}/admin/lessons/${id}/video`, fd, token, setSent);
      setOnSite({ file: r.videoFile, size: Number(r.videoSize), url: r.videoUrl, webm: null });
      setSavedBad(false);
      setVideo(null);
      setUpMsg({ ok: true, text: `✓ ${r.message || 'Video uploaded.'}` });
      dispatch(api.util.invalidateTags(['Themes', 'Theme', 'Dashboard', 'Site', { type: 'Lesson' as const, id }]));
      return true;
    } catch (err) {
      setUpMsg({ ok: false, text: `✗ ${err instanceof Error ? err.message : 'The video could not be uploaded.'} Choose the video again to retry.` });
      return false;
    } finally {
      setSent(null);
    }
  }
  /** Choosing a video: an existing lesson uploads it at once; a new lesson uploads it right after Add lesson. */
  function chooseVideo(f: File | null) {
    setVideo(f);
    setUpMsg(null);
    if (f && !isNew && lesson.id) void uploadVideo(lesson.id, f);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    // "Save as draft" / "Unpublish" hide it from the app; "Save & preview" keeps a published lesson published
    const publish = intent === 'publish' || (intent === 'preview' && !isNew && lesson.published);
    const fd = new FormData();
    for (const k of ['courseId', 'slug', 'position', 'emoji', 'name', 'title', 'subtitle', 'videoBundled', 'defaultCode'] as const) fd.append(k, form[k]);
    fd.append('published', String(publish));
    fd.append('removeVideo', String(form.removeVideo));
    fd.append('examples', JSON.stringify(examples.filter((x) => x.label || x.explain || x.output || x.code)));
    if (sent !== null) { setErrors(['The video is still uploading. Wait for it to finish, then save.']); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    try {
      const d = isNew ? await create(fd).unwrap() : await update({ id: lesson.id as number, form: fd }).unwrap();
      const res: Saved = { ok: d.ok, id: d.id ?? (lesson.id as number), courseId: d.courseId ?? Number(form.courseId), message: d.message };
      if (isNew && video && !(await uploadVideo(res.id, video))) {
        // the lesson is saved; only the video failed: open the saved lesson so the video can be chosen again there
        dispatch(flash('info', 'The lesson was added, but its video did not upload. Choose the video again on this page.'));
        router.push(`/admin/lessons/${res.id}`);
        return;
      }
      if (intent === 'preview') {
        dispatch(flash('info', publish ? 'Saved. This is how the lesson looks in the app.' : 'Saved as a draft. This is how the lesson will look in the app.'));
        router.push(`/admin/lessons/${res.id}/preview`);
        return;
      }
      dispatch(flash('success', publish ? `${res.message || 'Lesson saved.'} It is published in the app.` : 'Saved as a draft: it is hidden from the app until you publish it.'));
      router.push(`/admin/themes/${res.courseId ?? form.courseId}`);
    } catch (err) {
      setSent(null);
      setErrors(err instanceof Error && !(err as { data?: unknown }).data ? [err.message] : errorList(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const busy = creating || updating || sent !== null;
  return (
    <>
      <div className="toolbar">
        <h1>{isNew ? 'Add a lesson' : 'Edit lesson'}</h1>
        <Link href={`/admin/themes/${lesson.courseId}`}>Back to the theme</Link>
      </div>
      <FormErrors errors={errors} />
      <form onSubmit={submit}>
        <div className="card">
          <h2>Theme</h2>
          <div className="field">
            <label htmlFor="course_id">This lesson belongs to</label>
            <select id="course_id" value={form.courseId} onChange={set('courseId')}>
              {(themes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="help">Choose another theme to move the lesson there.</span>
          </div>
        </div>

        <div className="card">
          <h2>Topic <span className="muted" style={{ fontSize: '1rem' }}>(how it appears in the app&apos;s lesson list)</span></h2>
          <div className="row-3">
            <div className="field"><label htmlFor="emoji">Emoji</label><input id="emoji" type="text" maxLength={12} value={form.emoji} onChange={set('emoji')} /></div>
            <div className="field"><label htmlFor="name">Topic name</label><input id="name" type="text" required value={form.name} onChange={set('name')} placeholder="PRINT HELLO" /></div>
            <div className="field"><label htmlFor="position">Order</label><input id="position" type="number" value={form.position} onChange={set('position')} /><span className="help">Lowest number comes first.</span></div>
          </div>
          <div className="field">
            <label htmlFor="slug">Lesson ID</label>
            <input id="slug" type="text" required value={form.slug} onChange={set('slug')} placeholder="lesson_loops" pattern="[A-Za-z0-9_-]+" />
            <span className="help">Used by the app to remember progress, like lesson1 or lesson_opencv. Must be different from the other lessons in this theme. Avoid changing it once the lesson is live.</span>
          </div>
        </div>

        <div className="card">
          <h2>Lesson page</h2>
          <div className="field"><label htmlFor="title">Title</label><input id="title" type="text" required value={form.title} onChange={set('title')} placeholder="🖨️ PRINT HELLO" /></div>
          <div className="field"><label htmlFor="subtitle">Subtitle</label><input id="subtitle" type="text" value={form.subtitle} onChange={set('subtitle')} placeholder="Learn how to print messages! 💌" /></div>
          <div className="field">
            <label htmlFor="default_code">Starting code in the editor</label>
            <textarea id="default_code" className="code" spellCheck={false} style={{ minHeight: 110 }} value={form.defaultCode}
              onChange={set('defaultCode')} onKeyDown={(e) => tabToSpaces(e, (v) => setForm({ ...form, defaultCode: v }))} />
          </div>
        </div>

        <div className="card">
          <h2>Video</h2>
          {onSite.file ? (
            <>
              <p>Video on the website: <b>{onSite.file}</b> <span className="muted">({mb(onSite.size)})</span>. Installed apps download it and play it instead of the one inside the app.</p>
              {onSite.url ? (
                <video key={onSite.file} className="video-preview" controls preload="metadata" onError={() => setSavedBad(true)} onLoadedMetadata={() => setSavedBad(false)}>
                  {onSite.webm ? <source src={onSite.webm} type="video/webm" /> : null}
                  <source src={onSite.url} onError={() => setSavedBad(true)} />
                </video>
              ) : null}
              <p className="video-note">{onSite.webm ? '✓ The app\'s copy (WebM) is ready: installed apps play this video.'
                : '⏳ The website is making the copy the app plays (needs ffmpeg on the server). Reload this page in a few minutes.'}
                {savedBad && !onSite.webm ? ' This browser can\'t play the original file; the preview works when the app\'s copy is ready.' : ''}</p>
              <label className="check" style={{ margin: '12px 0 18px' }}><input type="checkbox" checked={form.removeVideo} onChange={set('removeVideo')} /><span>Remove the uploaded video and go back to the one inside the app</span></label>
            </>
          ) : null}
          <div className="field">
            <label htmlFor="video">{onSite.file ? 'Replace with a new video' : 'Upload a video'} <span className="muted">(optional: .mp4, .mov, .webm, .mkv…)</span></label>
            <FilePick id="video" file={video} onFile={chooseVideo} button="📁 Choose video" dropHint="or drag the video file here" />
            <span className="help">{isNew ? 'The video uploads right after you press Add lesson.' : 'The video uploads as soon as you choose it; you don\'t need to press Save for the video.'}</span>
            {upMsg ? <p className={upMsg.ok ? 'upload-msg ok' : 'upload-msg bad'} role="status">{upMsg.text}</p> : null}
            {preview && (isNew || sent !== null) ? (
              <>
                <video key={preview} className="video-preview" style={{ marginTop: 10 }} src={preview} controls preload="metadata"
                  onError={() => setChosenBad(true)} onLoadedMetadata={() => setChosenBad(false)} />
                {chosenBad ? <p className="video-note">This browser can&apos;t play this file here (many Ubuntu browsers can&apos;t play MP4). That&apos;s fine: it still uploads, and the website makes the copy the app plays.</p> : null}
              </>
            ) : null}
            {sent !== null ? (
              <div className="upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sent * 100)}>
                <div className="upload-bar"><span style={{ width: `${Math.round(sent * 100)}%` }} /></div>
                <span>{sent < 1 ? `Uploading the video… ${Math.round(sent * 100)}%` : 'Upload finished, the website is storing it…'}</span>
              </div>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="video_bundled">Video inside the app</label>
            <input id="video_bundled" type="text" value={form.videoBundled} onChange={set('videoBundled')} placeholder="vid/video1.mp4" />
            <span className="help">The file in the app&apos;s vid folder. The app plays this when no video has been uploaded.</span>
          </div>
        </div>

        <div className="card">
          <h2>Examples</h2>
          <p className="muted">Each example is a button in the lesson. Children click it to see the explanation and expected output, and the code goes into their editor. Leave an example empty to remove it.</p>
          {examples.map((ex, i) => (
            <fieldset className="example-edit" key={i}>
              <legend>Example {i + 1}</legend>
              <div className="field"><label htmlFor={`ex_label_${i}`}>Button label</label><input id={`ex_label_${i}`} type="text" value={ex.label} placeholder={i < 6 ? `${i + 1}️⃣ Name this example ✨` : ''} onChange={(e) => setEx(i, 'label', e.target.value)} /></div>
              <div className="field"><label htmlFor={`ex_explain_${i}`}>Explanation</label><textarea id={`ex_explain_${i}`} rows={3} value={ex.explain} onChange={(e) => setEx(i, 'explain', e.target.value)} /></div>
              <div className="row-2">
                <div className="field"><label htmlFor={`ex_code_${i}`}>Code</label><textarea id={`ex_code_${i}`} className="code" spellCheck={false} style={{ minHeight: 100 }} value={ex.code}
                  onChange={(e) => setEx(i, 'code', e.target.value)} onKeyDown={(e) => tabToSpaces(e, (v) => setEx(i, 'code', v))} /></div>
                <div className="field"><label htmlFor={`ex_output_${i}`}>Expected output</label><textarea id={`ex_output_${i}`} className="code" spellCheck={false} style={{ minHeight: 100 }} value={ex.output} onChange={(e) => setEx(i, 'output', e.target.value)} /></div>
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setExamples([...examples, { ...EMPTY_EXAMPLE }])}>Add another example</button>
        </div>

        <div className="card">
          <p className={`lesson-state ${lesson.published ? 'live' : 'draft'}`}>
            {isNew ? '📝 New lesson: save it as a draft, preview it, then publish it to the app.'
              : lesson.published ? '✅ Published: children see this lesson in the app.' : '📝 Draft: hidden from the app until you publish it.'}
          </p>
          {busy ? <p className="muted"><b>{video ? `Uploading the video… ${Math.round((sent || 0) * 100)}%` : 'Saving…'}</b></p> : null}
          <div className="lesson-actions">
            <button className="btn btn-ghost" disabled={busy} onClick={() => setIntent('draft')}>{!isNew && lesson.published ? 'Unpublish (back to draft)' : 'Save as draft'}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setIntent('preview')}>Save &amp; preview 👀</button>
            <button className="btn" disabled={busy} onClick={() => setIntent('publish')}>{!isNew && lesson.published ? 'Save changes' : 'Publish to the app 🚀'}</button>
          </div>
        </div>
      </form>
    </>
  );
}
