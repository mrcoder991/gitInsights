import type React from 'react';
import { Box, Group, Stack, Text, Tooltip, type TooltipProps } from '@mantine/core';
import { SyncIcon } from '@primer/octicons-react';
import { useEffect, useMemo } from 'react';
import styled from 'styled-components';

import { useHoverHighlight } from '../../../store/hoverHighlight';

import { useAuth } from '../../../hooks/useAuth';
import { useTimeframe } from '../../../hooks/useTimeframe';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import {
  bestWeek,
  bucketWeeklyCodingDays,
  weeklyCodingDays,
  type HistogramBucket,
  type WeeklyBucket,
} from '../../../analytics/weeklyCodingDays';
import { eachDay } from '../../../analytics/dates';
import { isOffDay, type OffDayContext } from '../../../analytics/offDay';
import { windowSpanDays } from '../../../analytics/timeframe';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatNumber, StatRow, VerdictLine } from './Stat';

const BarWrap = styled(Box)`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 56px;
  margin-top: 12px;
` as typeof Box;

// Bar uses CSS custom properties set via inline `style` so we avoid transient props.
// --bar-bg and --bar-opacity are passed at render time per bucket type.
const Bar = styled(Box)`
  flex: 1;
  border-radius: 3px 3px 1px 1px;
  background: var(--bar-bg, var(--gi-success-emphasis));
  opacity: var(--bar-opacity, 0.85);
  border: var(--bar-border, none);
  min-height: 3px;
  cursor: pointer;
` as typeof Box;

const LabelRow = styled(Group)`
  gap: 3px;
  margin-top: 4px;
  flex-wrap: nowrap;
` as typeof Group;

