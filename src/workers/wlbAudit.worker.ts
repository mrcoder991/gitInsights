import * as Comlink from 'comlink';

import { wlbAudit, type WlbCommitInput, type WlbResult } from '../analytics/wlb';
import type { OffDayContext } from '../analytics/offDay';
import type { StreakMode } from '../userData/schema';

// `OffDayContext` carries `Set` instances; structured cloning preserves them
// across the worker boundary so the rollup can rebuild them on the worker
// side without Set→Array→Set churn.
export type WlbAuditInput = {
  commits: WlbCommitInput[];
  byDate: Record<string, number>;
  ctx: {
    workdays: number[];
    ptoDates: string[];
    holidayDates: string[];
    overrideDates: string[];
  };
  streakMode: StreakMode;
};

export type WlbAuditApi = {
  computeWlbAudit: (input: WlbAuditInput) => WlbResult;
};

function inflate(input: WlbAuditInput): {
  byDate: Map<string, number>;
  ctx: OffDayContext;
} {
  const byDate = new Map(Object.entries(input.byDate));
  const ctx: OffDayContext = {
    workdays: new Set(input.ctx.workdays),
    ptoSet: new Set(input.ctx.ptoDates),
    holidaySet: new Set(input.ctx.holidayDates),
    overrideSet: new Set(input.ctx.overrideDates),
  };
  return { byDate, ctx };
}

const api: WlbAuditApi = {
  computeWlbAudit: (input) => {
    const { byDate, ctx } = inflate(input);
    return wlbAudit({
      commits: input.commits,
      byDate,
      ctx,
      streakMode: input.streakMode,
    });
  },
};

Comlink.expose(api);
