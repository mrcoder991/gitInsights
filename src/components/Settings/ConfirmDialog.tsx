import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

// Reusable confirmation dialog for destructive, non-reversible actions.
// Voice rules (spec §10): direct, lowercase, name what's being destroyed,
// no "are you sure?" filler, no apology padding.

type ConfirmDialogProps = {
  opened: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  opened,
  title,
  body,
  confirmLabel,
  cancelLabel = 'never mind',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal opened={opened} onClose={onCancel} title={title} centered size="md">
      <Stack gap="sm">
        {typeof body === 'string' ? <Text size="sm">{body}</Text> : body}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button color="primerRed" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
