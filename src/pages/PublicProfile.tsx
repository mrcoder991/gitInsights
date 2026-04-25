import { Stack, Text, Title } from '@mantine/core';
import { useParams } from 'react-router-dom';

export function PublicProfilePage(): JSX.Element {
  const { username } = useParams();
  return (
    <Stack gap="md">
      <Title order={1}>/u/{username ?? 'unknown'}</Title>
      <Text c="dimmed">
        public profiles are coming soon!
      </Text>
    </Stack>
  );
}
