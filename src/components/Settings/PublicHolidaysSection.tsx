import {
  ActionIcon,
  Badge,
  Checkbox,
  Group,
  MultiSelect,
  Pagination,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core';
import { TrashIcon } from '@primer/octicons-react';
import { useEffect, useMemo, useState } from 'react';

import { formatDisplayDayMonthYear } from '../../analytics/dates';
import { SUPPORTED_HOLIDAY_REGIONS } from '../../data/holidays';
import { useHolidays } from '../../userData/useHolidays';
import { useHolidaysConfig, useUserDataStore } from '../../userData';
import { holidayRowsFromLookup } from './publicHolidayList';
import { SettingsSection } from './SettingsSection';

const PAGE_SIZE = 10;

type HolidayTimingFilter = 'all' | 'upcoming' | 'past';

export function PublicHolidaysSection(): JSX.Element {
  const config = useHolidaysConfig();
  const setRegions = useUserDataStore((s) => s.setHolidayRegions);
  const toggleOverride = useUserDataStore((s) => s.toggleHolidayOverride);
  const setHolidays = useUserDataStore((s) => s.setHolidays);

  const { lookup, isLoading } = useHolidays();
  const [timingFilter, setTimingFilter] = useState<HolidayTimingFilter>('all');
  const [page, setPage] = useState(1);

  const overrideSet = useMemo(
    () => new Set(config.overrides.map((o) => o.date)),
    [config.overrides],
  );

  const holidayRows = useMemo(() => holidayRowsFromLookup(lookup), [lookup]);

  const filteredRows = useMemo(() => {
    if (timingFilter === 'all') return holidayRows;
    return holidayRows.filter((row) => row.timing === timingFilter);
  }, [holidayRows, timingFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [lookup, timingFilter]);

  const effectivePage = Math.min(page, totalPages);
  const sliceStart = (effectivePage - 1) * PAGE_SIZE;
  const pageSlice = filteredRows.slice(sliceStart, sliceStart + PAGE_SIZE);

  const removeOverride = async (date: string) => {
    await setHolidays({
      ...config,
      overrides: config.overrides.filter((o) => o.date !== date),
    });
  };

  return (
    <SettingsSection
      id="holidays"
      title="public holidays"
      description="pick your region. national holidays auto-mark as off-days. you can still untick any one if you actually worked."
    >
      <Stack gap="md">
        <MultiSelect
          label="regions"
          placeholder="search ISO 3166 region…"
          data={SUPPORTED_HOLIDAY_REGIONS.map((r) => ({ value: r.code, label: r.label }))}
          value={config.regions}
          onChange={(values) => void setRegions(values)}
          searchable
          clearable
          comboboxProps={{ withinPortal: true }}
        />

        {config.regions.length === 0 ? (
          <Text size="sm" c="dimmed">
            no regions selected. holidays stay off until you pick at least one.
          </Text>
        ) : isLoading ? (
          <Text size="sm" c="dimmed">
            loading holiday data…
          </Text>
        ) : holidayRows.length === 0 ? (
          <Text size="sm" c="dimmed">
            no holidays in the bundled window for the selected regions. custom .ics import is coming.
          </Text>
        ) : (
          <Stack gap="xs">
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
              <div>
                <Text size="sm" fw={600}>
                  holiday calendar
                </Text>
                {timingFilter === 'all' ? (
                  <Text size="xs" c="dimmed">
                    {holidayRows.length} holiday
                    {holidayRows.length === 1 ? '' : 's'}
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    showing {timingFilter} ({filteredRows.length} of {holidayRows.length})
                  </Text>
                )}
              </div>
              <SegmentedControl
                size="xs"
                value={timingFilter}
                onChange={(v) => setTimingFilter(v as HolidayTimingFilter)}
                data={[
                  { label: 'all', value: 'all' },
                  { label: 'upcoming', value: 'upcoming' },
                  { label: 'past', value: 'past' },
                ]}
              />
            </Group>
            {filteredRows.length === 0 ? (
              <Text size="sm" c="dimmed">
                no {timingFilter} holidays in the bundled window.
              </Text>
            ) : (
              <>
                <Table.ScrollContainer minWidth={520}>
                  <Table highlightOnHover layout="fixed">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '22%' }}>when</Table.Th>
                        <Table.Th style={{ width: '26%' }}>date</Table.Th>
                        <Table.Th>name</Table.Th>
                        <Table.Th style={{ width: 140 }}>i worked</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pageSlice.map((h) => {
                        const overridden = overrideSet.has(h.date);
                        const rowKey = `${h.date}-${h.name}`;
                        return (
                          <Table.Tr key={rowKey}>
                            <Table.Td>
                              <Badge
                                size="xs"
                                variant="light"
                                color={h.timing === 'upcoming' ? 'blue' : 'gray'}
                              >
                                {h.timing}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs" wrap="nowrap">
                                <Text size="sm">{formatDisplayDayMonthYear(h.date)}</Text>
                                {overridden ? (
                                  <Badge size="xs" color="gray" variant="outline">
                                    workday override
                                  </Badge>
                                ) : null}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{h.name}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Switch
                                checked={overridden}
                                onChange={() => void toggleOverride(h.date)}
                                aria-label={`i worked ${formatDisplayDayMonthYear(h.date)} (${h.name})`}
                                label="yes"
                                size="xs"
                              />
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
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
              </>
            )}
          </Stack>
        )}

        {config.overrides.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              overrides ({config.overrides.length})
            </Text>
            {config.overrides.map((o) => (
              <Group key={o.date} justify="space-between" gap="sm">
                <Group gap="xs">
                  <Checkbox
                    checked
                    onChange={() => void toggleOverride(o.date)}
                    aria-label={`untick override for ${formatDisplayDayMonthYear(o.date)}`}
                  />
                  <Text size="sm">{formatDisplayDayMonthYear(o.date)}</Text>
                  <Text size="xs" c="dimmed">
                    treated as workday
                  </Text>
                </Group>
                <ActionIcon
                  variant="subtle"
                  color="primerRed"
                  onClick={() => void removeOverride(o.date)}
                  aria-label={`remove override ${formatDisplayDayMonthYear(o.date)}`}
                >
                  <TrashIcon size={14} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </SettingsSection>
  );
}
