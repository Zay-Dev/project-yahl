import type { StageContextPayload, StageSessionInput } from "../shared/stage-contract";
import type { StageExecutionMeta } from "../shared/transport";

import type { RuntimeContext } from "./runtime-types";

export type RerunPrefixSnapshot = {
  contextAfter?: unknown;
  contextBefore?: unknown;
  currentStage?: string;
  executionMeta?: unknown;
  stageIndex: number;
};

export interface CliForkedFrom {
  prefixDump?: unknown[];
  prefixSnapshots?: RerunPrefixSnapshot[];
  requestId: string;
  sourceSessionId: string;
  stepIndex: number;
}

export interface CliResume {
  forkrunFormId?: string;
  sourceRequestId: string;
  sourceSessionId: string;
  sourceStageId: string;
  stepIndex: number;
}

export interface CliOptions {
  agentContainerPrefix: string;
  composeProjectPrefix: string;
  resume?: CliResume;
  resumeAskUserRecoveryPath?: string;
  sessionId: string;
  taskId: string;
  taskPath: string;
}

export interface StageLoopMeta {
  arraySnapshot: unknown[];
  index: number;
  value: unknown;
}

export interface ResumeState {
  executionMeta?: StageExecutionMeta;
  logicalStepCursor?: number;
  pendingStageId: string | null;
  prefixSnapshots?: RerunPrefixSnapshot[];
  requestSnapshotOverride?: StageSessionInput;
  resumeFromStepIndex?: number;
  started: boolean;
}

export interface StagePosition {
  generatedLine: number;
  sourceLine: number;
}

export interface ParsedStage {
  lines: string;
  sourceStartLine: number;
  type: "loop" | "plain";
}

export interface LoopKnowledgeIssue {
  count: number;
  lastSolution: string;
  solved: boolean;
}

export interface LoopKnowledge {
  issues: Record<string, LoopKnowledgeIssue>;
  notes: string[];
}

export interface LoopKnowledgeUpdate {
  issue: string;
  note?: string;
  solution?: string;
  solved?: boolean;
}

export interface ComposeUpOptions {
  composeProjectName: string;
  onecliOverrideFilePath?: string;
}

export type StageExecuteFn = (
  text: string,
  stageContext: Record<string, unknown>,
  seedTypes: Record<string, unknown>,
  sourceFilePath: string,
  sourceBaseLine: number,
  loopMeta?: StageLoopMeta,
  resumeHydrate?: StageContextPayload,
) => Promise<{ runtime: RuntimeContext; stages: ParsedStage[] }>;
