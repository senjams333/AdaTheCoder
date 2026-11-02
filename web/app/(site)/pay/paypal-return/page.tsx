'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { Paid, payCall } from '@/lib/pay';

/** PayPal sends the parent back here (?token=<PayPal order id>): the API captures the payment and unlocks the theme. */
function ReturnInner() {
  const orderId = useSearchParams().get('token') || '';
  const [paid, setPaid] = useState<Paid | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (!orderId) return setErrors(['PayPal did not send the order back. If money left your account, write to us.']);
    payCall<Paid>('paypal/capture', null, { order_id: orderId }).then(setPaid).catch((err) => setErrors([(err as Error).message]));
  }, [orderId]);

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
          ) : (
            <>
              <h1>Finishing your PayPal payment…</h1>
              <FormErrors errors={errors} />
              {!errors.length && <p className="sub">One moment, please. Don&apos;t close this page.</p>}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function PaypalReturnPage() {
  return (
    <Suspense>
      <ReturnInner />
    </Suspense>
  );
}
