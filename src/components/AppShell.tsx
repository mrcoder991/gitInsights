import { AppShell as MantineAppShell, Container, Group, NavLink, Text } from '@mantine/core';
import { Outlet, NavLink as RouterNavLink } from 'react-router-dom';
import styled from 'styled-components';

// Phase 1 chrome only — a tiny header so every placeholder page is reachable
// without the URL bar. Real navigation lands with auth in Phase 2 and the
// dashboard in Phase 4.
//
// styled-components v6 loses the polymorphic typing of Mantine components when
// it wraps them, so we cast each `styled(...)` result back to the source
// component's type. This keeps Mantine's full prop surface (`gap`, `size`,
// `children`, …) available to consumers, while still letting the styled
// definition read `({ theme }) => theme...` from the shared Mantine theme.
const HeaderInner = styled(Group)`
  height: 100%;
  padding-inline: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid var(--gi-border-default);
` as typeof Group;

const Brand = styled(Text)`
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--gi-fg-default);
` as typeof Text;

const NAV_LINKS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/', label: 'home' },
  { to: '/dashboard', label: 'dashboard' },
  { to: '/settings', label: 'settings' },
];

export function AppShell(): JSX.Element {
  return (
    <MantineAppShell header={{ height: 56 }} padding="md">
      <MantineAppShell.Header>
        <HeaderInner justify="space-between" wrap="nowrap">
          <Brand size="lg">gitInsights</Brand>
          <Group gap="xs">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                component={RouterNavLink}
                to={link.to}
                label={link.label}
                end={link.to === '/'}
                variant="subtle"
                w="auto"
                px="sm"
              />
            ))}
          </Group>
        </HeaderInner>
      </MantineAppShell.Header>
      <MantineAppShell.Main>
        <Container size="lg" py="lg">
          <Outlet />
        </Container>
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
