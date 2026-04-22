import { Stack } from '@mantine/core';
import {
  ClockIcon,
  FlameIcon,
  GraphIcon,
  PulseIcon,
  SyncIcon,
} from '@primer/octicons-react';

import { BENTO_AREAS, BentoGrid, BentoHeader, BentoTile } from '../components/Bento';
import { ConsistencyTile } from '../components/ConsistencyMap';

export function DashboardPage(): JSX.Element {
  return (
    <Stack gap="lg">
      <BentoHeader />
      <BentoGrid>
        <BentoTile
          title="energy points · 365d"
          icon={FlameIcon}
          state="placeholder"
          area={BENTO_AREAS.EP}
        />
        <BentoTile
          title="streak"
          icon={ClockIcon}
          state="placeholder"
          area={BENTO_AREAS.Streak}
        />
        <BentoTile
          title="weekly coding days"
          icon={SyncIcon}
          state="placeholder"
          area={BENTO_AREAS.WeeklyCodingDays}
        />
        <ConsistencyTile />
        <BentoTile
          title="wlb audit · 30d"
          icon={PulseIcon}
          state="placeholder"
          area={BENTO_AREAS.WLB}
        />
        <BentoTile
          title="tech stack · 12mo"
          icon={GraphIcon}
          state="placeholder"
          area={BENTO_AREAS.TechStack}
        />
      </BentoGrid>
    </Stack>
  );
}
