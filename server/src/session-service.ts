import mongoose from "mongoose";

import {
  Session,
  SessionForkLineage,
  SessionModelSpend,
  SessionStage,
  SessionStageChatMessage,
  SessionToolCall,
} from "./models";
import { emitSessionMeta, emitSessionStep, emitSessionsLifecycle } from "./session-sse-hub";
import type { SessionMetaSsePayload, SessionStepSsePayload } from "./session-sse-hub";
import type {
  SessionChatMessagePayload,
  SessionForkLineagePayload,
  SessionRuntimeSnapshotPatchPayload,
  SessionUsagePayload,
} from "./types";

const toNumber = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;

  return value;
};

const replyPreviewFromPayload = (payload: SessionUsagePayload) => {
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
  replyPreview: replyPreviewFromPayload(payload),
  sessionId,
  stageInput: payload.stageInput ?? payload.contextBefore,
  stageInputTruncated: payload.stageInputTruncated ?? payload.contextBeforeTruncated,
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
  eventType: "archived" | "created" | "deleted" | "finalized" | "updated",
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

const toolDocsFromResponse = (
  sessionId: string,
  stageIndex: number,
  toolCalls: unknown[] | undefined,
) => {
  if (!toolCalls?.length) return [];

  return toolCalls.map((raw, callIndex) => {
    const name =
      raw && typeof raw === "object" && !Array.isArray(raw) && (raw as Record<string, unknown>).function
        ? String((raw as { function?: { name?: string } }).function?.name || "")
        : "";
    const externalId =
      raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as { id?: string }).id === "string"
        ? (raw as { id: string }).id
        : undefined;
    const fn =
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>).function : null;
    const args =
      fn && typeof fn === "object" && !Array.isArray(fn) && typeof (fn as Record<string, unknown>).arguments === "string"
        ? (fn as { arguments: string }).arguments
        : fn && typeof fn === "object" && !Array.isArray(fn) ? (fn as Record<string, unknown>).arguments : undefined;

    return {
      arguments: args,
      callIndex,
      externalToolCallId: externalId,
      name: name || "unknown_tool",
      sessionId,
      stageIndex,
      status: "ok",
    };
  });
};

const buildLegacyEvent = (
  sessionId: string,
  stage: {
    cost?: number;
    contextAfter?: unknown;
    contextAfterTruncated?: boolean;
    contextBefore?: unknown;
    contextBeforeTruncated?: boolean;
    executionMeta?: unknown;
    llmReplyEnvelope?: { durationMs?: number; reasoning: string | null; reply: string | null };
    model: string;
    requestId: string;
    stageIndex: number;
    thinkingMode: boolean;
    timestamp: string;
    usage: SessionUsagePayload["usage"];
  },
  toolRows: { arguments?: unknown; callIndex: number; name: string; result?: unknown }[],
  chatRows: { content?: unknown; modelSpendId?: unknown; role: string; sequence: number; toolCallId?: unknown }[],
) => {
  const toolCalls = toolRows
    .slice()
    .sort((a, b) => a.callIndex - b.callIndex)
    .map((row) => ({
      function: {
        arguments: typeof row.arguments === "string" ? row.arguments : JSON.stringify(row.arguments ?? {}),
        name: row.name,
      },
      id: `persisted-${stage.stageIndex}-${row.callIndex}`,
      type: "function" as const,
    }));

  const stageChat = chatRows
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((row) => ({
      content: row.content,
      modelSpendId: row.modelSpendId ? String(row.modelSpendId) : undefined,
      role: row.role,
      toolCallId: row.toolCallId ? String(row.toolCallId) : undefined,
    }));

  const response = stage.llmReplyEnvelope
    ? {
      durationMs: stage.llmReplyEnvelope.durationMs ?? 0,
      reasoning: stage.llmReplyEnvelope.reasoning,
      reply: stage.llmReplyEnvelope.reply,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    }
    : undefined;

  return {
    cost: stage.cost,
    contextAfter: stage.contextAfter,
    contextAfterTruncated: stage.contextAfterTruncated,
    contextBefore: stage.contextBefore,
    contextBeforeTruncated: stage.contextBeforeTruncated,
    executionMeta: stage.executionMeta,
    model: stage.model,
    requestId: stage.requestId,
    response,
    sessionId,
    stageChat: stageChat.length ? stageChat : undefined,
    stageIndex: stage.stageIndex,
    stageInput: stage.contextBefore,
    stageInputTruncated: stage.contextBeforeTruncated,
    thinkingMode: stage.thinkingMode,
    timestamp: stage.timestamp,
    usage: stage.usage,
  } as SessionUsagePayload;
};

