import type Redis from "ioredis";

import type {
  TStorage,
  IPublisher,
  ISubscriber,
  TRequestEnvelope,
  TChatToolCall,
  TToolCallResult,
} from "./-types";

import { randomUUID } from 'crypto';

import { PublisherEmitter } from "./-types";

const _getReplyQueue = (requestId: string) => `yahl:reply:${requestId}`;
const _getRequestQueue = (sessionId: string) => `yahl:request:${sessionId}`;

const _getToolCallChannel = (sessionId: string) => `yahl:tool:${sessionId}`;
const _getToolCallResultChannel = (sessionId: string) => `yahl:tool-result:${sessionId}`;
const _getModelResponseChannel = (sessionId: string) => `yahl:model-response:${sessionId}`;

const _isStorage = (value: unknown): value is TStorage =>
  typeof value === 'object'
  && value !== null
  && (value as TStorage).context instanceof Map;

const _serializeStorage = (storage?: TStorage) => {
  if (!storage) return undefined;

  return {
    context: Object.fromEntries(storage.context.entries()),
    types: Object.fromEntries(storage.types.entries()),
  };
};

const _normalizeContextAfter = (contextAfter: TStorage | Record<string, unknown>) => {
  if (_isStorage(contextAfter)) {
    return _serializeStorage(contextAfter)!;
  }

  return contextAfter as { context: Record<string, unknown>; types: Record<string, unknown> };
};

class RedisTransport {
  protected readonly connections: Redis[] = [];

  protected readonly requestQueue: string;

  protected readonly toolCallChannel: string;
  protected readonly toolResultChannel: string;
  protected readonly modelResponseChannel: string;

  constructor(protected readonly redis: Redis, protected readonly sessionId: string) {
    this.requestQueue = _getRequestQueue(this.sessionId);

    this.toolCallChannel = _getToolCallChannel(this.sessionId);
    this.toolResultChannel = _getToolCallResultChannel(this.sessionId);
    this.modelResponseChannel = _getModelResponseChannel(this.sessionId);
  }

  async close() {
    await Promise.all(
      this.connections.map(async connection => {
        connection.removeAllListeners();

        if (!['close', 'end'].includes(connection.status)) {
          await connection.quit();
        }
      }),
    );

    this.connections.length = 0;
    this.redis.removeAllListeners();
    await this.redis.quit();
  }

  async waitForReady(options?: {
    maxAttempts?: number;
    delayMs?: number;
  }) {
    const maxAttempts = options?.maxAttempts ?? 60;
    const delayMs = options?.delayMs ?? 500;

    for (let i = 0; i < maxAttempts; i += 1) {
      try {
        const pong = await this.redis.ping();

        if (pong === "PONG") return;
      } catch { }

      await new Promise((r) => setTimeout(r, delayMs));
    }

    throw new Error("Redis not ready after ping retries");
  }

  protected async _brpop(redis: Redis, queue: string, timeoutSeconds: number) {
    const popped = await redis.brpop(queue, timeoutSeconds);

    if (popped?.[1]) {
      return popped[1];
    }

    return null;
  }
}

export class RedisPublisher extends RedisTransport implements IPublisher {
  private readonly _emitter: PublisherEmitter = new PublisherEmitter();

  on: PublisherEmitter['on'] = this._emitter.on.bind(this._emitter);
  off: PublisherEmitter['off'] = this._emitter.off.bind(this._emitter);
  once: PublisherEmitter['once'] = this._emitter.once.bind(this._emitter);
  emit: PublisherEmitter['emit'] = this._emitter.emit.bind(this._emitter);

  waitForReady: IPublisher['waitForReady'] =
    async (options) => {
      await super.waitForReady(options);

      this.connections.push(this.redis.duplicate());

      this.connections.at(-1)!
        .on("message", (channel, message) => {
          if (channel === this.modelResponseChannel) {
            this.emit("modelResponse", JSON.parse(message));
          }
        })
        .subscribe(this.modelResponseChannel);
    };

