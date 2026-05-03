import type { OpenAI } from 'openai';
import type { StageEnvelope, SetContextToolCallEnvelope } from '@/shared/stage-contract';
import type { ChatToolCall } from '@/shared/stage-tools';

import { EventEmitter } from 'events';

export type TModelResponse = OpenAI.Chat.Completions.ChatCompletion & {
  thinkingMode: boolean;
  durationMs: number;
};

type TRuntimeContext = {
  context: Record<string, unknown>;
  stage: Record<string, unknown>;
  types: Record<string, unknown>;
};

export type TRequestEnvelope = {
  requestId: string;
  context: TRuntimeContext;
  currentStage: string;
};

export type TStageExecutionMeta = {
  loopRef?: {
    arraySnapshot: unknown[];
    index: number;
    value: unknown;
  };
  runtimeRef: {
    generatedLine: number;
  };
  sourceRef: {
    filePath: string;
    line: number;
    text: string;
  };
  stageId: string;
  stageTextHash: string;
};

interface IPublisherEventMap {
  toolCall: [envelope: { requestId: string, toolCalls: ChatToolCall[] }];
  modelResponse: [envelope: { requestId: string, response: TModelResponse }];
  pushRequest: [envelope: { requestId: string, context: TRuntimeContext, currentStage: string, meta: TStageExecutionMeta }];
  stageFinish: [envelope: { requestId: string, contextAfter: unknown }];
}

export class PublisherEmitter extends EventEmitter<IPublisherEventMap> { }

interface IBase {
  close: () => Promise<void>;
  waitForReady: (options?: { maxAttempts?: number; delayMs?: number }) => Promise<void>;
}

export interface IPublisher extends IBase {
  on: EventEmitter<IPublisherEventMap>['on'];
  off: EventEmitter<IPublisherEventMap>['off'];
  once: EventEmitter<IPublisherEventMap>['once'];
  emit: EventEmitter<IPublisherEventMap>['emit'];

  emitStageFinish: (envelope: { requestId: string, contextAfter: unknown }) => void;

  pushRequest: (
    context: TRuntimeContext,
    currentStage: string,
    meta: TStageExecutionMeta,
  ) => Promise<{ requestId: string, envelope: StageEnvelope }>;
}

export interface ISubscriber extends IBase {
  waitForRequest: () => Promise<TRequestEnvelope | null>;

  getReply: (requestId: string) => {
    reply: (envelope: StageEnvelope) => Promise<void>;
    error: (error: Error) => Promise<void>;

    onModelResponse: (response: TModelResponse) => Promise<void>;
  };
}