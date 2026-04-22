import { Box } from '@mantine/core';
import type { ReactNode } from 'react';
import styled from 'styled-components';

// Spec §4.C / mocks `dashboard · bento grid`. 12-column grid that mirrors the
// design board:
//   row 1 — EP (4) · Streak (4) · WeeklyCodingDays (4)
//   row 2 — Consistency (12, full width)
//   row 3 — WLB (7) · TechStack (5)
//
// Tablet keeps the 12-col grid but stacks each tile to full width except the
// first row (EP / Streak side-by-side). Mobile collapses to a single column
// in the visual order from the mobile mock.
//
// Phase 4 ships Consistency live; the rest render as `placeholder` so the
// layout stays visually anchored as Phase 5 tiles come online.

export const BENTO_AREAS = {
  EP: 'EP',
  Streak: 'Streak',
  WeeklyCodingDays: 'WeeklyCodingDays',
  Consistency: 'Consistency',
  WLB: 'WLB',
  TechStack: 'TechStack',
} as const;

const Grid = styled(Box)`
  display: grid;
  width: 100%;
  gap: ${({ theme }) => theme.spacing.md};
  grid-auto-rows: minmax(220px, auto);

  grid-template-columns: 1fr;
  grid-template-areas:
    'EP'
    'Streak'
    'WeeklyCodingDays'
    'Consistency'
    'WLB'
    'TechStack';

  @media (min-width: 640px) {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-areas:
      'EP EP EP EP EP EP Streak Streak Streak Streak Streak Streak'
      'WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays'
      'Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency'
      'WLB WLB WLB WLB WLB WLB WLB WLB WLB WLB WLB WLB'
      'TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack';
  }

  @media (min-width: 992px) {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-areas:
      'EP EP EP EP Streak Streak Streak Streak WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays'
      'Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency'
      'WLB WLB WLB WLB WLB WLB WLB TechStack TechStack TechStack TechStack TechStack';
  }
` as typeof Box;

export function BentoGrid({ children }: { children: ReactNode }): JSX.Element {
  return <Grid role="list">{children}</Grid>;
}
