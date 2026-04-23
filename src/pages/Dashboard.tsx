import { Stack } from '@mantine/core';

import { BentoGrid, BentoHeader } from '../components/Bento';
import {
  EPTile,
  StreakTile,
  TechStackTile,
  WeeklyCodingDaysTile,
  WLBAuditTile,
} from '../components/Bento/tiles';
import { ConsistencyTile } from '../components/ConsistencyMap';

export function DashboardPage(): JSX.Element {
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
