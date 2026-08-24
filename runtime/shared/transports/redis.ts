import type Redis from "ioredis";

import type {
  TStorage,
  IPublisher,
  ISubscriber,
  TRequestEnvelope,
  TChatToolCall,
  TLocalToolResultEnvelope,
  TToolCallResult,
  TToolCallResultWire,
} from "./-types";

import { isAgentLocalTool } from "../agent-local-tools.js";
import { truncateToolResult } from "../tool-result-truncate.js";

import { PublisherEmitter } from "./-types";

const _getReplyQueue = (requestId: string) => `yahl:reply:${requestId}`;
const _getRequestQueue = (sessionId: string) => `yahl:request:${sessionId}`;

const _getToolCallChannel = (sessionId: string, requestId: string) =>
  `yahl:tool:${sessionId}:${requestId}`;
const _getToolCallResultChannel = (sessionId: string, requestId: string) =>
  `yahl:tool-result:${sessionId}:${requestId}`;
const _getModelResponseChannel = (sessionId: string, requestId: string) =>
  `yahl:model-response:${sessionId}:${requestId}`;
const _getLocalToolResultChannel = (sessionId: string, requestId: string) =>
  `yahl:local-tool-result:${sessionId}:${requestId}`;

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

const _isDisposedConnectionError = (disposed: boolean, reason: string) =>
  disposed && reason === 'Connection is closed.';

const flushSessionTracker = async () => {
  const tracker = (globalThis as { sessionTracker?: { flush?: () => Promise<void> } })
    .sessionTracker;

  await tracker?.flush?.();
};

class RedisTransport {
  protected readonly connections: Redis[] = [];

  protected readonly requestQueue: string;

  constructor(protected readonly redis: Redis, protected readonly sessionId: string) {
    this.requestQueue = _getRequestQueue(this.sessionId);
  }

  protected _modelResponseQueue(requestId: string) {
    return _getModelResponseChannel(this.sessionId, requestId);
  }

  protected _toolCallChannel(requestId: string) {
    return _getToolCallChannel(this.sessionId, requestId);
  }

  protected _toolResultChannel(requestId: string) {
    return _getToolCallResultChannel(this.sessionId, requestId);
  }

