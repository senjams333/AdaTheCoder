import { redirect } from 'next/navigation';

/** The purchase and cancellation policy lives on the Policies page; old links (and payment providers) land there. */
export default function RefundsPage() {
  redirect('/privacy#purchases');
}
