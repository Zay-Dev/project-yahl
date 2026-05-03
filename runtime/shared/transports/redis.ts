import type Redis from "ioredis";
import type { StageEnvelope } from '@/shared/stage-contract';

import type { IPublisher, ISubscriber, TRequestEnvelope, TModelResponse } from "./-types";

import { randomUUID } from 'crypto';

import { parseStageEnvelope } from '@/shared/stage-contract';

import { PublisherEmitter } from "./-types";

const _getReplyQueue = (requestId: string) => `yahl:reply:${requestId}`;
const _getRequestQueue = (sessionId: string) => `yahl:request:${sessionId}`;

const _getToolCallChannel = (sessionId: string) => `yahl:tool-call:${sessionId}`;
const _getModelResponseChannel = (sessionId: string) => `yahl:model-response:${sessionId}`;

const _extractJsonLine = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) =>
      (line.startsWith("{") && line.endsWith("}")) ||
      (line.startsWith("[") && line.endsWith("]"))
    ) || "";

const _parseAgentEnvelope = (value: string): StageEnvelope => {
  const jsonLine = _extractJsonLine(value);
  const parsed = parseStageEnvelope(jsonLine);

  if (parsed) return parsed;

  return {
    output: value.trim(),
    type: "result",
  };
}

class RedisTransport {
  protected readonly connections: Redis[] = [];

  protected readonly requestQueue: string;

  protected readonly toolCallChannel: string;
  protected readonly modelResponseChannel: string;

  constructor(protected readonly redis: Redis, protected readonly sessionId: string) {
    this.requestQueue = _getRequestQueue(this.sessionId);

    this.toolCallChannel = _getToolCallChannel(this.sessionId);
    this.modelResponseChannel = _getModelResponseChannel(this.sessionId);
  }

  async close() {
    await Promise.all(
      this.connections.map(async connection => {
        connection.removeAllListeners();
        await connection.quit();
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
          if (channel === this.toolCallChannel) {
            this.emit("toolCall", JSON.parse(message));
          } else if (channel === this.modelResponseChannel) {
            this.emit("modelResponse", JSON.parse(message));
          }
        })
        .subscribe(this.toolCallChannel, this.modelResponseChannel);
    };

  pushRequest: IPublisher['pushRequest'] =
    async (context, currentStage, meta) => {
      const requestId = randomUUID();
      this.emit("pushRequest", { requestId, context, currentStage, meta });

      await this.redis.lpush(this.requestQueue,
        JSON.stringify({
          context,
          requestId,
          currentStage,
        })
      );

      return {
        requestId,
        envelope: await this._waitForReply(requestId),
      }
    }

  private async _waitForReply(requestId: string) {
    const brpopSeconds = 30;
    const deadline = Date.now() + 3_600_000;
    const replyQueue = _getReplyQueue(requestId);

    while (Date.now() < deadline) {
      const remainingMs = deadline - Date.now();
      const sec = Math.min(brpopSeconds, Math.max(1, Math.ceil(remainingMs / 1000)));
      const popped = await this.redis.brpop(replyQueue, sec);

      if (popped?.[1]) {
        return _parseAgentEnvelope(popped[1]);
      }
    }

    throw new Error(`Stage agent reply timeout: ${requestId}`);
  }
}

export class RedisSubscriber extends RedisTransport implements ISubscriber {
  async waitForRequest() {
    const raw = (await this.redis.brpop(this.requestQueue, 0))?.[1] || null;
    if (!raw) return null;

    try {
      return JSON.parse(raw) as TRequestEnvelope;
    } catch {
      return null;
    }
  }

  getReply: ISubscriber['getReply'] =
    (requestId: string) => {
      type ToolCall = Exclude<
        TModelResponse['choices'][number]['message']['tool_calls'],
        undefined
      >[number];

      const replyQueue = _getReplyQueue(requestId);
      const onToolsCall = async (toolCalls: ToolCall[]) => {
        if (!toolCalls.length) return;
        await this.redis.publish(this.toolCallChannel, JSON.stringify({ requestId, toolCalls }));
      }

      return {
        reply: async (envelope: StageEnvelope) => {
          await this.redis.lpush(replyQueue, JSON.stringify(envelope));
        },

        error: async (error: Error) => {
          await this.redis.lpush(replyQueue, JSON.stringify({
            type: "result",
            output: { error, type: 'error', message: error.message },
          }));
        },

        onModelResponse: async (response: TModelResponse) => {
          await Promise.all([
            this.redis.publish(this.modelResponseChannel, JSON.stringify({ requestId, response })),
            onToolsCall(response.choices[0].message.tool_calls || []),
          ]);
        },
      }
    }
}