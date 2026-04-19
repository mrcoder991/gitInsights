import { Stack, Text, Title } from '@mantine/core';
import { useLocation } from 'react-router-dom';

export function NotFoundPage(): JSX.Element {
  const { pathname } = useLocation();
  return (
    <Stack gap="md">
      <Title order={1}>404</Title>
      <Text c="dimmed">no route at {pathname}. phase 8 ships the branded version.</Text>
    </Stack>
  );
}
