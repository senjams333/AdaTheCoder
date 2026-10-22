'use client';

import { useGetSiteQuery } from '@/lib/api';

export default function PrivacyPage() {
  const { data } = useGetSiteQuery();
  const email = data?.settings.contact_email || 'ada@adathecoder.com';
  return (
    <article className="prose wrap">
      <h1>Privacy</h1>
      <p className="muted">Template text: review it with a legal adviser for the countries you operate in (for example India&apos;s DPDP Act, GDPR or COPPA) before launch.</p>
      <h2>What we collect</h2>
      <p>When a parent or guardian creates an account we store their name, email address, city and country, and a scrambled (hashed) version of their password. Parents can choose to add their child&apos;s first name and age. We also record when the app is downloaded.</p>
      <h2>What we don&apos;t collect</h2>
      <p>Children don&apos;t create accounts. The app doesn&apos;t send your child&apos;s code, answers or progress to us; that stays on your computer. The app only asks our website for new lessons and app updates.</p>
      <h2>How we use it</h2>
      <p>We use your details to let you log in and download the app, and to send you a welcome email when you sign up. We don&apos;t sell your details or show adverts.</p>
      <h2>Deleting your data</h2>
      <p>You can delete your account at any time from your account page. That removes your details from our records.</p>
      <h2>Contact</h2>
      <p>Questions? Email <a href={`mailto:${email}`}>{email}</a>.</p>
    </article>
  );
}
