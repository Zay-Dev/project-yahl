import { ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EMPTY_VALUE, formatCost, formatNumber, truncateText } from "@/lib/format";
import type { SessionEventRow } from "@/lib/session-events";
import {
  getCurrentStageDisplay,
  getInputTokens,
  getRequestGlobalStage,
  isLoopStep,
} from "@/lib/session-events";

const STAGE_PREVIEW_LIMIT = 500;

type Props = {
  defaultOpen?: boolean;
  onOpenDetails: (firstRowIndex: number) => void;
  requestId: string;
  rows: SessionEventRow[];
  stepIndexLabel?: (rowIndex: number) => string | number;
};

export const RequestGroup = ({
  defaultOpen = true,
  onOpenDetails,
  requestId,
  rows,
  stepIndexLabel,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const globalStage = getRequestGlobalStage(rows);
  const globalStageEvent = globalStage?.event || rows[0]?.event;
  const sourceIndexLabel = stepIndexLabel
    ? stepIndexLabel(globalStage?.index ?? rows[0]?.index ?? 0)
    : globalStage?.index ?? rows[0]?.index ?? 0;

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex w-full items-center justify-between gap-2 bg-slate-50 px-2 py-1.5 text-xs dark:bg-slate-900">
        <button
          className="flex flex-1 cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => setOpen((prev) => !prev)}
          type="button"
        >
          <ChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="font-mono">{requestId}</span>
        </button>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">steps: {formatNumber(rows.length)}</Badge>
          <Button
            onClick={() => onOpenDetails(rows[0]?.index ?? 0)}
            size="xs"
            variant="outline"
          >
            <ExternalLink />
            Full details
          </Button>
        </div>
      </div>

      {open && globalStageEvent ? (
        <div className="space-y-2 p-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span>Current stage (request-global)</span>
                <Badge variant={isLoopStep(globalStageEvent) ? "default" : "outline"}>
                  {isLoopStep(globalStageEvent) ? "loop" : "non-loop"}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                source step #{sourceIndexLabel} · first {STAGE_PREVIEW_LIMIT} characters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="max-h-56 overflow-auto rounded border p-2 font-mono text-xs whitespace-pre-wrap">
                {truncateText(getCurrentStageDisplay(globalStageEvent), STAGE_PREVIEW_LIMIT)}
              </p>
            </CardContent>
          </Card>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">ms</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Tokens in</TableHead>
                <TableHead>Reply</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ event, index }) => (
                <TableRow key={`${event.requestId}-${index}`}>
                  <TableCell>{stepIndexLabel ? stepIndexLabel(index) : index}</TableCell>
                  <TableCell className="font-mono text-xs">{event.model}</TableCell>
                  <TableCell className="text-right">
                    {typeof event.response?.durationMs === "number"
                      ? formatNumber(event.response.durationMs)
                      : EMPTY_VALUE}
                  </TableCell>
                  <TableCell className="text-right">{formatCost(event.cost ?? 0)}</TableCell>
                  <TableCell className="text-right">{formatNumber(getInputTokens(event))}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs">
                    {event.response?.reply ?? EMPTY_VALUE}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
};
