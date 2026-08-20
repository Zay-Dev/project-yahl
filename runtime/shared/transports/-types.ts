import type { OpenAI } from 'openai';

import type { TModelResponseTag } from '../model-response-tags.js';
import type { ChatApiMessage } from '../stage-tools.js';

import { EventEmitter } from 'events';

import type { StageExecutionMeta } from '../transport';
import type { AskUserBatchToolArguments } from '../ask-user-batch';
import type { YahlStage } from '../yahl-stage';

export type TModelResponse = OpenAI.Chat.Completions.ChatCompletion & {
  durationMs: number;
  tags?: TModelResponseTag[];
  thinkingMode: boolean;
};

export type TStorage = {
  context: Map<string, unknown>;
  types: Map<string, unknown>;
};

type TNormalizedStorage = {
  context: Record<string, unknown>;
  types: Record<string, unknown>;
};

export type TLoopMetaKind = 'warmup' | 'for' | 'while';

export type TLoopMeta = {
  arraySnapshot: unknown[];
  index: number;
  indexName?: string;
  kind?: TLoopMetaKind;
  remainingBashCalls?: number;
  remainingTurns?: number;
  temperature?: number;
  value: unknown;
};

export type TChatToolCall = {
  function: {
    arguments: string;
    name: string;
  };
  id: string;
  type: "function";
};

export type TToolCallResult = {
  hasError: boolean;
  result: string;
  newStorage?: TStorage;
};

export type TToolCallResultWire = TToolCallResult & {
  toolCallId?: string;
};

export type TLocalToolResultEnvelope = {
  hasError: boolean;
  result: string;
  toolCallId: string;
};

export type TAskUserBatchResumeAnswer = {
  answerValue: number | string | string[];
  freeText?: string;
  questionRef: string;
  selectedLabels?: string[];
  selectedOptionIds?: string[];
};

export type TAskUserResumeFrom = {
  batch: AskUserBatchToolArguments;
  batchAnswers: TAskUserBatchResumeAnswer[];
  modelResponses: TModelResponse[];
  pendingToolCallId: string;
  toolCalls: TChatToolCall[];
};

export type TRequestEnvelope = {
  context: TStorage;
  contextAfter?: TStorage;
  parsedStageIndex?: number;
  prefixMessages?: ChatApiMessage[];
  requestId: string;
  resumeFrom?: TAskUserResumeFrom;
  stage: YahlStage;
  systemAppend?: string;
  temperature?: number;
};

interface IPublisherEventMap {
  toolCall: [envelope: { requestId: string, toolCalls: TChatToolCall[] }];
  toolCallResult: [envelope: { requestId: string; result: string; toolCallId: string }];
  modelResponse: [envelope: { requestId: string, response: TModelResponse }];
  pushRequest: [envelope: {
    context: TNormalizedStorage;
    executionMeta?: StageExecutionMeta;
    loopMeta?: TLoopMeta;
    parsedStageIndex?: number;
    requestId: string;
    sourceStartLine?: number;
    stage: YahlStage;
    temperature?: number;
  }];
  stageFinish: [envelope: { contextAfter: TNormalizedStorage; requestId: string }];
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

  emitStageFinish: (envelope: {
    contextAfter: TStorage | Record<string, unknown>;
    requestId: string;
  }) => void;

  pushToolCallResult: (requestId: string, result: TToolCallResult) => Promise<void>;

  pushRequest: (
    context: TStorage,
    stage: YahlStage,
    requestId: string,
    options?: {
      contextAfter?: TStorage | undefined,
      executionMeta?: StageExecutionMeta,
      loopMeta?: TLoopMeta | undefined,
      parsedStageIndex?: number,
      persistedStage?: YahlStage,
      prefixMessages?: ChatApiMessage[],
      resumeFrom?: TAskUserResumeFrom,
      skipStageCreate?: boolean,
      sourceStartLine?: number,
      systemAppend?: string,
      temperature?: number,
    },
  ) => Promise<{
    disposeWait: () => void;
    wait: () => Promise<{ bashCalls?: number; turns?: number } | void>,
    getWaitForToolCall: (
      callback: (toolCall: TChatToolCall) => Promise<TToolCallResult>
    ) => {
      wait: () => Promise<void>;
      dispose: () => void;
    },
  }>;
}

export interface ISubscriber extends IBase {
  waitForRequest: () => Promise<TRequestEnvelope | null>;

  getReply: (requestId: string) => {
    error: (error: Error) => Promise<void>;

    end: (usage?: { bashCalls?: number; turns?: number }) => Promise<any>;
    onModelResponse: (response: TModelResponse) => Promise<void>;
    reportLocalToolCall: (
      toolCall: TChatToolCall,
      result: Pick<TToolCallResult, 'hasError' | 'result'>,
    ) => Promise<void>;
    toolCall: (toolCalls: TChatToolCall) => Promise<TToolCallResult>;
  };
}