import type { TResponseTokenTotals } from "@project-yahl/server/modules/sessions/-api-types";

type TTokenStatsRowProps = {
  compact?: boolean;
  domains?: string[];
  totals: TResponseTokenTotals | null;
};

const TokenChip = ({
  compact,
  label,
  value,
}: {
  compact?: boolean;
  label: string;
  value: number | string;
}) => (
  <span
    className={
      compact
        ? "inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-xs"
        : "rounded-lg border bg-background px-2 py-1 text-xs"
    }
  >
    <span className="text-muted-foreground">{label}</span>
    <span className={typeof value === "number" ? "font-medium tabular-nums" : "font-medium"}>
      {typeof value === "number" ? value.toLocaleString() : value}
    </span>
  </span>
);

export function TokenStatsRow({ compact = true, domains, totals }: TTokenStatsRowProps) {
  const hosts = (domains ?? [])
    .map((domain) => domain.trim())
    .filter((domain) => domain.length > 0);

  if (!totals && hosts.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "gap-2"}`}>
      {hosts.map((host) => (
        <TokenChip compact={compact} key={host} label="Domain" value={host} />
      ))}
      {totals ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}
