import type { StageContextPayload, StageSessionInput } from "../shared/stage-contract";
import type { YahlStage } from "../shared/yahl-stage";
import type { StageExecutionMeta } from "../shared/transport";

import type { RuntimeContext } from "./runtime-types";

export type RerunPrefixSnapshot = {
  contextAfter?: unknown;
  contextBefore?: unknown;
  executionMeta?: unknown;
  stage?: YahlStage;
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
  indexName?: string;
  temperature?: number;
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
  contextKeys?: string[];
  lines: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  sourceStartLine: number;
  spec: YahlStage;
  temperature?: number;
  type: "loop" | "plain";
  updateContextKeys?: string[];
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
