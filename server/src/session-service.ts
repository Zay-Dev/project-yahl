import { emitSessionMeta, emitSessionStep, emitSessionsLifecycle } from "./session-sse-hub";
import type { SessionMetaSsePayload, SessionStepSsePayload } from "./session-sse-hub";
import { SessionModel } from "./session-model";
import type { SessionUsagePayload } from "./types";

const toNumber = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;

  return value;
};

const replyPreview = (payload: SessionUsagePayload) => {
  const reply = payload.response?.reply;

  if (typeof reply !== "string" || !reply) return null;

  const max = 200;

  return reply.length <= max ? reply : `${reply.slice(0, max)}…`;
};

const stepSummary = (
  sessionId: string,
  stepIndex: number,
  payload: SessionUsagePayload,
): SessionStepSsePayload => ({
  cost: toNumber(payload.cost),
  durationMs:
    typeof payload.response?.durationMs === "number" && Number.isFinite(payload.response.durationMs)
      ? payload.response.durationMs
      : null,
  executionMeta: payload.executionMeta,
  model: payload.model,
  requestId: payload.requestId,
  replyPreview: replyPreview(payload),
  sessionId,
  stageInput: payload.stageInput,
  stageInputTruncated: payload.stageInputTruncated,
  stepIndex,
  usage: {
    cacheHitTokens: payload.usage.cacheHitTokens,
    cacheMissTokens: payload.usage.cacheMissTokens,
    completionTokens: payload.usage.completionTokens,
    reasoningTokens: payload.usage.reasoningTokens,
  },
});

const metaFromRow = (
  sessionId: string,
  row: { finalizedAt?: Date | null; taskYahlPath?: string | null } | null,
): SessionMetaSsePayload => ({
  finalizedAt: row?.finalizedAt ? new Date(row.finalizedAt).toISOString() : null,
  sessionId,
  taskYahlPath: typeof row?.taskYahlPath === "string" ? row.taskYahlPath : null,
});

const emitLifecycle = (
  eventType: "created" | "finalized" | "updated",
  sessionId: string,
  row: { finalizedAt?: Date | null; taskYahlPath?: string | null; updatedAt?: Date | null } | null,
) => {
  emitSessionsLifecycle({
    eventType,
    finalizedAt: row?.finalizedAt ? new Date(row.finalizedAt).toISOString() : null,
    sessionId,
    taskYahlPath: typeof row?.taskYahlPath === "string" ? row.taskYahlPath : null,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  });
};

export const registerSessionMetadata = async (sessionId: string, taskYahlPath: string) => {
  const now = new Date();

  const result = await SessionModel.updateOne(
    { sessionId },
    {
      $set: {
        taskYahlPath,
        updatedAt: now,
      },
      $setOnInsert: {
        events: [],
        modelAggregates: {},
        sessionId,
      },
    },
    { upsert: true },
  );

  const row = await SessionModel.findOne({ sessionId }).lean();

  emitSessionMeta(sessionId, metaFromRow(sessionId, row));
  emitLifecycle(result.upsertedCount > 0 ? "created" : "updated", sessionId, row);
};

export const appendUsageEvent = async (payload: SessionUsagePayload) => {
  const now = new Date();
  const modelKey = payload.model;
  const safeCost = toNumber(payload.cost);
  const current = await SessionModel.findOne({ sessionId: payload.sessionId });

  if (!current) {
    await SessionModel.create({
      events: [payload],
      modelAggregates: {
        [modelKey]: {
          cacheHitTokens: payload.usage.cacheHitTokens,
          cacheMissTokens: payload.usage.cacheMissTokens,
          calls: 1,
          completionTokens: payload.usage.completionTokens,
          cost: safeCost,
          reasoningTokens: payload.usage.reasoningTokens,
        },
      },
      sessionId: payload.sessionId,
    });

    emitSessionStep(payload.sessionId, stepSummary(payload.sessionId, 0, payload));
    emitLifecycle("created", payload.sessionId, await SessionModel.findOne({ sessionId: payload.sessionId }).lean());

    return;
  }

  current.events.push(payload);

  const stepIndex = current.events.length - 1;

  const aggregates = (current.modelAggregates || {}) as Record<string, {
    cacheHitTokens: number;
    cacheMissTokens: number;
    calls: number;
    completionTokens: number;
    cost: number;
    reasoningTokens: number;
  }>;

  const aggregate = aggregates[modelKey] || {
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    calls: 0,
    completionTokens: 0,
    cost: 0,
    reasoningTokens: 0,
  };

  aggregate.cacheHitTokens += payload.usage.cacheHitTokens;
  aggregate.cacheMissTokens += payload.usage.cacheMissTokens;
  aggregate.calls += 1;
  aggregate.completionTokens += payload.usage.completionTokens;
  aggregate.cost += safeCost;
  aggregate.reasoningTokens += payload.usage.reasoningTokens;
  aggregates[modelKey] = aggregate;
  current.modelAggregates = aggregates;
  current.updatedAt = now;
  await current.save();

  emitSessionStep(payload.sessionId, stepSummary(payload.sessionId, stepIndex, payload));
  emitLifecycle("updated", payload.sessionId, current.toObject());
};

export const finalizeSession = async (sessionId: string, result?: unknown) => {
  const updateSet: Record<string, unknown> = {
    finalizedAt: new Date(),
  };
  if (result !== undefined) {
    updateSet.result = result;
  }

  await SessionModel.updateOne(
    { sessionId },
    { $set: updateSet },
    { upsert: true },
  );

  const row = await SessionModel.findOne({ sessionId }).lean();

  emitSessionMeta(sessionId, metaFromRow(sessionId, row));
  emitLifecycle("finalized", sessionId, row);
};

export const listSessions = async (limit: number, offset: number) => {
  const rows = await SessionModel.find({})
    .sort({ updatedAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return rows.map((row) => {
    const events = row.events || [];
    const totalCalls = events.length;
    const totalCost = events.reduce((sum, event) => sum + toNumber(event?.cost), 0);
    const totalInputTokens = events.reduce(
      (sum, event) => sum + toNumber(event?.usage?.cacheHitTokens) + toNumber(event?.usage?.cacheMissTokens),
      0,
    );
    const totalOutputTokens = events.reduce((sum, event) => sum + toNumber(event?.usage?.completionTokens), 0);
    const totalUsedTimeMs = events.reduce((sum, event) => {
      if (typeof event?.response?.durationMs !== "number" || !Number.isFinite(event.response.durationMs)) return sum;

      return sum + event.response.durationMs;
    }, 0);

    return {
      createdAt: row.createdAt,
      finalizedAt: row.finalizedAt || null,
      sessionId: row.sessionId,
      taskYahlPath: row.taskYahlPath ?? null,
      totalCalls,
      totalCost,
      totalUsedTimeMs,
      totalInputTokens,
      totalOutputTokens,
      updatedAt: row.updatedAt,
    };
  });
};

export const getSession = async (sessionId: string) =>
  SessionModel.findOne({ sessionId }).lean();
