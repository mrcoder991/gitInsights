import { Group, Stack, Text } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';
import styled from 'styled-components';

/** Tabular monospace for stat numbers (tiles, footers, tables). */
export const metricMonoStyle: CSSProperties = {
  fontFamily: 'var(--gi-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
  fontFeatureSettings: "'tnum'",
};

const Big = styled(Text)`
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  line-height: 1;
  font-weight: 700;
  font-feature-settings: 'tnum';
  font-family: var(--gi-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  color: var(--gi-fg-default);
` as typeof Text;

const StatValue = styled(Text)`
  font-family: var(--gi-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-feature-settings: 'tnum';
` as typeof Text;

export function StatNumber({
  value,
  unit,
  trailing,
}: {
  value: ReactNode;
  unit?: ReactNode;
  trailing?: ReactNode;
}): JSX.Element {
  return (
    <Group gap="xs" align="baseline" wrap="nowrap">
      <Big>{value}</Big>
      {unit ? (
        <Text size="sm" c="dimmed">
          {unit}
        </Text>
      ) : null}
      {trailing}
    </Group>
  );
}

export function StatRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}): JSX.Element {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <StatValue size="sm" fw={600} ta="right" style={{ whiteSpace: 'nowrap' }}>
        {value}
      </StatValue>
    </Group>
  );
}

export function VerdictLine({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" lh={1.4}>
        {children}
      </Text>
    </Stack>
  );
}
