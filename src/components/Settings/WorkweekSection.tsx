import { Button, Chip, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';

import { useUserDataStore, useWorkweek, type Workweek } from '../../userData';
import { SettingsSection } from './SettingsSection';

type Preset = 'mon-fri' | 'sun-thu' | 'mon-thu' | 'custom';

const PRESETS: Record<Exclude<Preset, 'custom'>, number[]> = {
  'mon-fri': [1, 2, 3, 4, 5],
  'sun-thu': [0, 1, 2, 3, 4],
  'mon-thu': [1, 2, 3, 4],
};

function arraysEqualUnordered(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((v, i) => v === sorted[i]);
}

function detectPreset(workdays: number[]): Preset {
  for (const [name, days] of Object.entries(PRESETS) as Array<[Exclude<Preset, 'custom'>, number[]]>) {
    if (arraysEqualUnordered(workdays, days)) return name;
  }
  return 'custom';
}

function localeDayNames(): string[] {
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const d = new Date(2025, 5, 1 + dow);
    return fmt.format(d).toLowerCase();
  });
}

function firstDayOfWeek(): number {
  try {
    const locale = new Intl.Locale(navigator.language ?? 'en-US') as Intl.Locale & {
      weekInfo?: { firstDay: number };
    };
    return locale.weekInfo?.firstDay ?? 1;
  } catch {
    return 1;
  }
}

export function WorkweekSection(): JSX.Element {
  const current = useWorkweek();
  const setWorkweek = useUserDataStore((s) => s.setWorkweek);
  const dayNames = useMemo(localeDayNames, []);
  const firstDay = useMemo(firstDayOfWeek, []);
  const [error, setError] = useState<string | null>(null);

  const preset = detectPreset(current.workdays);

  const orderedDays = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((i) => (i + firstDay) % 7);
  }, [firstDay]);

  const apply = async (next: Workweek) => {
    try {
      setError(null);
      await setWorkweek(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'workdays must include at least one day.');
    }
  };

  return (
    <SettingsSection
      id="workweek"
      title="workweek"
      description="pick your working days. drives every weekend / non-workday metric."
    >
      <Stack gap="sm">
        <SegmentedControl
          value={preset}
          onChange={(value) => {
            if (value === 'custom') return;
            const days = PRESETS[value as Exclude<Preset, 'custom'>];
            void apply({ workdays: days });
          }}
          data={[
            { value: 'mon-fri', label: 'mon–fri' },
            { value: 'sun-thu', label: 'sun–thu' },
            { value: 'mon-thu', label: 'mon–thu (4-day)' },
            { value: 'custom', label: 'custom' },
          ]}
          color="primerBlue"
        />
        <Chip.Group
          multiple
          value={current.workdays.map(String)}
          onChange={(values) => {
            const next = values.map((v) => Number(v));
            void apply({ workdays: next });
          }}
        >
          <Group gap="xs" wrap="wrap">
            {orderedDays.map((dow) => (
              <Chip key={dow} value={String(dow)} color="primerBlue" variant="light">
                {dayNames[dow]}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
        {error ? (
          <Text size="sm" c="primerRed">
            {error}
          </Text>
        ) : null}
        <Group>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => void apply({ workdays: [...PRESETS['mon-fri']] })}
          >
            reset to mon–fri
          </Button>
        </Group>
      </Stack>
    </SettingsSection>
  );
}
