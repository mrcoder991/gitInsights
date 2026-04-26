import { Group, Stack } from '@mantine/core';
import { Sparkline } from '@mantine/charts';
import { SyncIcon } from '@primer/octicons-react';
import { useMemo } from 'react';

import { useAuth } from '../../../hooks/useAuth';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { rollingYearWindow } from '../../ConsistencyMap/contributions';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import {
  bestWeek,
  currentAndPrevWeek,
  trailingTwelveWeeks,
} from '../../../analytics/weeklyCodingDays';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatNumber, StatRow, VerdictLine } from './Stat';

function weeklyVerdict(current: number, expected: number): string {
  if (expected === 0) return 'every day was an off-day. nothing to evaluate.';
  if (current === 0) return 'zero coding days this week so far. could be a rest week. could be a head-down deep-thinking week.';
  if (current === expected) return 'every workday touched. tidy.';
  return `${current} of ${expected} so far. plenty of week left.`;
}

export function WeeklyCodingDaysTile(): JSX.Element {
  const { viewer } = useAuth();
  const window = useMemo(() => rollingYearWindow(), []);
  const { ctx } = useOffDayContext();

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: window,
  });

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const [k, v] of Object.entries(data.byDate)) m.set(k, v);
    return m;
  }, [data]);

  const buckets = useMemo(
    () => (data ? trailingTwelveWeeks({ byDate, ctx }) : []),
    [byDate, ctx, data],
  );
  const { current, previous } = useMemo(
    () => (data ? currentAndPrevWeek({ byDate, ctx }) : { current: null, previous: null }),
    [byDate, ctx, data],
  );
  const best = useMemo(() => (data ? bestWeek(buckets) : null), [buckets, data]);

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.totalCommits === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  const sparkData = buckets.map((b) => b.active);

  return (
    <BentoTile
      title="weekly coding days"
      titleTooltip={TILE_HELP.weeklyCodingDays}
      icon={SyncIcon}
      state={state}
      area={BENTO_AREAS.WeeklyCodingDays}
      onRetry={() => void refetch()}
      footer={
        state === 'loaded' && current ? (
          <VerdictLine>{weeklyVerdict(current.active, current.expected)}</VerdictLine>
        ) : null
      }
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-end">
          <StatNumber
            value={current ? `${current.active} / ${current.expected}` : '—'}
            unit="this week"
          />
        </Group>
        <Sparkline
          h={40}
          data={sparkData.length > 0 ? sparkData : [0]}
          color="primerGreen.4"
          fillOpacity={0.25}
          curveType="monotone"
        />
        <StatRow
          label="last week"
          value={previous ? `${previous.active} / ${previous.expected}` : '—'}
        />
        <StatRow
          label="best week"
          value={best ? `${best.active} / ${best.expected}` : '—'}
        />
      </Stack>
    </BentoTile>
  );
}
