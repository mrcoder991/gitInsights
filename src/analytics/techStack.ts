// Spec §6 Tech Stack. Aggregate languages by bytes across the user's owned +
// contributed repos for the trailing 12 months. Long tail collapses into
// "Other".

export type RepoLanguageNode = {
  nameWithOwner: string;
  pushedAt: string;
  languages: {
    edges: Array<{
      size: number;
      node: { name: string; color: string | null };
    }>;
  };
};

export type LanguageSlice = {
  name: string;
  color: string | null;
  bytes: number;
  share: number;
};

const TWELVE_MONTHS_MS = 365 * 86400000;

export function aggregateTechStack(
  repos: RepoLanguageNode[],
  args?: { topN?: number; now?: Date },
): LanguageSlice[] {
  const topN = args?.topN ?? 6;
  const now = args?.now ?? new Date();
  const cutoff = now.getTime() - TWELVE_MONTHS_MS;

  const totals = new Map<string, { bytes: number; color: string | null }>();
  for (const repo of repos) {
    if (new Date(repo.pushedAt).getTime() < cutoff) continue;
    for (const edge of repo.languages.edges) {
      const existing = totals.get(edge.node.name) ?? { bytes: 0, color: edge.node.color };
      existing.bytes += edge.size;
      existing.color = existing.color ?? edge.node.color;
      totals.set(edge.node.name, existing);
    }
  }

  const entries = [...totals.entries()].sort(([, a], [, b]) => b.bytes - a.bytes);
  const totalBytes = entries.reduce((sum, [, v]) => sum + v.bytes, 0);
  if (totalBytes === 0) return [];

  const top = entries.slice(0, topN);
  const tail = entries.slice(topN);
  const slices: LanguageSlice[] = top.map(([name, v]) => ({
    name,
    color: v.color,
    bytes: v.bytes,
    share: v.bytes / totalBytes,
  }));
  if (tail.length > 0) {
    const otherBytes = tail.reduce((sum, [, v]) => sum + v.bytes, 0);
    slices.push({
      name: 'Other',
      color: null,
      bytes: otherBytes,
      share: otherBytes / totalBytes,
    });
  }
  return slices;
}
