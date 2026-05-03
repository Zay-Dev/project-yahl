import type { StageExecutionMeta } from "../shared/transport";

import type { ResumeState } from "./orchestrator-types";
import { setContextValue, type RuntimeContext } from "./runtime";

export const applyResumeSnapshotIfNeeded = (
  runtime: RuntimeContext,
  resumeState?: ResumeState,
) => {
  if (!resumeState || resumeState.started || !resumeState.requestSnapshotOverride) return undefined;
  const resumeInput = resumeState.requestSnapshotOverride;

  runtime.set("context", { ...resumeInput.context.context });
  runtime.set("stage", { ...resumeInput.context.stage });
  runtime.set("types", { ...resumeInput.context.types });
  resumeState.started = true;

  return resumeInput;
};

export const primeResumeContextIfNeeded = (
  runtime: RuntimeContext,
  resumeState?: ResumeState,
) => {
  if (!resumeState || resumeState.started || !resumeState.requestSnapshotOverride) return;

  runtime.set("context", { ...resumeState.requestSnapshotOverride.context.context });
  runtime.set("stage", { ...resumeState.requestSnapshotOverride.context.stage });
  runtime.set("types", { ...resumeState.requestSnapshotOverride.context.types });
};

export const runSnapshotStageOnce = async (
  runtime: RuntimeContext,
  resumeState: ResumeState,
) => {
  if (!resumeState.requestSnapshotOverride || !resumeState.executionMeta) return;

  const {envelope} = await publisher.pushRequest(
    resumeState.requestSnapshotOverride.context,
    resumeState.requestSnapshotOverride.currentStage,
    resumeState.executionMeta,
  );
  resumeState.started = true;
  if (!Array.isArray(envelope)) return;

  envelope
    .filter((item) => item.type === "tool_call" && item.tool === "set_context")
    .forEach((item) => {
      setContextValue(
        runtime,
        item.arguments.scope === "types" ? "types" : "global",
        item.arguments.key,
        item.arguments.value,
        item.arguments.operation,
      );
    });
};

export const resolveResumeLoopStep = (line: string, loopRef: StageExecutionMeta["loopRef"]) => {
  const fromArrayExpr = line.match(/^\s*for each \w+ of \[(\w+)(,[+-]?(\d+))?\]/i);
  if (fromArrayExpr?.[2]) {
    return parseInt(fromArrayExpr[2].slice(1), 10);
  }
  if ((loopRef?.arraySnapshot || []).length >= 2) {
    return loopRef!.arraySnapshot[1] === 0 && loopRef!.arraySnapshot[0] === 1 ? -1 : 1;
  }
  return 1;
};
