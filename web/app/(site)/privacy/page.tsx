'use client';

import { Fragment, ReactNode } from 'react';
import BusinessDetails, { useContact } from '@/components/BusinessDetails';
import { useGetSiteQuery } from '@/lib/api';

/** The admin's text (Website text → Purchases and cancellation): empty line = new paragraph, "- " = bullet,
 *  "Title: text" in a bullet = bold title, {email} = the contact email as a link. */
function PolicyText({ text, email }: { text: string; email: string }) {
  const inline = (t: string): ReactNode[] => t.split('{email}').flatMap((part, i) =>
    i === 0 ? [part] : [<a key={i} href={`mailto:${email}`}>{email}</a>, part]);
  return (
    <>
      {text.split(/\n\s*\n/).map((block, b) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const bullets = lines.filter((l) => l.startsWith('- '));
        const plain = lines.filter((l) => !l.startsWith('- '));
        return (
          <Fragment key={b}>
            {plain.length > 0 && <p>{inline(plain.join(' '))}</p>}
            {bullets.length > 0 && (
              <ul>
                {bullets.map((l, k) => {
                  const t = l.slice(2); const c = t.indexOf(':');
                  return <li key={k}>{c > 0 && c < 60 ? <><b>{t.slice(0, c + 1)}</b>{inline(t.slice(c + 1))}</> : inline(t)}</li>;
                })}
              </ul>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export default function PrivacyPage() {
  const { email } = useContact();
  const { data } = useGetSiteQuery();
  const purchases = data?.settings.policy_purchases || '';
  return (
    <article className="prose wrap">
      <h1>Our policies</h1>
      <p className="muted">Last updated: 3 November 2026. Template text: review it with a legal adviser for the countries you operate in (for example India&apos;s DPDP Act, GDPR or COPPA) before launch.</p>
      <p>How we look after your family&apos;s information, and how purchases work.</p>
      <h2 id="privacy" style={{ fontSize: '1.7rem' }}>Privacy</h2>
      <h2>What we collect</h2>
      <p>When a parent or guardian creates an account we store their name, email address, city and country, and a scrambled (hashed) version of their password. Parents can choose to add their child&apos;s first name and age; the app uses the first name to greet the child. We also record when the account last logged in and when the app is downloaded.</p>
      <h2>Payments</h2>
      <p>Paid themes are bought on this website through <b>Razorpay</b> or <b>PayPal</b>. They handle your card, UPI, bank or PayPal details; we never see or store them. We keep a record of each purchase: which theme, the amount, the date, whether it went through, and the payment reference Razorpay or PayPal gives us, so we can show your licence and sort out any payment problem. Razorpay&apos;s and PayPal&apos;s own privacy policies cover what they collect.</p>
      <h2>Emails</h2>
      <p>We send account emails (your sign-up code, a welcome, password reset links) through our email provider, Brevo. We don&apos;t send marketing emails unless you ask for them.</p>
      <h2>What we don&apos;t collect</h2>
      <p>Children don&apos;t create accounts. The app doesn&apos;t send your child&apos;s code, answers or progress to us; that stays on your computer. The app only asks our website for new lessons, app updates and which themes your account has unlocked.</p>
      <h2>On your computer</h2>
      <p>The website keeps you logged in using your browser&apos;s storage. The app keeps a log-in token (never your password) so it can check for the themes you&apos;ve bought; logging out of the app removes it.</p>
      <h2>How we use it</h2>
      <p>We use your details to let you log in, download the app, unlock the themes you buy, and send the emails above. We don&apos;t sell your details or show adverts.</p>
      <h2>How long we keep it</h2>
      <p>We keep your account until you delete it. Purchase records are kept for as long as tax and accounting laws require, even after an account is deleted.</p>
      <h2>Deleting your data</h2>
      <p>You can delete your account at any time from your account page. That removes your details from our records, apart from the purchase records the law asks us to keep.</p>
      <h2 id="purchases" style={{ fontSize: '1.7rem', marginTop: '2.2em' }}>Purchases and cancellation</h2>
      <PolicyText text={purchases} email={email} />
      <h2>Contact</h2>
      <p>Questions about your data or a purchase? Email <a href={`mailto:${email}`}>{email}</a>.</p>
      <BusinessDetails />
    </article>
  );
}
