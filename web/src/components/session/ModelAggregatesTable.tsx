import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCost, formatNumber } from "@/lib/format";
import type { SessionDetail } from "@/types";

export const ModelAggregatesTable = ({ detail }: { detail: SessionDetail | null }) => {
  const rows = detail
    ? Object.entries(detail.modelAggregates || {}).sort((a, b) => a[0].localeCompare(b[0]))
    : [];

  if (!rows.length) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-sm text-slate-500 dark:text-slate-400">
        No model usage yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          <TableHead className="text-right">Calls</TableHead>
          <TableHead className="text-right">Input</TableHead>
          <TableHead className="text-right">Output</TableHead>
          <TableHead className="text-right">Cost</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map(([model, row]) => (
          <TableRow key={model}>
            <TableCell className="font-mono text-xs">{model}</TableCell>
            <TableCell className="text-right">{formatNumber(row.calls)}</TableCell>
            <TableCell className="text-right">
              {formatNumber(row.cacheHitTokens + row.cacheMissTokens)}
            </TableCell>
            <TableCell className="text-right">{formatNumber(row.completionTokens)}</TableCell>
            <TableCell className="text-right">{formatCost(row.cost)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
