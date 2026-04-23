import * as Comlink from 'comlink';

import { energyPoints, type CommitInput, type EpResult } from '../analytics/diffDelta';

// Web Worker for the EP / Diff Delta rollup. Pure: receives plain commit
// arrays, returns plain numbers. No React, no octokit, no network.

export type DiffDeltaApi = {
  computeEnergyPoints: (commits: CommitInput[], nowIso?: string) => EpResult;
};

const api: DiffDeltaApi = {
  computeEnergyPoints: (commits, nowIso) => {
    const now = nowIso ? new Date(nowIso) : new Date();
    return energyPoints(commits, now);
  },
};

Comlink.expose(api);
