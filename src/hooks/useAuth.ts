import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '../store/auth';

// Thin selector hook so components can destructure `{ token, viewer, status,
// login, logout }` without each call subscribing to the entire store. Spec
// §12 Phase 2 names the hook explicitly — this is the public surface.
//
// `useShallow` keeps the equality check on the projected object so we don't
// re-render on unrelated store fields (e.g., `error` flipping while we're
// only reading `viewer`).

export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      token: s.token,
      viewer: s.viewer,
      status: s.status,
      error: s.error,
      login: s.login,
      logout: s.logout,
    })),
  );
}
