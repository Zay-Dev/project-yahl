import type { TAgentTracker } from "./index";

import { computeCost } from "@/orchestrator/pricing";

type PerModelTotals = {
  avgDurationMs: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  calls: number;
  completionTokens: number;
  cost: number;
  durationCalls: number;
  durationTotalMs: number;
  reasoningTokens: number;
};

const emptyRow = (): PerModelTotals => ({
  avgDurationMs: 0,
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  calls: 0,
  completionTokens: 0,
  cost: 0,
  durationCalls: 0,
  durationTotalMs: 0,
  reasoningTokens: 0,
});

export const createSessionTracker = () => {
  const byModel = new Map<string, PerModelTotals>();

  const track: TAgentTracker['track'] = (event) => {
    const { model, usage } = event;
    const row = byModel.get(model) ?? emptyRow();

    row.calls += 1;
    row.cacheHitTokens += usage.cacheHitTokens;
    row.cacheMissTokens += usage.cacheMissTokens;
    row.completionTokens += usage.completionTokens;
    row.reasoningTokens += usage.reasoningTokens;
    row.cost += computeCost(model, usage);
    if (typeof event.durationMs === "number") {
      row.durationCalls += 1;
      row.durationTotalMs += event.durationMs;
      row.avgDurationMs = row.durationTotalMs / row.durationCalls;
    }

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
    let durationTotalMs = 0;
    let durationCalls = 0;

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
      if (row.durationCalls > 0) {
        lines.push(
          `  latency: avg=${row.avgDurationMs.toFixed(2)}ms  calls=${row.durationCalls}`,
        );
      }
      lines.push(`  cost  :  $${row.cost.toFixed(5)}`);

      inHit += row.cacheHitTokens;
      inMiss += row.cacheMissTokens;
      inTotal += promptTotal;
      outTotal += row.completionTokens;
      outReason += row.reasoningTokens;
      outVisible += visible;
      costSum += row.cost;
      durationTotalMs += row.durationTotalMs;
      durationCalls += row.durationCalls;
    }

    lines.push("");
    lines.push("[Session totals]");
    lines.push(`  input  total = ${inTotal}  (cache_hit=${inHit}, cache_miss=${inMiss})`);
    lines.push(`  output total = ${outTotal}  (reasoning=${outReason}, visible=${outVisible})`);
    if (durationCalls > 0) {
      lines.push(`  latency avg  = ${(durationTotalMs / durationCalls).toFixed(2)}ms  (calls=${durationCalls})`);
    }
    lines.push(`  cost   total = $${costSum.toFixed(5)}`);

    return lines.join("\n");
  };

  const base = {
    track,
    reset: () => {
      byModel.clear();
    },
  } satisfies TAgentTracker;

  return {
    ...base,
    summaryText,
  };
};
