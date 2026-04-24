import { useEffect } from 'react';
import { useMantineColorScheme } from '@mantine/core';

import { useTheme } from '../userData';

// Keeps Mantine's `colorScheme` in sync with the user's `theme` choice
// stored in `gi.user-data` (spec §3.F + §4.E). `system` defers to Mantine's
// `auto` which subscribes to `prefers-color-scheme` natively.
export function ThemeController(): null {
  const choice = useTheme();
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
