'use client';

import BusinessDetails, { useContact } from '@/components/BusinessDetails';

export default function RefundsPage() {
  const { email } = useContact();
  return (
    <article className="prose wrap">
      <h1>Refund and cancellation policy</h1>
      <p className="muted">Last updated: 6 November 2026. Template text: review it with a legal adviser before launch.</p>

      <h2>No refunds</h2>
      <p>Our themes cost very little, and every paid theme lets your child <b>try the first lessons free</b> before you buy. So all sales are final: we don&apos;t give refunds once a theme is bought and unlocked.</p>

      <h2>Problems with a payment</h2>
      <p>We will always put right a payment mistake. Write to <a href={`mailto:${email}`}>{email}</a> with your account&apos;s email and the payment reference (from Razorpay or PayPal):</p>
      <ul>
        <li><b>Charged twice for the same theme:</b> we refund the extra payment.</li>
        <li><b>Charged, but the theme didn&apos;t unlock:</b> we unlock it for you, or refund you if we can&apos;t.</li>
      </ul>
      <p>Money for a payment mistake goes back the way you paid (card, UPI, bank or PayPal) within 2 working days of us confirming it; your bank or PayPal usually shows it within 5 to 7 working days.</p>

      <h2>Cancellation</h2>
      <p>Licences are one-time payments, not subscriptions, so there is nothing to cancel and you&apos;ll never be charged again automatically. You can delete your account at any time from your account page.</p>

      <h2>Contact</h2>
      <BusinessDetails />
    </article>
  );
}
