import type { StageSessionInput } from "../shared/stage-contract";
import type { StageExecutionMeta } from "../shared/transport";

import type { RuntimeContext } from "./runtime-types";

export interface CliForkedFrom {
  prefixDump: unknown[];
  requestId: string;
  sourceSessionId: string;
  stepIndex: number;
}

export interface CliResume {
  executionMeta: StageExecutionMeta;
  requestSnapshotOverride: StageSessionInput;
  sourceRequestId: string;
  sourceSessionId: string;
  stepIndex: number;
}

export interface CliOptions {
  agentContainerPrefix: string;
  composeProjectPrefix: string;
  forkedFrom?: CliForkedFrom;
  resume?: CliResume;
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
  pendingStageId: string | null;
  requestSnapshotOverride?: StageSessionInput;
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
  resumeState?: ResumeState,
) => Promise<{ runtime: RuntimeContext; stages: ParsedStage[] }>;
