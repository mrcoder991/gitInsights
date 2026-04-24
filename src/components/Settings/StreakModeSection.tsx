import { Radio, Stack, Text } from '@mantine/core';

import { useStreakMode, useUserDataStore, type StreakMode } from '../../userData';
import { SettingsSection } from './SettingsSection';

const MODES: ReadonlyArray<{ value: StreakMode; label: string; copy: string }> = [
  {
    value: 'strict',
    label: 'every day or it doesn’t count',
    copy: 'strict — non-workdays still need a commit. classic github behavior.',
  },
  {
    value: 'skip-non-workdays',
    label: 'weekends don’t break me',
    copy: 'skip non-workdays — weekends and off-days neither extend nor break the streak.',
  },
  {
    value: 'workdays-only',
    label: 'workdays only',
    copy: 'workdays only — non-workday commits don’t count toward the streak.',
  },
];

export function StreakModeSection(): JSX.Element {
  const value = useStreakMode();
  const setMode = useUserDataStore((s) => s.setStreakMode);

  return (
    <SettingsSection
      id="streak-mode"
      title="streak mode"
      description="rest is a feature. pick how off-days are treated."
    >
      <Radio.Group
        value={value}
        onChange={(next) => void setMode(next as StreakMode)}
        name="streakMode"
      >
        <Stack gap="sm">
          {MODES.map((m) => (
            <Radio
              key={m.value}
              value={m.value}
              label={
                <Stack gap={2}>
                  <Text fw={600}>{m.label}</Text>
                  <Text size="sm" c="dimmed">
                    {m.copy}
                  </Text>
                </Stack>
              }
            />
          ))}
        </Stack>
      </Radio.Group>
    </SettingsSection>
  );
}
