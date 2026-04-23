import { Group, Stack, Text } from '@mantine/core';
import { LineChart } from '@mantine/charts';
import { FlameIcon } from '@primer/octicons-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../../hooks/useAuth';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { rollingYearWindow } from '../../ConsistencyMap/contributions';
import { useUserDataVersions } from '../../../userData';
import { runEnergyPoints } from '../../../workers/client';
import type { CommitInput, EpResult } from '../../../analytics/diffDelta';
import { addDaysIso } from '../../../analytics/dates';
import { BENTO_AREAS, BentoTile } from '..';
import { StatNumber, VerdictLine } from './Stat';

// Spec §6 EP. We don't yet fetch per-commit additions/deletions (that needs a
// repos.getCommit call per commit), so we feed the worker minimum-effort
// commit shapes derived from the search/commits timestamps. The recency
// weight + rolling-365 window apply correctly; absolute magnitudes will
// rebase upward once per-commit diff stats land.

const APPROX_ADDITIONS = 1;
const APPROX_FILES = 1;

function timestampsToCommits(timestamps: string[]): CommitInput[] {
  return timestamps.map((authoredAt) => ({
    authoredAt,
    additions: APPROX_ADDITIONS,
    deletions: 0,
    filesChanged: APPROX_FILES,
    isMerge: false,
  }));
}

function buildSparkline(perDay: Record<string, number>, days = 30): Array<{ date: string; ep: number }> {
  const today = new Date();
  const out: Array<{ date: string; ep: number }> = [];
  const todayKey = today.toISOString().slice(0, 10);
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = addDaysIso(todayKey, -i);
    out.push({ date: key.slice(5), ep: Math.round((perDay[key] ?? 0) * 10) / 10 });
  }
  return out;
}

function epVerdict(total: number, totalCommits: number): string {
  if (totalCommits === 0) {
    return 'no commits in 365 days. either you’re new, on PTO, or actually resting. all valid.';
  }
  if (total < 50) return 'low ep this year. that’s fine. quality > volume.';
  if (total < 200) return 'steady. nothing to prove here.';
  return 'busy year. the score isn’t the point — make sure the rest is too.';
}

export function EPTile(): JSX.Element {
  const { viewer } = useAuth();
  const window = useMemo(() => rollingYearWindow(), []);
  const versions = useUserDataVersions();

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: window,
  });

  const [ep, setEp] = useState<EpResult | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!data || !viewer) return;
    let cancelled = false;
    setComputing(true);
    void runEnergyPoints({
      userId: viewer.login,
      shaRange: `${data.fromIso}..${data.toIso}:n${data.totalCommits}`,
      commits: timestampsToCommits(data.timestamps),
      workweekVersion: versions.workweek,
      ptoVersion: versions.pto,
      holidaysVersion: versions.holidays,
    })
      .then((result) => {
        if (!cancelled) setEp(result);
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data, versions.holidays, versions.pto, versions.workweek, viewer]);

  const total = ep?.total ?? 0;
  const sparkline = useMemo(
    () => buildSparkline(ep?.perDay ?? {}, 30),
    [ep],
  );

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.totalCommits === 0) state = 'empty';
  else if (data && ep) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading || computing) state = 'loading';

  return (
    <BentoTile
      title="energy points · 365d"
      icon={FlameIcon}
      state={state}
      area={BENTO_AREAS.EP}
      onRetry={() => void refetch()}
      footer={
        state === 'loaded' ? (
          <VerdictLine>{epVerdict(total, data?.totalCommits ?? 0)}</VerdictLine>
        ) : null
      }
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-end">
          <StatNumber value={Math.round(total).toLocaleString()} unit="ep" />
          <Text size="xs" c="dimmed">
            approx · awaiting per-commit diffs
          </Text>
        </Group>
        <LineChart
          h={80}
          data={sparkline}
          dataKey="date"
          series={[{ name: 'ep', color: 'primerBlue.4' }]}
          curveType="monotone"
          withDots={false}
          withTooltip
          withXAxis={false}
          withYAxis={false}
          gridAxis="none"
        />
      </Stack>
    </BentoTile>
  );
}
