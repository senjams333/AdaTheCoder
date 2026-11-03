'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useAppSelector } from '@/lib/hooks';
import { loadRazorpay, Paid, payCall, PayPage } from '@/lib/pay';

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
  const [page, setPage] = useState<PayPage | null>(null);
  const [errors, setErrors] = useState<string[]>(params.get('cancelled') ? ['The PayPal payment was cancelled. Nothing was charged.'] : []);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState<'' | 'razorpay' | 'paypal'>('');
  const [paid, setPaid] = useState<Paid | null>(null);
  const wanted = params.get('method');      // the app's Upgrade card: "razorpay" or "paypal" starts that one straight away
  const started = useRef(false);

  const load = useCallback(async () => {
    if (!slug) return setErrors(['Choose a theme to unlock on your account page.']);
    if (!token) return setNeedLogin(true);
    try {
      setPage(await payCall<PayPage>(encodeURIComponent(slug), token));
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

  const here = `/pay?theme=${encodeURIComponent(slug)}`;
  return (
    <div className="auth-page">
      <section className="auth wrap">
        <div className="auth-card has-peek pay-card">
          <img className="peek" src="/img/byte.webp" alt="" />
          {paid ? (
            <>
              <h1>Unlocked! 🎉</h1>
              <p className="sub">{paid.message}</p>
              <div className="pay-licence"><span>Your licence</span><b>{paid.licence}</b></div>
              <p className="sub">Keep this code. It is also on your <Link href={`/account?theme=${encodeURIComponent(paid.theme)}`}>account page</Link>.
                You can close this page and go back to Ada The Coder.</p>
            </>
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
            <>
              <h1>{page.theme.name} is yours ✓</h1>
              <div className="pay-licence"><span>Your licence</span><b>{page.licence}</b></div>
              <p className="sub">Every lesson is already unlocked in the app.</p>
            </>
          ) : (
            <>
              <h1>Unlock {page.theme.name}</h1>
              <div className="pay-pics">{page.theme.images.slice(0, 3).map((i) => <img key={i} src={i} alt="" />)}</div>
              <p className="sub">{page.theme.tagline}</p>
              <ul className="pay-features">{page.theme.featureList.map((f) => <li key={f}>{f}</li>)}</ul>
              <p className="sub">One payment, every lesson, for <b>{page.user.email}</b>. No subscription.</p>
              <FormErrors errors={errors} />
              <div className="pay-methods">
                {/* both buttons always show; one that isn't set up yet says what's missing when pressed */}
                <button type="button" className="btn pay-razorpay" disabled={!!busy}
                  onClick={() => (page.methods.razorpay ? razorpay() : setErrors([!page.theme.priceInr
                    ? 'Razorpay needs this theme\'s price in rupees: in the admin, open the theme → Settings → Price in rupees.'
                    : 'Razorpay isn\'t switched on yet: add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in api/.env, then restart the website.']))}>
                  {busy === 'razorpay' ? 'Opening Razorpay…'
                    : `Pay ${page.methods.razorpay?.label || (page.theme.priceInr ? `₹${page.theme.priceInr}` : '')} with Razorpay`.replace('Pay  with', 'Pay with')}
                  <small>UPI · cards · net banking (India)</small>
                </button>
                <button type="button" className="btn pay-paypal" disabled={!!busy}
                  onClick={() => (page.methods.paypal ? paypal() : setErrors([
                    'PayPal isn\'t switched on yet: add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in api/.env, then restart the website.']))}>
                  {busy === 'paypal' ? 'Going to PayPal…' : `Pay ${page.methods.paypal?.label || page.theme.price} with PayPal`}
                  <small>PayPal or any card</small>
                </button>
              </div>
              <p className="pay-safe">🔒 Payments are handled by Razorpay and PayPal. We never see your card.<br />
                By paying you agree to the <Link href="/terms">terms</Link>. Not happy? <Link href="/refunds">7-day refund</Link>.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense>
      <PayInner />
    </Suspense>
  );
}
