'use client';

import Link from 'next/link';
import BusinessDetails, { useContact } from '@/components/BusinessDetails';

export default function TermsPage() {
  const { email } = useContact();
  return (
    <article className="prose wrap">
      <h1>Terms of use</h1>
      <p className="muted">Last updated: 3 November 2026. Template text: review it with a legal adviser before launch.</p>

      <h2>1. Who we are</h2>
      <p>Ada The Coder (&quot;we&quot;, &quot;us&quot;) runs this website and the Ada The Coder app, which teach children to write Python. Our details are at the end of this page.</p>

      <h2>2. Who can use it</h2>
      <p>Accounts are for parents, guardians and teachers aged 18 or over. Children use the app with a grown-up&apos;s account and don&apos;t need one of their own. By creating an account you confirm that you are 18 or over and responsible for how the children in your care use Ada The Coder.</p>

      <h2>3. Your account</h2>
      <p>Keep your password private. You are responsible for what happens with your account. Tell us straight away at <a href={`mailto:${email}`}>{email}</a> if you think someone else has used it. You can delete your account at any time from your account page.</p>

      <h2>4. Free and paid themes</h2>
      <p>Some themes are free. Paid themes let children try the first lessons free; buying a licence unlocks every lesson of that theme. A licence is for your family&apos;s own, non-commercial use on the computers in your home, is linked to your account and can&apos;t be sold or passed on. Schools and groups: write to us for a group licence.</p>

      <h2>5. Prices and payment</h2>
      <p>Prices are shown on your account page and on the pay page before you pay, in Indian rupees (Razorpay) or US dollars (PayPal), and include any taxes we have to charge. Payments are handled by Razorpay or PayPal; we never see or store your card, UPI or bank details. A licence is a one-time payment, not a subscription: we never charge you again without you choosing to buy something new.</p>
      <p>When a payment goes through you get a licence code straight away, shown on screen and on your account page, and the app unlocks the theme by itself.</p>

      <h2>6. Refunds</h2>
      <p>See our <Link href="/refunds">refund and cancellation policy</Link>.</p>

      <h2>7. Using the app and the lessons</h2>
      <p>The app, lessons, videos, characters and pictures belong to us or to the people who licensed them to us. You may use them to learn, and children may keep and share the programs they write themselves. Please don&apos;t copy, resell or publish our lessons, videos or characters, or try to get round the licence checks.</p>

      <h2>8. Availability and changes</h2>
      <p>We work to keep the website and the lessons available and correct, and we add new lessons over time. We may change or retire a theme; if we ever stop offering a paid theme you have bought, you keep the lessons already on your computer.</p>

      <h2>9. Our responsibility</h2>
      <p>Ada The Coder is provided as it is. As far as the law allows, we are not responsible for indirect losses, and our total responsibility to you is limited to what you paid us in the 12 months before the claim. Nothing in these terms limits rights you have by law as a consumer.</p>

      <h2>10. Ending your use</h2>
      <p>You can stop using Ada The Coder and delete your account at any time. We may turn off an account that breaks these terms, after telling you why where we can.</p>

      <h2>11. Law</h2>
      <p>These terms are governed by the laws of India, and the courts of India have jurisdiction, without affecting any rights you have under the laws of the country where you live.</p>

      <h2>12. Changes to these terms</h2>
      <p>If we change these terms we&apos;ll update the date at the top, and tell account holders by email about important changes.</p>

      <h2>13. Contact</h2>
      <BusinessDetails />
    </article>
  );
}
