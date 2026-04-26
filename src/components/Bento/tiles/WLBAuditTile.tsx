import { Stack, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { PulseIcon } from '@primer/octicons-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../../hooks/useAuth';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { rollingYearWindow } from '../../ConsistencyMap/contributions';
import { useStreakMode, useUserDataVersions } from '../../../userData';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import { runWlbAudit } from '../../../workers/client';
import type { WlbResult } from '../../../analytics/wlb';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatRow, VerdictLine } from './Stat';

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function lateNightVerdict(ratio: number, evaluable: number): string {
  if (evaluable === 0) return 'no commits in the window. nothing to call out.';
  const nights = Math.round(ratio * evaluable);
  if (ratio === 0) return 'no late-night commits. log off remains undefeated.';
  if (ratio >= 0.25) return `${nights} late-night commits. that’s a lot. log off.`;
  if (ratio >= 0.1) return `${nights} late-night commits. keep an eye on it.`;
  return `${nights} late-night commits. fine.`;
}

function nonWorkdayVerdict(ratio: number): string {
  if (ratio === 0) return 'workdays are workdays. weekends are not a feature.';
  if (ratio >= 0.3) return `${pct(ratio)} on non-workdays. weekends are not a feature.`;
  return `${pct(ratio)} on non-workdays. occasional, fine.`;
}

function ptoVerdict(taken: number, violations: number, honored: number | null): string {
  if (taken === 0) return '0 PTO days marked. when’s the last time you took a day?';
  if (violations === 0) return `${taken} PTO days, all honored. nicely done.`;
  if (honored !== null && honored < 0.5) {
    return `${violations} of ${taken} PTO days had commits. it’s PTO. close the laptop.`;
  }
  return `${violations} of ${taken} PTO days had commits. mostly honored. mostly.`;
}

export function WLBAuditTile(): JSX.Element {
  const { viewer } = useAuth();
  const window = useMemo(() => rollingYearWindow(), []);
  const versions = useUserDataVersions();
  const streakMode = useStreakMode();
  const { ctx } = useOffDayContext();

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: window,
  });

  const [result, setResult] = useState<WlbResult | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!data || !viewer) return;
    let cancelled = false;
    setComputing(true);
    void runWlbAudit({
      userId: viewer.login,
      shaRange: `${data.fromIso}..${data.toIso}:n${data.totalCommits}`,
      commits: data.timestamps.map((authoredAt) => ({ authoredAt })),
      byDate: data.byDate,
      ctx: {
        workdays: [...ctx.workdays],
        ptoDates: [...ctx.ptoSet],
        holidayDates: [...ctx.holidaySet],
        overrideDates: [...ctx.overrideSet],
      },
      streakMode,
      workweekVersion: versions.workweek,
      ptoVersion: versions.pto,
      holidaysVersion: versions.holidays,
      streakModeVersion: versions.streakMode,
    })
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    ctx.holidaySet,
    ctx.overrideSet,
    ctx.ptoSet,
    ctx.workdays,
    data,
    streakMode,
    versions.holidays,
    versions.pto,
    versions.streakMode,
    versions.workweek,
    viewer,
  ]);

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.totalCommits === 0) state = 'empty';
  else if (data && result) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading || computing) state = 'loading';

  const histogramData = useMemo(() => {
    if (!result) return [];
    return result.hourHistogram.map((count, hour) => ({
      hour: String(hour).padStart(2, '0'),
      commits: count,
    }));
  }, [result]);

  return (
    <BentoTile
      title="wlb audit · 365d"
      titleTooltip={TILE_HELP.wlbAudit}
      icon={PulseIcon}
      state={state}
      area={BENTO_AREAS.WLB}
      onRetry={() => void refetch()}
      footer={
        state === 'loaded' && result ? (
          <Stack gap={2}>
            <VerdictLine>
              {lateNightVerdict(result.lateNightRatio, result.evaluableCommits)}
            </VerdictLine>
            <VerdictLine>{nonWorkdayVerdict(result.nonWorkdayRatio)}</VerdictLine>
            <VerdictLine>
              {ptoVerdict(result.ptoDaysTaken, result.ptoViolationCount, result.ptoHonoredRatio)}
            </VerdictLine>
          </Stack>
        ) : null
      }
    >
      <Stack gap="sm">
        <BarChart
          h={140}
          data={histogramData}
          dataKey="hour"
          series={[{ name: 'commits', color: 'primerBlue.4' }]}
          withLegend={false}
          withTooltip
          tickLine="x"
          gridAxis="y"
          xAxisLabel="hour of day"
        />
        {result ? (
          <Stack gap={4}>
            <StatRow label="late-night ratio" value={pct(result.lateNightRatio)} />
            <StatRow label="non-workday ratio" value={pct(result.nonWorkdayRatio)} />
            <StatRow
              label="pto honored"
              value={result.ptoHonoredRatio === null ? '—' : pct(result.ptoHonoredRatio)}
            />
            <StatRow
              label="longest break"
              value={`${result.longestBreakDays} ${result.longestBreakDays === 1 ? 'day' : 'days'}`}
            />
          </Stack>
        ) : null}
        <Text size="xs" c="dimmed">
          off-days excluded from late-night and non-workday denominators.
        </Text>
      </Stack>
    </BentoTile>
  );
}
