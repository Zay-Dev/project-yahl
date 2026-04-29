import { SessionModel } from "./session-model";
import type { SessionUsagePayload } from "./types";

const toNumber = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;

  return value;
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

    return;
  }

  current.events.push(payload);

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
};

export const finalizeSession = async (sessionId: string) => {
  await SessionModel.updateOne(
    { sessionId },
    { $set: { finalizedAt: new Date() } },
    { upsert: true },
  );
};

export const listSessions = async (limit: number, offset: number) => {
  const rows = await SessionModel.find({})
    .sort({ updatedAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return rows.map((row) => {
    const modelEntries = Object.values(row.modelAggregates || {});
    const totalCost = modelEntries.reduce((sum, item) => sum + item.cost, 0);
    const totalCalls = modelEntries.reduce((sum, item) => sum + item.calls, 0);
    const totalInputTokens = modelEntries.reduce(
      (sum, item) => sum + item.cacheHitTokens + item.cacheMissTokens,
      0,
    );
    const totalOutputTokens = modelEntries.reduce(
      (sum, item) => sum + item.completionTokens,
      0,
    );

    return {
      createdAt: row.createdAt,
      finalizedAt: row.finalizedAt || null,
      sessionId: row.sessionId,
      totalCalls,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      updatedAt: row.updatedAt,
    };
  });
};

export const getSession = async (sessionId: string) =>
  SessionModel.findOne({ sessionId }).lean();
