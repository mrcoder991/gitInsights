import { Box, Stack, Text, Tooltip } from '@mantine/core';
import { useMemo } from 'react';
import styled from 'styled-components';

import type { ContributionWindow, HeatmapRow } from './contributions';

// Spec §6 Consistency. Pure CSS-grid heatmap (53-week × 7-day) using
// `aspect-ratio: 1` cells; the outer wrapper's `overflow-x: auto` handles
// narrow viewports. `cellAdornments(date)` is the seam through which PTO +
// Public Holiday colors and the violation dot overlay land.

export type CellAdornment = {
  color?: string;
  overlayDot?: boolean;
  label?: string;
};

export type ConsistencyMapProps = {
  rows: HeatmapRow[];
  window: ContributionWindow;
  cellAdornments?: (date: string) => CellAdornment | undefined;
};

const WEEK_COLUMNS = 53;
const DAYS_PER_WEEK = 7;
const GRID_MIN_PX = 680;
const BUCKET_THRESHOLDS = [1, 3, 6, 10] as const;

const WEEKDAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTH_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

const Shell = styled(Box)`
  width: 100%;
  overflow-x: auto;
  padding-block: ${({ theme }) => theme.spacing.xs};
` as typeof Box;

const Inner = styled(Box)`
  min-width: ${GRID_MIN_PX}px;
  display: grid;
  grid-template-columns: 24px 1fr;
  column-gap: ${({ theme }) => theme.spacing.xs};
  row-gap: 4px;
` as typeof Box;

const MonthsRow = styled(Box)`
  grid-column: 2 / 3;
  display: grid;
  grid-template-columns: repeat(${WEEK_COLUMNS}, 1fr);
  font-size: 10px;
  color: var(--gi-fg-muted);
  font-family: var(--gi-mono, ui-monospace, monospace);
  margin-bottom: 2px;

  span {
    min-width: 0;
    white-space: nowrap;
  }
` as typeof Box;

const DayLabels = styled(Box)`
  display: grid;
  grid-template-rows: repeat(${DAYS_PER_WEEK}, 1fr);
  align-items: center;
  font-size: 10px;
  color: var(--gi-fg-muted);
  font-family: var(--gi-mono, ui-monospace, monospace);
` as typeof Box;

const Grid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(${WEEK_COLUMNS}, 1fr);
  grid-auto-rows: 1fr;
  gap: 3px;
` as typeof Box;

const Cell = styled(Box)`
  aspect-ratio: 1;
  border-radius: 2px;
  background: var(--gi-heatmap-0);
  position: relative;
  min-width: 0;

  &[data-lvl='1'] {
    background: var(--gi-heatmap-1);
  }
  &[data-lvl='2'] {
    background: var(--gi-heatmap-2);
  }
  &[data-lvl='3'] {
    background: var(--gi-heatmap-3);
  }
  &[data-lvl='4'] {
    background: var(--gi-heatmap-4);
  }

  &[data-out-of-range='true'] {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--gi-border-muted);
    opacity: 0.4;
  }

  &[data-gi-violation='true']::after {
    content: '';
    position: absolute;
    right: 1px;
    bottom: 1px;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: var(--gi-heatmap-violation, var(--mantine-color-red-6));
  }
