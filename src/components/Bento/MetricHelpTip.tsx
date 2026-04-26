import { ActionIcon, Tooltip } from '@mantine/core';
import { QuestionIcon } from '@primer/octicons-react';
import styled from 'styled-components';

// Tooltip body owns its own block layout. Mantine's Tooltip + Floating UI
// render `label` inside a portal, so we style with a scoped wrapper to keep
// `ul`, `li`, `pre`, `code` rendering as proper blocks regardless of how
// Mantine's defaults try to collapse them.
const TooltipHtml = styled.div`
  width: min(360px, calc(100vw - 2rem));
  max-width: 100%;
  display: block;
  white-space: normal;
  font-size: var(--mantine-font-size-sm);
  line-height: 1.45;
  color: inherit;

  & > * + * {
    margin-top: var(--mantine-spacing-sm);
  }

  ul {
    display: block;
    margin: 0;
    padding-inline-start: 1.15rem;
    list-style: disc outside;
    color: inherit;
  }

  li {
    display: list-item;
    white-space: normal;
    margin: 0 0 4px 0;
  }

  li:last-child {
    margin-bottom: 0;
  }

  pre {
    display: block;
    width: 100%;
    margin: 0;
    padding: var(--mantine-spacing-xs);
    background: var(--gi-bg-muted);
    border: 1px solid var(--gi-border-muted);
    border-radius: 6px;
    box-sizing: border-box;
    color: var(--gi-fg-muted, currentColor);
    opacity: 0.9;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    font-size: 11px;
    font-family: var(--gi-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-feature-settings: 'tnum';
    line-height: 1.45;
  }

  pre code {
    font: inherit;
    color: inherit;
    background: transparent;
    padding: 0;
  }
`;

export function MetricHelpTip({
  ariaLabel,
  html,
}: {
  /** Short context for screen readers, e.g. "About commit momentum" */
  ariaLabel: string;
  /** Pre-built HTML string (see `TILE_HELP` in `tileTooltips.tsx`). Trusted, app-authored copy. */
  html: string;
}): JSX.Element {
  const label = <TooltipHtml dangerouslySetInnerHTML={{ __html: html }} />;

  return (
    <Tooltip
      label={label}
      multiline
      w={360}
      maw="min(360px, calc(100vw - 2rem))"
      position="bottom-end"
      withArrow
      events={{ hover: true, focus: true, touch: true }}
      styles={{
        tooltip: {
          padding: 'var(--mantine-spacing-sm)',
          whiteSpace: 'normal',
          maxWidth: 'min(360px, calc(100vw - 2rem))',
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
