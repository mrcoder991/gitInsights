import { Stack, Text, Title } from '@mantine/core';

export function LandingPage(): JSX.Element {
  return (
    <Stack gap="md">
      <Title order={1}>your commits, your story.</Title>
      <Text c="dimmed">
        not your boss&apos;s dashboard. login lands in phase 2 — for now this is just the shell.
      </Text>
    </Stack>
  );
}
