'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import Flashes, { FormErrors } from '@/components/Flashes';
import InstallHelp from '@/components/InstallHelp';
import SiteHeader from '@/components/SiteHeader';
import Modal from '@/components/Modal';
import {
  api, useDeleteAccountMutation, useForgotPasswordMutation, useDownloadLinkMutation, useGetAccountQuery, useGetSiteQuery,
  useUpdateAccountMutation,
} from '@/lib/api';
import { loggedOut, userUpdated } from '@/lib/authSlice';
import { errorList, httpStatus } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { day, mb } from '@/lib/format';
import { useAppDispatch } from '@/lib/hooks';
import { useRequireLogin } from '@/lib/useRequireLogin';
import { LicenceCopy } from '@/components/PaidCard';

const PLATFORM_LABELS = { windows: 'Windows', mac: 'Mac', android: 'Android', ios: 'iPhone & iPad' } as const;
type ModalName = 'details' | 'password' | 'delete' | 'install' | null;

function AccountInner() {
  const allowed = useRequireLogin();
  const { data, error, isLoading } = useGetAccountQuery(undefined, { skip: !allowed });
  const { data: site } = useGetSiteQuery();
  const [modal, setModal] = useState<ModalName>(null);
  const [licenceOf, setLicenceOf] = useState<{ name: string; code: string } | null>(null);   // See Licence pop-up
  const [mine, setMine] = useState<'windows' | 'mac' | 'android' | 'ios' | null>(null);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get('theme') || '';
  const askPassword = params.get('change') === 'password';   // the app's Profile → Change password
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
    // phones and tablets first: iPhones say "like Mac OS X", and iPads ask for the Mac page (but have a touch screen)
    const ipad = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
    setMine(/Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) || ipad ? 'ios'
      : /Windows/i.test(ua) ? 'windows' : /Macintosh|Mac OS X/i.test(ua) ? 'mac' : null);
    // The left panel's height comes from the screen size and changes only when the window width changes.
    let lastWidth = 0;
    const size = () => {
      const side = sideRef.current;
      if (!side || window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      const h = Math.min(window.innerHeight, (screen.availHeight || window.innerHeight) - 100) - 32 - 84;   // 84: the top panel
      side.style.setProperty('--sidebar-h', `${Math.max(520, Math.round(h))}px`);
    };
    size();
    window.addEventListener('resize', size);
    return () => window.removeEventListener('resize', size);
  }, [data]);

  useEffect(() => {
    if (wanted && data) document.getElementById(`theme-${wanted}`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [wanted, data]);

  useEffect(() => {
    if (askPassword && data) setModal('password');
  }, [askPassword, data]);

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
      <SiteHeader />
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
                {u.role === 'admin' ? <Link className="acct-link acct-admin-link" href="/admin">Go to admin</Link> : null}
                <div className="acct-logout"><button type="button" className="acct-btn acct-btn-danger acct-btn-block" onClick={() => setModal('delete')}>Delete account</button></div>
              </div>

              <Modal open={modal === 'details'} onClose={() => setModal(null)} title="Edit your details" id="det-title">
                <DetailsForm user={u} countries={site?.countries || []} onDone={() => setModal(null)} />
              </Modal>
              <Modal open={modal === 'password'} onClose={() => setModal(null)} title="Change your password" id="pw-title">
                <PasswordLink email={u.email} onDone={() => setModal(null)} />
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
                    <div className="acct-card-image"><span className="acct-tag acct-tag-main">FREE DOWNLOAD</span><img src="/img/ada.webp" alt="" /></div>
                    <div className="acct-card-body">
                      <span className="acct-main-label">⭐ The main app: start here</span>
                      <h3>Free Trial</h3>
                      {/* short words (and soft hyphens, \u00AD) so the justified lines never get long gaps */}
                      <p>{'Get Ada The Cod\u00ADer free. Ev\u00ADery theme opens in it, and new les\u00ADsons ar\u00ADrive on their own.'}</p>
                      <div className="acct-card-actions">
                        {(['windows', 'mac'] as const).map((key) => (
                          <DownloadButton key={key} platform={key} label={PLATFORM_LABELS[key]} release={data.releases[key]} yours={mine === key} />
                        ))}
                      </div>
                      <MobileApps releases={data.releases} mine={mine} />
                      <button type="button" className="acct-help-btn" onClick={() => setModal('install')}>How to install</button>
                      {/* a plain link (a full page load): /learn needs its own page headers to run Python */}
                      <a className="acct-learn" href="/learn">📱 No computer? Learn in the browser</a>
                    </div>
                  </article>

                  {data.themes.map((c) => (
                    <article key={c.id} className={`acct-card theme-${c.pack}${wanted === c.slug ? ' acct-card-wanted' : ''}`} id={`theme-${c.slug}`}>
                      <div className={`acct-card-image${c.images.length > 1 ? ' many' : ''}`}>
                        {!c.premium ? <span className="acct-tag acct-tag-free">FREE</span>
                          : c.licence ? <span className="acct-tag acct-tag-owned">✓ PURCHASED</span> : <span className="acct-tag">UPGRADE</span>}
                        {c.images.map((img) => <img key={img} src={img} alt="" />)}
                      </div>
                      <div className="acct-card-body">
                        <h3>{c.name}</h3>
                        <p>{c.tagline}</p>
                        <ul className="acct-features">{c.featureList.map((f) => <li key={f}>{f}</li>)}</ul>
                        <div className="acct-card-actions">
                          {!c.premium ? (
                            <p className="acct-free-note">Free in the app: open Ada The Coder and choose this theme.</p>
                          ) : c.licence ? (
                            <>
                              <button type="button" className="acct-get acct-see acct-btn-block" onClick={() => setLicenceOf({ name: c.name, code: c.licence as string })}>See Licence</button>
                            </>
                          ) : (
                            <>
                              <div className="acct-price">{c.price} <span>one-time</span></div>
                              <Link className="acct-get acct-btn-block" href={`/pay?theme=${encodeURIComponent(c.slug)}`}>Get Licence</Link>
                              <span className="acct-pay-note">Razorpay (UPI, cards)</span>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <Modal open={licenceOf !== null} onClose={() => setLicenceOf(null)} title={licenceOf ? `Your licence: ${licenceOf.name}` : 'Your licence'} id="lic-title">
                {licenceOf ? <LicenceBox code={licenceOf.code} /> : null}
              </Modal>
              <Modal open={modal === 'install'} onClose={() => setModal(null)} title="How to install Ada The Coder" id="inst-title" wide>
                <InstallHelp contact={contact} macReady={Boolean(data?.releases?.mac)} onDone={() => setModal(null)} />
              </Modal>
              <footer className="acct-footer">
                <span>© Ada The Coder. Made for curious kids and the grown-ups who help them.</span>
                <Link href="/privacy">Policies</Link>
                <Link href="/terms">Terms &amp; Conditions</Link>
                <Link href="/contact">Contact</Link>
              </footer>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

/** The phone and tablet apps: the store link the admin set (Website text), else the uploaded app file (App versions).
 *  Shown only when there is one. */
function MobileApps({ releases, mine }: { releases: Partial<Record<'windows' | 'mac' | 'android' | 'ios', { version: string; size: number }>>; mine: string | null }) {
  const { data } = useGetSiteQuery();
  const s = data?.settings || {};
  const items = [
    { key: 'android' as const, store: (s.play_store_url || '').trim(), storeLabel: 'Google Play' },
    { key: 'ios' as const, store: (s.app_store_url || '').trim(), storeLabel: /testflight/i.test(s.app_store_url || '') ? 'TestFlight' : 'App Store' },
  ].filter((x) => x.store || releases[x.key]);
  if (!items.length) return null;
  return (
    <div className="acct-mobile">
      <span className="acct-small">Phones and tablets:</span>
      <div className="acct-card-actions">
        {items.map((x) => x.store
          ? <div className="acct-dl" key={x.key}><a className="acct-btn acct-btn-block" href={x.store} target="_blank" rel="noopener noreferrer">{PLATFORM_LABELS[x.key]}: {x.storeLabel}</a></div>
          : <DownloadButton key={x.key} platform={x.key} label={PLATFORM_LABELS[x.key]} release={releases[x.key]} yours={mine === x.key} />)}
      </div>
    </div>
  );
}

function DownloadButton({ platform, label, release, yours }: {
  platform: 'windows' | 'mac' | 'android' | 'ios'; label: string; release?: { version: string; size: number }; yours: boolean;
}) {
  const [getLink, { isLoading }] = useDownloadLinkMutation();
  const dispatch = useAppDispatch();
  if (!release) {
    return <div className="acct-dl"><span className="acct-btn acct-btn-block is-off" aria-disabled="true">{label}: Coming Soon</span></div>;
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
      <span className="acct-small">Version {release.version}, {mb(release.size)}{yours ? <span className="yours"> · {platform === 'android' || platform === 'ios' ? 'this device' : 'your computer'}</span> : null}</span>
    </div>
  );
}

function LicenceBox({ code }: { code: string }) {
  return (
    <div className="acct-licence-wrap">
      <LicenceCopy code={code} />
      <p className="acct-unlock-hint">To unlock in the app: open the theme → <b>Upgrade ⭐</b> → <b>I have a licence 🔑</b>, then paste this licence. (It usually unlocks by itself when you log in to the app.)</p>
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

/** Change password: a reset link is emailed to the account's address (the same link as "Forgot password"),
 *  so a password is only changed by someone who can read that inbox. */
function PasswordLink({ email, onDone }: { email: string; onDone: () => void }) {
  const [send, { isLoading }] = useForgotPasswordMutation();
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const asked = useRef(false);
  async function go() {
    setErrors([]);
    try {
      await send({ email }).unwrap();
      setSent(true);
    } catch (err) {
      setErrors(errorList(err));
    }
  }
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <FormErrors errors={errors} />
      {sent ? (
        <>
          <p className="acct-text"><b>📧 We&apos;ve sent a password reset link to {email}.</b></p>
          <p className="acct-text">Please check your email and click the password reset link to change your password. If you don&apos;t see it within a few minutes, look in your Spam folder.</p>
        </>
      ) : !errors.length && <p className="acct-text">{isLoading ? 'Sending a password reset link…' : ''}</p>}
      <div className="acct-modal-buttons">
        {errors.length > 0 && <button type="button" className="acct-btn" onClick={go} disabled={isLoading}>Try again</button>}
        <button type="button" className="acct-btn acct-btn-ghost" onClick={onDone}>OK</button>
      </div>
    </div>
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
