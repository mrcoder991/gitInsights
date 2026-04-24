// Local-only sync activity log (spec §3.G "telemetry-free observability").
// We never ship these events anywhere; they exist so the user can self-
// diagnose without us collecting anything.

const STORAGE_KEY = 'gi.sync.log';
const RETENTION_MS = 24 * 60 * 60 * 1000;
// Hard cap as a backstop against a runaway push loop blowing up localStorage.
// 24h of normal activity stays well under this.
const HARD_CAP = 200;

export type SyncEventLevel = 'info' | 'warn' | 'error';

export type SyncEvent = {
  at: string;
  level: SyncEventLevel;
  message: string;
};

function prune(events: SyncEvent[], now = Date.now()): SyncEvent[] {
  const cutoff = now - RETENTION_MS;
  return events.filter((e) => new Date(e.at).getTime() >= cutoff).slice(0, HARD_CAP);
}

function readLog(): SyncEvent[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return prune(parsed as SyncEvent[]);
  } catch {
    return [];
  }
}

function writeLog(events: SyncEvent[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function appendSyncEvent(event: Omit<SyncEvent, 'at'>): SyncEvent[] {
  const next: SyncEvent = { ...event, at: new Date().toISOString() };
  const log = prune([next, ...readLog()]);
  writeLog(log);
  return log;
}

export function getSyncLog(): SyncEvent[] {
  return readLog();
}

export function clearSyncLog(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
