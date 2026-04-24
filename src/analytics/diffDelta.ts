// Spec §6 Diff Delta + EP. Pure functions, no React, no octokit. Reused by
// `diffDelta.worker.ts` and unit tests.

export type CommitInput = {
  oid?: string;
  authoredAt: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  isMerge: boolean;
  changedPaths?: string[];
};

const MERGE_PENALTY = 5;
const VENDOR_PENALTY_MULT = 0.9;
const VENDOR_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /(^|\/)dist\//,
  /\.lock$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
];

function vendorRatio(paths?: string[]): number {
  if (!paths || paths.length === 0) return 0;
  let hits = 0;
  for (const p of paths) {
    if (VENDOR_PATTERNS.some((rx) => rx.test(p))) hits += 1;
  }
  return hits / paths.length;
}

export function diffDelta(commit: CommitInput): number {
  const base = Math.log2(1 + commit.additions + commit.deletions) + 0.5 * commit.filesChanged;
  const merge = commit.isMerge ? MERGE_PENALTY : 0;
  const vendor = vendorRatio(commit.changedPaths) > 0.8 ? VENDOR_PENALTY_MULT : 1;
  const score = (base - merge) * vendor;
  return Math.max(0, score);
}

const ROLLING_WINDOW_DAYS = 365;

export function recencyWeight(authoredAt: string, now = new Date()): number {
  const t = new Date(authoredAt).getTime();
  const cutoff = now.getTime() - ROLLING_WINDOW_DAYS * 86400000;
  if (t < cutoff) return 0;
  const ageDays = (now.getTime() - t) / 86400000;
  const linear = 1 - (ageDays / ROLLING_WINDOW_DAYS) * 0.75;
  return Math.max(0.25, Math.min(1, linear));
}

export type EpResult = {
  total: number;
  perDay: Record<string, number>;
};

export function energyPoints(commits: CommitInput[], now = new Date()): EpResult {
  let total = 0;
  const perDay: Record<string, number> = {};
  for (const c of commits) {
    const w = recencyWeight(c.authoredAt, now);
    if (w <= 0) continue;
    const score = diffDelta(c) * w;
    total += score;
    const day = c.authoredAt.slice(0, 10);
    perDay[day] = (perDay[day] ?? 0) + score;
  }
  return { total, perDay };
}