export const registerSessionMetadata = async (sessionId: string, taskYahlPath: string) => {
  const now = new Date();
  const result = await Session.updateOne(
    { sessionId },
    {
      $set: {
        taskYahlPath,
        updatedAt: now,
      },
      $setOnInsert: {
        sessionId,
      },
    },
    { upsert: true },
  );

  const row = await Session.findOne({ sessionId }).lean();

  emitSessionMeta(sessionId, metaFromRow(sessionId, row));
  emitLifecycle(result.upsertedCount > 0 ? "created" : "updated", sessionId, row);
};

export const registerSessionMetadataWithFork = async (
  sessionId: string,
  taskYahlPath: string,
  forkLineage: SessionForkLineagePayload | undefined,
) => {
  const now = new Date();

  const result = await Session.updateOne(
    { sessionId },
    {
      $set: {
        taskYahlPath,
        updatedAt: now,
      },
      $setOnInsert: {
        sessionId,
      },
    },
    { upsert: true },
  );

  if (forkLineage) {
    await SessionForkLineage.replaceOne(
      { sessionId },
      {
        sessionId,
        sourceRequestId: forkLineage.sourceRequestId,
        sourceSessionId: forkLineage.sourceSessionId,
        stageIndex: forkLineage.stageIndex,
      },
      { upsert: true },
    );
  }

  const row = await Session.findOne({ sessionId }).lean();

  emitSessionMeta(sessionId, metaFromRow(sessionId, row));
  emitLifecycle(result.upsertedCount > 0 ? "created" : "updated", sessionId, row);
};

const patchRuntimeSnapshotsByRequest = async (
  sessionId: string,
  requestId: string,
  patch: { contextAfter?: unknown; contextBefore?: unknown },
) => {
  const $set: Record<string, unknown> = {};
  if (patch.contextAfter !== undefined) $set.contextAfter = patch.contextAfter;
  if (patch.contextBefore !== undefined) $set.contextBefore = patch.contextBefore;
  if (Object.keys($set).length === 0) return;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const res = await SessionStage.updateMany(
      { requestId, sessionId },
      { $set },
    );

    if (res.matchedCount > 0) return;
    await new Promise((r) => setTimeout(r, 40));
  }
};

export const appendUsageEvent = async (payload: SessionUsagePayload | SessionRuntimeSnapshotPatchPayload) => {
  if ("runtimeSnapshotPatch" in payload && payload.runtimeSnapshotPatch === true) {
    await patchRuntimeSnapshotsByRequest(payload.sessionId, payload.requestId, {
      contextAfter: payload.contextAfter,
      contextBefore: payload.contextBefore,
    });
    return;
  }

  const p = payload as SessionUsagePayload;
  const now = new Date();
  const safeCost = toNumber(p.cost);
  const modelKey = p.model;
  const firstPersistedRow = !(await Session.exists({ sessionId: p.sessionId }));

  const contextBefore = p.contextBefore ?? p.stageInput;
  const contextBeforeTruncated = p.contextBeforeTruncated ?? p.stageInputTruncated;

  const spend = await SessionModelSpend.findOneAndUpdate(
    { model: modelKey, sessionId: p.sessionId },
    {
      $inc: {
        cacheHitTokens: p.usage.cacheHitTokens,
        cacheMissTokens: p.usage.cacheMissTokens,
        calls: 1,
        completionTokens: p.usage.completionTokens,
        cost: safeCost,
        reasoningTokens: p.usage.reasoningTokens,
      },
      $setOnInsert: {
        model: modelKey,
        sessionId: p.sessionId,
      },
    },
    { new: true, upsert: true },
  );

  const stageIndex = await SessionStage.countDocuments({ sessionId: p.sessionId });

  const toolDocs = toolDocsFromResponse(p.sessionId, stageIndex, p.response?.toolCalls);
  const insertedTools = toolDocs.length
    ? await SessionToolCall.insertMany(toolDocs)
    : [];

  const toolIdByIndex = new Map<number, mongoose.Types.ObjectId>();
  insertedTools.forEach((doc, i) => {
    toolIdByIndex.set(doc.callIndex, doc._id as mongoose.Types.ObjectId);
  });

  const chatIncoming = p.chatMessages?.length
    ? p.chatMessages
    : [
      {
        content: p.response?.reply ?? "",
        role: "assistant",
      },
    ];

  const chatDocs = chatIncoming.map((msg: SessionChatMessagePayload, sequence: number) => ({
    content: msg.content,
    modelSpendId: spend?._id as mongoose.Types.ObjectId,
    role: msg.role,
    sequence,
    sessionId: p.sessionId,
    stageIndex,
    toolCallId:
      typeof msg.toolCallIndex === "number" && toolIdByIndex.has(msg.toolCallIndex)
        ? toolIdByIndex.get(msg.toolCallIndex)
        : undefined,
    usageDelta: msg.usageDelta,
  }));

  if (chatDocs.length) {
    await SessionStageChatMessage.insertMany(chatDocs);
  }

  await SessionStage.create({
    contextAfter: p.contextAfter,
    contextAfterTruncated: p.contextAfterTruncated,
    contextBefore,
    contextBeforeTruncated,
    cost: safeCost,
    executionMeta: p.executionMeta,
    llmReplyEnvelope: p.response
      ? {
        durationMs: p.response.durationMs,
        reasoning:
          p.response.reasoning === undefined
            ? null
            : p.response.reasoning,
        reply: p.response.reply === undefined ? null : p.response.reply,
      }
      : undefined,
    model: modelKey,
    requestId: p.requestId,
    sessionId: p.sessionId,
    stageIndex,
    thinkingMode: p.thinkingMode,
    timestamp: p.timestamp,
    usage: p.usage,
  });

  await Session.updateOne(
    { sessionId: p.sessionId },
    {
      $set: { updatedAt: now },
      $setOnInsert: { sessionId: p.sessionId },
    },
    { upsert: true },
  );

  emitSessionStep(p.sessionId, stepSummary(p.sessionId, stageIndex, p));
  emitLifecycle(
    firstPersistedRow ? "created" : "updated",
    p.sessionId,
    await Session.findOne({ sessionId: p.sessionId }).lean(),
  );
};

