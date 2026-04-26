import * as Comlink from 'comlink';
import { createStore, get, set } from 'idb-keyval';

import CommitMomentumWorker from './commitMomentum.worker?worker';
import WlbAuditWorker from './wlbAudit.worker?worker';
import type { CommitMomentumApi } from './commitMomentum.worker';
import type { WlbAuditApi, WlbAuditInput } from './wlbAudit.worker';
import type { CommitMomentumInput, MomentumResult } from '../analytics/diffDelta';
import type { WlbResult } from '../analytics/wlb';

// Comlink-wrapped worker handles + IndexedDB memoization (spec §3.E +
// Phase 5 task "Memoize results in IndexedDB"). Memo keys mix the inputs
// with the user-data versions the result depends on, so a PTO change
// invalidates only the slices that care.

const memoStore = createStore('gi.worker-memo', 'kv');

let commitMomentumClient: Comlink.Remote<CommitMomentumApi> | null = null;
let wlbAuditClient: Comlink.Remote<WlbAuditApi> | null = null;

function getCommitMomentumWorker(): Comlink.Remote<CommitMomentumApi> {
  if (!commitMomentumClient) {
    commitMomentumClient = Comlink.wrap<CommitMomentumApi>(new CommitMomentumWorker());
  }
  return commitMomentumClient;
}

function getWlbAudit(): Comlink.Remote<WlbAuditApi> {
  if (!wlbAuditClient) wlbAuditClient = Comlink.wrap<WlbAuditApi>(new WlbAuditWorker());
  return wlbAuditClient;
}

async function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = await get<T>(key, memoStore).catch(() => undefined);
  if (cached !== undefined) return cached;
  const value = await fn();
  await set(key, value, memoStore).catch(() => undefined);
  return value;
}

export type CommitMomentumJobInput = {
  userId: string;
  commits: CommitMomentumInput[];
  shaRange: string;
  workweekVersion: number;
  ptoVersion: number;
  holidaysVersion: number;
};

export async function runCommitMomentum(input: CommitMomentumJobInput): Promise<MomentumResult> {
  const cacheKey = `momentum:${input.userId}:${input.shaRange}:ww${input.workweekVersion}:pto${input.ptoVersion}:hol${input.holidaysVersion}`;
  return memo(cacheKey, async () => {
    const api = getCommitMomentumWorker();
    return api.computeCommitMomentum(input.commits);
  });
}

export type WlbJobInput = WlbAuditInput & {
  userId: string;
  shaRange: string;
  workweekVersion: number;
  ptoVersion: number;
  holidaysVersion: number;
  streakModeVersion: number;
};

export async function runWlbAudit(input: WlbJobInput): Promise<WlbResult> {
  const cacheKey = `wlb:${input.userId}:${input.shaRange}:ww${input.workweekVersion}:pto${input.ptoVersion}:hol${input.holidaysVersion}:sm${input.streakModeVersion}`;
  return memo(cacheKey, async () => {
    const api = getWlbAudit();
    return api.computeWlbAudit(input);
  });
}