const BarLabel = styled(Text)`
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 9px;
  font-family: var(--mantine-font-family-monospace);
  color: var(--gi-fg-subtle);
  text-transform: lowercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
` as typeof Text;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const MONTH_ABBR_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${MONTH_ABBR_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function bucketRangeLabel(b: HistogramBucket): string {
  return b.from === b.to ? formatShortDate(b.from) : `${formatShortDate(b.from)} – ${formatShortDate(b.to)}`;
}

function effectiveWorkingDatesForBucket(b: HistogramBucket, ctx: OffDayContext): string[] {
  return eachDay(new Date(`${b.from}T00:00:00`), new Date(`${b.to}T00:00:00`)).filter(
    (date) => !isOffDay(date, ctx),
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="lg" wrap="nowrap">
      <Text component="span" size="xs" ff="monospace" c="dimmed">{label}</Text>
      <Text component="span" size="xs" ff="monospace" fw={600}>{value}</Text>
    </Group>
  );
}

function tooltipLabel(b: HistogramBucket): TooltipProps['label'] {
  if (b.isRest) {
    return (
      <Stack gap={4} p={2}>
        <Text size="xs" ff="monospace" fw={600}>{b.label}</Text>
        <TooltipRow label="range" value={bucketRangeLabel(b)} />
        <Text size="xs" ff="monospace" c="dimmed">all off-days</Text>
      </Stack>
    );
  }

  const avgActive = round1(b.totalActive / b.weekCount);
  const avgEffectiveWorkingDays = round1(b.totalEffectiveWorkingDays / b.weekCount);

  return (
    <Stack gap={4} p={2}>
      <Text size="xs" ff="monospace" fw={600}>{b.label}</Text>
      <TooltipRow label="range" value={bucketRangeLabel(b)} />
      <TooltipRow label="avg effective workdays/week" value={`${avgActive}/${avgEffectiveWorkingDays}`} />
      {b.weekCount > 1 && <TooltipRow label="weeks" value={String(b.weekCount)} />}
      {b.bestWeek && (
        <TooltipRow label="best week" value={`${b.bestWeek.active}/${b.bestWeek.effectiveWorkingDays}`} />
      )}
      {b.worstWeek && b.worstWeek !== b.bestWeek && (
        <TooltipRow label="worst week" value={`${b.worstWeek.active}/${b.worstWeek.effectiveWorkingDays}`} />
      )}
    </Stack>
  );
}

function windowVerdict(
  avgActive: number | null,
  avgEffectiveWorkingDays: number | null,
  weekCount: number,
  latest: WeeklyBucket | null,
): string {
  if (avgEffectiveWorkingDays === null || avgActive === null || avgEffectiveWorkingDays === 0) {
    return 'every day in the window was an off-day.';
  }

  if (weekCount === 1 && latest) {
    if (latest.effectiveWorkingDays === 0) return 'every day was an off-day.';
    if (latest.active === 0) return 'no coding days. rest week or heads-down.';
    if (latest.active === latest.effectiveWorkingDays) return 'every effective workday touched. tidy.';
    return `${latest.active} of ${latest.effectiveWorkingDays} effective working days coded.`;
  }

  const ratio = avgActive / avgEffectiveWorkingDays;
  let quality: string;
  if (ratio >= 1.0) quality = 'full attendance across the window.';
  else if (ratio >= 0.8) quality = 'solid coverage. consistently showing up.';
  else if (ratio >= 0.6) quality = 'decent pace. a few gaps but mostly there.';
  else if (ratio >= 0.4) quality = 'patchy window. more gaps than usual.';
  else quality = 'light window. heavy on off-days or rest.';

  if (latest && latest.effectiveWorkingDays > 0) {
    const latestRatio = latest.active / latest.effectiveWorkingDays;
    const delta = latestRatio - ratio;
    if (delta > 0.25) return `${quality} last week was above your average.`;
    if (delta < -0.25) return `${quality} last week trended lighter than usual.`;
  }

  return quality;
}

export function WeeklyCodingDaysTile(): JSX.Element {
  const { viewer } = useAuth();
  const { from, to } = useTimeframe();
  const { setRange, clear } = useHoverHighlight();

  // Clear any stale highlight when this tile unmounts.
  useEffect(() => clear, [clear]);
  const { ctx } = useOffDayContext();

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: { from, to },
  });

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const [k, v] of Object.entries(data.byDate)) m.set(k, v);
    return m;
  }, [data]);

  const weeks = useMemo(
    () => (data ? weeklyCodingDays({ byDate, ctx, from, to }) : []),
    [byDate, ctx, data, from, to],
  );

  const buckets = useMemo(() => bucketWeeklyCodingDays(weeks, from, to), [weeks, from, to]);

  const best = useMemo(() => (data ? bestWeek(weeks) : null), [weeks, data]);

  // Average active days and Effective Working Days per week across the full selected window.
  const avgActive = useMemo(() => {
    if (weeks.length === 0) return null;
    const sum = weeks.reduce((s, w) => s + w.active, 0);
    return Math.round((sum / weeks.length) * 10) / 10;
  }, [weeks]);

  const avgEffectiveWorkingDays = useMemo(() => {
    if (weeks.length === 0) return null;
    const sum = weeks.reduce((s, w) => s + w.effectiveWorkingDays, 0);
    return Math.round((sum / weeks.length) * 10) / 10;
  }, [weeks]);

  const latestWeek = weeks.length > 0 ? (weeks[weeks.length - 1] ?? null) : null;

  const span = windowSpanDays(from, to);
  const tooShort = span < 7;

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.totalCommits === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  const maxRatio = Math.max(...buckets.map((b) => b.meanRatio), 0.01);
  const restCount = buckets.filter((b) => b.isRest).length;

  return (
    <BentoTile
      title="weekly coding days"
      titleTooltip={TILE_HELP.weeklyCodingDays}
      icon={SyncIcon}
      state={state}
      area={BENTO_AREAS.WeeklyCodingDays}
      onRetry={() => void refetch()}
      footer={
        state === 'loaded' ? (
          <VerdictLine>
            {windowVerdict(avgActive, avgEffectiveWorkingDays, weeks.length, latestWeek)}
          </VerdictLine>
        ) : null
      }
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-end">
          <StatNumber
            value={avgActive !== null ? avgActive : '—'}
            unit={avgActive !== null && avgEffectiveWorkingDays !== null
              ? `/ ${avgEffectiveWorkingDays} avg effective working days/week`
              : undefined}
          />
        </Group>

        {state === 'loaded' && !tooShort && buckets.length > 0 && (
          <>
            <BarWrap>
              {buckets.map((b) => (
                <Tooltip key={b.from} label={tooltipLabel(b)} withArrow>
                  <Bar
                    tabIndex={0}
                    onMouseEnter={() =>
                      setRange({
                        from: b.from,
                        to: b.to,
                        dates: effectiveWorkingDatesForBucket(b, ctx),
                      })
                    }
                    onMouseLeave={clear}
                    onFocus={() =>
                      setRange({
                        from: b.from,
                        to: b.to,
                        dates: effectiveWorkingDatesForBucket(b, ctx),
                      })
                    }
                    onBlur={clear}
                    style={{
                      height: `${Math.max((b.meanRatio / maxRatio) * 100, 5)}%`,
                      '--bar-bg': b.isRest
                        ? 'var(--gi-attention-fg)'
                        : 'var(--gi-success-emphasis)',
                      '--bar-opacity': b.isRest ? '0.6' : b.isPartial ? '0.65' : '0.85',
                      '--bar-border': b.isPartial
                        ? '1px dashed var(--gi-success-fg)'
                        : 'none',
                    } as React.CSSProperties}
                  />
                </Tooltip>
              ))}
            </BarWrap>
            <LabelRow>
              {buckets.map((b) => (
                <BarLabel key={b.from} component="span">{b.label}</BarLabel>
              ))}
            </LabelRow>
            {restCount > 0 && (
              <Text size="xs" c="dimmed" ff="monospace">
                {restCount} bar{restCount !== 1 ? 's' : ''} entirely off-days. that&apos;s the point.
              </Text>
            )}
          </>
        )}

        {state === 'loaded' && tooShort && (
          <Text size="xs" c="dimmed" ff="monospace">
            less than a week selected. one bar isn&apos;t a histogram.
          </Text>
        )}

        <StatRow
          label="best week"
          value={best ? `${best.active}/${best.effectiveWorkingDays}` : '—'}
        />
        <StatRow
          label="weeks in window"
          value={weeks.length > 0 ? String(weeks.length) : '—'}
        />
      </Stack>

      {/* Hidden a11y table for screen readers (spec §10 A11y) */}
      <table style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        <caption>weekly coding days by bucket</caption>
        <thead>
          <tr>
            <th scope="col">period</th>
            <th scope="col">coding days over effective working days</th>
            <th scope="col">weeks</th>
            <th scope="col">best week</th>
            <th scope="col">worst week</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.from}>
              <td>{b.isRest ? `${b.label} (all off-days)` : b.label}</td>
              <td>{b.totalActive}/{b.totalEffectiveWorkingDays}</td>
              <td>{b.weekCount}</td>
              <td>{b.bestWeek ? `${b.bestWeek.active}/${b.bestWeek.effectiveWorkingDays}` : '—'}</td>
              <td>{b.worstWeek ? `${b.worstWeek.active}/${b.worstWeek.effectiveWorkingDays}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </BentoTile>
  );
}
