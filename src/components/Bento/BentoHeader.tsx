import { Box, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import styled from 'styled-components';

import { useAuth } from '../../hooks/useAuth';
import { useTimeframe } from '../../hooks/useTimeframe';
import { TimeframePicker } from '../Timeframe';

function greetingForHour(hour: number): string {
  if (hour < 5) return 'still up';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'late';
}

function firstNameOf(name: string | null, login: string): string {
  if (name && name.trim().length > 0) {
    const first = name.trim().split(/\s+/)[0];
    if (first) return first.toLowerCase();
  }
  return login.toLowerCase();
}

const TfBar = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-block-end: ${({ theme }) => theme.spacing.xs};
` as typeof Box;

const HeaderWrap = styled(Box)`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding-block-end: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
` as typeof Box;

export function BentoHeader(): JSX.Element {
  const { viewer } = useAuth();
  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const { from, to } = useTimeframe();

  const fromLabel = from.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const toLabel = to.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Stack gap={4}>
      <TfBar component="div">
        <TimeframePicker />
        <Text size="xs" ff="monospace" c="dimmed">
          heatmap fixed at 53 weeks · all other tiles follow this
        </Text>
      </TfBar>

      <HeaderWrap component="header">
        <Stack gap={4}>
          {viewer ? (
            <Title order={1} size="h2" fw={700} tt="lowercase" lh={1.1}>
              {greeting}, {firstNameOf(viewer.name, viewer.login)}.
            </Title>
          ) : (
            <Skeleton height={28} width={220} radius="sm" />
          )}
          <Text size="sm" c="dimmed">
            {fromLabel} → {toLabel} · all timestamps in your local tz.
          </Text>
        </Stack>
        <Group gap="xs" c="dimmed">
          <Text size="xs" ff="monospace">
            public + private
          </Text>
        </Group>
      </HeaderWrap>
    </Stack>
  );
}
