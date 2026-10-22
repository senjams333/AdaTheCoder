'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import Flashes from '@/components/Flashes';
import SiteShell from '@/components/SiteShell';
import { api } from '@/lib/api';
import { loggedOut } from '@/lib/authSlice';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useRequireLogin } from '@/lib/useRequireLogin';

const NAV = [
  { href: '/admin', label: 'Overview', match: (p: string) => p === '/admin' },
  { href: '/admin/content', label: 'Website text', match: (p: string) => p.startsWith('/admin/content') },
  { href: '/admin/themes', label: 'Themes & lessons', match: (p: string) => p.startsWith('/admin/themes') || p.startsWith('/admin/lessons') },
  { href: '/admin/releases', label: 'App versions', match: (p: string) => p.startsWith('/admin/releases') },
  { href: '/admin/parents', label: 'Parents', match: (p: string) => p.startsWith('/admin/parents') },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin/login') return <SiteShell>{children}</SiteShell>;
  return <AdminShell pathname={pathname}>{children}</AdminShell>;
}

function AdminShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  const allowed = useRequireLogin(true);
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const router = useRouter();

  function logout() {
    dispatch(loggedOut());
    dispatch(api.util.resetApiState());
    dispatch(flash('info', "You're logged out."));
    router.push('/');
  }

  if (!allowed) return <div className="admin"><main className="admin-main"><p className="muted">Checking your log-in…</p></main></div>;
  return (
    <div className="admin">
      <aside className="admin-side">
        <Link className="brand" href="/admin"><img src="/img/ada-face.png" alt="" />Ada admin</Link>
        <nav aria-label="Admin">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={n.match(pathname) ? 'page' : undefined}>{n.label}</Link>
          ))}
          <a href="/" target="_blank" rel="noreferrer">View website</a>
        </nav>
        <div className="who">
          Logged in as {user?.email}<br />
          <button className="link-btn" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="admin-main" id="main">
        <Flashes className="flashes" />
        {children}
      </main>
    </div>
  );
}
