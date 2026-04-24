import {
  Alert,
  Anchor,
  Box,
  Button,
  Divider,
  FileButton,
  Group,
  List,
  Modal,
  ScrollArea,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { ReactNode } from 'react';
import { useState } from 'react';
import styled from 'styled-components';

import { clearAllQueryCache } from '../../api/queryClient';
import { useAuth } from '../../hooks/useAuth';
import { useSyncStore, type SyncEvent } from '../../sync';
import {
  exportUserData,
  getDeviceId,
  importUserData,
  MigrationError,
  useUserData,
  useUserDataStore,
  type UserData,
} from '../../userData';
import { ConfirmDialog } from './ConfirmDialog';
import { SettingsSection } from './SettingsSection';

const SCOPE_DOC_URL =
  'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes';

export function SyncSection(): JSX.Element {
  const enabled = useSyncStore((s) => s.enabled);
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const error = useSyncStore((s) => s.error);
  const log = useSyncStore((s) => s.log);
  const gistId = useSyncStore((s) => s.gistId);
  const enable = useSyncStore((s) => s.enable);
  const disable = useSyncStore((s) => s.disable);
  const syncNow = useSyncStore((s) => s.syncNow);
  const deleteCloudCopy = useSyncStore((s) => s.deleteCloudCopy);

  const { viewer } = useAuth();
  const localData = useUserData();
  const replaceAll = useUserDataStore((s) => s.replaceAll);

  const [optInOpen, { open: openOptIn, close: closeOptIn }] = useDisclosure(false);
  const [deleteOpen, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [logVisible, setLogVisible] = useState(false);
  const [transferStatus, setTransferStatus] = useState<
    { tone: 'success' | 'error'; message: string } | null
  >(null);
  const [pendingImport, setPendingImport] = useState<{ doc: UserData; filename: string } | null>(
    null,
  );

  const handleToggle = (next: boolean) => {
    if (next) openOptIn();
    else disable();
  };

  const confirmEnable = async () => {
    closeOptIn();
    await enable();
  };

  const confirmDelete = async () => {
    closeDelete();
    await deleteCloudCopy();
  };

  const hasUserContent =
    localData.pto.length > 0 ||
    localData.holidays.regions.length > 0 ||
    localData.holidays.overrides.length > 0 ||
    localData.bento.tileOrder.length > 0 ||
    localData.bento.hiddenTiles.length > 0 ||
    Object.keys(localData.preferences ?? {}).length > 0;

  const handleExport = async () => {
    if (!viewer) return;
    try {
      const data = await exportUserData(viewer.login);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gi.user-data.${viewer.login}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setTransferStatus({ tone: 'success', message: 'downloaded. it’s yours.' });
    } catch (err) {
      setTransferStatus({
        tone: 'error',
        message: err instanceof Error ? err.message : 'export failed.',
      });
    }
  };

  const handleImportPicked = async (file: File | null) => {
    if (!file || !viewer) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const next = await importUserData(viewer.login, parsed);
      if (hasUserContent) {
        setPendingImport({ doc: next, filename: file.name });
      } else {
        await applyImport(next);
      }
    } catch (err) {
      const message =
        err instanceof MigrationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'import failed.';
      setTransferStatus({ tone: 'error', message });
    }
  };

  const applyImport = async (next: UserData) => {
    await replaceAll(next);
    setTransferStatus({ tone: 'success', message: 'imported. live across the app.' });
    // If sync is on, the local write triggers the debounced push automatically.
    if (!enabled) await clearAllQueryCache();
  };

  const deviceSuffix = deviceIdSuffix();

  return (
    <SettingsSection
      id="sync"
      title="sync"
      description={
        <>
          your preferences are mirrored to a private gist in your account.
        </>
      }
    >
      <Stack gap="lg">
        <SettingsRow
          label="cross-device sync"
          hint={
            enabled
              ? 'debounced ~2s after each change.'
              : 'turn this on to keep your settings consistent across devices.'
          }
        >
          <Group gap="xs" wrap="nowrap">
            <Switch
              checked={enabled}
              onChange={(e) => handleToggle(e.currentTarget.checked)}
              aria-label="cross-device sync"
            />
            <Text size="sm" c="dimmed">
              {enabled ? 'on' : 'off'}
            </Text>
          </Group>
        </SettingsRow>

        {enabled ? (
          <StatusPanel>
            <Group justify="space-between" wrap="nowrap" gap="md">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                <StatusDot tone={dotTone(status, lastSyncedAt, error)} />
                <Text size="sm" style={{ minWidth: 0 }} truncate>
                  {statusLabel(status, lastSyncedAt, error)}
                  {deviceSuffix ? (
                    <Text span c="dimmed">
                      {' · device '}
                      {deviceSuffix}
                    </Text>
                  ) : null}
                </Text>
              </Group>
              <Button
                variant="default"
                size="xs"
                onClick={() => void syncNow()}
                disabled={status === 'syncing'}
              >
                sync now
              </Button>
            </Group>
          </StatusPanel>
        ) : null}

        {error && enabled ? (
          <Alert color="primerRed" variant="light" title="sync hiccup">
            {error}
          </Alert>
        ) : null}

        {enabled && gistId ? (
          <SettingsRow
            label="remove from cloud"
            hint="deletes the gist. local data stays."
          >
            <Button variant="outline" color="primerRed" size="sm" onClick={openDelete}>
              delete cloud copy
            </Button>
          </SettingsRow>
        ) : null}

        {enabled ? (
          <Group gap="xs">
            <Anchor
              component="button"
              type="button"
              size="xs"
              c="dimmed"
              onClick={() => setLogVisible((v) => !v)}
            >
              {logVisible ? 'hide recent sync activity' : 'show recent sync activity'}
            </Anchor>
          </Group>
        ) : null}

        {logVisible ? <SyncActivityList events={log} /> : null}

        <Divider variant="dashed" />

        <SettingsRow
          label="export / import"
          hint="portable json. works whether sync is on or off."
        >
          <Group gap="sm" wrap="wrap">
            <Button variant="default" size="sm" onClick={() => void handleExport()} disabled={!viewer}>
              export user data (.json)
            </Button>
            <FileButton onChange={(file) => void handleImportPicked(file)} accept="application/json">
              {(props) => (
                <Button variant="default" size="sm" {...props} disabled={!viewer}>
                  import .json
                </Button>
              )}
            </FileButton>
          </Group>
        </SettingsRow>

        {transferStatus ? (
          <Text size="sm" c={transferStatus.tone === 'success' ? 'dimmed' : 'primerRed'}>
            {transferStatus.message}
          </Text>
        ) : null}
      </Stack>

      <Modal opened={optInOpen} onClose={closeOptIn} title="turn on cross-device sync?" centered size="lg">
        <Stack gap="sm">
          <Text size="sm">
            we&apos;ll redirect you to github to grant the <code>gist</code> scope. that scope lets
            gitInsights read and write{' '}
            <Text span fw={600}>
              all
            </Text>{' '}
            of your gists — that&apos;s a github limitation, not a choice we made. we only ever
            touch one private gist named <code>gitinsights:user-data:v1</code>.
          </Text>

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              what gets synced
            </Text>
            <List size="sm" spacing={2}>
              <List.Item>theme</List.Item>
              <List.Item>workweek</List.Item>
              <List.Item>streak mode</List.Item>
              <List.Item>pto calendar</List.Item>
              <List.Item>public holidays + overrides</List.Item>
              <List.Item>bento layout</List.Item>
              <List.Item>preferences</List.Item>
            </List>
          </Stack>

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              what does not sync
            </Text>
            <List size="sm" spacing={2}>
              <List.Item>your github access token (per-device)</List.Item>
              <List.Item>cached commit data, diffs, computed analytics</List.Item>
              <List.Item>transient ui state (scroll, last tab, dialogs)</List.Item>
            </List>
          </Stack>

          <Text size="xs" c="dimmed">
            the gist is private, but it lives on github&apos;s servers. that&apos;s the one place we
            relax the &quot;data stays in your browser&quot; promise.{' '}
            <Anchor href={SCOPE_DOC_URL} target="_blank" rel="noreferrer" size="xs">
              about the gist scope
            </Anchor>
            .
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={closeOptIn}>
              not now
            </Button>
            <Button color="primerBlue" onClick={() => void confirmEnable()}>
              continue to github
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDialog
        opened={deleteOpen}
        title="delete the cloud copy?"
        body={
          <Text size="sm">
            removes the <code>gitinsights:user-data:v1</code> gist from your github account.
            local data stays. you can re-create it anytime by syncing again.
          </Text>
        }
        confirmLabel="delete cloud copy"
        cancelLabel="keep it"
        onCancel={closeDelete}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        opened={pendingImport !== null}
        title="replace your settings with this file?"
        body={
          <Text size="sm">
            <code>{pendingImport?.filename}</code> overwrites your current theme, workweek,
            streak mode, pto, holidays, bento, and preferences.
            {enabled
              ? ' sync is on, so the cloud copy gets the new doc on the next push.'
              : ' export your current data first if you want a backup.'}
          </Text>
        }
        confirmLabel="replace"
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          const target = pendingImport;
          setPendingImport(null);
          if (target) void applyImport(target.doc);
        }}
      />
    </SettingsSection>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
      <Stack gap={2} style={{ flex: '1 1 240px', minWidth: 0 }}>
        <Text fw={600}>{label}</Text>
        {hint ? (
          <Text size="sm" c="dimmed">
            {hint}
          </Text>
        ) : null}
      </Stack>
      <Group gap="xs">{children}</Group>
    </Group>
  );
}

