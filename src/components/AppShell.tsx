import {
  AppShell as MantineAppShell,
  Avatar,
  Button,
  Container,
  Group,
  NavLink,
  Stack,
  Text,
} from '@mantine/core';
import { useNavigate, NavLink as RouterNavLink, Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { useAuth } from '../hooks/useAuth';
import { RateLimitBanner } from './RateLimitBanner';

// App chrome. Phase 1 brought up the static header; Phase 2 wires it into the
// auth store so the nav surface matches the session state — protected links
// only show when authenticated, and a logout button shows up next to the
// avatar.
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

type NavLinkDef = { to: string; label: string; protected?: boolean };

const NAV_LINKS: ReadonlyArray<NavLinkDef> = [
  { to: '/', label: 'home' },
  { to: '/dashboard', label: 'dashboard', protected: true },
  { to: '/settings', label: 'settings', protected: true },
];

export function AppShell(): JSX.Element {
  const { status, viewer, logout } = useAuth();
  const navigate = useNavigate();
  const isAuthed = status === 'authenticated';

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const visibleLinks = NAV_LINKS.filter((link) => isAuthed || !link.protected);

  return (
    <MantineAppShell header={{ height: 56 }} padding="md">
      <MantineAppShell.Header>
        <HeaderInner justify="space-between" wrap="nowrap">
          <Brand size="lg">gitInsights</Brand>
          <Group gap="xs" wrap="nowrap">
            {visibleLinks.map((link) => (
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
            {isAuthed && viewer && (
              <Group gap="xs" wrap="nowrap" pl="sm" ml="sm">
                <Avatar
                  src={viewer.avatarUrl}
                  alt={`${viewer.login} avatar`}
                  size="sm"
                  radius="xl"
                />
                <Text size="sm" c="dimmed" visibleFrom="sm">
                  {viewer.login}
                </Text>
                <Button size="xs" variant="subtle" onClick={handleLogout}>
                  log out
                </Button>
              </Group>
            )}
          </Group>
        </HeaderInner>
      </MantineAppShell.Header>
      <MantineAppShell.Main>
        <Container size="lg" py="lg">
          <Stack gap="md">
            <RateLimitBanner />
            <Outlet />
          </Stack>
        </Container>
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
