import { ActionIcon, Box, Button, Group, Popover, Stack, Text, Tooltip } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { SyncIcon } from '@primer/octicons-react';
import type { FC, SVGProps } from 'react';
import { useCallback, useState } from 'react';
import styled from 'styled-components';

import { refreshDateRange } from '../../api/commitsByDayRange';
import { useGitHub } from '../../hooks/useGitHub';
import { useAuth } from '../../hooks/useAuth';

const SyncSvg = SyncIcon as unknown as FC<
  { size?: number } & Pick<SVGProps<SVGSVGElement>, 'style' | 'className' | 'aria-hidden'>
>;

const MAX_RANGE_DAYS = 30;

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

const CalendarBox = styled(Box)`
  border: 1px solid var(--gi-border-muted);
  border-radius: 8px;
  padding: 10px;

  .mantine-DatePicker-calendarHeader {
    min-height: unset;
    margin-bottom: 6px;
  }
  .mantine-DatePicker-calendarHeaderLevel {
    font-family: var(--mantine-font-family-monospace);
    font-size: 11px;
    font-weight: 500;
    color: var(--gi-fg-muted);
    text-transform: lowercase;
  }
  .mantine-DatePicker-calendarHeaderControl {
    width: 20px;
    height: 20px;
    min-width: unset;
    color: var(--gi-fg-muted);
  }
  .mantine-DatePicker-weekday {
    font-family: var(--mantine-font-family-monospace);
    font-size: 9px;
    text-transform: uppercase;
    color: var(--gi-fg-subtle);
    padding: 4px 0;
    width: 28px;
  }
  .mantine-DatePicker-day {
    font-family: var(--mantine-font-family-monospace);
    font-size: 11px;
    width: 28px;
    height: 24px;
    border-radius: 4px;
    padding: 0;
    line-height: 24px;
    text-align: center;
    color: var(--gi-fg-default);

    &[data-outside] {
      color: var(--gi-fg-subtle);
      opacity: 0.4;
    }
    &[data-disabled] {
      color: var(--gi-fg-subtle);
      opacity: 0.25;
      text-decoration: line-through;
    }
    &[data-in-range] {
      background: color-mix(in srgb, var(--mantine-color-primerBlue-4) 18%, transparent);
      border-radius: 0;
    }
    &[data-first-in-range] {
      background: var(--mantine-color-primerBlue-4);
      color: var(--gi-fg-on-emphasis);
      border-radius: 4px 0 0 4px;
    }
    &[data-last-in-range] {
      background: var(--mantine-color-primerBlue-4);
      color: var(--gi-fg-on-emphasis);
      border-radius: 0 4px 4px 0;
    }
    &[data-selected] {
      background: var(--mantine-color-primerBlue-4);
      color: var(--gi-fg-on-emphasis);
      border-radius: 4px;
    }
    &:hover:not([data-selected]):not([data-in-range]):not([data-disabled]) {
      background: var(--gi-bg-muted);
    }
  }
` as typeof Box;

export type RefreshRangePickerProps = {
  /** "icon" renders a small ActionIcon; "button" renders a labeled Button. */
  variant?: 'icon' | 'button';
};

export function RefreshRangePicker({ variant = 'icon' }: RefreshRangePickerProps): JSX.Element {
  const clients = useGitHub();
  const { viewer } = useAuth();
  const [opened, setOpened] = useState(false);
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [from, to] = range;
  const rangeValid = from != null && to != null && daysBetween(from, to) <= MAX_RANGE_DAYS;
  const rangeTooLong = from != null && to != null && daysBetween(from, to) > MAX_RANGE_DAYS;

  const handleRefresh = useCallback(async () => {
    if (!clients || !viewer?.login || !from || !to) return;
    setError(null);
    setRefreshing(true);
    try {
      await refreshDateRange(clients, viewer.login, from, to);
      setOpened(false);
      setRange([null, null]);
    } catch {
      setError("couldn't refresh. github might be rate-limiting us. try again in a bit.");
    } finally {
      setRefreshing(false);
    }
  }, [clients, viewer?.login, from, to]);

  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setDate(yearAgo.getDate() - 365);

  const trigger =
    variant === 'button' ? (
      <Button
        variant="outline"
        color="primerBlue"
        size="xs"
        leftSection={<SyncSvg size={14} />}
        onClick={() => setOpened((o) => !o)}
      >
        refresh date range
      </Button>
    ) : (
      <Tooltip label="refresh a date range" withArrow>
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => setOpened((o) => !o)}
          aria-label="refresh date range"
        >
          <SyncSvg size={14} />
        </ActionIcon>
      </Tooltip>
    );

  const rangeLabel =
    from && to
      ? `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`
      : from
        ? `${from.toLocaleDateString()} – pick end date`
        : 'pick start date';

  return (
    <Popover opened={opened} onChange={setOpened} position="top-end" withArrow shadow="xl" radius="md" width={300}>
      <Popover.Target>{trigger}</Popover.Target>
      <Popover.Dropdown p={14}>
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            re-fetch commits for a date range
          </Text>
          <Text size="xs" c="dimmed">
            pick up to {MAX_RANGE_DAYS} days. pulls fresh data from github for those months.
          </Text>
          <CalendarBox>
            <DatePicker
              type="range"
              value={range}
              onChange={(r) => setRange(r as [Date | null, Date | null])}
              minDate={yearAgo}
              maxDate={today}
              size="xs"
              withCellSpacing={false}
            />
          </CalendarBox>
          <Text size="xs" c="dimmed" ff="monospace">
            {rangeLabel}
          </Text>
          {rangeTooLong && (
            <Text size="xs" c="primerRed">
              max {MAX_RANGE_DAYS} days. narrow it down.
            </Text>
          )}
          {error && (
            <Text size="xs" c="primerRed">
              {error}
            </Text>
          )}
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="light"
              color="primerBlue"
              loading={refreshing}
              disabled={!rangeValid}
              onClick={() => void handleRefresh()}
            >
              refresh
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
