import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { CallbackPage } from './pages/Callback';
import { DashboardPage } from './pages/Dashboard';
import { LandingPage } from './pages/Landing';
import { NotFoundPage } from './pages/NotFound';
import { PublicProfilePage } from './pages/PublicProfile';
import { SettingsPage } from './pages/Settings';
import { ThemeController } from './theme/ThemeController';

// `import.meta.env.BASE_URL` is set by Vite's `base` config (see vite.config.ts).
// Stripping the trailing slash keeps Router happy under both `/` (dev) and
// `/gitInsights/` (GH Pages).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function App(): JSX.Element {
  return (
    <BrowserRouter basename={basename}>
      <ThemeController />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LandingPage />} />
          <Route path="callback" element={<CallbackPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="u/:username" element={<PublicProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
