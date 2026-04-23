import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { CallbackPage } from './pages/Callback';
import { DashboardPage } from './pages/Dashboard';
import { LandingPage } from './pages/Landing';
import { NotFoundPage } from './pages/NotFound';
import { PublicProfilePage } from './pages/PublicProfile';
import { SettingsPage } from './pages/Settings';
import { useAuthStore } from './store/auth';
import { ThemeController } from './theme/ThemeController';
import { UserDataBoot } from './userData';

// `import.meta.env.BASE_URL` is set by Vite's `base` config (see vite.config.ts).
// Stripping the trailing slash keeps Router happy under both `/` (dev) and
// `/gitInsights/` (GH Pages).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function App(): JSX.Element {
  // Boot validation: if a token is sitting in localStorage, hit `viewer { login }`
  // once on mount. Runs unconditionally — the store handles the no-token case
  // by transitioning to `idle`. Spec §3.A "Token Lifecycle".
  const bootstrap = useAuthStore((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <BrowserRouter basename={basename}>
      <ThemeController />
      <UserDataBoot />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LandingPage />} />
          <Route path="callback" element={<CallbackPage />} />
          <Route
            path="dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route path="u/:username" element={<PublicProfilePage />} />
          <Route
            path="settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
