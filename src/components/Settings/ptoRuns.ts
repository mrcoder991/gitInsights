import dayjs from 'dayjs';

import type { PtoEntry, PtoKind } from '../../userData';

export type PtoRun = {
  start: string;
  end: string;
  entries: PtoEntry[];
};

function normalizeKind(entry: PtoEntry): PtoKind {
  return entry.kind ?? 'vacation';
}

function normalizeLabel(entry: PtoEntry): string {
  return (entry.label ?? '').trim();
}

function sameRunMeta(a: PtoEntry, b: PtoEntry): boolean {
  return normalizeKind(a) === normalizeKind(b) && normalizeLabel(a) === normalizeLabel(b);
}

/** `entries` must be sorted ascending by `date` (ISO). */
export function groupPtoIntoRuns(sortedAsc: PtoEntry[]): PtoRun[] {
  if (sortedAsc.length === 0) return [];
  const runs: PtoRun[] = [];
  let chunk: PtoEntry[] = [sortedAsc[0] as PtoEntry];

  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = sortedAsc[i - 1] as PtoEntry;
    const cur = sortedAsc[i] as PtoEntry;
    const nextDay = dayjs(prev.date).add(1, 'day').format('YYYY-MM-DD');
    const consecutive = cur.date === nextDay;
    if (consecutive && sameRunMeta(prev, cur)) {
      chunk.push(cur);
    } else {
      runs.push(finishRun(chunk));
      chunk = [cur];
    }
  }
  runs.push(finishRun(chunk));
  return runs;
}

function finishRun(entries: PtoEntry[]): PtoRun {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0] as PtoEntry;
  const last = sorted[sorted.length - 1] as PtoEntry;
  return {
    start: first.date,
    end: last.date,
    entries: sorted,
  };
}

export function formatPtoDateSpan(start: string, end: string): string {
  const a = dayjs(start);
  const b = dayjs(end);
  if (start === end) {
    return a.format('MMM D, YYYY');
  }
  const sameYear = a.year() === b.year();
  const left = sameYear ? a.format('MMM D') : a.format('MMM D, YYYY');
  return `${left} – ${b.format('MMM D, YYYY')}`;
}
