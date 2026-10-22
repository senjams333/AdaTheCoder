'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { FormErrors } from '@/components/Flashes';
import { useGetSiteQuery, useRegisterMutation } from '@/lib/api';
import { loggedIn } from '@/lib/authSlice';
import { errorList } from '@/lib/errors';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch } from '@/lib/hooks';

const EMPTY = { name: '', email: '', city: '', country: '', password: '', password2: '', childName: '', childAge: '', consent: false };

export default function RegisterPage() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [register, { isLoading }] = useRegisterMutation();
  const { data: site } = useGetSiteQuery();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? Boolean(e.target.checked) : e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems: string[] = [];
    if (!form.name.trim()) problems.push('Enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) problems.push('Enter a valid email address.');
    if (form.password.length < 8) problems.push('Choose a password with at least 8 characters.');
    if (form.password !== form.password2) problems.push("The two passwords don't match.");
    if (!form.city.trim()) problems.push('Enter your city.');
    if (!form.country.trim()) problems.push('Enter your country.');
    if (!form.consent) problems.push('Tick the box to confirm you are the parent or guardian.');
    setErrors(problems);
    if (problems.length) return;
    try {
      const body: Record<string, unknown> = {
        name: form.name, email: form.email, password: form.password, password2: form.password2,
        city: form.city, country: form.country, consent: true,
      };
      if (form.childName.trim()) body.childName = form.childName.trim();
      if (form.childAge) body.childAge = Number(form.childAge);
      const res = await register(body).unwrap();
      dispatch(loggedIn({ token: res.token, user: res.user }));
      dispatch(flash('success', 'Your account is ready. Download the app below.'));
      router.push('/account');
    } catch (err) {
      setErrors(errorList(err));
    }
  }

  return (
    <div className="auth-page">
      <section className="auth wrap reg-layout">
        <div className="reg-art">
          <div className="reg-scene" role="img" aria-label="Ada sitting at her desk next to a computer running a Python loop that prints Hello three times">
            <svg className="reg-scene-back" viewBox="0 0 600 400" aria-hidden="true">
              <ellipse cx="300" cy="388" rx="270" ry="10" fill="#2B2257" opacity=".08" />
              <rect x="40" y="318" width="14" height="66" rx="5" fill="#F2B97A" />
              <rect x="536" y="318" width="14" height="66" rx="5" fill="#F2B97A" />
              <rect x="18" y="22" width="320" height="226" rx="20" fill="#2B2257" />
              <rect x="32" y="36" width="292" height="198" rx="11" fill="#1E1745" />
              <path d="M156 248h44l8 52h-60z" fill="#4A3F8C" />
              <g fontFamily="'JetBrains Mono', Consolas, monospace" fontSize="15" fontWeight="600">
                <text x="48" y="66"><tspan fill="#FF8AC6">for</tspan><tspan fill="#E9E4FF"> star </tspan><tspan fill="#FF8AC6">in</tspan><tspan fill="#7FD8FF"> range</tspan><tspan fill="#E9E4FF">(</tspan><tspan fill="#FFD23F">3</tspan><tspan fill="#E9E4FF">):</tspan></text>
                <text x="84" y="90"><tspan fill="#7FD8FF">print</tspan><tspan fill="#E9E4FF">(</tspan><tspan fill="#8EF0C4">&quot;✨ Hello!</tspan><tspan fill="#FF8AC6">\n</tspan><tspan fill="#8EF0C4">&quot;</tspan><tspan fill="#E9E4FF">)</tspan></text>
                <text x="48" y="122" fill="#FFD23F">✨ Hello!</text>
                <text x="48" y="162" fill="#FFD23F">✨ Hello!</text>
                <text x="48" y="202" fill="#FFD23F">✨ Hello!</text>
                <rect className="scene-cursor" x="48" y="212" width="9" height="18" fill="#FFD23F" />
              </g>
              <rect x="392" y="150" width="168" height="170" rx="34" fill="#7B4DFF" />
              <rect x="406" y="164" width="140" height="150" rx="26" fill="#9A75FF" />
            </svg>
            <img className="reg-scene-ada" src="/img/ada.webp" alt="" />
            <svg className="reg-scene-front" viewBox="0 0 600 400" aria-hidden="true">
              <rect x="8" y="300" width="560" height="20" rx="8" fill="#FFD9A8" />
              <rect x="8" y="314" width="560" height="7" rx="3" fill="#F2B97A" />
              <rect x="124" y="292" width="108" height="8" rx="4" fill="#4A3F8C" />
              <path d="M262 300l10-12h86l6 12z" fill="#CFC6EC" />
            </svg>
          </div>
          <div className="reg-pitch">
            <h2>Give your child a head start in coding</h2>
            <p>Coding is the new reading and writing. With Ada The Coder, children aged 6 to 11 type real Python, see it work straight away, and feel proud of what they make.</p>
            <ul className="reg-points">
              <li>Real Python from the very first lesson, not just blocks</li>
              <li>Short lessons with videos and friendly characters</li>
              <li>Builds problem-solving, patience and confidence</li>
            </ul>
          </div>
        </div>
        <div className="auth-card">
          <h1>Create a parent account</h1>
          <p className="sub">You&apos;ll be able to download the app as soon as you&apos;re done.</p>
          <FormErrors errors={errors} />
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" type="text" autoComplete="name" required value={form.name} onChange={set('name')} />
            </div>
            <div className="field">
              <label htmlFor="email">Your email</label>
              <input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
            </div>
            <div className="row-2">
              <div className="field">
                <label htmlFor="city">City</label>
                <input id="city" type="text" maxLength={80} autoComplete="address-level2" required value={form.city} onChange={set('city')} />
              </div>
              <div className="field">
                <label htmlFor="country">Country</label>
                <input id="country" type="text" maxLength={80} autoComplete="country-name" required list="country-list" value={form.country} onChange={set('country')} />
                <datalist id="country-list">{(site?.countries || []).map((c) => <option key={c} value={c} />)}</datalist>
              </div>
            </div>
            <div className="row-2">
              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} />
                <span className="help">At least 8 characters</span>
              </div>
              <div className="field">
                <label htmlFor="password2">Type it again</label>
                <input id="password2" type="password" autoComplete="new-password" required value={form.password2} onChange={set('password2')} />
              </div>
            </div>
            <div className="row-2">
              <div className="field">
                <label htmlFor="child_name">Child&apos;s first name <span className="muted">(optional)</span></label>
                <input id="child_name" type="text" maxLength={40} autoComplete="off" value={form.childName} onChange={set('childName')} />
              </div>
              <div className="field">
                <label htmlFor="child_age">Child&apos;s age <span className="muted">(optional)</span></label>
                <select id="child_age" value={form.childAge} onChange={set('childAge')}>
                  <option value="">Choose</option>
                  {[5, 6, 7, 8, 9, 10, 11, 12].map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="check">
                <input type="checkbox" checked={form.consent} onChange={set('consent')} />
                <span>I&apos;m the parent or legal guardian, and I&apos;ve read the <Link href="/privacy" target="_blank">privacy page</Link>.</span>
              </label>
            </div>
            <button className="btn" type="submit" disabled={isLoading}>{isLoading ? 'Creating your account…' : 'Create account'}</button>
          </form>
          <p className="switch">Already have an account? <Link href="/login">Log in</Link></p>
        </div>
      </section>
    </div>
  );
}
