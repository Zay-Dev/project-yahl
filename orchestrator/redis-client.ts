import Redis from "ioredis";

import {
  REQUEST_QUEUE,
  USAGE_CHANNEL,
  replyQueue,
  type StageExecutionMeta,
  type StageRequestEnvelope,
  type StageTokenTrace,
  type UsageEvent,
} from "../shared/transport";

import { parseStageEnvelope, type StageEnvelope } from "../shared/stage-contract";

import { randomUUID } from "crypto";

const extractJsonLine = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) =>
      (line.startsWith("{") && line.endsWith("}")) ||
      (line.startsWith("[") && line.endsWith("]"))
    ) || "";

const parseAgentEnvelope = (stdout: string): StageEnvelope => {
  const jsonLine = extractJsonLine(stdout);
  const parsed = parseStageEnvelope(jsonLine);

  if (parsed) return parsed;

  return {
    output: stdout.trim(),
    type: "result",
  };
};

const isUsageEvent = (value: unknown): value is UsageEvent => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const o = value as Record<string, unknown>;

  if (typeof o.sessionId !== "string") return false;
  if (typeof o.requestId !== "string") return false;
  if (typeof o.model !== "string") return false;
  if (typeof o.thinkingMode !== "boolean") return false;
  if (!o.usage || typeof o.usage !== "object" || Array.isArray(o.usage)) return false;

  return true;
};

export type OrchestratorRedisOptions = {
  onUsage: (event: StageTokenTrace) => void;
  redisUrl: string;
};

export type OrchestratorRedis = {
  close: () => Promise<void>;
  execStageAgent: (
    sessionId: string,
    stageInput: StageRequestEnvelope["stageInput"],
    executionMeta: StageExecutionMeta,
  ) => Promise<StageEnvelope>;
  pingUntilReady: (opts?: { maxAttempts?: number; delayMs?: number }) => Promise<void>;
  subscribeUsage: () => Promise<void>;
};

export const createOrchestratorRedis = async (
  options: OrchestratorRedisOptions,
): Promise<OrchestratorRedis> => {
  const commands = new Redis(options.redisUrl, {
    maxRetriesPerRequest: 2,
  });

  const subscriber = commands.duplicate();
  const requestMeta = new Map<string, StageExecutionMeta>();

  const onMessage = (_channel: string, message: string) => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(message) as unknown;
    } catch {
      return;
    }

    if (!isUsageEvent(parsed)) return;

    const executionMeta = requestMeta.get(parsed.requestId);
    if (!executionMeta) return;
    
    options.onUsage({
      executionMeta,
      model: parsed.model,
      requestId: parsed.requestId,
      sessionId: parsed.sessionId,
      thinkingMode: parsed.thinkingMode,
      timestamp: new Date().toISOString(),
      usage: parsed.usage,
    });
  };

  const subscribeUsage = async () => {
    await subscriber.subscribe(USAGE_CHANNEL);
    subscriber.on("message", onMessage);
  };

  const pingUntilReady = async (opts?: { maxAttempts?: number; delayMs?: number }) => {
    const maxAttempts = opts?.maxAttempts ?? 60;
    const delayMs = opts?.delayMs ?? 500;

    for (let i = 0; i < maxAttempts; i += 1) {
      try {
        const pong = await commands.ping();

        if (pong === "PONG") return;
      } catch { }

      await new Promise((r) => setTimeout(r, delayMs));
    }

    throw new Error("Redis not ready after ping retries");
  };

  const execStageAgent = async (
    sessionId: string,
    stageInput: StageRequestEnvelope["stageInput"],
    executionMeta: StageExecutionMeta,
  ): Promise<StageEnvelope> => {
    const requestId = randomUUID();
    const body: StageRequestEnvelope = {
      executionMeta,
      requestId,
      sessionId,
      stageInput,
    };
    requestMeta.set(requestId, executionMeta);

    await commands.lpush(REQUEST_QUEUE, JSON.stringify(body));

    const key = replyQueue(requestId);
    const deadline = Date.now() + 3_600_000;
    const brpopSeconds = 30;

    while (Date.now() < deadline) {
      const remainingMs = deadline - Date.now();
      const sec = Math.min(brpopSeconds, Math.max(1, Math.ceil(remainingMs / 1000)));
      const popped = await commands.brpop(key, sec);

      if (popped && popped[1]) {
        requestMeta.delete(requestId);
        return parseAgentEnvelope(popped[1]);
      }
    }

    requestMeta.delete(requestId);
    throw new Error(`Stage agent reply timeout: ${requestId}`);
  };

  const close = async () => {
    subscriber.off("message", onMessage);

    try {
      await subscriber.unsubscribe(USAGE_CHANNEL);
    } catch { }

    requestMeta.clear();
    await subscriber.quit();
    await commands.quit();
  };

  return {
    close,
    execStageAgent,
    pingUntilReady,
    subscribeUsage,
  };
};
