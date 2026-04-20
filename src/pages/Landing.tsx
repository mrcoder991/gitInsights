import {
  Alert,
  Anchor,
  Button,
  List,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { MarkGithubIcon } from '@primer/octicons-react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

// Scope copy follows spec §10 voice: blunt, anti-corporate, "the user is on
// their side". Each line names the scope, says why we want it, and where the
// data lives. The `repo` line carries the disclosure that we read private
// repos and that nothing leaves the browser (spec §3.A, §4.A, §6).
const SCOPES: ReadonlyArray<{ name: string; rationale: string }> = [
  {
    name: 'read:user',
    rationale: 'who you are. login, name, avatar. nothing else.',
  },
  {
    name: 'user:email',
    rationale: 'your primary email — used to match commits authored by you.',
  },
  {
    name: 'repo',
    rationale:
      'we read your private repos because that is where the work actually lives. ' +
      'commits, diffs, metadata. read-only. nothing leaves your browser. promise.',
  },
  {
    name: 'read:org',
    rationale: 'discover the orgs you are in so private contributions count.',
  },
];

export function LandingPage(): JSX.Element {
  const { status, login } = useAuth();

  // Already signed in? skip the marketing pitch and send them straight to
  // the dashboard. The route guard handles the inverse case.
  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  const isBooting = status === 'validating';
  const envMissing =
    !import.meta.env.VITE_GITHUB_CLIENT_ID || !import.meta.env.VITE_OAUTH_REDIRECT_URI;

  return (
    <Stack gap="xl" maw={640}>
      <Stack gap="sm">
        <Title order={1}>your commits, your story.</Title>
        <Text c="dimmed">
          not your boss&apos;s dashboard. gitInsights runs entirely in your browser, reads your
          github work directly, and shows you what no manager dashboard ever will.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Button
          size="lg"
          color="primerBlue"
          leftSection={<MarkGithubIcon size={20} />}
          onClick={login}
          disabled={isBooting || envMissing}
          loading={isBooting}
        >
          login with github
        </Button>
        {isBooting && (
          <Text size="sm" c="dimmed">
            <Loader size="xs" type="dots" mr="xs" />
            checking your existing session…
          </Text>
        )}
        {envMissing && (
          <Alert color="primerYellow" variant="light" title="oauth not configured">
            set <code>VITE_GITHUB_CLIENT_ID</code> and <code>VITE_OAUTH_REDIRECT_URI</code> in{' '}
            <code>.env.local</code>, then restart <code>npm run dev</code>. see{' '}
            <code>.env.example</code>.
          </Alert>
        )}
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="scope-disclosure-heading">
        <Title order={2} size="h4" id="scope-disclosure-heading">
          what we ask github for
        </Title>
        <Text size="sm" c="dimmed">
          oauth scopes, in plain english. nothing leaves your browser — the github access token
          stays in <code>localStorage</code>, all analytics run on your machine.
        </Text>
        <List size="sm" spacing="xs" withPadding>
          {SCOPES.map((scope) => (
            <List.Item key={scope.name}>
              <Text component="span" fw={600}>
                {scope.name}
              </Text>{' '}
              — {scope.rationale}
            </List.Item>
          ))}
        </List>
        <Text size="xs" c="dimmed">
          you can revoke gitInsights anytime from{' '}
          <Anchor
            href="https://github.com/settings/applications"
            target="_blank"
            rel="noreferrer"
          >
            github → settings → applications
          </Anchor>
          .
        </Text>
      </Stack>
    </Stack>
  );
}
