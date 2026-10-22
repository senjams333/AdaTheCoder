'use client';

import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { AUTH_KEY, hydrate } from '@/lib/authSlice';
import { clearOld } from '@/lib/flashSlice';
import { AppStore, makeStore } from '@/lib/store';

/** Gives every page the Redux store, remembers the log-in in this browser, and clears old messages. */
export default function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();
  const store = storeRef.current;
  const pathname = usePathname();

  useEffect(() => {
    let saved = { token: null, user: null };
    try {
      saved = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') || saved;
    } catch {
      /* private window or blocked storage: start logged out */
    }
    store.dispatch(hydrate(saved));
    let last = '';
    return store.subscribe(() => {
      const { token, user, ready } = store.getState().auth;
      if (!ready) return;
      const now = JSON.stringify({ token, user });
      if (now === last) return;
      last = now;
      try {
        if (token) localStorage.setItem(AUTH_KEY, now);
        else localStorage.removeItem(AUTH_KEY);
      } catch {
        /* storage unavailable: the log-in lasts until the tab closes */
      }
    });
  }, [store]);

  // a message survives the move to the next page, then goes away on the page after
  useEffect(() => {
    store.dispatch(clearOld(Date.now() - 1500));
  }, [pathname, store]);

  return <Provider store={store}>{children}</Provider>;
}