const StatusPanel = styled(Box)`
  background: var(--gi-bg-subtle);
  border: 1px solid var(--gi-border-muted);
  border-radius: var(--mantine-radius-md);
  padding: var(--mantine-spacing-sm) var(--mantine-spacing-md);
` as typeof Box;

type DotTone = 'success' | 'pending' | 'warn' | 'error';

const StatusDot = styled(Box)<{ tone: DotTone }>`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: ${({ tone }) =>
    tone === 'success'
      ? 'var(--mantine-color-green-6)'
      : tone === 'pending'
        ? 'var(--mantine-color-blue-5)'
        : tone === 'warn'
          ? 'var(--mantine-color-yellow-6)'
          : 'var(--mantine-color-red-6)'};
`;

function dotTone(
  status: ReturnType<typeof useSyncStore.getState>['status'],
  lastSyncedAt: string | null,
  error: string | null,
): DotTone {
  if (status === 'syncing') return 'pending';
  if (status === 'error' || error) return 'error';
  if (!lastSyncedAt) return 'warn';
  return 'success';
}

function statusLabel(
  status: ReturnType<typeof useSyncStore.getState>['status'],
  lastSyncedAt: string | null,
  error: string | null,
): string {
  if (status === 'syncing') return 'syncing…';
  if (status === 'error' && error) return error;
  if (!lastSyncedAt) return 'no successful sync yet.';
  return `synced ${formatRelative(lastSyncedAt)}`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

function deviceIdSuffix(): string {
  const id = getDeviceId();
  if (!id || id === 'ssr') return '';
  const compact = id.replace(/-/g, '');
  return compact.slice(-4);
}

// Caps the visible log at ~8 rows of activity; older entries scroll into view.
// Pruning by age (24h) happens in `syncLog.ts` before we ever render.
const ACTIVITY_LIST_MAX_HEIGHT = 220;

function SyncActivityList({ events }: { events: SyncEvent[] }): JSX.Element {
  if (events.length === 0) {
    return (
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          nothing logged yet.
        </Text>
        <Text size="xs" c="dimmed">
          last 24 hours only.
        </Text>
      </Stack>
    );
  }
  return (
    <Stack gap={4}>
      <ScrollArea.Autosize mah={ACTIVITY_LIST_MAX_HEIGHT} type="auto" offsetScrollbars>
        <Stack gap={4} pr="xs">
          {events.map((e) => (
            <Group key={`${e.at}-${e.message}`} gap="xs" wrap="nowrap">
              <Text size="xs" c="dimmed" style={{ minWidth: 160 }}>
                {new Date(e.at).toLocaleString()}
              </Text>
              <StatusDot
                tone={e.level === 'error' ? 'error' : e.level === 'warn' ? 'warn' : 'success'}
              />
              <Text size="xs">{e.message}</Text>
            </Group>
          ))}
        </Stack>
      </ScrollArea.Autosize>
      <Text size="xs" c="dimmed">
        last 24 hours only.
      </Text>
    </Stack>
  );
}
