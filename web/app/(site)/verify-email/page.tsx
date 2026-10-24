'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useVerifyEmailMutation } from '@/lib/api';
import { loggedIn } from '@/lib/authSlice';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch } from '@/lib/hooks';

/** Opened from the sign-up email (?token=...): the parent types the 6-digit code and the account is made. */
function VerifyForm() {
  const token = useSearchParams().get('token') || '';
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [verify, { isLoading }] = useVerifyEmailMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const digits = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(digits)) {
      setErrors(['Type the 6-digit code from the email.']);
      return;
    }
    setErrors([]);
    try {
      const res = await verify({ token, code: digits }).unwrap();
      dispatch(loggedIn({ token: res.token, user: res.user }));
      dispatch(flash('success', 'Your account is ready. Download the app below.'));
      router.push('/account');
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  return (
    <div className="auth-page">
      <section className="auth wrap">
        <div className="auth-card has-peek">
          <img className="peek" src="/img/byte.webp" alt="" />
          {!token ? (
            <>
              <h1>This link isn&apos;t complete</h1>
              <p className="sub">Open the link from the email again, or sign up again to get a new email.</p>
              <Link className="btn" href="/register">Sign up</Link>
            </>
          ) : (
            <>
              <h1>Type your code</h1>
              <p className="sub">Type the 6-digit code from the email to finish your account.</p>
              <FormErrors errors={errors} />
              <form onSubmit={submit} noValidate>
                <div className="field">
                  <label htmlFor="code">Code from the email</label>
                  <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456"
                    style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center' }}
                    value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <button className="btn" type="submit" disabled={isLoading}>{isLoading ? 'Checking…' : 'Finish my account'}</button>
              </form>
              {errors.some((m) => m.includes('expired') || m.includes('Too many')) && (
                <p className="switch"><Link href="/register">Sign up again</Link></p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
