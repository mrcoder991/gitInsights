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
import '@mantine/charts/styles.css';
import '@mantine/dates/styles.css';
import './styles/globals.css';

const queryClient = createAppQueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root missing from index.html.');
}

// Bridges Mantine's *merged* theme into styled-components so
// `styled(MantineComponent)` definitions read the same Primer-derived tokens
// Mantine ships to its own internals.
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
