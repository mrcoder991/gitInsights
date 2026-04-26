import { Group, Stack, Text } from '@mantine/core';
import { CalendarIcon } from '@primer/octicons-react';
import { useMemo } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { useViewerCommitsByDay } from '../../hooks/useGitHubQueries';
import { useCellAdornments } from '../../hooks/useCellAdornments';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '../Bento';
import { metricMonoStyle } from '../Bento/tiles/Stat';
import { ConsistencyMap } from './ConsistencyMap';
import { HeatmapLegend } from './HeatmapLegend';
import { HeatmapA11yTable } from './HeatmapA11yTable';
import { commitsToHeatmapRows, rollingYearWindow } from './contributions';

// Heatmap shows pure non-merge commits per day (REST search/commits with
// `merge:false`), not the GitHub "contributions" total which folds in PRs /
// issues / reviews / comments / approvals. The 4-state surface is owned by
// `BentoTile`. Phase 5 wires `cellAdornments` to render PTO + Public Holiday
// cells in the off-day color, with a violation dot overlay when a commit
// landed on an off-day.

export function ConsistencyTile(): JSX.Element {
  const { viewer } = useAuth();
  const window = useMemo(() => rollingYearWindow(), []);
  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: window,
  });

  const rows = useMemo(
    () => (data ? commitsToHeatmapRows(data.byDate, window) : []),
    [data, window],
  );
  const byDateMap = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const [k, v] of Object.entries(data.byDate)) m.set(k, v);
    return m;
  }, [data]);
  const cellAdornments = useCellAdornments(byDateMap);
  const totalCommits = data?.totalCommits ?? 0;

  // Spec §3.D: when a 403/rate-limit hits but we already have a persisted
  // snapshot, keep showing it. The global RateLimitBanner signals staleness.
  // Only collapse to the error tile when there is literally nothing to render.
  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && totalCommits === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  return (
    <BentoTile
      title="your year. one square per day."
      titleTooltip={TILE_HELP.consistencyMap}
      icon={CalendarIcon}
      state={state}
      area={BENTO_AREAS.Consistency}
      onRetry={() => void refetch()}
      emptyMessage="no commits in the last 365 days. either you\u2019re new, on PTO, or actually resting. all valid."
      errorMessage="couldn\u2019t load your commits. github blinked. try again."
      footer={
        state === 'loaded' ? (
          <Group justify="space-between">
            <Text size="xs" c="dimmed" style={metricMonoStyle}>
              {totalCommits.toLocaleString()} commits, last 365 days.
            </Text>
            <Text size="xs" c="dimmed">
              public + private.
            </Text>
          </Group>
        ) : null
      }
    >
      <Stack gap="xs">
        <ConsistencyMap rows={rows} window={window} cellAdornments={cellAdornments} />
        <HeatmapLegend />
        <HeatmapA11yTable
          rows={rows}
          adornments={cellAdornments}
          caption="commits over the last 365 days"
        />
      </Stack>
    </BentoTile>
  );
}
