import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isRecord, stringifyValue } from "@/lib/format";
import {
  getRequestGlobalStage,
  getRequestSnapshot,
  type SessionEventGroup,
} from "@/lib/session-events";
import type {
  RerunRequestPayload,
  RuntimeRun,
  SessionStepEvent,
} from "@/types";

type Props = {
  groupedEvents: SessionEventGroup[];
  modalStep: { event: SessionStepEvent; index: number } | null;
  onClose: () => void;
  onForkSuccess: (created: RuntimeRun) => void;
  open: boolean;
  sessionId: string;
  submitRerun: (payload: RerunRequestPayload) => Promise<RuntimeRun | null>;
};

const parseJson = (raw: string, label: string) => {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) throw new Error();
    return value;
  } catch {
    throw new Error(`${label} must be a valid JSON object`);
  }
};

const resolveStageId = (event: SessionStepEvent | null) => {
  if (!event) return null;
  if (!isRecord(event.executionMeta)) return null;

  const stageId = event.executionMeta.stageId;
  if (typeof stageId !== "string" || !stageId.trim()) return null;
  return stageId;
};

export const RerunDraftDialog = ({
  groupedEvents,
  modalStep,
  onClose,
  onForkSuccess,
  open,
  sessionId,
  submitRerun,
}: Props) => {
  const [stage, setStage] = useState("");
  const [contextJson, setContextJson] = useState("{}");
  const [stageContextJson, setStageContextJson] = useState("{}");
  const [typesJson, setTypesJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestRows = modalStep
    ? groupedEvents.find(([id]) => id === modalStep.event.requestId)?.[1] ?? []
    : [];
  const globalStage = getRequestGlobalStage(requestRows);
  const globalStageEvent = globalStage?.event ?? modalStep?.event ?? null;
  const globalStageIndex = globalStage?.index ?? modalStep?.index ?? null;
  const snapshot = getRequestSnapshot(requestRows, globalStageEvent);
  const sourceStageId = resolveStageId(globalStageEvent);

  const requestKey = modalStep ? modalStep.event.requestId : null;

  useEffect(() => {
    if (!open || !snapshot) return;
    setError(null);
    setStage(snapshot.currentStage);
    setContextJson(stringifyValue(snapshot.context.context));
    setStageContextJson(stringifyValue(snapshot.context.stage));
    setTypesJson(stringifyValue(snapshot.context.types));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requestKey]);

  const onSubmit = async () => {
    if (!modalStep || globalStageIndex === null || !sourceStageId) {
      setError("Missing source request anchor");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const payload: RerunRequestPayload = {
        requestSnapshotOverride: {
          context: {
            context: parseJson(contextJson, "context.context"),
            stage: parseJson(stageContextJson, "context.stage"),
            types: parseJson(typesJson, "context.types"),
          },
          currentStage: stage,
        },
        sourceRequestId: modalStep.event.requestId,
        sourceSessionId: sessionId,
        sourceStageId,
      };

      const created = await submitRerun(payload);
      if (created) {
        onForkSuccess(created);
      }
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rerun request draft</DialogTitle>
          <DialogDescription>
            Forks into a new session and continues the pipeline from this request boundary.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto">
          <div className="space-y-1">
            <label className="text-xs font-medium">currentStage</label>
            <Textarea
              className="min-h-28 font-mono text-xs"
              onChange={(event) => setStage(event.target.value)}
              value={stage}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">context.context (JSON object)</label>
            <Textarea
              className="min-h-24 font-mono text-xs"
              onChange={(event) => setContextJson(event.target.value)}
              value={contextJson}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">context.stage (JSON object)</label>
            <Textarea
              className="min-h-24 font-mono text-xs"
              onChange={(event) => setStageContextJson(event.target.value)}
              value={stageContextJson}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">context.types (JSON object)</label>
            <Textarea
              className="min-h-24 font-mono text-xs"
              onChange={(event) => setTypesJson(event.target.value)}
              value={typesJson}
            />
          </div>

          {error ? <p className="text-xs text-red-500">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button disabled={submitting} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={submitting || !snapshot} onClick={() => void onSubmit()} size="sm">
            {submitting ? "Submitting..." : "Start fork rerun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
