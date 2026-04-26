import * as Comlink from 'comlink';

import {
  commitMomentum,
  type CommitMomentumInput,
  type MomentumResult,
} from '../analytics/diffDelta';

// Web Worker for Commit Momentum rollup. Pure: receives plain commit
// timestamps, returns totals. No React, no octokit, no network.

export type CommitMomentumApi = {
  computeCommitMomentum: (commits: CommitMomentumInput[], nowIso?: string) => MomentumResult;
};

const api: CommitMomentumApi = {
  computeCommitMomentum: (commits, nowIso) => {
    const now = nowIso ? new Date(nowIso) : new Date();
    return commitMomentum(commits, now);
  },
};

Comlink.expose(api);
