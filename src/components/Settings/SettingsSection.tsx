import { Box, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import styled from 'styled-components';

// Two-column settings row: label + description in the left rail, controls on
// the right. Collapses to a single column under Mantine's `sm` breakpoint
// (768px) so mobile keeps the existing top-down layout.
const Row = styled(Box)`
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--mantine-spacing-md);
  align-items: start;

  @media (min-width: 768px) {
    grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
    gap: var(--mantine-spacing-xl);
  }
` as typeof Box;

const Content = styled(Box)`
  min-width: 0;
` as typeof Box;

export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <Row role="group" aria-labelledby={`${id}-heading`}>
      <Stack gap="xs">
        <Title order={2} size="h4" id={`${id}-heading`}>
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" id={`${id}-help`} size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
      <Content>{children}</Content>
    </Row>
  );
}
