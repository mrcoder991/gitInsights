import { Stack } from '@mantine/core';
import { useEffect } from 'react';

import { BentoGrid, BentoHeader } from '../components/Bento';
import {
  EPTile,
  StreakTile,
  TechStackTile,
  WeeklyCodingDaysTile,
  WLBAuditTile,
} from '../components/Bento/tiles';
import { ConsistencyTile } from '../components/ConsistencyMap';
import { trackEvent } from '../lib/analytics';

export function DashboardPage(): JSX.Element {
  useEffect(() => { trackEvent('dashboard-loaded'); }, []);

  return (
    <Stack gap="lg">
      <BentoHeader />
      <BentoGrid>
        <EPTile />
        <StreakTile />
        <WeeklyCodingDaysTile />
        <ConsistencyTile />
        <WLBAuditTile />
        <TechStackTile />
      </BentoGrid>
    </Stack>
  );
}
