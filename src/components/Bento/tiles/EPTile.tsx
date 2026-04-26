import { Stack, Text } from '@mantine/core';
import { LineChart } from '@mantine/charts';
import { FlameIcon } from '@primer/octicons-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../../hooks/useAuth';
import { useTimeframe } from '../../../hooks/useTimeframe';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { useUserDataVersions } from '../../../userData';
import { runCommitMomentum } from '../../../workers/client';
import type { CommitMomentumInput, MomentumResult } from '../../../analytics/diffDelta';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatNumber, VerdictLine } from './Stat';

function timestampsToMomentumCommits(timestamps: string[]): CommitMomentumInput[] {
  return timestamps.map((authoredAt) => ({ authoredAt }));
}

function buildSparkline(
  perDay: Record<string, number>,
  from: Date,
  to: Date,
): Array<{ date: string; momentum: number }> {
  const out: Array<{ date: string; momentum: number }> = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ date: key.slice(5), momentum: Math.round((perDay[key] ?? 0) * 10) / 10 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function momentumVerdict(total: number, totalCommits: number): string {
  if (totalCommits === 0) {
    return 'no commits in 365 days. either you’re new, on PTO, or actually resting. all valid.';
  }
  if (total < 50) return 'low momentum this year. that’s fine. quality > volume.';
  if (total < 200) return 'steady. nothing to prove here.';
  return 'busy year. the score isn’t the point — make sure the rest is too.';
}

export function EPTile(): JSX.Element {
  const { viewer } = useAuth();
  const { from, to, label } = useTimeframe();
  const versions = useUserDataVersions();

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: { from, to },
  });

  const [momentum, setMomentum] = useState<MomentumResult | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!data || !viewer) return;
    let cancelled = false;
    setComputing(true);
    void runCommitMomentum({
      userId: viewer.login,
      shaRange: `${data.fromIso}..${data.toIso}:n${data.totalCommits}`,
      fromIso: data.fromIso,
      toIso: data.toIso,
      commits: timestampsToMomentumCommits(data.timestamps),
      workweekVersion: versions.workweek,
      ptoVersion: versions.pto,
      holidaysVersion: versions.holidays,
    })
      .then((result) => {
        if (!cancelled) setMomentum(result);
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data, versions.holidays, versions.pto, versions.workweek, viewer]);

  const total = momentum?.total ?? 0;
  const sparkline = useMemo(
    () => buildSparkline(momentum?.perDay ?? {}, from, to),
    [momentum, from, to],
  );

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.totalCommits === 0) state = 'empty';
  else if (data && momentum) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading || computing) state = 'loading';

  return (
    <BentoTile
      title={`commit momentum · ${label}`}
      titleTooltip={TILE_HELP.commitMomentum}
      icon={FlameIcon}
      state={state}
      area={BENTO_AREAS.EP}
      onRetry={() => void refetch()}
      footer={
        state === 'loaded' ? (
          <VerdictLine>{momentumVerdict(total, data?.totalCommits ?? 0)}</VerdictLine>
        ) : null
      }
    >
      <Stack gap="md">
        {/* <Group justify="space-between" align="flex-end"> */}
          <StatNumber value={Math.round(total).toLocaleString()} unit="pts" hero />
          <Text size="xs" c="dimmed">
            recency-weighted commits
          </Text>
        {/* </Group> */}
        <LineChart
          h={80}
          data={sparkline}
          dataKey="date"
          series={[{ name: 'momentum', color: 'primerBlue.4' }]}
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
