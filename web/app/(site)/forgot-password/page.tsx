'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useForgotPasswordMutation } from '@/lib/api';
import { errorList } from '@/lib/errors';

/** "Forgot your password?" (also where the app's Profile → Change password opens): emails a link. */
function ForgotForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [errors, setErrors] = useState<string[]>([]);
  const [sentTo, setSentTo] = useState('');
  const [forgot, { isLoading }] = useForgotPasswordMutation();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);
    try {
      await forgot({ email }).unwrap();
      setSentTo(email.trim());
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  return (
    <div className="auth-page">
      <section className="auth wrap">
        <div className="auth-card has-peek">
          <img className="peek" src="/img/byte.webp" alt="" />
          <h1>Change your password</h1>
          {sentTo ? (
            <>
              <p className="sub">
                If <b>{sentTo}</b> has an account, we&apos;ve emailed it a link to choose a new password. The link works for
                1 hour. Check your spam folder if it isn&apos;t there in a few minutes.
              </p>
              <p className="sub">The new password works on the website and in the app.</p>
              <button className="btn btn-ghost" type="button" onClick={() => setSentTo('')}>Send it again</button>
            </>
          ) : (
            <>
              <p className="sub">Type the email you log in with. We&apos;ll email you a link to choose a new password.</p>
              <FormErrors errors={errors} />
              <form onSubmit={submit}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <button className="btn" type="submit" disabled={isLoading}>{isLoading ? 'Sending…' : 'Email me a link'}</button>
              </form>
            </>
          )}
          <p className="switch">Remembered it? <Link href="/login">Log in</Link></p>
        </div>
      </section>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
