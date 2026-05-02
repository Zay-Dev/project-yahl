import { useMemo } from "react";

import { RequestGroup } from "@/components/session/RequestGroup";
import { Badge } from "@/components/ui/badge";
import {
  groupEventsByRequestId,
  toLiveEvent,
} from "@/lib/session-events";
import type { SessionMetaSse, SessionStepSse } from "@/types";

type Props = {
  liveMeta: SessionMetaSse | null;
  liveSteps: SessionStepSse[];
  onOpenLiveRequestDetails: (requestId: string) => void;
};

export const LiveStreamPanel = ({
  liveMeta,
  liveSteps,
  onOpenLiveRequestDetails,
}: Props) => {
  const groups = useMemo(
    () => groupEventsByRequestId(liveSteps.map(toLiveEvent)),
    [liveSteps],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Live stream (SSE)</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">SSE: {liveMeta?.finalizedAt ? "closed" : "open"}</Badge>
          {liveMeta?.finalizedAt ? (
            <Badge variant="secondary">finalized {liveMeta.finalizedAt}</Badge>
          ) : null}
        </div>
      </div>

      {groups.length ? (
        <div className="space-y-2">
          {groups.map(([requestId, rows]) => (
            <RequestGroup
              key={requestId}
              onOpenDetails={() => onOpenLiveRequestDetails(requestId)}
              requestId={requestId}
              rows={rows}
              stepIndexLabel={(rowIndex) => liveSteps[rowIndex]?.stepIndex ?? rowIndex}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-slate-500 dark:text-slate-400">
          No live steps yet. Waiting for model usage events.
        </p>
      )}
    </div>
  );
};
