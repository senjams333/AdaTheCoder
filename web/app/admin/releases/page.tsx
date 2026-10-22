'use client';

import { FormEvent, useRef, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useDeleteReleaseMutation, useMakeLatestMutation, useReleasesQuery, useUploadReleaseMutation } from '@/lib/api';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { day, mb } from '@/lib/format';
import { useAppDispatch } from '@/lib/hooks';

const LABELS: Record<string, string> = { windows: 'Windows', mac: 'Mac' };

export default function AdminReleases() {
  const { data: releases } = useReleasesQuery();
  const [upload, { isLoading: uploading }] = useUploadReleaseMutation();
  const [makeLatest] = useMakeLatestMutation();
  const [remove] = useDeleteReleaseMutation();
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({ platform: 'windows', version: '', notes: '', minSupported: '', makeLatest: true });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('platform', form.platform);
    fd.append('version', form.version.trim());
    fd.append('notes', form.notes);
    fd.append('minSupported', form.minSupported.trim());
    fd.append('makeLatest', String(form.makeLatest));
    if (file) fd.append('file', file);
    try {
      const res = await upload(fd).unwrap();
      dispatch(flash('success', res.message || 'Uploaded.'));
      setErrors([]);
      setForm({ ...form, version: '', notes: '', minSupported: '' });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  async function run(p: Promise<{ message?: string }>) {
    try {
      const res = await p;
      dispatch(flash('success', res.message || 'Done.'));
    } catch (err) {
      dispatch(flash('error', errorList(err).join(' ')));
    }
  }

  return (
    <>
      <h1>App versions</h1>
      <p className="muted">Upload a new installer here. When it&apos;s the current download, installed apps show &quot;A new version is ready&quot; next time they open, and parents download it from their account page.</p>

      <form className="card" onSubmit={submit}>
        <h2>Upload a new version</h2>
        <FormErrors errors={errors} />
        <div className="row-2">
          <div className="field">
            <label htmlFor="platform">Computer</label>
            <select id="platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              <option value="windows">Windows (.exe, .msi or .zip)</option>
              <option value="mac">Mac (.dmg, .pkg or .zip)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="version">Version number</label>
            <input id="version" type="text" placeholder="1.2.0" required pattern="\d+\.\d+\.\d+" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            <span className="help">Must match APP_VERSION in the app&apos;s ada_coder/config.py, so the app knows it&apos;s up to date.</span>
          </div>
        </div>
        <div className="field"><label htmlFor="file">Installer file</label><input id="file" ref={fileRef} type="file" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file ? <span className="help">{file.name}, {mb(file.size)}</span> : null}</div>
        <div className="field"><label htmlFor="notes">What&apos;s new</label><textarea id="notes" rows={3} placeholder="New turtle lessons and bigger text buttons." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><span className="help">Parents see this on the download page and kids see it in the app.</span></div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="min_supported">Oldest version still allowed <span className="muted">(optional)</span></label>
            <input id="min_supported" type="text" placeholder="1.0.0" pattern="\d+\.\d+\.\d+" value={form.minSupported} onChange={(e) => setForm({ ...form, minSupported: e.target.value })} />
            <span className="help">Apps older than this show the update message more strongly. Leave empty for a normal update.</span>
          </div>
          <div className="field" style={{ alignSelf: 'center' }}>
            <label className="check"><input type="checkbox" checked={form.makeLatest} onChange={(e) => setForm({ ...form, makeLatest: e.target.checked })} /><span>Make this the current download</span></label>
          </div>
        </div>
        <button className="btn" disabled={uploading}>{uploading ? 'Uploading… (big files take a few minutes)' : 'Upload version'}</button>
      </form>

      <div className="card table-wrap">
        <h2>All versions</h2>
        {releases?.length ? (
          <table>
            <thead><tr><th>Computer</th><th>Version</th><th>Uploaded</th><th>Size</th><th>Downloads</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id}>
                  <td>{LABELS[r.platform] || r.platform}</td>
                  <td>{r.version}{r.minSupported ? <><br /><span className="muted">needs {r.minSupported}+</span></> : null}</td>
                  <td>{day(r.createdAt)}</td>
                  <td>{mb(r.size)}</td>
                  <td>{r.downloads}</td>
                  <td>{r.isLatest ? <span className="pill pill-sun">Current download</span> : <span className="pill pill-grey">Older</span>}</td>
                  <td><div className="actions">
                    {!r.isLatest ? (
                      <>
                        <button className="btn btn-small btn-ghost" onClick={() => run(makeLatest(r.id).unwrap())}>Make current</button>
                        <button className="btn btn-small btn-danger" onClick={() => confirm(`Delete version ${r.version}?`) && run(remove(r.id).unwrap())}>Delete</button>
                      </>
                    ) : null}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No versions uploaded yet. Build the app with the scripts in the desktop_app folder, then upload the installers above.</p>}
      </div>
    </>
  );
}
