import * as Comlink from 'comlink';
import { createStore, get, set } from 'idb-keyval';

import DiffDeltaWorker from './diffDelta.worker?worker';
import WlbAuditWorker from './wlbAudit.worker?worker';
import type { DiffDeltaApi } from './diffDelta.worker';
import type { WlbAuditApi, WlbAuditInput } from './wlbAudit.worker';
import type { CommitInput, EpResult } from '../analytics/diffDelta';
import type { WlbResult } from '../analytics/wlb';

// Comlink-wrapped worker handles + IndexedDB memoization (spec §3.E +
// Phase 5 task "Memoize results in IndexedDB"). Memo keys mix the inputs
// with the user-data versions the result depends on, so a PTO change
// invalidates only the slices that care.

const memoStore = createStore('gi.worker-memo', 'kv');

let diffDelta: Comlink.Remote<DiffDeltaApi> | null = null;
let wlbAuditClient: Comlink.Remote<WlbAuditApi> | null = null;

function getDiffDelta(): Comlink.Remote<DiffDeltaApi> {
  if (!diffDelta) diffDelta = Comlink.wrap<DiffDeltaApi>(new DiffDeltaWorker());
  return diffDelta;
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

export type EpJobInput = {
  userId: string;
  commits: CommitInput[];
  shaRange: string;
  workweekVersion: number;
  ptoVersion: number;
  holidaysVersion: number;
};

export async function runEnergyPoints(input: EpJobInput): Promise<EpResult> {
  const cacheKey = `ep:${input.userId}:${input.shaRange}:ww${input.workweekVersion}:pto${input.ptoVersion}:hol${input.holidaysVersion}`;
  return memo(cacheKey, async () => {
    const api = getDiffDelta();
    return api.computeEnergyPoints(input.commits);
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