  protected _localToolResultChannel(requestId: string) {
    return _getLocalToolResultChannel(this.sessionId, requestId);
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

  protected async _brpopKeys(redis: Redis, keys: string[], timeoutSeconds: number) {
    if (keys.length === 0) {
      return null;
    }

    const popped = await redis.brpop(...keys, timeoutSeconds);

    if (popped?.[0] && popped?.[1]) {
      return { key: popped[0], value: popped[1] };
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
    };

  drainRequestQueue: IPublisher['drainRequestQueue'] = async () => {
    let drained = 0;

    while (true) {
      const raw = await this.redis.lpop(this.requestQueue);

      if (!raw) {
        break;
      }

      drained += 1;
    }

    return drained;
  };

  private async _drainModelResponses(requestId: string) {
    const queue = this._modelResponseQueue(requestId);

    while (true) {
      const raw = await this.redis.lpop(queue);

      if (!raw) {
        return;
      }

      this.emit("modelResponse", JSON.parse(raw));
    }
  }

  pushRequest: IPublisher['pushRequest'] =
    async (context, stage, requestId, {
      contextAfter,
      executionMeta,
      loopMeta,
      parsedStageIndex,
      persistedStage,
      prefixMessages,
      resumeFrom,
      skipStageCreate,
      sourceStartLine,
      systemAppend,
      temperature,
    } = {}) => {
      if (!skipStageCreate) {
        this.emit("pushRequest", {
          context: _serializeStorage(context)!,
          executionMeta,
          loopMeta,
          parsedStageIndex,
          requestId,
          sourceStartLine,
          stage: persistedStage ?? stage,
          temperature,
        });
      }

      await flushSessionTracker();

      await this.redis.lpush(this.requestQueue,
        JSON.stringify({
          context: _serializeStorage(context),
          contextAfter: _serializeStorage(contextAfter),
          parsedStageIndex,
          prefixMessages,
          requestId,
          resumeFrom,
          stage,
          systemAppend,
          temperature,
        })
      );

      const waitHandlers = this._createWaitForReply(requestId);

      return {
        disposeWait: waitHandlers.dispose,
        wait: waitHandlers.wait,
        getWaitForToolCall: (callback) => this._getWaitForToolCall(requestId, callback),
      }
    }

  pushToolCallResult: IPublisher['pushToolCallResult'] =
    async (requestId, result) => {
      await this.redis.lpush(
        this._toolResultChannel(requestId),
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

  private _createWaitForReply(requestId: string) {
    const timeoutSeconds = 60 * 60;
    const redis = this.redis.duplicate();
    const replyQueue = _getReplyQueue(requestId);
    let disposed = false;

    this.connections.push(redis);

    return {
      dispose: () => {
        disposed = true;
        redis.disconnect();
      },

      wait: async () => {
        await this._drainModelResponses(requestId);

        const waitStartedAt = Date.now();
        let usage: { bashCalls?: number; turns?: number } | undefined;

        console.log(`[yahl-diag] reply wait start requestId=${requestId} pid=${process.pid}`);

        while (true) {
          try {
            const raw = await this._brpop(redis, replyQueue, timeoutSeconds);

            if (raw === 'END') {
              console.log(
                `[yahl-diag] reply wait end requestId=${requestId} raw=END pid=${process.pid} `
                + `elapsedMs=${Date.now() - waitStartedAt}`,
              );
              break;
            }

            if (raw) {
              try {
                const parsed = JSON.parse(raw) as {
                  bashCalls?: number;
                  turns?: number;
                  type?: string;
                  output?: {
                    error?: { message?: string; name?: string; stack?: string };
                    message?: string;
                  };
                };

                if (parsed.type === 'usage') {
                  usage = {
                    bashCalls: Number(parsed.bashCalls) || 0,
                    turns: Number(parsed.turns) || 0,
                  };
                  continue;
                }

                if (parsed.type === 'error') {
                  const errorMessage = parsed.output?.message
                    ?? parsed.output?.error?.message
                    ?? 'agent stage error';
                  const errorName = parsed.output?.error?.name ?? 'Error';
                  const errorStack = parsed.output?.error?.stack ?? '';
                  const stackPreview = errorStack.length > 500
                    ? `${errorStack.slice(0, 500)}…`
                    : errorStack;

                  console.log(
                    `[yahl-diag] reply error requestId=${requestId} elapsedMs=${Date.now() - waitStartedAt} `
                    + `message=${errorMessage} name=${errorName} stack=${stackPreview || '-'}`,
                  );

                  throw new Error(errorMessage);
                }

                const rawPreview = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;

                console.log(
                  `[yahl-diag] reply interim requestId=${requestId} elapsedMs=${Date.now() - waitStartedAt} `
                  + `raw=${rawPreview}`,
                );
              } catch (error) {
                if (error instanceof SyntaxError) {
                  continue;
                }

                throw error;
              }
            }
          } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);

            if (_isDisposedConnectionError(disposed, reason)) {
              console.log(
                `[yahl-diag] reply wait disposed requestId=${requestId} pid=${process.pid}`,
              );
              return;
            }

            throw error instanceof Error ? error : new Error(reason);
          }
        }

        await this._drainModelResponses(requestId);

        if (!disposed) {
          await redis.quit();
        }

        return usage;
      },
    };
  }

  private _getWaitForToolCall(
    requestId: string,
    callback: (toolCall: TChatToolCall) => Promise<TToolCallResult>
  ): ReturnType<Awaited<ReturnType<IPublisher['pushRequest']>>['getWaitForToolCall']> {
    const timeoutSeconds = 60 * 60;
    const redis = this.redis.duplicate();
    let disposed = false;
    const localOrphanBuffer = new Map<string, TLocalToolResultEnvelope>();

    this.connections.push(redis);

    return {
      dispose: () => {
        disposed = true;
        redis.disconnect();
      },

      wait: async () => {
        while (true) {
          try {
            const toolCallChannel = this._toolCallChannel(requestId);
            const modelResponseQueue = this._modelResponseQueue(requestId);
            const popped = await this._brpopKeys(
              redis,
              [toolCallChannel, modelResponseQueue],
              timeoutSeconds,
            );

            if (!popped) continue;

            if (popped.key === modelResponseQueue) {
              this.emit("modelResponse", JSON.parse(popped.value));
              continue;
            }

            const toolCall = JSON.parse(popped.value) as TChatToolCall;

            this.emit("toolCall", { requestId, toolCalls: [toolCall] });

            if (isAgentLocalTool(toolCall.function.name)) {
              const localResult = await this._waitForLocalToolResult(
                redis,
                requestId,
                toolCall.id,
                timeoutSeconds,
                localOrphanBuffer,
              );
              const persistedResult = truncateToolResult(localResult.result);
              const result: TToolCallResult = {
                hasError: localResult.hasError,
                result: persistedResult,
              };

              this.emit("toolCallResult", {
                requestId,
                result: persistedResult,
                toolCallId: toolCall.id,
              });

              await this.redis.lpush(
                this._toolResultChannel(requestId),
                JSON.stringify({ ...result, toolCallId: toolCall.id } satisfies TToolCallResultWire),
              );

              continue;
            }

            const result = await callback(toolCall);

            this.emit("toolCallResult", {
              requestId,
              result: result.result,
              toolCallId: toolCall.id,
            });

            await this.redis.lpush(
              this._toolResultChannel(requestId),
              JSON.stringify({ ...result, toolCallId: toolCall.id } satisfies TToolCallResultWire),
            );
          } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AskUserPausedError') {
              throw error;
            }

            const reason = error instanceof Error ? error.message : String(error);

            if (_isDisposedConnectionError(disposed, reason)) {
              return;
            }

            console.error('waitForToolCall', { requestId, reason });

            throw error instanceof Error ? error : new Error(reason);
          }
        }
      }
    };
  }