  pushRequest: IPublisher['pushRequest'] =
    async (context, stage, temperature, { contextAfter, executionMeta, loopMeta, persistedStage } = {}) => {
      const requestId = randomUUID();

      this.emit("pushRequest", { 
        context: _serializeStorage(context)!,
        executionMeta,
        loopMeta,
        requestId,
        stage: persistedStage ?? stage,
        temperature,
      });

      await this.redis.lpush(this.requestQueue,
        JSON.stringify({
          requestId,
          temperature,
          stage,
          context: _serializeStorage(context),
          contextAfter: _serializeStorage(contextAfter),
        })
      );

      return {
        requestId,
        wait: () => this._waitForReply(requestId),
        getWaitForToolCall: (callback) => this._getWaitForToolCall(requestId, callback),
      }
    }

  pushToolCallResult: IPublisher['pushToolCallResult'] =
    async (result) => {
      await this.redis.lpush(
        this.toolResultChannel,
        JSON.stringify({
          ...result,
          newStorage: _serializeStorage(result.newStorage),
        }),
      );
    }

  emitStageFinish: IPublisher['emitStageFinish'] = (envelope) => {
    this.emit("stageFinish", {
      ...envelope,
      contextAfter: _normalizeContextAfter(envelope.contextAfter),
    });
  }

  private async _waitForReply(requestId: string) {
    const timeoutSeconds = 60 * 60;

    const redis = this.redis.duplicate();
    const replyQueue = _getReplyQueue(requestId);

    this.connections.push(redis);

    await this._brpop(redis, replyQueue, timeoutSeconds);
    await redis.quit();
  }

  private _getWaitForToolCall(
    requestId: string,
    callback: (toolCall: TChatToolCall) => Promise<TToolCallResult>
  ): ReturnType<Awaited<ReturnType<IPublisher['pushRequest']>>['getWaitForToolCall']> {
    const timeoutSeconds = 60 * 60;
    const redis = this.redis.duplicate();

    this.connections.push(redis);

    return {
      dispose: () => { redis.disconnect() },

      wait: async () => {
        while (true) {
          try {
            const popped = await this._brpop(redis, this.toolCallChannel, timeoutSeconds);
            if (!popped) continue;

            const toolCall = JSON.parse(popped) as TChatToolCall;

            this.emit("toolCall", { requestId, toolCalls: [toolCall] });

            const result = await callback(toolCall);

            await this.redis.lpush(this.toolResultChannel, JSON.stringify(result));
          } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);

            return console.debug('waitForToolCall', { requestId, reason });
          }
        }
      }
    };
  }
}

export class RedisSubscriber extends RedisTransport implements ISubscriber {
  async waitForRequest() {
    const raw = (await this.redis.brpop(this.requestQueue, 0))?.[1] || null;
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as TRequestEnvelope;

      return {
        ...parsed,
        context: this._deserializeStorage(parsed.context)!,
        contextAfter: this._deserializeStorage(parsed.contextAfter),
      };
    } catch {
      return null;
    }
  }

  getReply: ISubscriber['getReply'] =
    (requestId: string) => {
      const timeoutSeconds = 60 * 60;
      const redis = this.redis.duplicate();

      const replyQueue = _getReplyQueue(requestId);

      this.connections.push(redis);

      const _waitForToolCallResult = async (): Promise<TToolCallResult> => {
        const popped = await this._brpop(redis, this.toolResultChannel, timeoutSeconds);

        if (!popped) {
          return {
            hasError: false,
            result: 'Empty result',
          };
        }

        const parsed = JSON.parse(popped) as TToolCallResult;

        return {
          ...parsed,
          newStorage: this._deserializeStorage(parsed.newStorage),
        };
      };

      return {
        error: async (error) => {
          await this.redis.lpush(replyQueue, JSON.stringify({
            type: "result",
            output: { error, type: 'error', message: error.message },
          }));
        },

        end: () => this.redis.lpush(replyQueue, 'END'),

        onModelResponse: async (response) => {
          await this.redis.publish(
            this.modelResponseChannel,
            JSON.stringify({ requestId, response }),
          );
        },

        toolCall: async (toolCall) => {
          await this.redis.lpush(this.toolCallChannel, JSON.stringify(toolCall));

          return await _waitForToolCallResult();
        },
      }
    }

  private _deserializeStorage(storage?: TStorage) {
    if (!storage) return undefined;

    return {
      context: new Map<string, unknown>(Object.entries(storage.context)),
      types: new Map<string, unknown>(Object.entries(storage.types)),
    };
  }
}