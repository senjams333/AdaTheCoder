'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import Flashes, { FormErrors } from '@/components/Flashes';
import InstallHelp from '@/components/InstallHelp';
import Modal from '@/components/Modal';
import {
  api, useChangePasswordMutation, useDeleteAccountMutation, useDownloadLinkMutation, useGetAccountQuery, useGetSiteQuery,
  useUpdateAccountMutation,
} from '@/lib/api';
import { loggedOut, userUpdated } from '@/lib/authSlice';
import { errorList, httpStatus } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { day, mb } from '@/lib/format';
import { useAppDispatch } from '@/lib/hooks';
import { useRequireLogin } from '@/lib/useRequireLogin';

const PLATFORM_LABELS = { windows: 'Windows', mac: 'Mac' } as const;
type ModalName = 'details' | 'password' | 'delete' | 'install' | null;

function AccountInner() {
  const allowed = useRequireLogin();
  const { data, error, isLoading } = useGetAccountQuery(undefined, { skip: !allowed });
  const { data: site } = useGetSiteQuery();
  const [modal, setModal] = useState<ModalName>(null);
  const [mine, setMine] = useState<'windows' | 'mac' | null>(null);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const wanted = useSearchParams().get('theme') || '';
  const sideRef = useRef<HTMLElement>(null);
  const contact = site?.settings.contact_email || 'ada@adathecoder.com';

  // an expired log-in: back to the log-in page
  useEffect(() => {
    if (httpStatus(error) === 401) {
      dispatch(loggedOut());
      dispatch(flash('info', 'Please log in again.'));
      router.replace('/login?next=/account');
    }
  }, [error, dispatch, router]);

  useEffect(() => {
    const ua = navigator.userAgent;
    setMine(/Windows/i.test(ua) ? 'windows' : /Macintosh|Mac OS X/i.test(ua) ? 'mac' : null);
    // The left panel's height comes from the screen size and changes only when the window width changes.
    let lastWidth = 0;
    const size = () => {
      const side = sideRef.current;
      if (!side || window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      const h = Math.min(window.innerHeight, (screen.availHeight || window.innerHeight) - 100) - 32;
      side.style.setProperty('--sidebar-h', `${Math.max(520, Math.round(h))}px`);
    };
    size();
    window.addEventListener('resize', size);
    return () => window.removeEventListener('resize', size);
  }, [data]);

  useEffect(() => {
    if (wanted && data) document.getElementById(`theme-${wanted}`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [wanted, data]);

  if (!allowed || isLoading || !data) {
    return <div className="acct-page"><div className="wrap acct-wrap"><p className="acct-text">Loading your account…</p></div></div>;
  }

  const u = data.user;
  const [local, domain] = u.email.includes('@') ? [u.email.split('@')[0], u.email.split('@').slice(1).join('@')] : [u.email, ''];

  function logout() {
    dispatch(loggedOut());
    dispatch(api.util.resetApiState());
    dispatch(flash('info', "You're logged out."));
    router.push('/');
  }

  return (
    <>
      <a className="skip" href="#apps">Skip to your apps</a>
      {site?.settings.site_banner ? <div className="banner">{site.settings.site_banner}</div> : null}
      <div className="acct-page">
        <div className="wrap acct-wrap">
          <div className="acct-layout">
            <section className="acct-panel" id="settings" ref={sideRef}>
              <Link className="brand acct-brand" href="/"><img src="/img/ada-face.png" alt="" />Ada The Coder</Link>
              <div className="acct-welcome acct-welcome-side">
                <h1>Welcome, {u.name.split(' ')[0]}! 👋</h1>
                <p>{u.childName ? `Let's get ${u.childName} coding with Ada The Coder` : 'Your Ada The Coder account'}</p>
              </div>
              <h2 className="acct-title">My Account</h2>
              <div className="acct-row"><span className="acct-label">Name</span><span className="acct-value">{u.name}</span></div>
              <div className="acct-row"><span className="acct-label">Email</span><span className="acct-value">{local}{domain ? <><wbr />@{domain}</> : null}</span></div>
              <div className="acct-row"><span className="acct-label">City</span><span className="acct-value">{u.city || 'Not added yet'}</span></div>
              <div className="acct-row"><span className="acct-label">Country</span><span className="acct-value">{u.country || 'Not added yet'}</span></div>
              {u.childName || u.childAge ? (
                <div className="acct-row"><span className="acct-label">Child</span><span className="acct-value">{u.childName || ''}{u.childAge ? `${u.childName ? ', ' : ''}age ${u.childAge}` : ''}</span></div>
              ) : null}
              <div className="acct-row"><span className="acct-label">Plan</span><span className="acct-value">{u.plan === 'premium' ? <span className="acct-plan premium">Premium</span> : <span className="acct-plan free">Free</span>}</span></div>
              <div className="acct-row"><span className="acct-label">Member Since</span><span className="acct-value">{day(u.createdAt)}</span></div>

              <div className="acct-actions">
                <button type="button" className="acct-btn" onClick={() => setModal('details')}>Edit Details</button>
                <button type="button" className="acct-btn acct-btn-ghost" onClick={() => setModal('password')}>Change Password</button>
                <button type="button" className="acct-link" onClick={() => setModal('delete')}>Delete account</button>
                {u.role === 'admin' ? <Link className="acct-link acct-admin-link" href="/admin">Go to admin</Link> : null}
                <div className="acct-logout"><button className="acct-btn acct-btn-ghost acct-btn-block" onClick={logout}>Log out</button></div>
              </div>

              <Modal open={modal === 'details'} onClose={() => setModal(null)} title="Edit your details" id="det-title">
                <DetailsForm user={u} countries={site?.countries || []} onDone={() => setModal(null)} />
              </Modal>
              <Modal open={modal === 'password'} onClose={() => setModal(null)} title="Change your password" id="pw-title">
                <PasswordForm onDone={() => setModal(null)} />
              </Modal>
              <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete your account?" id="del-title">
                <DeleteForm onDone={() => setModal(null)} />
              </Modal>
            </section>

            <main className="acct-apps-col" id="apps">
              <Flashes className="flashes acct-flashes" />
              <section className="acct-panel acct-shelf-panel" aria-labelledby="shelf-title">
                <div className="acct-shelf-head">
                  <div>
                    <h2 id="shelf-title">Your apps</h2>
                    <p>Start with the free trial, then add themes whenever you like. New ones appear here as they come out.</p>
                  </div>
                </div>

                <div className="acct-shelf" tabIndex={0} aria-label="Apps and themes, scroll to see more">
                  <article className="acct-card acct-card-trial">
                    <div className="acct-card-image"><span className="acct-tag acct-tag-free">FREE</span><img src="/img/ada.webp" alt="" /></div>
                    <div className="acct-card-body">
                      <h3>Free Trial</h3>
                      <p>Try Ada The Coder for free. New lessons arrive by themselves.</p>
                      <div className="acct-card-actions">
                        {(['windows', 'mac'] as const).map((key) => (
                          <DownloadButton key={key} platform={key} label={PLATFORM_LABELS[key]} release={data.releases[key]} yours={mine === key} />
                        ))}
                      </div>
                      <button type="button" className="acct-help-btn" onClick={() => setModal('install')}>How to install</button>
                    </div>
                  </article>

                  {data.themes.map((c) => (
                    <article key={c.id} className={`acct-card theme-${c.pack}${wanted === c.slug ? ' acct-card-wanted' : ''}`} id={`theme-${c.slug}`}>
                      <div className={`acct-card-image${c.images.length > 1 ? ' many' : ''}`}>
                        {c.licence ? <span className="acct-tag acct-tag-owned">✓ OWNED</span> : <span className="acct-tag">UPGRADE</span>}
                        {c.images.map((img) => <img key={img} src={img} alt="" />)}
                      </div>
                      <div className="acct-card-body">
                        <h3>{c.name}</h3>
                        <p>{c.tagline}</p>
                        <ul className="acct-features">{c.featureList.map((f) => <li key={f}>{f}</li>)}</ul>
                        <div className="acct-card-actions">
                          {c.licence ? (
                            <LicenceBox code={c.licence} />
                          ) : (
                            <>
                              <div className="acct-price">{c.price} <span>one-time</span></div>
                              <a className="acct-get acct-btn-block" href={`mailto:${contact}?subject=${encodeURIComponent(`Licence for the ${c.name} theme`)}`}>Get Licence</a>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <Modal open={modal === 'install'} onClose={() => setModal(null)} title="How to install Ada The Coder" id="inst-title" wide>
                <InstallHelp contact={contact} onDone={() => setModal(null)} />
              </Modal>
              <footer className="acct-footer">
                <span>© Ada The Coder</span>
                <Link href="/privacy">Privacy</Link>
                <a href={`mailto:${contact}`}>{contact}</a>
              </footer>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

function DownloadButton({ platform, label, release, yours }: {
  platform: 'windows' | 'mac'; label: string; release?: { version: string; size: number }; yours: boolean;
}) {
  const [getLink, { isLoading }] = useDownloadLinkMutation();
  const dispatch = useAppDispatch();
  if (!release) {
    return <div className="acct-dl"><span className="acct-btn acct-btn-block is-off" aria-disabled="true">{label}: coming soon</span></div>;
  }
  async function download() {
    try {
      const { url } = await getLink(platform).unwrap();
      window.location.href = url;
    } catch (err) {
      dispatch(flash('error', errorList(err).join(' ')));
    }
  }
  return (
    <div className="acct-dl">
      <button type="button" className="acct-btn acct-btn-block" onClick={download} disabled={isLoading}>
        <span aria-hidden="true">⬇</span> {label}
      </button>
      <span className="acct-small">Version {release.version}, {mb(release.size)}{yours ? <span className="yours"> · your computer</span> : null}</span>
    </div>
  );
}

function LicenceBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="acct-license">
      <div className="acct-license-code"><strong>Your licence</strong><span>{code}</span></div>
      <button
        type="button"
        className="acct-btn"
        onClick={() => navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function DetailsForm({ user, countries, onDone }: { user: { name: string; city: string; country: string }; countries: string[]; onDone: () => void }) {
  const [form, setForm] = useState({ name: user.name, city: user.city || '', country: user.country || '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [save, { isLoading }] = useUpdateAccountMutation();
  const dispatch = useAppDispatch();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await save(form).unwrap();
      dispatch(userUpdated(res.user));
      dispatch(flash('success', 'Your details are saved.'));
      onDone();
    } catch (err) {
      setErrors(errorList(err));
    }
  }
  return (
    <form onSubmit={submit}>
      <FormErrors errors={errors} />
      <div className="field"><label htmlFor="d_name">Your name</label><input id="d_name" type="text" maxLength={80} autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="field"><label htmlFor="d_city">City</label><input id="d_city" type="text" maxLength={80} autoComplete="address-level2" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
      <div className="field"><label htmlFor="d_country">Country</label><input id="d_country" type="text" maxLength={80} autoComplete="country-name" required list="d-country-list" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        <datalist id="d-country-list">{countries.map((c) => <option key={c} value={c} />)}</datalist></div>
      <div className="acct-modal-buttons">
        <button className="acct-btn" disabled={isLoading}>Save details</button>
        <button type="button" className="acct-btn acct-btn-ghost" onClick={onDone}>Close</button>
      </div>
    </form>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [change, { isLoading }] = useChangePasswordMutation();
  const dispatch = useAppDispatch();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setErrors(['Choose a new password with at least 8 characters.']);
    try {
      await change({ current, new: next }).unwrap();
      dispatch(flash('success', 'Password changed.'));
      onDone();
    } catch (err) {
      setErrors(errorList(err));
    }
  }
  return (
    <form onSubmit={submit}>
      <FormErrors errors={errors} />
      <div className="field"><label htmlFor="current">Current password</label><input id="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
      <div className="field"><label htmlFor="new">New password</label><input id="new" type="password" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} /><span className="help">At least 8 characters.</span></div>
      <div className="acct-modal-buttons">
        <button className="acct-btn" disabled={isLoading}>Save new password</button>
        <button type="button" className="acct-btn acct-btn-ghost" onClick={onDone}>Close</button>
      </div>
    </form>
  );
}

function DeleteForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [remove, { isLoading }] = useDeleteAccountMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await remove({ password }).unwrap();
      dispatch(loggedOut());
      dispatch(api.util.resetApiState());
      dispatch(flash('info', 'Your account and details have been deleted.'));
      router.push('/');
    } catch (err) {
      setErrors(errorList(err));
    }
  }
  return (
    <form onSubmit={submit}>
      <FormErrors errors={errors} />
      <p className="acct-text">This removes your name, email and child details from our records. The app on your computer keeps working.</p>
      <div className="field"><label htmlFor="delpw">Type your password to confirm</label><input id="delpw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <div className="acct-modal-buttons">
        <button className="acct-btn acct-btn-danger" disabled={isLoading}>Delete my account</button>
        <button type="button" className="acct-btn acct-btn-ghost" onClick={onDone}>Close</button>
      </div>
    </form>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountInner />
    </Suspense>
  );
}
