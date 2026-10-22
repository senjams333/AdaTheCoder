'use client';

import { FormEvent, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useDeleteParentMutation, useParentsQuery, useSaveParentPlanMutation, useToggleParentMutation } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { day } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import type { ParentRow } from '@/lib/types';

export default function AdminParents() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { data, error } = useParentsQuery(q);
  const [toggle] = useToggleParentMutation();
  const [remove] = useDeleteParentMutation();
  const token = useAppSelector((s) => s.auth.token);
  const dispatch = useAppDispatch();

  async function run(p: Promise<{ message?: string }>) {
    try {
      const res = await p;
      dispatch(flash('success', res.message || 'Done.'));
    } catch (err) {
      dispatch(flash('error', errorList(err).join(' ')));
    }
  }

  /** The CSV needs the log-in header, so it's fetched here and saved as a file. */
  async function exportCsv() {
    try {
      const res = await fetch(`${API_URL}/admin/parents/export.csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`The export didn't work (${res.status}).`);
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: 'parents.csv' });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      dispatch(flash('error', (err as Error).message));
    }
  }

  return (
    <>
      <div className="toolbar">
        <h1>Parents</h1>
        <div className="actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <form style={{ display: 'flex', gap: 8 }} onSubmit={(e: FormEvent) => { e.preventDefault(); setQ(search.trim()); }}>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search name or email" style={{ width: 240 }} />
            <button className="btn btn-small btn-ghost">Search</button>
          </form>
          <button className="btn btn-small btn-ghost" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      {error ? <FormErrors errors={errorList(error)} /> : null}
      <div className="card table-wrap">
        {!data ? <p className="muted">Loading…</p> : data.parents.length ? (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Location</th><th>Child</th><th>Joined</th><th>Last log in</th><th>Downloads</th><th>Plan</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.parents.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.email}</td>
                  <td>{[p.city, p.country].filter(Boolean).join(', ')}</td>
                  <td>{p.childName || ''}{p.childAge ? ` (${p.childAge})` : ''}</td>
                  <td>{day(p.createdAt)}</td>
                  <td>{p.lastLogin ? day(p.lastLogin) : ''}</td>
                  <td>{p.downloads}</td>
                  <td>{p.plan === 'premium' ? <span className="pill pill-pink">Premium</span> : <span className="pill">Free</span>}</td>
                  <td>{p.isActive ? <span className="pill pill-green">Active</span> : <span className="pill pill-grey">Turned off</span>}</td>
                  <td><div className="actions">
                    <PlanEditor parent={p} themes={data.paidThemes} />
                    <button className="btn btn-small btn-ghost" onClick={() => run(toggle(p.id).unwrap())}>{p.isActive ? 'Turn off' : 'Turn on'}</button>
                    <button className="btn btn-small btn-danger" onClick={() => confirm('Delete this parent account for good?') && run(remove(p.id).unwrap())}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : q ? (
          <p>No parents match &quot;{q}&quot;. <button className="link-btn" onClick={() => { setSearch(''); setQ(''); }}>Show everyone</button></p>
        ) : <p className="muted">No parents have signed up yet.</p>}
      </div>
    </>
  );
}

function PlanEditor({ parent, themes }: { parent: ParentRow; themes: { id: number; name: string }[] }) {
  const [plan, setPlan] = useState(parent.plan);
  const [licences, setLicences] = useState<Record<string, string>>(
    Object.fromEntries(themes.map((t) => [String(t.id), parent.licences[String(t.id)] || ''])),
  );
  const [save, { isLoading }] = useSaveParentPlanMutation();
  const dispatch = useAppDispatch();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await save({ id: parent.id, plan, licences }).unwrap();
      dispatch(flash('success', res.message || 'Plan and licences saved.'));
    } catch (err) {
      dispatch(flash('error', errorList(err).join(' ')));
    }
  }
  return (
    <details className="plan-edit">
      <summary className="btn btn-small btn-ghost">Plan</summary>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor={`plan_${parent.id}`}>Plan</label>
          <select id={`plan_${parent.id}`} value={plan} onChange={(e) => setPlan(e.target.value)}><option value="free">Free</option><option value="premium">Premium</option></select></div>
        {themes.map((t) => (
          <div className="field" key={t.id}><label htmlFor={`licence_${t.id}_${parent.id}`}>{t.name} licence</label>
            <input id={`licence_${t.id}_${parent.id}`} type="text" value={licences[String(t.id)] || ''} placeholder="Empty = not bought"
              onChange={(e) => setLicences({ ...licences, [String(t.id)]: e.target.value })} /></div>
        ))}
        <button className="btn btn-small" disabled={isLoading}>Save</button>
      </form>
    </details>
  );
}
