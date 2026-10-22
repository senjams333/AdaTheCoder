'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useChangePasswordMutation, useDashboardQuery } from '@/lib/api';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { day } from '@/lib/format';
import { useAppDispatch } from '@/lib/hooks';

const PLATFORMS = [['windows', 'Windows'], ['mac', 'Mac']] as const;

export default function AdminDashboard() {
  const { data, error } = useDashboardQuery();
  if (error) return <FormErrors errors={errorList(error)} />;
  if (!data) return <p className="muted">Loading…</p>;
  const s = data.stats;
  return (
    <>
      <h1>Overview</h1>
      <div className="stats">
        <div className="stat"><b>{s.parents}</b><span>parent accounts</span></div>
        <div className="stat"><b>{s.newParents}</b><span>new in the last 7 days</span></div>
        <div className="stat"><b>{s.downloads}</b><span>app downloads</span></div>
        <div className="stat"><b>{s.lessons}</b><span>live lessons in {s.themes} themes{s.drafts ? `, ${s.drafts} hidden` : ''}</span></div>
      </div>

      <div className="card">
        <h2>Current app versions</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Computer</th><th>Version</th><th>Released</th><th>Downloads</th></tr></thead>
          <tbody>
            {PLATFORMS.map(([key, label]) => {
              const r = data.releases[key];
              return (
                <tr key={key}>
                  <td>{label}</td>
                  {r ? (
                    <><td>{r.version}</td><td>{day(r.createdAt)}</td><td>{r.downloads}</td></>
                  ) : (
                    <td colSpan={3} className="muted">No installer yet. <Link href="/admin/releases">Upload one</Link></td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h2>Newest parents</h2>
        {data.recent.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Location</th><th>Child&apos;s age</th><th>Joined</th></tr></thead>
            <tbody>{data.recent.map((p) => (
              <tr key={p.email}><td>{p.name}</td><td>{p.email}</td><td>{[p.city, p.country].filter(Boolean).join(', ')}</td><td>{p.childAge || ''}</td><td>{day(p.createdAt)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">No parents have signed up yet. Share the website to get your first families.</p>}
      </div>

      <AdminPassword />
    </>
  );
}

function AdminPassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [change, { isLoading }] = useChangePasswordMutation();
  const dispatch = useAppDispatch();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await change({ current, new: next }).unwrap();
      setCurrent('');
      setNext('');
      setErrors([]);
      dispatch(flash('success', 'Password changed.'));
    } catch (err) {
      setErrors(errorList(err));
    }
  }
  return (
    <div className="card">
      <h2>Change your admin password</h2>
      <FormErrors errors={errors} />
      <form onSubmit={submit}>
        <div className="row-2">
          <div className="field"><label htmlFor="current">Current password</label><input id="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div className="field"><label htmlFor="new">New password</label><input id="new" type="password" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <button className="btn btn-small" disabled={isLoading}>Change password</button>
      </form>
    </div>
  );
}
