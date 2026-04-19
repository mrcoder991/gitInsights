import { Stack, Text, Title } from '@mantine/core';

export function DashboardPage(): JSX.Element {
  return (
    <Stack gap="md">
      <Title order={1}>dashboard</Title>
      <Text c="dimmed">
        bento grid + consistency map land in phase 4. tiles fill in across phase 5.
      </Text>
    </Stack>
  );
}
