import { useEffect, useState } from 'react';

import type { GitHubErrorKind } from '../api/errors';
import { getLastRateLimit, subscribeRateLimit } from '../api/events';

type RateLimitInfo = Extract<GitHubErrorKind, { kind: 'rate-limit' }>;

const NULL_INFO: RateLimitInfo = { kind: 'rate-limit', resetAt: null, remaining: null };

function isActive(info: RateLimitInfo | null): boolean {
  if (!info) return false;
  if (info.resetAt && info.resetAt.getTime() <= Date.now()) return false;
  if (info.resetAt === null && info.remaining === null) return false;
  return true;
}

export function useRateLimit(): RateLimitInfo | null {
  const [info, setInfo] = useState<RateLimitInfo | null>(() => getLastRateLimit());

  useEffect(() => {
    return subscribeRateLimit((next) => {
      setInfo(next === NULL_INFO ? null : next);
    });
  }, []);

  useEffect(() => {
    if (!info?.resetAt) return;
    const ms = info.resetAt.getTime() - Date.now();
    if (ms <= 0) {
      setInfo(null);
      return;
    }
    const handle = window.setTimeout(() => setInfo(null), ms + 1000);
    return () => window.clearTimeout(handle);
  }, [info]);

  return isActive(info) ? info : null;
}