export const finalizeSession = async (sessionId: string, result?: unknown) => {
  const updateSet: Record<string, unknown> = {
    finalizedAt: new Date(),
  };
  if (result !== undefined) {
    updateSet.result = result;
  }

  await Session.updateOne(
    { sessionId },
    { $set: updateSet },
    { upsert: true },
  );

  const row = await Session.findOne({ sessionId }).lean();

  emitSessionMeta(sessionId, metaFromRow(sessionId, row));
  emitLifecycle("finalized", sessionId, row);
};

export const listSessions = async (limit: number, offset: number, includeArchived = false) => {
  const match: Record<string, unknown> = includeArchived ? {} : { archivedAt: { $exists: false } };

  const rows = await Session.aggregate<{
    archivedAt: Date | null;
    createdAt: Date;
    finalizedAt: Date | null;
    sessionId: string;
    taskYahlPath: string | null;
    totalCalls: number;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalUsedTimeMs: number;
    updatedAt: Date;
  }>([
    { $match: match },
    { $sort: { updatedAt: -1 } },
    { $skip: offset },
    { $limit: limit },
    {
      $lookup: {
        as: "st",
        foreignField: "sessionId",
        from: "session_stages",
        localField: "sessionId",
      },
    },
    {
      $addFields: {
        totalCalls: { $size: "$st" },
        totalCost: { $sum: "$st.cost" },
        totalInputTokens: {
          $sum: {
            $map: {
              as: "e",
              in: {
                $add: [
                  { $ifNull: ["$$e.usage.cacheHitTokens", 0] },
                  { $ifNull: ["$$e.usage.cacheMissTokens", 0] },
                ],
              },
              input: "$st",
            },
          },
        },
        totalOutputTokens: {
          $sum: {
            $map: {
              as: "e",
              in: { $ifNull: ["$$e.usage.completionTokens", 0] },
              input: "$st",
            },
          },
        },
        totalUsedTimeMs: {
          $sum: {
            $map: {
              as: "e",
              in: {
                $cond: [
                  { $eq: [{ $type: "$$e.llmReplyEnvelope.durationMs" }, "number"] },
                  "$$e.llmReplyEnvelope.durationMs",
                  0,
                ],
              },
              input: "$st",
            },
          },
        },
      },
    },
    {
      $project: {
        archivedAt: 1,
        createdAt: 1,
        finalizedAt: 1,
        sessionId: 1,
        taskYahlPath: 1,
        totalCalls: 1,
        totalCost: 1,
        totalInputTokens: 1,
        totalOutputTokens: 1,
        totalUsedTimeMs: 1,
        updatedAt: 1,
      },
    },
  ]);

  return rows.map((row) => ({
    archivedAt: row.archivedAt || null,
    createdAt: row.createdAt,
    finalizedAt: row.finalizedAt || null,
    sessionId: row.sessionId,
    taskYahlPath: row.taskYahlPath ?? null,
    totalCalls: row.totalCalls,
    totalCost: row.totalCost,
    totalUsedTimeMs: row.totalUsedTimeMs,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    updatedAt: row.updatedAt,
  }));
};