  private async _waitForLocalToolResult(
    redis: Redis,
    requestId: string,
    toolCallId: string,
    timeoutSeconds: number,
    orphanBuffer: Map<string, TLocalToolResultEnvelope>,
  ): Promise<TLocalToolResultEnvelope> {
    const buffered = orphanBuffer.get(toolCallId);

    if (buffered) {
      orphanBuffer.delete(toolCallId);

      return buffered;
    }

    const deadline = Date.now() + timeoutSeconds * 1000;

    while (Date.now() < deadline) {
      const remainingMs = deadline - Date.now();
      const waitSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      const popped = await this._brpop(redis, this._localToolResultChannel(requestId), waitSeconds);

      if (!popped) {
        continue;
      }

      const parsed = JSON.parse(popped) as TLocalToolResultEnvelope;

      if (parsed.toolCallId !== toolCallId) {
        orphanBuffer.set(parsed.toolCallId, parsed);

        continue;
      }

      return parsed;
    }

    throw new Error(`local tool result timed out for ${toolCallId}`);
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

      const orphanBuffer = new Map<string, TToolCallResultWire>();

      const _waitForToolCallResult = async (toolCallId: string): Promise<TToolCallResult> => {
        const buffered = orphanBuffer.get(toolCallId);

        if (buffered) {
          orphanBuffer.delete(toolCallId);
          const { toolCallId: _wireId, ...result } = buffered;

          return {
            ...result,
            newStorage: this._deserializeStorage(result.newStorage),
          };
        }

        const deadline = Date.now() + timeoutSeconds * 1000;

        while (Date.now() < deadline) {
          const remainingMs = deadline - Date.now();
          const waitSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
          const popped = await this._brpop(redis, this._toolResultChannel(requestId), waitSeconds);

          if (!popped) {
            continue;
          }

          const parsed = JSON.parse(popped) as TToolCallResultWire;

          if (parsed.toolCallId && parsed.toolCallId !== toolCallId) {
            orphanBuffer.set(parsed.toolCallId, parsed);

            continue;
          }

          const { toolCallId: _wireId, ...result } = parsed;

          return {
            ...result,
            newStorage: this._deserializeStorage(result.newStorage),
          };
        }

        return {
          hasError: false,
          result: 'Empty result',
        };
      };

      return {
        error: async (error) => {
          await this.redis.lpush(replyQueue, JSON.stringify({
            type: "error",
            output: {
              error: {
                message: error.message,
                name: error.name,
                ...(typeof error.stack === 'string' ? { stack: error.stack } : {}),
              },
              message: error.message,
              type: 'error',
            },
          }));
          await this.redis.lpush(replyQueue, 'END');
        },

        end: async (usage) => {
          if (usage) {
            await this.redis.lpush(replyQueue, JSON.stringify({
              bashCalls: usage.bashCalls ?? 0,
              turns: usage.turns ?? 0,
              type: 'usage',
            }));
          }

          await this.redis.lpush(replyQueue, 'END');
        },

        onModelResponse: async (response) => {
          await this.redis.lpush(
            this._modelResponseQueue(requestId),
            JSON.stringify({ requestId, response }),
          );
        },

        reportLocalToolCall: async (toolCall, result) => {
          await this.redis.lpush(this._toolCallChannel(requestId), JSON.stringify(toolCall));
          await this.redis.lpush(
            this._localToolResultChannel(requestId),
            JSON.stringify({
              hasError: result.hasError,
              result: result.result,
              toolCallId: toolCall.id,
            } satisfies TLocalToolResultEnvelope),
          );
        },

        toolCall: async (toolCall) => {
          await this.redis.lpush(this._toolCallChannel(requestId), JSON.stringify(toolCall));

          return await _waitForToolCallResult(toolCall.id);
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