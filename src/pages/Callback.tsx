import { Stack, Text, Title } from '@mantine/core';

export function CallbackPage(): JSX.Element {
  return (
    <Stack gap="md">
      <Title order={1}>oauth callback</Title>
      <Text c="dimmed">
        token exchange wires up in phase 2. this placeholder just proves the route exists.
      </Text>
    </Stack>
  );
}
