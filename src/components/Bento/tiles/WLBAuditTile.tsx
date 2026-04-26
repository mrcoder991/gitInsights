import { Box, Group, Stack, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { PulseIcon } from '@primer/octicons-react';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { useAuth } from '../../../hooks/useAuth';
import { useTimeframe } from '../../../hooks/useTimeframe';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { useStreakMode, useUserDataVersions } from '../../../userData';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import { runWlbAudit } from '../../../workers/client';
import type { WlbResult } from '../../../analytics/wlb';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { VerdictLine } from './Stat';

// Hours 22–23 and 00–05 are "late night" per spec (22:00–05:59)
function isLateHour(h: number): boolean {
  return h >= 22 || h < 6;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function lateNightVerdict(ratio: number, evaluable: number): string {
  if (evaluable === 0) return 'no commits in the window. nothing to call out.';
  const nights = Math.round(ratio * evaluable);
  if (ratio === 0) return 'no late-night commits. log off remains undefeated.';
  if (ratio >= 0.25) return `${nights} late-night commits. that's a lot. log off.`;
  if (ratio >= 0.1) return `${nights} late-night commits. keep an eye on it.`;
  return `${nights} late-night commits. fine.`;
}

const StatBoxGrid = styled(Box)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
` as typeof Box;

const StatBox = styled(Box)`
  background: var(--gi-bg-muted);
  border: 1px solid var(--gi-border-muted);
  border-radius: 8px;
  padding: 10px 12px;
` as typeof Box;

const BoxValue = styled(Text)`
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 700;
  line-height: 1;
  font-family: var(--mantine-font-family-monospace);
  font-feature-settings: 'tnum';
  color: var(--gi-fg-default);
` as typeof Text;

const BoxLabel = styled(Text)`
  font-size: 11px;
  font-family: var(--mantine-font-family-monospace);
  color: var(--gi-fg-muted);
  margin-top: 4px;
` as typeof Text;

function StatBoxItem({ value, label }: { value: string; label: string }) {
  return (
    <StatBox>
      <BoxValue>{value}</BoxValue>
      <BoxLabel>{label}</BoxLabel>
    </StatBox>
  );
}

const AlarmVerdict = styled(Box)`
  border: 1px solid var(--gi-danger-emphasis);
  background: color-mix(in srgb, var(--gi-danger-emphasis) 10%, transparent);
  border-radius: 8px;
  padding: 10px 14px;
` as typeof Box;

function Footer({ result }: { result: WlbResult }) {
  const alarming = result.lateNightRatio >= 0.25;
  const verdict = lateNightVerdict(result.lateNightRatio, result.evaluableCommits);
  if (alarming) {
    return (
      <AlarmVerdict>
        <Text size="xs" c="red" ff="monospace">{verdict}</Text>
      </AlarmVerdict>
    );
  }
  return <VerdictLine>{verdict}</VerdictLine>;
}

export function WLBAuditTile(): JSX.Element {
  const { viewer } = useAuth();
  const { from, to, label } = useTimeframe();
  const versions = useUserDataVersions();
  const streakMode = useStreakMode();
  const { ctx } = useOffDayContext();

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: { from, to },
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
      fromIso: data.fromIso,
      toIso: data.toIso,
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
      .then((res) => { if (!cancelled) setResult(res); })
      .finally(() => { if (!cancelled) setComputing(false); });
    return () => { cancelled = true; };
  }, [
    ctx.holidaySet, ctx.overrideSet, ctx.ptoSet, ctx.workdays,
    data, streakMode,
    versions.holidays, versions.pto, versions.streakMode, versions.workweek,
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
      day: isLateHour(hour) ? 0 : count,
      night: isLateHour(hour) ? count : 0,
    }));
  }, [result]);

  const lateNightCount = result ? Math.round(result.lateNightRatio * result.evaluableCommits) : 0;
  const ptoHonored = result && result.ptoHonoredRatio !== null
    ? Math.round(result.ptoHonoredRatio * result.ptoDaysTaken)
    : null;

  return (
    <BentoTile
      title={`wlb audit · ${label}`}
      titleTooltip={TILE_HELP.wlbAudit}
      icon={PulseIcon}
      state={state}
      area={BENTO_AREAS.WLB}
      onRetry={() => void refetch()}
      footer={state === 'loaded' && result ? <Footer result={result} /> : null}
    >
      <Stack gap="sm">
        <Box>
          <Text size="xs" c="dimmed" ff="monospace" mb={4}>
            hour-of-day histogram · red bars are 22:00–05:59 local time
          </Text>
          <BarChart
            h={120}
            data={histogramData}
            dataKey="hour"
            type="stacked"
            series={[
              { name: 'day', color: 'primerBlue.4' },
              { name: 'night', color: 'primerRed.4' },
            ]}
            withLegend={false}
            withTooltip
            tickLine="x"
            gridAxis="none"
            xAxisProps={{ interval: 5, tickFormatter: (v: string) => v }}
          />
        </Box>

        {result && (
          <StatBoxGrid>
            <StatBoxItem
              value={String(lateNightCount)}
              label="nights past 22:00"
            />
            <StatBoxItem
              value={pct(result.nonWorkdayRatio)}
              label="non-workday ratio"
            />
            <StatBoxItem
              value={ptoHonored !== null ? `${ptoHonored} / ${result.ptoDaysTaken}` : '—'}
              label="pto days honored"
            />
            <StatBoxItem
              value={String(result.ptoViolationCount)}
              label="pto violations"
            />
          </StatBoxGrid>
        )}

        <Group gap="xs">
          <Text size="xs" c="dimmed" ff="monospace">
            timezone · {Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase()}
          </Text>
        </Group>
      </Stack>
    </BentoTile>
  );
}
