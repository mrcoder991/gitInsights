import { Stack, Text } from '@mantine/core';
import { ClockIcon } from '@primer/octicons-react';
import { useMemo } from 'react';

import { useAuth } from '../../../hooks/useAuth';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { rollingYearWindow } from '../../ConsistencyMap/contributions';
import { useStreakMode } from '../../../userData';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import { currentStreak, longestStreak } from '../../../analytics/streaks';
import { BENTO_AREAS, BentoTile } from '..';
import { StatNumber, StatRow, VerdictLine } from './Stat';

function streakVerdict(current: number, mode: string): string {
  if (current === 0) {
    return mode === 'skip-non-workdays'
      ? 'no streak right now. workdays are what counts; rest is allowed.'
      : 'no streak right now. start whenever.';
  }
  if (current >= 30) return `${current} days running. when’s the last time you took a day?`;
  if (current >= 7) return `${current} days. solid. don’t turn it into a punishment.`;
  return `${current} days in. easy does it.`;
}

export function StreakTile(): JSX.Element {
  const { viewer } = useAuth();
  const window = useMemo(() => rollingYearWindow(), []);
  const mode = useStreakMode();
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

  const current = useMemo(
    () => (data ? currentStreak({ byDate, ctx, mode }) : 0),
    [byDate, ctx, data, mode],
  );
  const longest = useMemo(
    () => (data ? longestStreak({ byDate, ctx, mode }) : 0),
    [byDate, ctx, data, mode],
  );

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.totalCommits === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  return (
    <BentoTile
      title="streak"
      icon={ClockIcon}
      state={state}
      area={BENTO_AREAS.Streak}
      onRetry={() => void refetch()}
      footer={state === 'loaded' ? <VerdictLine>{streakVerdict(current, mode)}</VerdictLine> : null}
    >
      <Stack gap="sm">
        <StatNumber value={current} unit={current === 1 ? 'day' : 'days'} />
        <StatRow label="longest" value={`${longest} ${longest === 1 ? 'day' : 'days'}`} />
        <Text size="xs" c="dimmed">
          mode: {mode === 'skip-non-workdays' ? 'weekends don’t break me' : mode === 'workdays-only' ? 'workdays only' : 'every day or it doesn’t count'}
        </Text>
      </Stack>
    </BentoTile>
  );
}
