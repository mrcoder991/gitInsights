import { Group, Loader, Text } from '@mantine/core';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

// Route guard for protected screens (`/dashboard`, `/settings`). When there's
// no session, bounce to `/`. While the boot validation is in flight (the
// store's `validating` state), show a small inline spinner instead of either
// flashing the protected content or yanking the user to landing — Phase 2
// only validates once per app load, so this is short-lived.
//
// Usage: wrap a route element with <RequireAuth>{<Page />}</RequireAuth> in
// App.tsx. We don't use a layout-route variant because the AppShell already
// owns the chrome; this just guards the inner element.

export function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'authenticated') {
    return children;
  }

  if (status === 'validating') {
    return (
      <Group gap="xs" role="status" aria-live="polite">
        <Loader size="sm" type="dots" />
        <Text c="dimmed">checking session…</Text>
      </Group>
    );
  }

  // `idle` (no token / 401) and `error` (network blip during boot) both
  // route home. The user can re-attempt login from there.
  return <Navigate to="/" replace state={{ from: location.pathname }} />;
}
