import { API_URL } from './config';

/** The pay page talks to /api/pay with either the website log-in or the app's 15-minute pay link (?t=...). */
export async function payCall<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/pay/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = (data as { message?: string | string[] }).message;
    const err = new Error(Array.isArray(m) ? m.join(' ') : m || 'Something went wrong. Please try again.') as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export interface PayMethod { amount: number; currency: string; label: string; button?: string }
export interface PayPage {
  theme: { slug: string; name: string; tagline: string; images: string[]; featureList: string[]; price: string; priceInr: string; razorpayButton?: string };
  licence: string | null;
  methods: { razorpay: PayMethod | null; paypal: PayMethod | null };
  user: { name: string; email: string };
}
export interface Paid { ok: boolean; licence: string; theme: string; name: string; message: string }

/** Loads Razorpay Checkout's script once. */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}
