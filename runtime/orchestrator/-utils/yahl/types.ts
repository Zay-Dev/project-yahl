import type { YahlStage } from "@/shared/yahl-stage";

export interface StageLoopMeta {
  arraySnapshot: unknown[];
  index: number;
  indexName?: string;
  kind?: "warmup" | "for" | "while";
  remainingBashCalls?: number;
  remainingTurns?: number;
  temperature?: number;
  value: unknown;
}

export interface ParsedStage {
  contextKeys?: string[];
  lines: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  sourceStartLine: number;
  spec: YahlStage;
  temperature?: number;
  type: "loop" | "plain" | "while";
  updateContextKeys?: string[];
}

export interface ComposeUpOptions {
  composeOverrideFilePaths?: string[];
  composeProjectName: string;
}

export interface ComposeDownOptions {
  composeOverrideFilePaths?: string[];
  composeProjectName: string;
  sessionId?: string;
}
