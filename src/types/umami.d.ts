interface UmamiTracker {
  track(event: string, data?: Record<string, string | number>): void;
  identify(data: Record<string, string | number>): void;
}

declare const umami: UmamiTracker | undefined;
