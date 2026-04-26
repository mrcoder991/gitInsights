import { ActionIcon, Box, Tooltip } from '@mantine/core';
import { QuestionIcon } from '@primer/octicons-react';
import type { ReactNode } from 'react';

// The tooltip width is owned here (not by the body) so every metric tip lines
// up regardless of how chunky its bullet list / formula block is. Mantine's
// `Tooltip` portals the body, so we wrap it in a `Box` to set a stable
// max-width without targeting raw HTML elements (Phase 1 styled-components
// rule forbids `styled.div` / `styled.span` / etc.).
const TOOLTIP_MAX_WIDTH = 'min(400px, calc(100vw - 2rem))';

export function MetricHelpTip({
  ariaLabel,
  body,
}: {
  /** Short context for screen readers, e.g. "About commit momentum" */
  ariaLabel: string;
  /** Tooltip body — see `TILE_HELP` in `tileTooltips.tsx`. Trusted, app-authored. */
  body: ReactNode;
}): JSX.Element {
  return (
    <Tooltip
      label={<Box maw={TOOLTIP_MAX_WIDTH}>{body}</Box>}
      multiline
      w={360}
      maw={TOOLTIP_MAX_WIDTH}
      position="bottom-end"
      withArrow
      events={{ hover: true, focus: true, touch: true }}
      styles={{
        tooltip: {
          padding: 'var(--mantine-spacing-sm)',
          whiteSpace: 'normal',
          maxWidth: TOOLTIP_MAX_WIDTH,
        },
      }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label={ariaLabel}
        style={{ flexShrink: 0 }}
      >
        <QuestionIcon size={14} />
      </ActionIcon>
    </Tooltip>
  );
}
