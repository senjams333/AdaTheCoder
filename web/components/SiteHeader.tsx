'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, useGetSiteQuery } from '@/lib/api';
import { loggedOut } from '@/lib/authSlice';
import { flash } from '@/lib/flashSlice';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import Flashes from './Flashes';

export default function SiteHeader() {
  const { user } = useAppSelector((s) => s.auth);
  const { data } = useGetSiteQuery();
  const dispatch = useAppDispatch();
  const router = useRouter();

  function logout() {
    dispatch(loggedOut());
    dispatch(api.util.resetApiState());
    dispatch(flash('info', "You're logged out."));
    router.push('/');
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {data?.settings.site_banner ? <div className="banner">{data.settings.site_banner}</div> : null}
      <header className="site-header">
        <div className="wrap">
          <Link className="brand" href="/">
            <img src="/img/ada-face.png" alt="" />
            Ada The Coder
          </Link>
          <nav className="nav" aria-label="Main">
            <Link href="/#lessons">Lessons</Link>
            <Link href="/#parents">For parents</Link>
            {user ? (
              <>
                {user.role === 'admin' ? <Link href="/admin">Admin</Link> : null}
                <Link href="/account">My account</Link>
                <button className="link-btn" onClick={logout}>Log out</button>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link className="btn btn-small" href="/register">Sign up free</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <Flashes />
    </>
  );
}
