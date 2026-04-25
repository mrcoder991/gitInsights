import { useLayoutEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

const APP = 'gitInsights';

function titleForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') {
    return `${APP} · home`;
  }
  const profile = matchPath({ path: '/u/:username', end: true }, pathname);
  const login = profile?.params.username;
  if (login) {
    return `${APP} · @${login}`;
  }
  if (pathname.startsWith('/dashboard')) {
    return `${APP} · dashboard`;
  }
  if (pathname.startsWith('/settings')) {
    return `${APP} · settings`;
  }
  if (pathname.startsWith('/privacy')) {
    return `${APP} · privacy`;
  }
  if (pathname.startsWith('/callback')) {
    return `${APP} · signing in`;
  }
  return `${APP} · not found`;
}

/** Syncs `document.title` with the current route (pathname is relative to `BrowserRouter` basename). */
export function DocumentTitle(): null {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);

  return null;
}
