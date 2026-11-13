'use client';

import { FormEvent, useRef, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useDeleteParentMutation, useParentsQuery, useSaveParentPlanMutation, useToggleParentMutation, useUnlockThemeMutation } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { day } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import type { ParentPayment, ParentRow } from '@/lib/types';

/** Paid for a theme, but that theme has no licence: the licence wasn't made (unlock it by hand). */
const stuck = (p: ParentRow) => p.payments.filter((x) => x.status === 'paid' && !x.unlocked);

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
      {data && data.parents.some((p) => stuck(p).length) ? (
        <div className="card unlock-alert">
          <b>⚠ Paid, but not unlocked:</b> {data.parents.filter((p) => stuck(p).length).map((p) => `${p.name} (${stuck(p).map((x) => x.theme).join(', ')})`).join('; ')}.
          {' '}Use <b>🔓 Unlock</b> on their row to give them the licence.
        </div>
      ) : null}
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
                  <td>{p.plan === 'premium' ? <span className="pill pill-pink">Premium</span> : <span className="pill">Free</span>}
                    {stuck(p).length ? <span className="pill pill-warn" title="A payment went through but the theme has no licence">⚠ Paid, not unlocked</span> : null}</td>
                  <td>{p.isActive ? <span className="pill pill-green">Active</span> : <span className="pill pill-grey">Turned off</span>}</td>
                  <td><div className="actions">
                    <UnlockPanel parent={p} themes={data.paidThemes} reasons={data.unlockReasons} />
                    {/* key: starts again with the newest licences after an unlock, so saving the plan never removes one */}
                    <PlanEditor key={`${p.id}-${JSON.stringify(p.licences)}`} parent={p} themes={data.paidThemes} />
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

const money = (x: ParentPayment) => x.provider === 'admin' ? 'no charge' : x.currency === 'INR' ? `₹${(x.amount / 100).toFixed(2)}` : `${x.currency} ${(x.amount / 100).toFixed(2)}`;
const PROVIDERS: Record<string, string> = { razorpay: 'Razorpay', paypal: 'PayPal', admin: 'By admin' };

/** Unlock a paid theme for this parent by hand: e.g. they paid, but the licence wasn't made because of an error. */
function UnlockPanel({ parent, themes, reasons }: { parent: ParentRow; themes: { id: number; name: string }[]; reasons: Record<string, string> }) {
  const locked = themes.filter((t) => !parent.licences[String(t.id)]);
  const firstStuck = stuck(parent)[0];
  const [form, setForm] = useState({
    courseId: String(firstStuck?.courseId || locked[0]?.id || ''), reason: firstStuck ? 'payment-error' : '',
    paymentId: firstStuck ? String(firstStuck.id) : '', reference: '', note: '', email: true,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [unlock, { isLoading }] = useUnlockThemeMutation();
  const box = useRef<HTMLDetailsElement>(null);
  const close = () => { if (box.current) box.current.open = false; };
  const dispatch = useAppDispatch();
  // this parent's tries at paying for the chosen theme that haven't unlocked it
  const tries = parent.payments.filter((x) => String(x.courseId) === form.courseId && !x.unlocked && x.provider !== 'admin');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);
    const theme = themes.find((t) => String(t.id) === form.courseId);
    if (!confirm(`Unlock ${theme?.name || 'this theme'} for ${parent.name}?`)) return;
    try {
      const res = await unlock({ id: parent.id, courseId: Number(form.courseId), reason: form.reason,
        paymentId: form.paymentId ? Number(form.paymentId) : null, reference: form.reference.trim(), note: form.note.trim(), email: form.email }).unwrap();
      dispatch(flash('success', res.message || 'Unlocked.'));
      close();
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  return (
    <details className="unlock-edit" ref={box}>
      <summary className="btn btn-small">🔓 Unlock</summary>
      <div className="unlock-backdrop" onClick={close} />
      <form onSubmit={submit} role="dialog" aria-label={`Unlock a theme for ${parent.name}`}>
        <button type="button" className="unlock-close" onClick={close} aria-label="Close">✕</button>
        <h3>Unlock a theme for {parent.name}</h3>
        <p className="muted unlock-sub">{parent.email}</p>
        {!locked.length ? <p className="muted">{parent.name} already has every paid theme.</p> : (
          <>
            <FormErrors errors={errors} />
            <div className="field"><label htmlFor={`u_theme_${parent.id}`}>Theme</label>
              <select id={`u_theme_${parent.id}`} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, paymentId: '' })}>
                {locked.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select></div>
            <div className="field"><label htmlFor={`u_reason_${parent.id}`}>Why</label>
              <select id={`u_reason_${parent.id}`} value={form.reason} onChange={set('reason')} required>
                <option value="">Choose…</option>
                {Object.entries(reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            {form.reason === 'payment-error' || form.reason === 'paid-other-way' ? (
              <>
                <div className="field"><label htmlFor={`u_pay_${parent.id}`}>Their payment on this website</label>
                  <select id={`u_pay_${parent.id}`} value={form.paymentId} onChange={set('paymentId')}>
                    <option value="">{tries.length ? 'None of these' : 'No payment tries for this theme'}</option>
                    {tries.map((x) => <option key={x.id} value={x.id}>{x.createdAt.slice(0, 10)} · {money(x)} · {x.status}{x.paymentId ? ` · ${x.paymentId}` : ''}</option>)}
                  </select>
                  <span className="help">Check the payment in your Razorpay (or PayPal) dashboard first: it must say Captured / Completed.</span></div>
                <div className="field"><label htmlFor={`u_ref_${parent.id}`}>Payment reference</label>
                  <input id={`u_ref_${parent.id}`} type="text" maxLength={80} placeholder="pay_… (Razorpay) or the PayPal transaction ID" value={form.reference} onChange={set('reference')} /></div>
              </>
            ) : null}
            <div className="field"><label htmlFor={`u_note_${parent.id}`}>Note {form.reason === 'other' ? '' : '(optional)'}</label>
              <input id={`u_note_${parent.id}`} type="text" maxLength={120} placeholder="e.g. emailed us on 14 Nov" value={form.note} onChange={set('note')} /></div>
            <label className="check"><input type="checkbox" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} /> Email the licence to {parent.email}</label>
            <button className="btn btn-small" disabled={isLoading || !form.courseId}>Unlock</button>
          </>
        )}
        {parent.payments.length ? (
          <div className="unlock-history">
            <b>Payments</b>
            <ul>{parent.payments.map((x) => (
              <li key={x.id} className={x.status === 'paid' && !x.unlocked ? 'warn' : ''}>
                {x.createdAt.slice(0, 10)} · {x.theme} · {PROVIDERS[x.provider] || x.provider} · {money(x)} · <b>{x.status}</b>{x.unlocked ? ' · unlocked' : ''}
                {x.paymentId ? <><br /><small>{x.paymentId}</small></> : null}
                {x.note ? <><br /><small>{x.note}</small></> : null}
              </li>
            ))}</ul>
          </div>
        ) : <p className="muted" style={{ marginTop: 10, fontSize: '.85rem' }}>No payments from {parent.name} yet.</p>}
      </form>
    </details>
  );
}
