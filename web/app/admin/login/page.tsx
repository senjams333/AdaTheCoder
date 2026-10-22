'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useLoginMutation, useSetupAdminMutation, useSetupStatusQuery } from '@/lib/api';
import { loggedIn } from '@/lib/authSlice';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { safeNext } from '@/lib/useRequireLogin';

function AdminLogin() {
  const { data: setup, isLoading: checking, error: setupError } = useSetupStatusQuery();
  const [login, { isLoading: loggingIn }] = useLoginMutation();
  const [createAdmin, { isLoading: creating }] = useSetupAdminMutation();
  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'), '/admin');
  const isSetup = Boolean(setup?.needed);

  useEffect(() => {
    if (user?.role === 'admin') router.replace(next);
  }, [user, next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (isSetup) {
        const problems: string[] = [];
        if (!form.name.trim()) problems.push('Type your name.');
        if (form.password.length < 10) problems.push('Choose a password with at least 10 characters.');
        else if (form.password !== form.password2) problems.push('The two passwords are different.');
        setErrors(problems);
        if (problems.length) return;
        const res = await createAdmin(form).unwrap();
        dispatch(loggedIn({ token: res.token, user: res.user }));
        dispatch(flash('success', 'Your admin account is ready. Log in at this same page next time.'));
        router.push('/admin');
        return;
      }
      const res = await login({ email: form.email, password: form.password }).unwrap();
      if (res.user.role !== 'admin') {
        setErrors(["That account isn't an admin account."]);
        return;
      }
      dispatch(loggedIn({ token: res.token, user: res.user }));
      router.push(next);
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="auth wrap">
      <div className="auth-card">
        <Link className="brand" href="/"><img src="/img/ada-face.png" alt="" />Ada The Coder</Link>
        {checking ? <p className="muted" style={{ marginTop: 24 }}>Loading…</p> : null}
        {setupError ? <FormErrors errors={errorList(setupError)} /> : null}
        {!checking && isSetup ? (
          <>
            <h1 style={{ marginTop: 24 }}>Create the admin account</h1>
            <p className="muted">This website has no admin yet. The account you make here manages the themes, lessons, videos, app versions and parents. This page only appears once: after this, it asks for the admin email and password.</p>
          </>
        ) : null}
        {!checking && !isSetup ? <h1 style={{ marginTop: 24 }}>Admin log in</h1> : null}
        <FormErrors errors={errors} />
        {!checking ? (
          <form onSubmit={submit}>
            {isSetup ? (
              <div className="field"><label htmlFor="name">Your name</label><input id="name" type="text" autoComplete="name" required value={form.name} onChange={set('name')} /></div>
            ) : null}
            <div className="field"><label htmlFor="email">{isSetup ? 'Admin email' : 'Email'}</label><input id="email" type="email" autoComplete="username" required value={form.email} onChange={set('email')} /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={isSetup ? 'new-password' : 'current-password'} minLength={isSetup ? 10 : undefined} required value={form.password} onChange={set('password')} />
              {isSetup ? <span className="help">At least 10 characters.</span> : null}</div>
            {isSetup ? (
              <div className="field"><label htmlFor="password2">Type the password again</label><input id="password2" type="password" autoComplete="new-password" required value={form.password2} onChange={set('password2')} /></div>
            ) : null}
            <button className="btn" type="submit" disabled={loggingIn || creating}>{isSetup ? 'Create admin account' : 'Log in'}</button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLogin />
    </Suspense>
  );
}
