import { Stack, Text, Title } from '@mantine/core';
import { useParams } from 'react-router-dom';

export function PublicProfilePage(): JSX.Element {
  const { username } = useParams();
  return (
    <Stack gap="md">
      <Title order={1}>/u/{username ?? 'unknown'}</Title>
      <Text c="dimmed">
        public profile is deferred — see spec.md §4.D and §11. route exists so links don&apos;t 404.
      </Text>
    </Stack>
  );
}
