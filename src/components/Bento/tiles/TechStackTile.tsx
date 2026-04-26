import { Box, Group, Stack, Text } from '@mantine/core';
import { GraphIcon } from '@primer/octicons-react';
import { useMemo } from 'react';
import styled from 'styled-components';

import { useViewerRepoLanguages } from '../../../hooks/useGitHubQueries';
import { aggregateTechStack, type LanguageSlice } from '../../../analytics/techStack';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { metricMonoStyle, VerdictLine } from './Stat';

const StackBar = styled(Group)`
  width: 100%;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--gi-bg-muted);
` as typeof Group;

function colorFor(slice: LanguageSlice, idx: number): string {
  if (slice.color) return slice.color;
  const palette = [
    'var(--mantine-color-primerBlue-4)',
    'var(--mantine-color-primerGreen-4)',
    'var(--mantine-color-primerYellow-4)',
    'var(--mantine-color-primerOrange-4)',
    'var(--mantine-color-primerPurple-4)',
    'var(--mantine-color-primerPink-4)',
    'var(--mantine-color-primerGray-5)',
  ];
  return palette[idx % palette.length] ?? 'var(--mantine-color-primerGray-5)';
}

export function TechStackTile(): JSX.Element {
  const { data, isLoading, isError, refetch } = useViewerRepoLanguages();
  const slices = useMemo(() => (data ? aggregateTechStack(data) : []), [data]);

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && slices.length === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  const top = slices[0];

  return (
    <BentoTile
      title="tech stack · 12mo"
      titleTooltip={TILE_HELP.techStack}
      icon={GraphIcon}
      state={state}
      area={BENTO_AREAS.TechStack}
      onRetry={() => void refetch()}
      emptyMessage="no language data in the last 12 months. ship something."
      footer={
        state === 'loaded' && top ? (
          <VerdictLine>
            <Text component="span" style={metricMonoStyle}>
              {Math.round(top.share * 100)}%
            </Text>{' '}
            {top.name}. {top.share > 0.7 ? 'a one-language year.' : 'a healthy mix.'}
          </VerdictLine>
        ) : null
      }
    >
      <Stack gap="sm">
        <StackBar gap={0} wrap="nowrap">
          {slices.map((slice, idx) => (
            <Box
              key={slice.name}
              style={{
                height: '100%',
                background: colorFor(slice, idx),
                flexBasis: `${slice.share * 100}%`,
              }}
            />
          ))}
        </StackBar>
        <Stack gap={4}>
          {slices.map((slice, idx) => (
            <Group key={slice.name} justify="space-between" gap="xs" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <Box
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: colorFor(slice, idx),
                    flexShrink: 0,
                  }}
                />
                <Text size="sm">{slice.name}</Text>
              </Group>
              <Text size="sm" c="dimmed" fw={600} style={metricMonoStyle}>
                {Math.round(slice.share * 100)}%
              </Text>
            </Group>
          ))}
        </Stack>
      </Stack>
    </BentoTile>
  );
}
