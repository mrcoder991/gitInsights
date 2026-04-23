import {
  ActionIcon,
  Badge,
  Card,
  Checkbox,
  Group,
  MultiSelect,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { TrashIcon } from '@primer/octicons-react';
import { useMemo } from 'react';
import styled from 'styled-components';

import {
  SUPPORTED_HOLIDAY_REGIONS,
} from '../../data/holidays';
import { useHolidays } from '../../userData/useHolidays';
import { useHolidaysConfig, useUserDataStore } from '../../userData';
import { SettingsSection } from './SettingsSection';

const HolidayCard = styled(Card)`
  background: var(--gi-bg-subtle);
  border: 1px solid var(--gi-border-muted);
` as typeof Card;

function isUpcoming(date: string, today = new Date()): boolean {
  const d = new Date(`${date}T00:00:00`);
  return d.getTime() >= today.setHours(0, 0, 0, 0);
}

export function PublicHolidaysSection(): JSX.Element {
  const config = useHolidaysConfig();
  const setRegions = useUserDataStore((s) => s.setHolidayRegions);
  const toggleOverride = useUserDataStore((s) => s.toggleHolidayOverride);
  const setHolidays = useUserDataStore((s) => s.setHolidays);

  const { lookup, isLoading } = useHolidays();
  const overrideSet = useMemo(
    () => new Set(config.overrides.map((o) => o.date)),
    [config.overrides],
  );

  const upcoming = useMemo(() => {
    const today = new Date();
    const entries: Array<{ date: string; name: string }> = [];
    for (const [date, items] of lookup) {
      if (!isUpcoming(date, today)) continue;
      for (const item of items) entries.push({ date, name: item.name });
    }
    return entries.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 12);
  }, [lookup]);

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
        ) : (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              upcoming
            </Text>
            {upcoming.length === 0 ? (
              <Text size="sm" c="dimmed">
                no holidays in the bundled window for the selected regions. custom .ics import is coming.
              </Text>
            ) : (
              upcoming.map((h) => {
                const overridden = overrideSet.has(h.date);
                return (
                  <HolidayCard key={`${h.date}-${h.name}`} padding="xs" withBorder radius="sm">
                    <Group justify="space-between" wrap="nowrap" gap="sm">
                      <Stack gap={0}>
                        <Group gap="xs">
                          <Text size="sm" fw={600}>
                            {h.date}
                          </Text>
                          {overridden ? (
                            <Badge size="xs" color="gray" variant="light">
                              treated as workday
                            </Badge>
                          ) : null}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {h.name}
                        </Text>
                      </Stack>
                      <Switch
                        checked={overridden}
                        onChange={() => void toggleOverride(h.date)}
                        label="i worked that day"
                        size="xs"
                      />
                    </Group>
                  </HolidayCard>
                );
              })
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
                    aria-label={`untick override for ${o.date}`}
                  />
                  <Text size="sm">{o.date}</Text>
                  <Text size="xs" c="dimmed">
                    treated as workday
                  </Text>
                </Group>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => void removeOverride(o.date)}
                  aria-label={`remove override ${o.date}`}
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
