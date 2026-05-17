import { Stack, Text, Title } from '@mantine/core';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { trackEvent } from '../lib/analytics';

export function PublicProfilePage(): JSX.Element {
  const { username } = useParams();

  useEffect(() => {
    if (username) trackEvent('public-profile-viewed', { username });
  }, [username]);

  return (
    <Stack gap="md">
      <Title order={1}>/u/{username ?? 'unknown'}</Title>
      <Text c="dimmed">
        public profiles are coming soon!
      </Text>
    </Stack>
  );
}
