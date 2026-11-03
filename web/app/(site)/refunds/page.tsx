'use client';

import BusinessDetails, { useContact } from '@/components/BusinessDetails';

export default function RefundsPage() {
  const { email } = useContact();
  return (
    <article className="prose wrap">
      <h1>Refund and cancellation policy</h1>
      <p className="muted">Last updated: 3 November 2026. Template text: review it with a legal adviser before launch.</p>

      <h2>Try before you buy</h2>
      <p>Every paid theme lets your child try the first lessons free, so you can see whether it suits them before you pay.</p>

      <h2>7-day refund</h2>
      <p>If you&apos;re not happy with a theme you bought, email <a href={`mailto:${email}`}>{email}</a> within <b>7 days</b> of paying, with the email address of your account and the theme&apos;s name. We&apos;ll refund the full amount; no questions asked. The licence for that theme is then removed.</p>

      <h2>Problems with a purchase</h2>
      <ul>
        <li><b>Charged twice, or charged but the theme didn&apos;t unlock:</b> write to us at any time with your payment&apos;s reference (from Razorpay or PayPal). We&apos;ll unlock the theme or refund the extra payment.</li>
        <li><b>The app doesn&apos;t work on your computer:</b> tell us within 7 days and we&apos;ll help, or refund you if we can&apos;t make it work.</li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>Refunds go back to the way you paid: to your card, UPI or bank account through Razorpay, or to your PayPal account or card through PayPal. We send the refund within 2 working days of agreeing to it; your bank or PayPal usually shows it within 5 to 7 working days.</p>

      <h2>Cancellation</h2>
      <p>Licences are one-time payments, not subscriptions, so there is nothing to cancel and you&apos;ll never be charged again automatically. You can delete your account at any time from your account page.</p>

      <h2>Contact</h2>
      <BusinessDetails />
    </article>
  );
}
