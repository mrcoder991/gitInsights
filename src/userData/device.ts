// Per-device identifier, generated lazily on first read and pinned to
// localStorage. Spec §3.G: never synced; used only as `lastWriterDeviceId`
// on writes and for the local sync log.

export const DEVICE_ID_STORAGE_KEY = 'gi.device.id';

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const fresh = generateDeviceId();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, fresh);
  return fresh;
}
