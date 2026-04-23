import { Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

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
    <Stack gap="sm" role="group" aria-labelledby={`${id}-heading`}>
      <Title order={2} size="h3" id={`${id}-heading`}>
        {title}
      </Title>
      {description ? (
        <Text c="dimmed" id={`${id}-help`} size="sm">
          {description}
        </Text>
      ) : null}
      {children}
    </Stack>
  );
}
