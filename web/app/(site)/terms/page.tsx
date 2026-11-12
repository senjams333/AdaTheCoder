'use client';

import Link from 'next/link';
import BusinessDetails, { useContact } from '@/components/BusinessDetails';
import GrievanceOfficer from '@/components/GrievanceOfficer';
import { useGetSiteQuery } from '@/lib/api';

export default function TermsPage() {
  const { email } = useContact();
  const { data } = useGetSiteQuery();
  const paypal = Boolean(data?.paypal);     // PayPal is mentioned only once it's offered
  const city = (data?.settings.legal_city || '').trim();
  return (
    <article className="prose wrap">
      <h1>Terms of use</h1>
      <p className="muted">Last updated: 12 November 2026</p>
      <p>These terms are an agreement between you and Ada The Coder for using this website and the Ada The Coder app. Please read them with our <Link href="/privacy">policies</Link>, which explain how we look after your information and how purchases and refunds work. By creating an account or buying a licence, you agree to these terms.</p>

      <h2>1. Who we are</h2>
      <p>Ada The Coder (&quot;we&quot;, &quot;us&quot;) runs this website and the Ada The Coder app, which teach children to write Python. Our details are at the end of this page.</p>

      <h2>2. Who can use it</h2>
      <p>Accounts are for parents, guardians and teachers aged 18 or over who live in India or elsewhere. Children use the app through a grown-up&apos;s account and don&apos;t need one of their own. By creating an account you confirm that you are 18 or over, that you are the parent or legal guardian of the children who will use it (or have their parent&apos;s permission, for teachers), and that you are responsible for how they use Ada The Coder. We recommend a grown-up stays nearby while young children use any computer.</p>

      <h2>3. Your account</h2>
      <p>Give true details when you sign up, and keep your password private. You are responsible for what happens with your account. Tell us straight away at <a href={`mailto:${email}`}>{email}</a> if you think someone else has used it. You can delete your account at any time from your account page.</p>

      <h2>4. Free and paid themes</h2>
      <p>The app is free to download, and some themes are free. Every paid theme opens its first lessons free, so your child can try it first. Buying a licence unlocks every lesson of that theme. A licence is for your family&apos;s own, non-commercial use on the computers in your home, is linked to your account, and can&apos;t be sold, shared or passed on. Schools and groups: write to us for a group licence.</p>

      <h2>5. Prices and payment</h2>
      <p>Prices are shown on your account page and on the pay page before you pay, {paypal ? 'in Indian rupees (Razorpay) or US dollars (PayPal)' : 'in Indian rupees'}, and include any taxes we have to charge. Payments are handled by {paypal ? 'Razorpay or PayPal' : 'Razorpay'}; we never see or store your card, UPI or bank details. A licence is a one-time payment, not a subscription: we never charge you again unless you choose to buy something new. If a price is ever shown wrongly, we will tell you before taking any payment.</p>

      <h2>6. Delivery</h2>
      <p>Themes are digital, so nothing is shipped. When a payment goes through, your licence code is shown on screen straight away, emailed to you and listed on your account page, and the app unlocks the theme by itself within a few minutes. If it doesn&apos;t, write to us and we&apos;ll unlock it.</p>

      <h2>7. Cancellation and refunds</h2>
      <p>You can cancel a purchase at any time before the payment is complete. Because a theme is unlocked and yours to keep as soon as its licence is issued, and you can try its free lessons first, we don&apos;t refund a purchase because of a change of mind once the licence has been issued. Payment mistakes and problems we can&apos;t fix are always refunded: see <Link href="/privacy#purchases">purchases, delivery, cancellation and refunds</Link> for exactly when, and how long it takes.</p>

      <h2>8. Using the app and the lessons fairly</h2>
      <p>The app, lessons, videos, characters, pictures and music belong to us or to the people who licensed them to us, and are protected by copyright. You may use them for learning. Children may keep and share the programs they write themselves. Please don&apos;t copy, resell, publish or share our lessons, videos or characters, get round the licence checks, or use Ada The Coder for anything unlawful or harmful.</p>

      <h2>9. Your computer</h2>
      <p>The app needs a supported computer (shown on the website) and an internet connection to download lessons and check licences. It runs the Python programs children write on your computer, in a folder of its own.</p>

      <h2>10. Availability and changes</h2>
      <p>We work to keep the website and the lessons available and correct, and we add new lessons over time. Sometimes the service may be briefly unavailable, for example during updates. We may change or retire a theme; if we ever stop offering a paid theme you have bought, you keep the lessons already on your computer.</p>

      <h2>11. Our responsibility</h2>
      <p>We provide Ada The Coder with reasonable care and skill. As far as the law allows, we are not responsible for losses that weren&apos;t foreseeable, or for problems caused by your computer, internet connection or other software, and our total responsibility to you is limited to what you paid us in the 12 months before the claim. Nothing in these terms limits any responsibility that can&apos;t be limited by law, or your rights as a consumer under the Consumer Protection Act, 2019.</p>

      <h2>12. Ending your use</h2>
      <p>You can stop using Ada The Coder and delete your account at any time. We may suspend or close an account that seriously or repeatedly breaks these terms, after telling you why and giving you a chance to put it right where we can. If we close an account for no fault of yours, we will refund any licence you bought in the previous 12 months.</p>

      <h2>13. Complaints</h2>
      <p>If something isn&apos;t right, please tell us first so we can fix it. Our Grievance Officer acknowledges every complaint within 48 hours and resolves it within 30 days:</p>
      <GrievanceOfficer />
      <p>You can also contact the National Consumer Helpline (call 1915, or visit consumerhelpline.gov.in), or file a complaint with a Consumer Commission.</p>

      <h2>14. Law</h2>
      <p>These terms are governed by the laws of India. Disputes are decided by the courts {city ? `at ${city}, India` : 'in India that have jurisdiction over our registered office'}, without affecting your right to approach a Consumer Commission or any rights you have under the laws of the country where you live.</p>

      <h2>15. Changes to these terms</h2>
      <p>If we change these terms we&apos;ll update the date at the top, and email account holders about important changes before they apply. Changes never affect a licence you have already bought.</p>

      <h2>16. Contact</h2>
      <BusinessDetails />
    </article>
  );
}
