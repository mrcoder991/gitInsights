import { Anchor, Button, Group, Stack, Text } from '@mantine/core';
import { useState } from 'react';

import { clearAllQueryCache } from '../../api/queryClient';
import { useAuth } from '../../hooks/useAuth';
import { useSyncStore } from '../../sync';
import { ConfirmDialog } from './ConfirmDialog';
import { SettingsSection } from './SettingsSection';

const REVOKE_URL = 'https://github.com/settings/applications';

export function DataControlsSection(): JSX.Element {
  const { logout } = useAuth();
  const syncEnabled = useSyncStore((s) => s.enabled);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [pendingClearCache, setPendingClearCache] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);

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
      title="account"
      description="local cache, session, and the github authorization itself."
    >
      <Stack gap="sm">
        <Group gap="sm" wrap="wrap">
          <Button variant="outline" color="primerRed" onClick={() => setPendingClearCache(true)}>
            clear local cache
          </Button>
          <Button variant="filled" color="primerRed" onClick={() => setPendingLogout(true)}>
            log out
          </Button>
        </Group>
        <Anchor c="primerYellow" href={REVOKE_URL} target="_blank" rel="noreferrer" size="sm">
          revoke gitInsights’ github authorization (opens github)
        </Anchor>
        {status ? (
          <Text size="sm" c={status.tone === 'success' ? 'dimmed' : 'primerRed'}>
            {status.message}
          </Text>
        ) : null}
      </Stack>

      <ConfirmDialog
        opened={pendingClearCache}
        title="clear local cache?"
        body="drops the cached commit data, repo metadata, and computed analytics. next dashboard load hits github fresh. settings (theme, pto, holidays) stay."
        confirmLabel="clear cache"
        onCancel={() => setPendingClearCache(false)}
        onConfirm={() => {
          setPendingClearCache(false);
          void handleClearCache();
        }}
      />

      <ConfirmDialog
        opened={pendingLogout}
        title="log out?"
        body={
          syncEnabled
            ? 'wipes your session and local data on this device. sync is on, so your settings come back when you log in again. cloud copy stays on github.'
            : 'wipes your session and local data on this device. sync is off, so your settings (theme, pto, holidays, bento) will be gone. export first or turn on sync if you want them back.'
        }
        confirmLabel="log out"
        onCancel={() => setPendingLogout(false)}
        onConfirm={() => {
          setPendingLogout(false);
          void handleLogout();
        }}
      />
    </SettingsSection>
  );
}
