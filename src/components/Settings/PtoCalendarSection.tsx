import {
  ActionIcon,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { TrashIcon } from '@primer/octicons-react';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

import { toIsoDateKey } from '../../analytics/dates';
import { usePto, useUserDataStore, type PtoEntry, type PtoKind } from '../../userData';
import { SettingsSection } from './SettingsSection';

import '@mantine/dates/styles.css';

const PTO_KINDS: Array<{ value: PtoKind; label: string }> = [
  { value: 'vacation', label: 'vacation' },
  { value: 'sick', label: 'sick' },
  { value: 'holiday', label: 'holiday' },
  { value: 'other', label: 'other' },
];

const PtoCard = styled(Card)`
  background: var(--gi-bg-subtle);
  border: 1px solid var(--gi-border-muted);
` as typeof Card;

function eachDateInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = dayjs(start);
  const finish = dayjs(end);
  while (cursor.isSame(finish) || cursor.isBefore(finish)) {
    out.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return out;
}

export function PtoCalendarSection(): JSX.Element {
  const pto = usePto();
  const setPto = useUserDataStore((s) => s.setPto);
  const togglePto = useUserDataStore((s) => s.togglePto);
  const upsertPto = useUserDataStore((s) => s.upsertPto);
  const removePto = useUserDataStore((s) => s.removePto);

  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [bulkLabel, setBulkLabel] = useState('');
  const [bulkKind, setBulkKind] = useState<PtoKind>('vacation');

  const ptoSet = useMemo(() => new Set(pto.map((p) => p.date)), [pto]);

  const onCellClick = (date: Date) => {
    const iso = toIsoDateKey(date);
    if (rangeStart && !rangeEnd) {
      const startDayjs = dayjs(rangeStart);
      const endDayjs = dayjs(iso);
      if (endDayjs.isBefore(startDayjs)) {
        setRangeStart(iso);
      } else {
        setRangeEnd(iso);
      }
      return;
    }
    if (rangeStart && rangeEnd) {
      setRangeStart(iso);
      setRangeEnd(null);
      return;
    }
    void togglePto(iso, { kind: 'vacation' });
  };

  const applyRange = async () => {
    if (!rangeStart || !rangeEnd) return;
    const dates = eachDateInRange(rangeStart, rangeEnd);
    const next = [...pto];
    for (const date of dates) {
      const idx = next.findIndex((p) => p.date === date);
      const entry: PtoEntry = {
        date,
        kind: bulkKind,
        ...(bulkLabel.trim() ? { label: bulkLabel.trim() } : {}),
      };
      if (idx >= 0) next[idx] = entry;
      else next.push(entry);
    }
    await setPto(next);
    setRangeStart(null);
    setRangeEnd(null);
    setBulkLabel('');
  };

  const clearRange = () => {
    setRangeStart(null);
    setRangeEnd(null);
  };

  const updateEntry = async (entry: PtoEntry, patch: Partial<PtoEntry>) => {
    await upsertPto({ ...entry, ...patch });
  };

  return (
    <SettingsSection
      id="pto"
      title="pto calendar"
      description="mark off-days. clicks toggle a day; pick a start + end to set a range with a label."
    >
      <Stack gap="md">
        <Group align="flex-start" gap="lg" wrap="wrap">
          <Calendar
            getDayProps={(date) => {
              const iso = toIsoDateKey(date);
              const inSet = ptoSet.has(iso);
              const inRange =
                rangeStart &&
                rangeEnd &&
                iso >= rangeStart &&
                iso <= rangeEnd;
              const isAnchor = iso === rangeStart || iso === rangeEnd;
              return {
                onClick: () => onCellClick(date),
                style:
                  inSet || inRange || isAnchor
                    ? {
                        background: inSet
                          ? 'var(--mantine-color-primerYellow-4)'
                          : 'var(--mantine-color-primerBlue-9)',
                        color: 'var(--gi-fg-on-emphasis)',
                        borderRadius: 4,
                      }
                    : undefined,
              };
            }}
          />

          <Stack gap="xs" style={{ minWidth: 220 }}>
            <Text size="sm" fw={600}>
              range tools
            </Text>
            <Text size="xs" c="dimmed">
              {rangeStart && !rangeEnd
                ? `start: ${rangeStart}. click an end date.`
                : rangeStart && rangeEnd
                  ? `${rangeStart} → ${rangeEnd}`
                  : 'click two days to mark a range.'}
            </Text>
            <Select
              label="kind"
              data={PTO_KINDS}
              value={bulkKind}
              onChange={(v) => setBulkKind((v as PtoKind) ?? 'vacation')}
              allowDeselect={false}
              size="xs"
            />
            <TextInput
              label="label (optional)"
              placeholder="vacation, conference, sick…"
              value={bulkLabel}
              onChange={(e) => setBulkLabel(e.currentTarget.value)}
              size="xs"
            />
            <Group gap="xs">
              <Button
                size="xs"
                onClick={() => void applyRange()}
                disabled={!rangeStart || !rangeEnd}
              >
                apply range
              </Button>
              <Button size="xs" variant="subtle" onClick={clearRange}>
                clear
              </Button>
            </Group>
          </Stack>
        </Group>

        <Stack gap="xs">
          <Text size="sm" fw={600}>
            marked days ({pto.length})
          </Text>
          {pto.length === 0 ? (
            <Text size="sm" c="dimmed">
              no PTO days marked. when’s the last time you took a day?
            </Text>
          ) : (
            <Stack gap={4}>
              {pto.map((entry) => (
                <PtoCard key={entry.date} padding="xs" withBorder radius="sm">
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <Text size="sm" fw={600}>
                        {entry.date}
                      </Text>
                      <Select
                        size="xs"
                        data={PTO_KINDS}
                        value={entry.kind ?? 'vacation'}
                        onChange={(v) =>
                          void updateEntry(entry, { kind: (v as PtoKind) ?? 'vacation' })
                        }
                        allowDeselect={false}
                      />
                      <TextInput
                        size="xs"
                        placeholder="label"
                        value={entry.label ?? ''}
                        onChange={(e) =>
                          void updateEntry(entry, { label: e.currentTarget.value })
                        }
                      />
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => void removePto(entry.date)}
                      aria-label={`remove pto ${entry.date}`}
                    >
                      <TrashIcon size={14} />
                    </ActionIcon>
                  </Group>
                </PtoCard>
              ))}
              <Group>
                <Button size="xs" variant="subtle" color="red" onClick={() => void setPto([])}>
                  clear all pto
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Stack>
    </SettingsSection>
  );
}
