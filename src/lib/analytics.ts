// Thin wrapper around the Umami global. In local dev the script tag is stripped
// from index.html so `umami` is never defined — every call here is a safe no-op.

function getUmami(): UmamiTracker | undefined {
  return typeof umami !== 'undefined' ? umami : undefined;
}

export function trackEvent(event: string, data?: Record<string, string | number>): void {
  getUmami()?.track(event, data);
}

export function identifyUser(login: string): void {
  getUmami()?.identify({ id: login });
}
