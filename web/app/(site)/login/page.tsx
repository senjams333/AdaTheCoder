'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useGetSiteQuery, useLoginMutation } from '@/lib/api';
import { loggedIn } from '@/lib/authSlice';
import { errorList } from '@/lib/errors';
import { useAppDispatch } from '@/lib/hooks';
import { safeNext } from '@/lib/useRequireLogin';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [login, { isLoading }] = useLoginMutation();
  const { data: site } = useGetSiteQuery();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const contact = site?.settings.contact_email || 'ada@adathecoder.com';

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await login({ email, password }).unwrap();
      dispatch(loggedIn({ token: res.token, user: res.user }));
      router.push(safeNext(next, res.user.role === 'admin' ? '/admin' : '/account'));
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  return (
    <div className="auth-page">
      <section className="auth wrap">
        <div className="auth-card has-peek">
          <img className="peek" src="/img/byte.webp" alt="" />
          <h1>Welcome back</h1>
          <p className="sub">Log in to download the app or update it.</p>
          <FormErrors errors={errors} />
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={isLoading}>{isLoading ? 'Logging in…' : 'Log in'}</button>
          </form>
          <p className="switch">New here? <Link href="/register">Create a parent account</Link></p>
          <p className="switch muted">Forgot your password? Email <a href={`mailto:${contact}`}>{contact}</a> and we&apos;ll help.</p>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
