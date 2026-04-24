import { Badge, Group, SegmentedControl, useComputedColorScheme } from '@mantine/core';

import { useTheme, useUserDataStore, type ThemeChoice } from '../../userData';
import { SettingsSection } from './SettingsSection';

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: 'system', label: 'system' },
  { value: 'dark', label: 'dark' },
  { value: 'light', label: 'light' },
];

export function ThemeSection(): JSX.Element {
  const choice = useTheme();
  const setTheme = useUserDataStore((s) => s.setTheme);
  const resolved = useComputedColorScheme('dark', { getInitialValueInEffect: true });

  return (
    <SettingsSection id="theme" title="theme" description="system — match my os. dark. light.">
      <Group justify="space-between" align="baseline">
        <SegmentedControl
          value={choice}
          onChange={(value) => void setTheme(value as ThemeChoice)}
          data={THEME_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          aria-labelledby="theme-heading"
          aria-describedby="theme-help"
          fullWidth={false}
          color="primerBlue"
        />
        {choice === 'system' && (
          <Badge variant="light" color="primerBlue">
            currently {resolved} (matching your os)
          </Badge>
        )}
      </Group>
    </SettingsSection>
  );
}
