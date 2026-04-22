import { Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useMemo } from 'react';

import { InlineQueryError } from '../components/InlineQueryError';
import {
  useViewerContributions,
  useViewerProfile,
} from '../hooks/useGitHubQueries';

// TODO(phase-04): replace with the bento grid + consistency map. This page is
// the throwaway end-to-end demo from phase-03 — proves the GraphQL + cache
// pipeline works against real `viewer.contributionsCollection` data.

function lastYearRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(to.getFullYear() - 1);
  return { from, to };
}

export function DashboardPage(): JSX.Element {
  const range = useMemo(lastYearRange, []);
  const profile = useViewerProfile();
  const contributions = useViewerContributions(range);

  return (
    <Stack gap="md">
      <Title order={1}>dashboard</Title>
      <Text c="dimmed" size="sm">
        bento grid + consistency map land in phase 4. tiles fill in across phase 5.
        the line below is the phase-3 sanity check — pulled live from github,
        cached to indexeddb.
      </Text>

      {profile.isPending ? (
        <Group gap="xs">
          <Loader size="sm" type="dots" />
          <Text c="dimmed" size="sm">loading profile…</Text>
        </Group>
      ) : profile.isError ? (
        <InlineQueryError error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <Text>
          signed in as <strong>{profile.data.login}</strong>
          {profile.data.name ? ` (${profile.data.name})` : ''}
        </Text>
      )}

      {contributions.isPending ? (
        <Group gap="xs">
          <Loader size="sm" type="dots" />
          <Text c="dimmed" size="sm">loading contributions…</Text>
        </Group>
      ) : contributions.isError ? (
        <InlineQueryError
          error={contributions.error}
          onRetry={() => contributions.refetch()}
        />
      ) : (
        <Text>
          {contributions.data.contributionCalendar.totalContributions.toLocaleString()}{' '}
          contributions in the last 12 months.
        </Text>
      )}
    </Stack>
  );
}