` as typeof Box;

function bucketOf(count: number): number {
  if (count <= 0) return 0;
  for (let i = 0; i < BUCKET_THRESHOLDS.length; i += 1) {
    const threshold = BUCKET_THRESHOLDS[i];
    if (threshold !== undefined && count < threshold) return i;
  }
  return BUCKET_THRESHOLDS.length;
}

function toIsoDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfGrid(from: Date): Date {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateLabel(date: Date): string {
  const weekday = WEEKDAY_SHORT[date.getDay()] ?? '';
  const month = MONTH_SHORT[date.getMonth()] ?? '';
  return `${weekday}, ${month} ${date.getDate()}`;
}

function formatCountLine(count: number): string {
  if (count === 0) return 'no commits.';
  if (count === 1) return '1 commit.';
  return `${count.toLocaleString()} commits.`;
}

type TooltipFacts = {
  date: Date;
  inRange: boolean;
  count: number;
  label: string | undefined;
};

function CellTooltipContent({ facts }: { facts: TooltipFacts }): JSX.Element {
  if (!facts.inRange) {
    return (
      <Stack gap={2}>
        <Text size="xs" fw={600}>
          {formatDateLabel(facts.date)}
        </Text>
        <Text size="xs" c="dimmed">
          outside the 365-day window.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      <Text size="xs" fw={600}>
        {formatDateLabel(facts.date)}
      </Text>
      <Text size="xs" c="dimmed">
        {formatCountLine(facts.count)}
      </Text>
      {facts.label ? (
        <Text size="xs" c="dimmed">
          {facts.label}
        </Text>
      ) : null}
    </Stack>
  );
}

export function ConsistencyMap({
  rows,
  window,
  cellAdornments,
}: ConsistencyMapProps): JSX.Element {
  const byDate = useMemo(() => {
    const m = new Map<string, HeatmapRow>();
    rows.forEach((r) => m.set(r.date, r));
    return m;
  }, [rows]);

  const grid = useMemo(() => {
    const gridStart = startOfGrid(window.from);
    const fromTime = new Date(window.from);
    fromTime.setHours(0, 0, 0, 0);
    const toTime = new Date(window.to);
    toTime.setHours(23, 59, 59, 999);

    const cells: Array<{
      key: string;
      facts: TooltipFacts;
      level: number;
      color?: string;
      violation?: boolean;
    }> = [];

    for (let row = 0; row < DAYS_PER_WEEK; row += 1) {
      for (let col = 0; col < WEEK_COLUMNS; col += 1) {
        const date = addDays(gridStart, col * DAYS_PER_WEEK + row);
        const dateKey = toIsoDateKey(date);
        const inRange = date >= fromTime && date <= toTime;
        const count = inRange ? (byDate.get(dateKey)?.count ?? 0) : 0;
        const level = inRange ? bucketOf(count) : 0;
        const adorn = inRange ? cellAdornments?.(dateKey) : undefined;
        cells.push({
          key: `${row}-${col}`,
          facts: { date, inRange, count, label: adorn?.label },
          level,
          color: adorn?.color,
          violation: adorn?.overlayDot,
        });
      }
    }

    return cells;
  }, [byDate, cellAdornments, window.from, window.to]);

  const months = useMemo(() => {
    const gridStart = startOfGrid(window.from);
    const labels: Array<{ col: number; text: string }> = [];
    let prev = -1;
    for (let col = 0; col < WEEK_COLUMNS; col += 1) {
      const d = addDays(gridStart, col * DAYS_PER_WEEK);
      const m = d.getMonth();
      if (m !== prev) {
        labels.push({ col, text: MONTH_SHORT[m] ?? '' });
        prev = m;
      }
    }
    return labels;
  }, [window.from]);

  return (
    <Shell>
      <Inner>
        <MonthsRow>
          {Array.from({ length: WEEK_COLUMNS }).map((_, col) => {
            const label = months.find((lbl) => lbl.col === col)?.text ?? '';
            return <span key={col}>{label}</span>;
          })}
        </MonthsRow>
        <DayLabels aria-hidden="true">
          <span />
          <span>mon</span>
          <span />
          <span>wed</span>
          <span />
          <span>fri</span>
          <span />
        </DayLabels>
        <Grid role="presentation">
          {grid.map((cell) => (
            <Tooltip
              key={cell.key}
              label={<CellTooltipContent facts={cell.facts} />}
              position="top"
              withArrow
              withinPortal
              openDelay={120}
              closeDelay={40}
              transitionProps={{ duration: 80 }}
              events={{ hover: true, focus: true, touch: true }}
            >
              <Cell
                data-lvl={cell.level > 0 ? String(cell.level) : undefined}
                data-out-of-range={cell.facts.inRange ? undefined : 'true'}
                data-gi-violation={cell.violation ? 'true' : undefined}
                style={cell.color ? { background: cell.color } : undefined}
                tabIndex={cell.facts.inRange ? 0 : -1}
                aria-label={
                  cell.facts.inRange
                    ? `${formatDateLabel(cell.facts.date)}: ${formatCountLine(cell.facts.count)}`
                    : undefined
                }
              />
            </Tooltip>
          ))}
        </Grid>
      </Inner>
    </Shell>
  );
}
