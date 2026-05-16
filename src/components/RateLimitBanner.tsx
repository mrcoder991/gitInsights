import { Alert } from '@mantine/core';

import { useRateLimit } from '../hooks/useRateLimit';

function formatResetTime(resetAt: Date | null): string {
  if (!resetAt) return 'soon';
  return resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RateLimitBanner(): JSX.Element | null {
  const info = useRateLimit();
  if (!info) return null;

  return (
    <Alert
      color="primerYellow"
      variant="light"
      title="data may be stale — refreshing in background"
      role="status"
      aria-live="polite"
    >
      github rate-limited us. resets at {formatResetTime(info.resetAt)}.
      {' '}showing cached data — it'll update automatically once the limit lifts.
    </Alert>
  );
}
