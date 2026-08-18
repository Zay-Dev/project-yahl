import type { TResponseStageDetail, TResponseStageListItem, TSessionLiveEvent } from "@project-yahl/server/modules/sessions/-api-types";
import type { TParsedStage } from "@project-yahl/server/modules/sessions/-types";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StageDetailPanel } from "@/pages/sessions/components/stage-detail-panel";
import { TokenStatsRow } from "@/pages/sessions/components/token-stats-row";
import { fetchWithConcurrency } from "@/pages/sessions/lib/fetch-with-concurrency";
import { fetchSessionStageDetail } from "@/pages/sessions/lib/sessions-api";
import { buildStageLabels } from "@/pages/sessions/lib/stage-label";
import {
  formatElapsedMs,
  resolveCurrentStage,
  resolveStageElapsed,
} from "@/pages/sessions/lib/stage-live-status";
import { summarizeValue } from "@/pages/sessions/lib/tool-call-parse";

type TSessionTimelineProps = {
  error: string | null;
  isLoading: boolean;
  lastEvent: TSessionLiveEvent | null;
  originalStages: TParsedStage[];
  sessionId: string;
  stages: TResponseStageListItem[];
  startingRun?: boolean;
};

const StatusBadge = ({ label, value }: { label: string; value: string }) => (
  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
    <span className="text-muted-foreground">{label}</span>{" "}
    <span className="font-mono">{value}</span>
  </span>
);

const DETAIL_FETCH_CONCURRENCY = 5;

const statusClass = (status: TResponseStageListItem["status"]) => {
  if (status === "finished") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "verifying") {
    return "bg-violet-500/15 text-violet-800 dark:text-violet-200";
  }

  return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
};

const needsDetailRefresh = (event: TSessionLiveEvent) => {
  return event.type === 'stage.finished'
    || event.type === 'stage.model-response'
    || event.type === 'stage.tool-call';
};

type TStageRowProps = {
  baselineAfter?: Record<string, unknown>;
  detail: TResponseStageDetail | null;
  detailError: string | null;
  detailLoading: boolean;
  item: TResponseStageListItem;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  originalStages: TParsedStage[];
  sessionId: string;
  stageLabel: string;
};

