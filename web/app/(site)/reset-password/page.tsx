'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useResetPasswordMutation } from '@/lib/api';
import { errorList } from '@/lib/errors';

/** Opened from the emailed link (?token=...): choose the new password. */
function ResetForm() {
  const token = useSearchParams().get('token') || '';
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [doneFor, setDoneFor] = useState('');
  const [reset, { isLoading }] = useResetPasswordMutation();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      setErrors(['Type the 6-digit code from the email.']);
      return;
    }
    if (password !== password2) {
      setErrors(["The two passwords don't match."]);
      return;
    }
    setErrors([]);
    try {
      const res = await reset({ token, code: code.replace(/\s/g, ''), password, password2 }).unwrap();
      setDoneFor(res.email);
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  return (
    <div className="auth-page">
      <section className="auth wrap">
        <div className="auth-card has-peek">
          <img className="peek" src="/img/byte.webp" alt="" />
          {doneFor ? (
            <>
              <h1>Password changed 🎉</h1>
              <p className="sub">
                The new password for <b>{doneFor}</b> works now, on the website and in the app. Log in with it in the app too.
              </p>
              <Link className="btn" href="/login">Log in</Link>
            </>
          ) : !token ? (
            <>
              <h1>This link isn&apos;t complete</h1>
              <p className="sub">Open the link from the email again, or ask for a new one.</p>
              <Link className="btn" href="/forgot-password">Get a new link</Link>
            </>
          ) : (
            <>
              <h1>Choose a new password</h1>
              <p className="sub">Type the 6-digit code from the email, then your new password (at least 8 characters).
                It will work on the website and in the app.</p>
              <FormErrors errors={errors} />
              <form onSubmit={submit}>
                <div className="field">
                  <label htmlFor="code">Code from the email</label>
                  <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" required
                    style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center' }} value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="password">New password</label>
                  <input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="password2">New password again</label>
                  <input id="password2" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
                    value={password2} onChange={(e) => setPassword2(e.target.value)} />
                </div>
                <button className="btn" type="submit" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save the new password'}</button>
              </form>
              {errors.some((m) => m.includes('expired')) && (
                <p className="switch"><Link href="/forgot-password">Get a new link</Link></p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
