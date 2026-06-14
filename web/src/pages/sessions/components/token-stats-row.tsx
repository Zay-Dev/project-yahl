import type { TResponseTokenTotals } from "@project-yahl/server/modules/sessions/-api-types";

type TTokenStatsRowProps = {
  compact?: boolean;
  totals: TResponseTokenTotals | null;
};

const TokenChip = ({
  compact,
  label,
  value,
}: {
  compact?: boolean;
  label: string;
  value: number;
}) => (
  <span
    className={
      compact
        ? "inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-xs"
        : "rounded-lg border bg-background px-2 py-1 text-xs"
    }
  >
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
  </span>
);

export function TokenStatsRow({ compact = true, totals }: TTokenStatsRowProps) {
  if (!totals) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "gap-2"}`}>
      <TokenChip compact={compact} label="Input" value={totals.promptTokens} />
      <TokenChip compact={compact} label="Cached" value={totals.cacheHitTokens} />
      <TokenChip compact={compact} label="Uncached" value={totals.cacheMissTokens} />
      <TokenChip compact={compact} label="Output" value={totals.completionTokens} />
      {totals.reasoningTokens > 0 ? (
        <TokenChip compact={compact} label="Reasoning" value={totals.reasoningTokens} />
      ) : null}
      {!compact ? (
        <TokenChip compact={compact} label="Total" value={totals.totalTokens} />
      ) : null}
    </div>
  );
}
