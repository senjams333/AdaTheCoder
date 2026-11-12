'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import PaidCard from '@/components/PaidCard';
import { useAppSelector } from '@/lib/hooks';
import { loadRazorpay, payCall } from '@/lib/pay';
import type { Paid, PayPage as PayPageData } from '@/lib/pay';

type RazorpayOrder = { key: string; order_id: string; amount: number; currency: string; name: string; description: string;
  prefill: { name: string; email: string } };
type RazorpayAnswer = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

/** Paying for a theme: Razorpay (India: UPI, cards, net banking) or PayPal. The app's Upgrade card opens this
 *  already logged in (?t=, a 15-minute link); from the website, the parent's own log-in is used. */
function PayInner() {
  const params = useSearchParams();
  const slug = params.get('theme') || '';
  const passToken = params.get('t');
  const { token: siteToken, ready } = useAppSelector((s) => s.auth);
  const token = passToken || siteToken;
  const [page, setPage] = useState<PayPageData | null>(null);
  const [errors, setErrors] = useState<string[]>(params.get('cancelled') ? ['The PayPal payment was cancelled. Nothing was charged.'] : []);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState<'' | 'razorpay' | 'paypal'>('');
  const [paid, setPaid] = useState<Paid | null>(null);
  const wanted = params.get('method');      // the app's Upgrade card: "razorpay" or "paypal" starts that one straight away
  const started = useRef(false);
  // Razorpay's Payment Button (or its redirect back here with ?paid=1): the webhook unlocks the theme, so this page
  // asks again every 5 seconds and turns into the "Payment successful" page as soon as the licence is there
  // Razorpay adds "?payment_id=pay_..." to the return address, even after ?paid=1 (giving "paid=1?payment_id=..."),
  // so both are read here; the payment id lets the server check that exact payment
  const paidParam = params.get('paid') || '';
  const paymentId = params.get('payment_id') || params.get('razorpay_payment_id') || (paidParam.match(/payment_id=(pay_[A-Za-z0-9]+)/) || [])[1] || '';
  const [confirming, setConfirming] = useState(paidParam.startsWith('1') || !!paymentId);
  const pagePath = encodeURIComponent(slug) + (paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : '');

  const load = useCallback(async () => {
    if (!slug) return setErrors(['Choose a theme to unlock on your account page.']);
    if (!token) return setNeedLogin(true);
    try {
      setPage(await payCall<PayPageData>(pagePath, token));
    } catch (err) {
      if ((err as { status?: number }).status === 401) setNeedLogin(true);
      else setErrors([(err as Error).message]);
    }
  }, [slug, token]);

  useEffect(() => {
    if (ready || passToken) load();
  }, [ready, passToken, load]);

  async function razorpay() {
    setErrors([]);
    setBusy('razorpay');
    try {
      if (!(await loadRazorpay())) throw new Error("Razorpay didn't load. Check the internet connection and try again.");
      const order = await payCall<RazorpayOrder>(`${encodeURIComponent(slug)}/razorpay`, token, {});
      const Razorpay = (window as unknown as { Razorpay: new (o: object) => { open(): void; on(e: string, f: (r: unknown) => void): void } }).Razorpay;
      const checkout = new Razorpay({
        key: order.key, order_id: order.order_id, amount: order.amount, currency: order.currency,
        name: order.name, description: order.description, prefill: order.prefill, theme: { color: '#7b4dff' },
        handler: async (answer: RazorpayAnswer) => {
          try {
            setPaid(await payCall<Paid>('razorpay/verify', null, answer));
          } catch (err) {
            setErrors([(err as Error).message]);
          } finally {
            setBusy('');
          }
        },
        modal: { ondismiss: () => setBusy('') },
      });
      checkout.on('payment.failed', () => setErrors(['The payment did not go through. Nothing was charged; you can try again.']));
      checkout.open();
    } catch (err) {
      setErrors([(err as Error).message]);
      setBusy('');
    }
  }

  async function paypal() {
    setErrors([]);
    setBusy('paypal');
    try {
      const { approve_url } = await payCall<{ approve_url: string }>(`${encodeURIComponent(slug)}/paypal`, token, {});
      window.location.href = approve_url;      // PayPal brings the parent back to /pay/paypal-return
    } catch (err) {
      setErrors([(err as Error).message]);
      setBusy('');
    }
  }

  useEffect(() => {
    if (!page || page.licence || started.current || params.get('cancelled')) return;
    started.current = true;
    if (wanted === 'razorpay' && page.methods.razorpay) razorpay();
    else if (wanted === 'paypal' && page.methods.paypal) paypal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const watching = !!page && !page.licence && !paid && (confirming || !!page.methods.razorpay?.button);
  useEffect(() => {
    if (!watching) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const fresh = await payCall<PayPageData>(pagePath, token);
        if (fresh.licence) {
          clearInterval(timer);
          setPaid({ ok: true, licence: fresh.licence, theme: fresh.theme.slug, name: fresh.theme.name, message: '' });
          setConfirming(false);
        }
      } catch { /* try again next time */ }
      if (tries > 180) { clearInterval(timer); if (confirming) { setConfirming(false); setErrors(["We haven't heard from Razorpay yet. If money left your account, your licence will appear on your account page and in your email soon, or write to us."]); } }
    }, 5000);
    return () => clearInterval(timer);
  }, [watching, slug, token, confirming]);

  const here = `/pay?theme=${encodeURIComponent(slug)}`;
  return (
    <div className="auth-page">
      <section className="auth wrap">
        <div className="auth-card has-peek pay-card">
          <img className="peek" src="/img/byte.webp" alt="" />
          {paid ? (
            <PaidCard licence={paid.licence} themeName={paid.name || page?.theme.name || ''} themeSlug={paid.theme || slug} email={page?.user.email} />
          ) : needLogin ? (
            <>
              <h1>Log in to pay</h1>
              <p className="sub">Log in with the account the app uses, then you can unlock this theme.</p>
              <Link className="btn" href={`/login?next=${encodeURIComponent(here)}`}>Log in</Link>
            </>
          ) : !page ? (
            <>
              <h1>Unlock a theme</h1>
              <FormErrors errors={errors} />
              {!errors.length && <p className="sub">Loading…</p>}
            </>
          ) : page.licence ? (
            <PaidCard licence={page.licence} themeName={page.theme.name} themeSlug={page.theme.slug} email={page.user.email} already />
          ) : confirming ? (
            <>
              <div className="pay-wait" aria-hidden="true" />
              <h1>Confirming your payment…</h1>
              <p className="sub">Razorpay is telling us about your payment. This usually takes a few seconds. Please don&apos;t close this page.</p>
            </>
          ) : (
            <>
              <h1>Unlock {page.theme.name}</h1>
              <div className="pay-pics">{page.theme.images.slice(0, 3).map((i) => <img key={i} src={i} alt="" />)}</div>
              {/* the theme's name is the heading: a tagline or feature that only repeats it isn't shown again */}
              {page.theme.tagline && !sameAsName(page.theme.tagline, page.theme.name) ? <p className="sub">{page.theme.tagline}</p> : null}
              <ul className="pay-features">{page.theme.featureList.filter((f) => !sameAsName(f, page.theme.name)).map((f) => <li key={f}>{f}</li>)}</ul>
              <p className="sub">One payment, every lesson, for <b>{page.user.email}</b>. No subscription.</p>
              <FormErrors errors={errors} />
              <div className="pay-methods">
                {/* both buttons always show; one that isn't set up yet says what's missing when pressed */}
                {page.methods.razorpay?.button ? (
                  <div className="pay-rzp-button">
                    <RazorpayPaymentButton id={page.methods.razorpay.button} />
                    <small>UPI · cards · net banking (India). On Razorpay&apos;s form, use <b>{page.user.email}</b> so the theme unlocks for this account.</small>
                  </div>
                ) : (
                <button type="button" className="btn pay-razorpay" disabled={!!busy}
                  onClick={() => (page.methods.razorpay ? razorpay() : setErrors([!page.theme.priceInr
                    ? 'Razorpay needs this theme\'s price in rupees: in the admin, open the theme → Settings → Price in rupees.'
                    : 'Razorpay isn\'t switched on yet: add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in api/.env, then restart the website.']))}>
                  {busy === 'razorpay' ? 'Opening Razorpay…'
                    : `Pay ${page.methods.razorpay?.label || (page.theme.priceInr ? `₹${page.theme.priceInr}` : '')} with Razorpay`.replace('Pay  with', 'Pay with')}
                  <small>UPI · cards · net banking (India)</small>
                </button>
                )}
                {page.methods.paypal ? (       /* only once PayPal's keys are set up on the website */
                <button type="button" className="btn pay-paypal" disabled={!!busy} onClick={() => paypal()}>
                  {busy === 'paypal' ? 'Going to PayPal…' : `Pay ${page.methods.paypal.label || page.theme.price} with PayPal`}
                  <small>PayPal or any card</small>
                </button>
                ) : null}
              </div>
              <p className="pay-safe">🔒 Payments are handled by Razorpay{page.methods.paypal ? ' and PayPal' : ''}. We never see your card.<br />
                By paying you agree to our <Link href="/terms">terms</Link> and <Link href="/privacy#purchases">policies</Link>. The free lessons are there so your child can try the theme first.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** Razorpay's own Payment Button (made in the Razorpay dashboard: Payment Button → pl_...). Razorpay's script turns the
 *  form into its "Pay Now" button; the payment is confirmed to us by Razorpay's webhook, which unlocks the theme. */
function RazorpayPaymentButton({ id }: { id: string }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const f = form.current;
    if (!f) return;
    f.innerHTML = '';
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    s.async = true;
    s.dataset.payment_button_id = id;
    f.appendChild(s);
  }, [id]);
  return <form ref={form} />;
}

/** "Data", "data " or "• Data" is the same as the theme's name "Data". */
const sameAsName = (text: string, name: string) => {
  const tidy = (x: string) => x.replace(/^[\s•*\-–]+/, '').trim().toLowerCase();
  return tidy(text) === tidy(name);
};

export default function PayPage() {
  return (
    <Suspense>
      <PayInner />
    </Suspense>
  );
}