const StageRow = ({
  baselineAfter,
  detail,
  detailError,
  detailLoading,
  item,
  onOpenChange,
  open,
  originalStages,
  sessionId,
  stageLabel,
}: TStageRowProps) => (
  <Collapsible
    className="rounded-lg border bg-background"
    onOpenChange={onOpenChange}
    open={open}
  >
    <CollapsibleTrigger className="flex w-full flex-col gap-2 p-3 text-left sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
            {stageLabel}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`}
          >
            {item.status}
          </span>
          {item.loopValue !== undefined ? (
            <span className="font-mono text-xs text-muted-foreground">
              {summarizeValue(item.loopValue, 40)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{item.requestId}</p>
        <p className="mt-1 line-clamp-5 text-sm whitespace-pre-wrap">
          {item.logicPreview || "—"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{item.modelCallCount} model</span>
          <span>{item.toolCallCount} tools</span>
        </div>
        <TokenStatsRow byModel={item.byModel} domains={item.domains} totals={item.tokenTotals} />
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      {detailLoading && !detail ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">Loading stage…</p>
      ) : null}
      {detailError ? (
        <p className="border-t px-4 py-3 text-sm text-destructive">{detailError}</p>
      ) : null}
      {detail ? (
        <StageDetailPanel
          baselineAfter={baselineAfter}
          detail={detail}
          originalStages={originalStages}
          sessionId={sessionId}
        />
      ) : null}
    </CollapsibleContent>
  </Collapsible>
);

export function SessionTimeline({
  error,
  isLoading,
  lastEvent,
  originalStages,
  sessionId,
  stages,
  startingRun = false,
}: TSessionTimelineProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [details, setDetails] = useState<Map<string, TResponseStageDetail>>(() => new Map());
  const [detailErrors, setDetailErrors] = useState<Map<string, string>>(() => new Map());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const detailsRef = useRef(details);
  const inFlightRef = useRef<Set<string>>(new Set());
  const lastProcessedEventRef = useRef<TSessionLiveEvent | null>(null);
  const loadingIdsRef = useRef(loadingIds);
  const openIdsRef = useRef(openIds);

  detailsRef.current = details;
  loadingIdsRef.current = loadingIds;
  openIdsRef.current = openIds;

  const loadDetail = useCallback(
    async (requestId: string, options?: { force?: boolean }) => {
      if (inFlightRef.current.has(requestId)) {
        return;
      }

      if (
        !options?.force
        && (detailsRef.current.has(requestId) || loadingIdsRef.current.has(requestId))
      ) {
        return;
      }

      inFlightRef.current.add(requestId);
      setLoadingIds((current) => new Set(current).add(requestId));
      setDetailErrors((current) => {
        const next = new Map(current);

        next.delete(requestId);

        return next;
      });

      try {
        const next = await fetchSessionStageDetail(sessionId, requestId);

        setDetails((current) => new Map(current).set(requestId, next));
      } catch (loadError) {
        setDetailErrors((current) => new Map(current).set(
          requestId,
          loadError instanceof Error ? loadError.message : "Failed to load stage detail",
        ));
      } finally {
        inFlightRef.current.delete(requestId);
        setLoadingIds((current) => {
          const next = new Set(current);

          next.delete(requestId);

          return next;
        });
      }
    },
    [sessionId],
  );

  useEffect(() => {
    openIds.forEach((requestId) => {
      if (!detailsRef.current.has(requestId) && !loadingIdsRef.current.has(requestId)) {
        void loadDetail(requestId);
      }
    });
  }, [loadDetail, openIds]);

  useEffect(() => {
    if (!lastEvent || !needsDetailRefresh(lastEvent)) {
      return;
    }

    if (lastProcessedEventRef.current === lastEvent) {
      return;
    }

    lastProcessedEventRef.current = lastEvent;

    const requestId = lastEvent.requestId;

    if (!openIdsRef.current.has(requestId)) {
      return;
    }

    void loadDetail(requestId, { force: true });
  }, [lastEvent, loadDetail]);

  const allOpen = stages.length > 0 && openIds.size === stages.length;

  const handleExpandAll = async () => {
    const ids = stages.map((stage) => stage.requestId);

    setOpenIds(new Set(ids));

    const missing = ids.filter((id) => !details.has(id));

    if (missing.length === 0) {
      return;
    }

    setBulkLoading(true);

    try {
      const fetched = await fetchWithConcurrency(
        missing,
        DETAIL_FETCH_CONCURRENCY,
        (requestId) => fetchSessionStageDetail(sessionId, requestId),
      );

      setDetails((current) => {
        const next = new Map(current);

        fetched.forEach((detail, requestId) => {
          next.set(requestId, detail);
        });

        return next;
      });
    } catch {
      await Promise.all(missing.map((requestId) => loadDetail(requestId)));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCollapseAll = () => {
    setOpenIds(new Set());
  };

  const stageLabels = useMemo(() => buildStageLabels(stages), [stages]);
  const hasLiveStage = stages.some((item) => item.status !== "finished");

  useEffect(() => {
    if (!hasLiveStage) {
      return;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasLiveStage]);

  const currentStage = resolveCurrentStage(stages);
  const currentElapsed = currentStage
    ? resolveStageElapsed(currentStage.stage, nowMs)
    : null;

  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">Execution timeline</p>
      {stages.length > 0 ? (
        <div className="sticky top-0 z-20 -mx-4 mt-3 flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/95 px-4 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-muted/80">
          <Button
            disabled={bulkLoading || allOpen}
            onClick={() => void handleExpandAll()}
            size="sm"
            type="button"
            variant="outline"
          >
            {bulkLoading ? "Expanding…" : "Expand all"}
          </Button>
          <Button
            disabled={openIds.size === 0}
            onClick={handleCollapseAll}
            size="sm"
            type="button"
            variant="outline"
          >
            Collapse all
          </Button>
          {currentStage ? (
            <>
              <StatusBadge
                label="stage"
                value={stageLabels[currentStage.index] ?? `#${currentStage.index + 1}`}
              />
              <StatusBadge
                label="calls"
                value={String(currentStage.stage.modelCallCount)}
              />
              {currentElapsed ? (
                <StatusBadge
                  label="elapsed"
                  value={`${formatElapsedMs(currentElapsed.currentMs)}/${formatElapsedMs(currentElapsed.totalMs)}`}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {isLoading ? <p className="mt-3 text-sm">Loading stages…</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {!isLoading && !error && stages.length === 0 && startingRun ? (
        <p className="mt-3 text-sm text-muted-foreground">Starting run…</p>
      ) : null}
      {!isLoading && !error && stages.length === 0 && !startingRun ? (
        <p className="mt-3 text-sm text-muted-foreground">No stages recorded yet.</p>
      ) : null}
      <div className="mt-4 space-y-2">
        {stages.map((item, index) => {
          const prevRequestId = index > 0 ? stages[index - 1]?.requestId : undefined;

          return (
          <StageRow
            baselineAfter={
              prevRequestId ? details.get(prevRequestId)?.contextAfter : undefined
            }
            detail={details.get(item.requestId) ?? null}
            detailError={detailErrors.get(item.requestId) ?? null}
            detailLoading={loadingIds.has(item.requestId)}
            item={item}
            key={item.requestId}
            originalStages={originalStages}
            sessionId={sessionId}
            stageLabel={stageLabels[index] ?? `#${index + 1}`}
            onOpenChange={(next) => {
              setOpenIds((current) => {
                const updated = new Set(current);

                if (next) {
                  updated.add(item.requestId);

                  if (prevRequestId) {
                    void loadDetail(prevRequestId);
                  }
                } else {
                  updated.delete(item.requestId);
                }

                return updated;
              });
            }}
            open={openIds.has(item.requestId)}
          />
          );
        })}
      </div>
    </div>
  );
};
