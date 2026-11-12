'use client';

import Link from 'next/link';
import { Fragment, ReactNode } from 'react';
import BusinessDetails, { useContact } from '@/components/BusinessDetails';
import GrievanceOfficer from '@/components/GrievanceOfficer';
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

/** Our policies: privacy (written as the notice India's Digital Personal Data Protection Act, 2023 and its Rules ask
 *  for), then purchases, delivery, cancellation and refunds. */
export default function PrivacyPage() {
  const { email } = useContact();
  const { data } = useGetSiteQuery();
  const purchases = data?.settings.policy_purchases || '';
  const paypal = Boolean(data?.paypal);
  return (
    <article className="prose wrap">
      <h1>Our policies</h1>
      <p className="muted">Last updated: 12 November 2026</p>
      <p>
        Ada The Coder teaches children to write Python. This page explains, in plain words, what information we collect,
        why, and the choices you have; and then how purchases, delivery, cancellation and refunds work. On this page,
        &quot;we&quot; means Ada The Coder (details at the end), and &quot;you&quot; means the parent or guardian who has
        the account.
      </p>

      <h2 id="privacy" style={{ fontSize: '1.7rem' }}>Privacy</h2>

      <h2>The short version</h2>
      <ul>
        <li>Accounts are for <b>parents and guardians aged 18 or over</b>. Children use the app through their grown-up&apos;s account.</li>
        <li>About your child, we keep at most a <b>first name and age</b>, and only if you choose to add them.</li>
        <li>Your child&apos;s code, answers and progress <b>stay on your computer</b>. The app doesn&apos;t send them to us.</li>
        <li><b>No adverts, no tracking, no selling of data</b>, and no profiling of children.</li>
        <li>You can see, correct or delete your information at any time, and delete your account from your account page.</li>
      </ul>

      <h2>What we collect, and why</h2>
      <ul>
        <li><b>Your account:</b> your name, email address, city, country and a scrambled (hashed) version of your password, so you can log in, download the app and reach your licences. When you sign up on the website, we check your email address with a code.</li>
        <li><b>Your consent:</b> the date and time you confirmed, when signing up, that you are 18 or over and the child&apos;s parent or guardian, and agreed to this policy.</li>
        <li><b>Your child (optional):</b> a first name and an age. The app uses the first name to greet your child. Leave them out if you prefer; everything works without them.</li>
        <li><b>Purchases:</b> which theme, the amount, the date, whether the payment went through, the payment reference from {paypal ? 'Razorpay or PayPal' : 'Razorpay'}, and your licence code, so we can unlock the theme, show your licence and sort out any payment problem.</li>
        <li><b>Using the website and app:</b> when you last logged in, when the app was downloaded, and the technical records every website keeps (the internet address, browser and time of each request), used only to keep the service working and secure, and to stop abuse.</li>
        <li><b>Messages:</b> what you write to us through the Contact page or by email, so we can answer you.</li>
      </ul>
      <p>We only collect what we need for these purposes, and we use it only for them. We rely on your consent, given when you sign up; and for purchase records, also on our legal duty to keep tax and accounting records.</p>

      <h2>Children</h2>
      <p>
        Ada The Coder is made for children, so we take extra care. Only a parent or guardian aged 18 or over can create an
        account, after confirming their email address, and they give consent for their child when they sign up. We never
        track or behaviourally monitor children, never show them adverts or target anything at them, and never process
        their information in a way that could harm their well-being. The app doesn&apos;t send your child&apos;s programs,
        answers or progress to us. Under India&apos;s Digital Personal Data Protection Act, 2023, anyone under 18 is a child.
      </p>

      <h2>What we don&apos;t do</h2>
      <p>We don&apos;t sell or rent your information, show adverts, use advertising or analytics cookies, or build profiles. We don&apos;t send marketing emails unless you ask for them.</p>

      <h2>Who helps us run the service</h2>
      <p>These companies process information only on our instructions and only to provide their service to us:</p>
      <ul>
        <li><b>Amazon Web Services</b> hosts the website, its database and its backups, in Mumbai, India.</li>
        <li><b>Razorpay</b> handles payments{paypal ? ', and PayPal for payments from outside India' : ''}. Your card, UPI and bank details go straight to {paypal ? 'them' : 'Razorpay'}; we never see or store them. Their own privacy policies cover what they collect.</li>
        <li><b>Brevo</b> sends our emails (your sign-up code, password resets, licence emails). Brevo is based in the European Union, so your name and email address may be processed outside India.</li>
        <li><b>Google Fonts</b> supplies the website&apos;s lettering, so your browser connects to Google to fetch it.</li>
      </ul>
      <p>We share information with the authorities only when Indian law requires it.</p>

      <h2>On your computer</h2>
      <p>The website keeps you logged in using your browser&apos;s storage; logging out removes it. The app keeps a log-in token (never your password), the lessons and videos it has downloaded, and your child&apos;s programs, all on your computer; logging out of the app removes the token. We use no advertising or tracking cookies.</p>

      <h2>Keeping it safe</h2>
      <p>Everything travels over an encrypted connection (HTTPS). Passwords are stored only in a scrambled form that can&apos;t be turned back into the password. Access to our systems is limited and protected, backups are kept in private storage, and the copies kept away from our server are encrypted. If a breach ever affects your information, we will tell you and the Data Protection Board of India as the law requires, and explain what happened and what we are doing about it.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li><b>Your account and your child&apos;s details:</b> until you delete your account, or ask us to delete them.</li>
        <li><b>Purchase records:</b> as long as tax and accounting laws require (generally up to 8 years), even after the account is deleted.</li>
        <li><b>Technical records:</b> a few weeks, unless needed to look into a security problem.</li>
        <li><b>Backups:</b> deleted data also leaves our backups within 60 days.</li>
      </ul>

      <h2>Your rights</h2>
      <p>Under the Digital Personal Data Protection Act, 2023 you can:</p>
      <ul>
        <li><b>See</b> a summary of the information we hold about you and your child, and who we have shared it with;</li>
        <li><b>Correct, complete or update</b> it (most of it you can change yourself on your account page);</li>
        <li><b>Delete</b> it: delete your account from your account page, or ask us;</li>
        <li><b>Withdraw your consent</b> at any time, as easily as you gave it, by deleting your account or your child&apos;s details, or by writing to us. Withdrawing doesn&apos;t affect what was done before;</li>
        <li><b>Nominate</b> someone to use these rights for you if you die or can&apos;t act yourself;</li>
        <li><b>Complain</b> to our Grievance Officer (below), and then to the Data Protection Board of India.</li>
      </ul>
      <p>To use any of these rights, write to the Grievance Officer from your account&apos;s email address.</p>

      <h2 id="grievance">Grievance Officer</h2>
      <GrievanceOfficer />
      <p>
        We acknowledge every complaint within 48 hours and resolve it within 30 days. If you aren&apos;t satisfied, you can
        complain to the Data Protection Board of India (about your data), or to the National Consumer Helpline: call 1915,
        or visit consumerhelpline.gov.in (about a purchase).
      </p>

      <h2 id="purchases" style={{ fontSize: '1.7rem', marginTop: '2.2em' }}>Purchases, delivery, cancellation and refunds</h2>
      <PolicyText text={purchases} email={email} />

      <h2>Changes to this page</h2>
      <p>If we change these policies we will update the date at the top, and email account holders about important changes before they apply.</p>

      <h2>Contact</h2>
      <p>Questions about your data or a purchase? Email <a href={`mailto:${email}`}>{email}</a>, or use the <Link href="/contact">Contact page</Link>.</p>
      <BusinessDetails />
    </article>
  );
}