export const buildPrefixDumpForRerun = async (sourceSessionId: string, resumeBeforeStageIndex: number) => {
  const stages = await SessionStage.find({
    sessionId: sourceSessionId,
    stageIndex: { $lt: resumeBeforeStageIndex },
  })
    .sort({ stageIndex: 1 })
    .lean();

  const tools = await SessionToolCall.find({ sessionId: sourceSessionId }).lean();
  const chats = await SessionStageChatMessage.find({ sessionId: sourceSessionId }).lean();

  const toolsByStage = new Map<number, typeof tools>();
  for (const t of tools) {
    const list = toolsByStage.get(t.stageIndex) ?? [];
    list.push(t);
    toolsByStage.set(t.stageIndex, list);
  }

  const chatsByStage = new Map<number, typeof chats>();
  for (const c of chats) {
    const list = chatsByStage.get(c.stageIndex) ?? [];
    list.push(c);
    chatsByStage.set(c.stageIndex, list);
  }

  return stages.map((stage) =>
    buildLegacyEvent(
      sourceSessionId,
      stage,
      toolsByStage.get(stage.stageIndex) ?? [],
      chatsByStage.get(stage.stageIndex) ?? [],
    ) as SessionUsagePayload,
  );
};

export const getSession = async (sessionId: string) => {
  const session = await Session.findOne({ sessionId }).lean();
  if (!session) return null;

  const stages = await SessionStage.find({ sessionId }).sort({ stageIndex: 1 }).lean();
  const tools = await SessionToolCall.find({ sessionId }).lean();
  const chats = await SessionStageChatMessage.find({ sessionId }).lean();
  const spends = await SessionModelSpend.find({ sessionId }).lean();
  const fork = await SessionForkLineage.findOne({ sessionId }).lean();

  const toolsByStage = new Map<number, typeof tools>();
  for (const t of tools) {
    const list = toolsByStage.get(t.stageIndex) ?? [];
    list.push(t);
    toolsByStage.set(t.stageIndex, list);
  }

  const chatsByStage = new Map<number, typeof chats>();
  for (const c of chats) {
    const list = chatsByStage.get(c.stageIndex) ?? [];
    list.push(c);
    chatsByStage.set(c.stageIndex, list);
  }

  const modelAggregates: Record<string, {
    cacheHitTokens: number;
    cacheMissTokens: number;
    calls: number;
    completionTokens: number;
    cost: number;
    reasoningTokens: number;
  }> = {};

  for (const s of spends) {
    modelAggregates[s.model] = {
      cacheHitTokens: s.cacheHitTokens,
      cacheMissTokens: s.cacheMissTokens,
      calls: s.calls,
      completionTokens: s.completionTokens,
      cost: s.cost,
      reasoningTokens: s.reasoningTokens,
    };
  }

  const events = stages.map((stage) =>
    buildLegacyEvent(sessionId, stage, toolsByStage.get(stage.stageIndex) ?? [], chatsByStage.get(stage.stageIndex) ?? []),
  );

  return {
    ...session,
    events,
    forkLineage: fork
      ? {
        sourceRequestId: fork.sourceRequestId,
        sourceSessionId: fork.sourceSessionId,
        stageIndex: fork.stageIndex,
      }
      : undefined,
    modelAggregates,
  };
};

export const getSessionStageForAnchor = async (sourceSessionId: string, stageIndex: number) =>
  SessionStage.findOne({ sessionId: sourceSessionId, stageIndex }).lean();

export const softDeleteSession = async (sessionId: string) => {
  const now = new Date();

  const row = await Session.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        archivedAt: now,
        updatedAt: now,
      },
    },
    { new: true },
  ).lean();

  if (!row) return false;

  emitSessionMeta(sessionId, metaFromRow(sessionId, row));
  emitLifecycle("archived", sessionId, row);
  return true;
};

export const hardDeleteSession = async (sessionId: string) => {
  const row = await Session.findOne({ sessionId }).lean();
  if (!row) return false;

  await Promise.all([
    SessionStageChatMessage.deleteMany({ sessionId }),
    SessionToolCall.deleteMany({ sessionId }),
    SessionStage.deleteMany({ sessionId }),
    SessionModelSpend.deleteMany({ sessionId }),
    SessionForkLineage.deleteMany({ sessionId }),
    Session.deleteOne({ sessionId }),
  ]);

  emitLifecycle("deleted", sessionId, row);
  return true;
};
