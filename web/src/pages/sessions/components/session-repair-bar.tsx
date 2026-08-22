import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useSessionRepair } from "@/pages/sessions/hooks/session-repair-context";
import { createRepairSession } from "@/pages/sessions/lib/sessions-api";

const REPAIR_INSTRUCTION_MAX_LENGTH = 4096;

type TSessionRepairBarProps = {
  sessionId: string;
};

export function SessionRepairBar({ sessionId }: TSessionRepairBarProps) {
  const navigate = useNavigate();
  const {
    anchorRequestId,
    anchorStageId,
    barOpen,
    barRef,
    clearValidationError,
    closeRepairBar,
    instruction,
    setInstruction,
    setValidationError,
    textareaRef,
    validationError,
  } = useSessionRepair();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!barOpen || !anchorStageId) {
    return null;
  }

  const trimmedLength = instruction.trim().length;

  const handleStartRepair = async () => {
    const trimmed = instruction.trim();

    if (!trimmed) {
      setValidationError("Paste a repair instruction before starting.");
      textareaRef.current?.focus();
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const result = await createRepairSession(sessionId, {
        anchorStageId,
        instruction: trimmed,
      });

      closeRepairBar();
      navigate(`/sessions/${encodeURIComponent(result.targetSessionId)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Repair failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`sticky top-0 z-20 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 ${
        validationError ? "border-destructive" : ""
      }`}
      ref={barRef}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Repair instruction</p>
          <p className="text-xs text-muted-foreground">
            Copy from stage history below, paste here, then start repair.
          </p>
          {anchorRequestId ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Anchor: {anchorRequestId}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="font-mono text-xs text-muted-foreground">
            {trimmedLength}/{REPAIR_INSTRUCTION_MAX_LENGTH}
          </p>
          <Button
            onClick={closeRepairBar}
            size="sm"
            type="button"
            variant="ghost"
          >
            Close
          </Button>
        </div>
      </div>
      <textarea
        className="mt-3 min-h-28 w-full rounded-md border bg-background p-3 font-mono text-xs"
        maxLength={REPAIR_INSTRUCTION_MAX_LENGTH}
        onChange={(event) => setInstruction(event.target.value)}
        onFocus={clearValidationError}
        placeholder="Paste ad-hoc repair instructions for the agent…"
        ref={textareaRef}
        spellCheck={false}
        value={instruction}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {validationError ? (
            <p className="text-sm text-destructive">{validationError}</p>
          ) : null}
          {!validationError && trimmedLength === 0 ? (
            <p className="text-xs text-muted-foreground">
              Instruction required before starting a repair run.
            </p>
          ) : null}
          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
        </div>
        <Button
          disabled={submitting || trimmedLength === 0}
          onClick={() => void handleStartRepair()}
          size="sm"
          type="button"
        >
          {submitting ? "Starting repair…" : "Start repair"}
        </Button>
      </div>
    </div>
  );
}
