import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, useMantineTheme } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';

import { createAppQueryClient } from './api/queryClient';
import { App } from './App';
import { QueryCachePersister } from './components/QueryCachePersister';
import { cssVariablesResolver, mantineTheme } from './theme';

import '@mantine/core/styles.css';
import './styles/globals.css';

const queryClient = createAppQueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root missing from index.html.');
}

// Mounts a styled-components <ThemeProvider> using the *merged* Mantine theme
// returned by `useMantineTheme()`. That guarantees `styled(MantineComponent)`
// definitions read the same theme object Mantine itself ships to its components
// (defaults + our overrides), not just the overrides we authored — one source
// of truth for Primer-derived tokens.
//
// Defined inline (not exported) because `main.tsx` is the entry module and
// nothing else should import from here.
// eslint-disable-next-line react-refresh/only-export-components
function StyledThemeBridge({ children }: { children: ReactNode }): JSX.Element {
  const theme = useMantineTheme();
  return <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>;
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider
      theme={mantineTheme}
      defaultColorScheme="auto"
      cssVariablesResolver={cssVariablesResolver}
    >
      <StyledThemeBridge>
        <QueryClientProvider client={queryClient}>
          <QueryCachePersister />
          <App />
        </QueryClientProvider>
      </StyledThemeBridge>
    </MantineProvider>
  </StrictMode>,
);
