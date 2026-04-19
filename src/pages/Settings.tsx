import {
  Badge,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
} from '@mantine/core';

import { usePreferencesStore, type ThemeChoice } from '../store/preferences';

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: 'system', label: 'system' },
  { value: 'dark', label: 'dark' },
  { value: 'light', label: 'light' },
];

export function SettingsPage(): JSX.Element {
  const choice = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const resolved = useComputedColorScheme('dark', { getInitialValueInEffect: true });

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={1}>settings</Title>
        <Text c="dimmed">
          phase 1 ships theme only. workweek, streak mode, pto, holidays, and sync land in phases 5
          and 5b.
        </Text>
      </Stack>

      <Stack gap="sm" role="group" aria-labelledby="theme-section-heading">
        <Group justify="space-between" align="baseline">
          <Title order={2} size="h3" id="theme-section-heading">
            theme
          </Title>
          {choice === 'system' && (
            <Badge variant="light" color="primerBlue">
              currently {resolved} (matching your os)
            </Badge>
          )}
        </Group>
        <Text c="dimmed" id="theme-section-help">
          system — match my os. dark. light.
        </Text>
        <SegmentedControl
          value={choice}
          onChange={(value) => setTheme(value as ThemeChoice)}
          data={THEME_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          aria-labelledby="theme-section-heading"
          aria-describedby="theme-section-help"
          fullWidth={false}
          color="primerBlue"
        />
      </Stack>
    </Stack>
  );
}
