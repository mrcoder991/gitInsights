import { useEffect } from 'react';
import { useMantineColorScheme } from '@mantine/core';

import { usePreferencesStore } from '../store/preferences';

// App-level theme controller. One job: keep Mantine's `colorScheme` in sync
// with the user's `theme` preference (`system` | `dark` | `light`).
//
// - When `theme === 'system'`, we hand control to Mantine via `setColorScheme('auto')`
//   *and* subscribe to `prefers-color-scheme` so live OS changes propagate without
//   a reload.
// - When `theme === 'dark' | 'light'`, we set Mantine's scheme directly.
//
// Mantine's CSS-variables-driven theme means a single `setColorScheme` call
// re-renders every component (Mantine + styled(MantineComponent)) atomically —
// no flash, no reload.
export function ThemeController(): null {
  const choice = usePreferencesStore((s) => s.theme);
  const { setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    if (choice === 'system') {
      setColorScheme('auto');
      return;
    }
    setColorScheme(choice);
  }, [choice, setColorScheme]);

  return null;
}
