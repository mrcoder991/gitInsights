import {
  ActionIcon,
  Button,
  Group,
  Pagination,
  Select,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { TrashIcon } from '@primer/octicons-react';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';

import { toIsoDateKey } from '../../analytics/dates';
import { usePto, useUserDataStore, type PtoEntry, type PtoKind } from '../../userData';
import { ConfirmDialog } from './ConfirmDialog';
import { SettingsSection } from './SettingsSection';
import { formatPtoDateSpan, groupPtoIntoRuns, type PtoRun } from './ptoRuns';

import '@mantine/dates/styles.css';

const PTO_KINDS: Array<{ value: PtoKind; label: string }> = [
  { value: 'vacation', label: 'vacation' },
  { value: 'sick', label: 'sick' },
  { value: 'holiday', label: 'holiday' },
  { value: 'other', label: 'other' },
];

const PAGE_SIZE = 10;

type ListView = 'grouped' | 'flat';

type PendingRemove =
  | null
  | { mode: 'day'; entry: PtoEntry }
  | { mode: 'run'; run: PtoRun };

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
  const [pendingRemove, setPendingRemove] = useState<PendingRemove>(null);
  const [pendingClearAll, setPendingClearAll] = useState(false);
  const [listView, setListView] = useState<ListView>('grouped');
  const [page, setPage] = useState(1);

  const ptoSet = useMemo(() => new Set(pto.map((p) => p.date)), [pto]);
  const sortedPto = useMemo(
    () => [...pto].sort((a, b) => a.date.localeCompare(b.date)),
    [pto],
  );
  const runs = useMemo(() => groupPtoIntoRuns(sortedPto), [sortedPto]);

  const totalRows = listView === 'grouped' ? runs.length : sortedPto.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [listView]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const effectivePage = Math.min(page, totalPages);
  const sliceStart = (effectivePage - 1) * PAGE_SIZE;
  const pageRuns = useMemo(() => runs.slice(sliceStart, sliceStart + PAGE_SIZE), [runs, sliceStart]);
  const pageDays = useMemo(
    () => sortedPto.slice(sliceStart, sliceStart + PAGE_SIZE),
    [sortedPto, sliceStart],
  );

  const onCellClick = (date: Date, event: MouseEvent) => {
    const iso = toIsoDateKey(date);
    if (event.altKey) {
      void togglePto(iso, { kind: 'vacation' });
      setRangeStart(null);
      setRangeEnd(null);
      return;
    }
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
    setRangeStart(iso);
    setRangeEnd(null);
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

  const removeRun = async (run: PtoRun) => {
    const drop = new Set(run.entries.map((e) => e.date));
    await setPto(pto.filter((p) => !drop.has(p.date)));
  };

  const applyRunPatch = async (run: PtoRun, patch: { kind?: PtoKind; label?: string }) => {
    const dates = new Set(run.entries.map((e) => e.date));
    const next = pto.map((p) => {
      if (!dates.has(p.date)) return p;
      const nextEntry: PtoEntry = { ...p };
      if (patch.kind !== undefined) nextEntry.kind = patch.kind;
      if (patch.label !== undefined) {
        const t = patch.label.trim();
        if (t) nextEntry.label = t;
        else delete nextEntry.label;
      }
      return nextEntry;
    });
    await setPto(next);
  };

  const runRowKey = (run: PtoRun) => `${run.start}:${run.end}`;

  return (
    <SettingsSection
      id="pto"
      title="pto calendar"
      description="mark off-days. click two days to outline a range, then apply range. alt-click (option-click on mac) toggles a single day."
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
                onClick: (e) => onCellClick(date, e),
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
                  : 'click two days to mark a range. alt-click (option-click on mac) toggles one day.'}
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
          <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
            <div>
              <Text size="sm" fw={600}>
                marked days ({pto.length})
              </Text>
              {listView === 'grouped' && pto.length > 0 ? (
                <Text size="xs" c="dimmed">
                  {runs.length} row{runs.length === 1 ? '' : 's'} — consecutive days with the same kind
                  and label are grouped.
                </Text>
              ) : null}
            </div>
            <SegmentedControl
              size="xs"
              value={listView}
              onChange={(v) => setListView(v as ListView)}
              data={[
                { label: 'grouped', value: 'grouped' },
                { label: 'each day', value: 'flat' },
              ]}
            />
          </Group>

          {pto.length === 0 ? (
            <Text size="sm" c="dimmed">
              no PTO days marked. when’s the last time you took a day?
            </Text>
          ) : (
            <>
              <Table.ScrollContainer minWidth={480}>
                <Table highlightOnHover layout="fixed">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: listView === 'grouped' ? '38%' : '28%' }}>
                        {listView === 'grouped' ? 'dates' : 'date'}
                      </Table.Th>
                      <Table.Th style={{ width: '22%' }}>kind</Table.Th>
                      <Table.Th>label</Table.Th>
                      <Table.Th style={{ width: 44 }} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {listView === 'grouped'
                      ? pageRuns.map((run) => {
                          const head = run.entries[0] as PtoEntry;
                          const kind = head.kind ?? 'vacation';
                          const label = head.label ?? '';
                          return (
                            <Table.Tr key={runRowKey(run)}>
                              <Table.Td>
                                <Text size="sm" fw={500}>
                                  {formatPtoDateSpan(run.start, run.end)}
                                </Text>
                                <Text size="xs" c="dimmed" ff="monospace">
                                  {run.entries.length} day{run.entries.length === 1 ? '' : 's'}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Select
                                  size="xs"
                                  data={PTO_KINDS}
                                  value={kind}
                                  onChange={(v) =>
                                    void applyRunPatch(run, { kind: (v as PtoKind) ?? 'vacation' })
                                  }
                                  allowDeselect={false}
                                />
                              </Table.Td>
                              <Table.Td>
                                <TextInput
                                  size="xs"
                                  placeholder="label"
                                  value={label}
                                  onChange={(e) =>
                                    void applyRunPatch(run, { label: e.currentTarget.value })
                                  }
                                />
                              </Table.Td>
                              <Table.Td>
                                <ActionIcon
                                  variant="subtle"
                                  color="primerRed"
                                  onClick={() => setPendingRemove({ mode: 'run', run })}
                                  aria-label={`remove pto ${run.start} through ${run.end}`}
                                >
                                  <TrashIcon size={14} />
                                </ActionIcon>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })
                      : pageDays.map((entry) => (
                          <Table.Tr key={entry.date}>
                            <Table.Td>
                              <Text size="sm" ff="monospace">
                                {entry.date}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Select
                                size="xs"
                                data={PTO_KINDS}
                                value={entry.kind ?? 'vacation'}
                                onChange={(v) =>
                                  void updateEntry(entry, { kind: (v as PtoKind) ?? 'vacation' })
                                }
                                allowDeselect={false}
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                size="xs"
                                placeholder="label"
                                value={entry.label ?? ''}
                                onChange={(e) =>
                                  void updateEntry(entry, { label: e.currentTarget.value })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                variant="subtle"
                                color="primerRed"
                                onClick={() => setPendingRemove({ mode: 'day', entry })}
                                aria-label={`remove pto ${entry.date}`}
                              >
                                <TrashIcon size={14} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>

              {totalPages > 1 ? (
                <Group justify="center" mt="xs">
                  <Pagination
                    total={totalPages}
                    value={effectivePage}
                    onChange={setPage}
                    size="sm"
                    siblings={1}
                    boundaries={1}
                  />
                </Group>
              ) : null}

              <Group>
                <Button
                  size="xs"
                  variant="subtle"
                  color="primerRed"
                  onClick={() => setPendingClearAll(true)}
                >
                  clear all pto
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Stack>

      <ConfirmDialog
        opened={pendingRemove !== null}
        title={
          pendingRemove?.mode === 'run'
            ? `remove ${pendingRemove.run.entries.length} PTO day${
                pendingRemove.run.entries.length === 1 ? '' : 's'
              }?`
            : `remove pto for ${pendingRemove?.mode === 'day' ? pendingRemove.entry.date : ''}?`
        }
        body={
          <Text size="sm">
            {pendingRemove?.mode === 'run' ? (
              <>
                {formatPtoDateSpan(pendingRemove.run.start, pendingRemove.run.end)} (
                {pendingRemove.run.entries.length} day
                {pendingRemove.run.entries.length === 1 ? '' : 's'}) won&apos;t be excluded from
                streaks or wcd anymore.
              </>
            ) : pendingRemove?.mode === 'day' ? (
              <>
                {pendingRemove.entry.date} won&apos;t be excluded from streaks or wcd anymore.
                {pendingRemove.entry.label ? (
                  <> label &quot;{pendingRemove.entry.label}&quot; goes with it.</>
                ) : null}{' '}
                you can re-mark the day, but the label and kind are gone.
              </>
            ) : null}
          </Text>
        }
        confirmLabel="remove it"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          const target = pendingRemove;
          setPendingRemove(null);
          if (target?.mode === 'day') void removePto(target.entry.date);
          else if (target?.mode === 'run') void removeRun(target.run);
        }}
      />

      <ConfirmDialog
        opened={pendingClearAll}
        title="clear all pto?"
        body={
          <Text size="sm">
            wipes all {pto.length} marked day{pto.length === 1 ? '' : 's'} and their labels.
            local-only — sync (if on) will push the empty list to the cloud copy too. export your
            user data first if you want a backup.
          </Text>
        }
        confirmLabel="clear all"
        onCancel={() => setPendingClearAll(false)}
        onConfirm={() => {
          setPendingClearAll(false);
          void setPto([]);
        }}
      />
    </SettingsSection>
  );
}
