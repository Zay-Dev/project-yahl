import type { TModelResponse } from "@/shared/transports/-types";
import type { StageExecutionMeta } from "@/shared/transport";
import type { NormalizedUsage } from "@/shared/usage";
import type { ChatToolCall } from "@/shared/stage-tools";

import type { ParsedStage } from "@/orchestrator/orchestrator-types";

export type PushRequestEvent = {
  contextBefore: unknown;
  currentStage: string;
  executionMeta: StageExecutionMeta;
  requestId: string;
  sessionId: string;
  timestamp: string;
};

export type ToolCallEvent = {
  requestId: string;
  sessionId: string;
  stageId: string;
  timestamp: string;
  toolCalls: ChatToolCall[];
};

export type ModelResponseEvent = {
  durationMs: number;
  model: string;
  requestId: string;
  response: TModelResponse;
  sessionId: string;
  stageId: string;
  thinkingMode: boolean;
  timestamp: string;
  usage: NormalizedUsage;
};

export type StageFinishEvent = {
  contextAfter: unknown;
  requestId: string;
  sessionId: string;
  stageId: string;
  timestamp: string;
};

export type SessionA2uiEvent = {
  envelopes: unknown;
  mode: "append" | "replace";
  sessionId: string;
  surfaceId: string;
  timestamp: string;
};

export type FinalResultEvent = {
  result: unknown;
  resultA2ui?: unknown;
  sessionId: string;
  stages: ParsedStage[];
};

export type TAgentTracker = {
  pushRequest?: (event: PushRequestEvent) => void | Promise<void>;
  toolCall?: (event: ToolCallEvent) => void | Promise<void>;
  modelResponse?: (event: ModelResponseEvent) => void | Promise<void>;
  sessionA2ui?: (event: SessionA2uiEvent) => void | Promise<void>;
  stageFinish?: (event: StageFinishEvent) => void | Promise<void>;
  finalResult?: (event: FinalResultEvent) => void | Promise<void>;
  reset?: () => void;
};

const _trackers: TAgentTracker[] = [];

export const add = (tracker: TAgentTracker) => {
  _trackers.push(tracker);
};

export const reset = () => {
  _trackers.forEach((tracker) => tracker.reset?.());
};

const _fanOut = async <T,>(
  method: keyof TAgentTracker,
  event: T,
) => {
  await Promise.all(
    _trackers.map((tracker) => {
      const fn = tracker[method] as ((e: T) => void | Promise<void>) | undefined;
      return fn?.(event);
    }),
  );
};

export const pushRequest = (event: PushRequestEvent) => _fanOut("pushRequest", event);
export const toolCall = (event: ToolCallEvent) => _fanOut("toolCall", event);
export const modelResponse = (event: ModelResponseEvent) => _fanOut("modelResponse", event);
export const sessionA2ui = (event: SessionA2uiEvent) => _fanOut("sessionA2ui", event);
export const stageFinish = (event: StageFinishEvent) => _fanOut("stageFinish", event);
export const finalResult = (event: FinalResultEvent) => _fanOut("finalResult", event);
