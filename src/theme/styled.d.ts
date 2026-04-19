// Tell styled-components that its `theme` prop is the same Mantine theme we
// hand to <MantineProvider>. This is what gives `({ theme }) => theme.colors...`
// inside `styled(Card)` definitions full type-safety against the Primer-derived
// Mantine tokens — one source of truth.

import 'styled-components';
import type { MantineTheme } from '@mantine/core';

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends MantineTheme {}
}
