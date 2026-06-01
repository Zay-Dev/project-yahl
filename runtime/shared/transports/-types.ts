import type { OpenAI } from 'openai';

import { EventEmitter } from 'events';

export type TModelResponse = OpenAI.Chat.Completions.ChatCompletion & {
  thinkingMode: boolean;
  durationMs: number;
};

export type TStorage = {
  context: Map<string, unknown>;
  types: Map<string, unknown>;
};

type TNormalizedStorage = {
  context: Record<string, unknown>;
  types: Record<string, unknown>;
};

export type TLoopMeta = {
  temperature?: number;
  arraySnapshot: unknown[];

  index: number;
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

export type TRequestEnvelope = {
  requestId: string;
  context: TStorage;
  currentStage: string;
  contextAfter?: TStorage;
  temperature?: number;
};

interface IPublisherEventMap {
  toolCall: [envelope: { requestId: string, toolCalls: TChatToolCall[] }];
  modelResponse: [envelope: { requestId: string, response: TModelResponse }];
  pushRequest: [envelope: {
    context: TNormalizedStorage;
    currentStage: string;
    requestId: string;
    loopMeta?: TLoopMeta;
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

  emitStageFinish: (envelope: { contextAfter: TStorage; requestId: string }) => void;

  pushToolCallResult: (result: TToolCallResult) => Promise<void>;

  pushRequest: (
    context: TStorage,
    currentStage: string,
    temperature: number | undefined,
    options?: {
      loopMeta?: TLoopMeta | undefined,
      contextAfter?: TStorage | undefined,
    },
  ) => Promise<{
    requestId: string,
    wait: () => Promise<void>,
    getWaitForToolCall: (
      callback: (toolCall: TChatToolCall) => Promise<TToolCallResult>
    ) => {
      wait: () => unknown;
      dispose: () => void;
    },
  }>;
}

export interface ISubscriber extends IBase {
  waitForRequest: () => Promise<TRequestEnvelope | null>;

  getReply: (requestId: string) => {
    error: (error: Error) => Promise<void>;

    end: () => Promise<any>;
    toolCall: (toolCalls: TChatToolCall) => Promise<TToolCallResult>;

    onModelResponse: (response: TModelResponse) => Promise<void>;
  };
}