import { Anchor, Button, FileButton, Group, Stack, Text } from '@mantine/core';
import { useState } from 'react';

import { useAuth } from '../../hooks/useAuth';
import {
  exportUserData,
  importUserData,
  MigrationError,
  useUserDataStore,
} from '../../userData';
import { clearAllQueryCache } from '../../api/queryClient';
import { SettingsSection } from './SettingsSection';

const REVOKE_URL = 'https://github.com/settings/applications';

export function DataControlsSection(): JSX.Element {
  const { viewer, logout } = useAuth();
  const replaceAll = useUserDataStore((s) => s.replaceAll);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

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
      setStatus({ tone: 'success', message: 'downloaded. it’s yours.' });
    } catch (err) {
      setStatus({
        tone: 'error',
        message: err instanceof Error ? err.message : 'export failed.',
      });
    }
  };

  const handleImport = async (file: File | null) => {
    if (!file || !viewer) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const next = await importUserData(viewer.login, parsed);
      await replaceAll(next);
      setStatus({ tone: 'success', message: 'imported. live across the app.' });
    } catch (err) {
      const message =
        err instanceof MigrationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'import failed.';
      setStatus({ tone: 'error', message });
    }
  };

  const handleClearCache = async () => {
    await clearAllQueryCache();
    setStatus({ tone: 'success', message: 'local query cache cleared. next fetch will be fresh.' });
  };

  const handleLogout = async () => {
    await logout();
    window.location.assign('/');
  };

  return (
    <SettingsSection
      id="data"
      title="data controls"
      description="your data is yours. take it with you."
    >
      <Stack gap="sm">
        <Group gap="sm" wrap="wrap">
          <Button variant="default" onClick={() => void handleExport()} disabled={!viewer}>
            export user data (json)
          </Button>
          <FileButton onChange={(file) => void handleImport(file)} accept="application/json">
            {(props) => (
              <Button variant="default" {...props} disabled={!viewer}>
                import user data (json)
              </Button>
            )}
          </FileButton>
          <Button variant="subtle" onClick={() => void handleClearCache()}>
            clear local cache
          </Button>
          <Button variant="subtle" color="red" onClick={() => void handleLogout()}>
            log out
          </Button>
        </Group>
        <Anchor href={REVOKE_URL} target="_blank" rel="noreferrer" size="sm">
          revoke gitInsights’ github authorization (opens github)
        </Anchor>
        {status ? (
          <Text size="sm" c={status.tone === 'success' ? 'dimmed' : 'red'}>
            {status.message}
          </Text>
        ) : null}
      </Stack>
    </SettingsSection>
  );
}
