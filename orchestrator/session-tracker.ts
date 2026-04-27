import type { StageTokenTrace } from "../shared/transport";

import { computeCost } from "./pricing";

export type PerModelTotals = {
  cacheHitTokens: number;
  cacheMissTokens: number;
  calls: number;
  completionTokens: number;
  cost: number;
  reasoningTokens: number;
};

const emptyRow = (): PerModelTotals => ({
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  calls: 0,
  completionTokens: 0,
  cost: 0,
  reasoningTokens: 0,
});

export type SessionTracker = {
  recordUsage: (event: StageTokenTrace) => void;
  summaryText: (sessionId: string) => string;
};

export const createSessionTracker = (): SessionTracker => {
  const byModel = new Map<string, PerModelTotals>();

  const recordUsage = (event: StageTokenTrace) => {
    const { model, usage } = event;
    const row = byModel.get(model) ?? emptyRow();

    row.calls += 1;
    row.cacheHitTokens += usage.cacheHitTokens;
    row.cacheMissTokens += usage.cacheMissTokens;
    row.completionTokens += usage.completionTokens;
    row.reasoningTokens += usage.reasoningTokens;
    row.cost += computeCost(model, usage);

    byModel.set(model, row);
  };

  const summaryText = (sessionId: string) => {
    const lines: string[] = [];

    lines.push(`[Session ${sessionId} usage]`);

    let inHit = 0;
    let inMiss = 0;
    let inTotal = 0;
    let outTotal = 0;
    let outReason = 0;
    let outVisible = 0;
    let costSum = 0;

    const sorted = [...byModel.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [model, row] of sorted) {
      const promptTotal = row.cacheHitTokens + row.cacheMissTokens;
      const visible = Math.max(0, row.completionTokens - row.reasoningTokens);

      lines.push(`model=${model}  calls=${row.calls}`);
      lines.push(
        `  input :  cache_hit=${row.cacheHitTokens}   cache_miss=${row.cacheMissTokens}   total=${promptTotal}`,
      );
      lines.push(
        `  output:  reasoning=${row.reasoningTokens}    visible=${visible}      total=${row.completionTokens}`,
      );
      lines.push(`  cost  :  $${row.cost.toFixed(5)}`);

      inHit += row.cacheHitTokens;
      inMiss += row.cacheMissTokens;
      inTotal += promptTotal;
      outTotal += row.completionTokens;
      outReason += row.reasoningTokens;
      outVisible += visible;
      costSum += row.cost;
    }

    lines.push("");
    lines.push("[Session totals]");
    lines.push(`  input  total = ${inTotal}  (cache_hit=${inHit}, cache_miss=${inMiss})`);
    lines.push(`  output total = ${outTotal}  (reasoning=${outReason}, visible=${outVisible})`);
    lines.push(`  cost   total = $${costSum.toFixed(5)}`);

    return lines.join("\n");
  };

  return {
    recordUsage,
    summaryText,
  };
};
