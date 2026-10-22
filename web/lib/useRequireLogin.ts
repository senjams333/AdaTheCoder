'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { flash } from './flashSlice';
import { useAppDispatch, useAppSelector } from './hooks';

/** Sends visitors who aren't logged in (or aren't admins, with admin=true) to the right log-in page.
 *  Returns true once the page may show. */
export function useRequireLogin(admin = false): boolean {
  const { ready, user, leaving } = useAppSelector((s) => s.auth);
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const allowed = Boolean(user && (!admin || user.role === 'admin'));

  useEffect(() => {
    if (!ready || allowed || leaving) return; // after Log out, the log-out button decides where to go
    const next = encodeURIComponent(pathname + (typeof window !== 'undefined' ? window.location.search : ''));
    if (!admin) dispatch(flash('info', 'Please log in first.'));
    router.replace(`${admin ? '/admin/login' : '/login'}?next=${next}`);
  }, [ready, allowed, leaving, admin, pathname, router, dispatch]);

  return ready && allowed;
}

/** A safe place to go after logging in (only pages on this website). */
export function safeNext(next: string | null, fallback: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
