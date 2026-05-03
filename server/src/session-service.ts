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
import type {
  SessionMetaSsePayload,
  SessionStepChatMessage,
  SessionStepSsePayload,
} from "./session-sse-hub";
import type {
  CreateModelResponsePayload,
  CreateStagePayload,
  CreateToolCallsPayload,
  LegacySessionEventWire,
  ParsedStageWire,
  PatchStageRuntimeSnapshotPayload,
  SessionChatMessagePayload,
  SessionForkLineagePayload,
  ToolCallWire,
} from "./types";

const toNumber = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;

  return value;
};

const replyPreview = (reply: string | null | undefined) => {
  if (typeof reply !== "string" || !reply) return null;

  const max = 200;

  return reply.length <= max ? reply : `${reply.slice(0, max)}…`;
};

const stepSummary = (
  sessionId: string,
  stage: {
    contextAfter?: unknown;
    contextAfterTruncated?: boolean;
    contextBefore?: unknown;
    contextBeforeTruncated?: boolean;
    cost?: number;
    currentStage?: string;
    executionMeta?: unknown;
    requestId: string;
    stageIndex: number;
  },
  modelEvent: CreateModelResponsePayload,
  stageChat: SessionStepChatMessage[],
): SessionStepSsePayload => {
  const durationMs =
    typeof modelEvent.durationMs === "number" && Number.isFinite(modelEvent.durationMs)
      ? modelEvent.durationMs
      : null;

  const responseDurationMs =
    typeof modelEvent.response?.durationMs === "number" && Number.isFinite(modelEvent.response.durationMs)
      ? modelEvent.response.durationMs
      : durationMs;

  const stageInput = stage.currentStage
    ? { context: stage.contextBefore, currentStage: stage.currentStage }
    : stage.contextBefore;

  return {
    contextAfter: stage.contextAfter,
    contextAfterTruncated: stage.contextAfterTruncated,
    cost: toNumber(modelEvent.cost ?? stage.cost),
    currentStage: stage.currentStage ?? null,
    durationMs,
    executionMeta: stage.executionMeta,
    model: modelEvent.model,
    replyPreview: replyPreview(modelEvent.response?.reply),
    requestId: stage.requestId,
    response: modelEvent.response
      ? {
        durationMs: responseDurationMs,
        reasoning: modelEvent.response.reasoning ?? null,
        reply: modelEvent.response.reply ?? null,
        toolCalls: modelEvent.response.toolCalls,
      }
      : null,
    sessionId,
    stageChat: stageChat.length ? stageChat : undefined,
    stageInput,
    stageInputTruncated: stage.contextBeforeTruncated,
    stepIndex: stage.stageIndex,
    thinkingMode: modelEvent.thinkingMode,
    timestamp: modelEvent.timestamp,
    usage: {
      cacheHitTokens: modelEvent.usage.cacheHitTokens,
      cacheMissTokens: modelEvent.usage.cacheMissTokens,
      completionTokens: modelEvent.usage.completionTokens,
      reasoningTokens: modelEvent.usage.reasoningTokens,
    },
  };
};

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

const toolDocFrom = (
  raw: ToolCallWire,
  callIndex: number,
  ids: { session: mongoose.Types.ObjectId; sessionId: string; stage: mongoose.Types.ObjectId; stageId: string },
) => {
  const fn = raw.function;
  const name = typeof fn?.name === "string" ? fn.name : "";
  const args = fn?.arguments;

  return {
    arguments: args,
    callIndex,
    externalToolCallId: typeof raw.id === "string" ? raw.id : undefined,
    name: name || "unknown_tool",
    session: ids.session,
    sessionId: ids.sessionId,
    stage: ids.stage,
    stageId: ids.stageId,
    status: "ok",
  };
};

const buildLegacyEvent = (
  sessionId: string,
  stage: {
    cost?: number;
    contextAfter?: unknown;
    contextAfterTruncated?: boolean;
    contextBefore?: unknown;
    contextBeforeTruncated?: boolean;
    currentStage?: string;
    executionMeta?: unknown;
    llmReplyEnvelope?: { durationMs?: number; reasoning: string | null; reply: string | null };
    model?: string;
    requestId: string;
    stageIndex: number;
    thinkingMode?: boolean;
    timestamp: string;
    usage?: {
      cacheHitTokens: number;
      cacheMissTokens: number;
      completionTokens: number;
      reasoningTokens: number;
    };
  },
  toolRows: { arguments?: unknown; callIndex: number; name: string; result?: unknown }[],
  chatRows: { content?: unknown; modelSpendId?: unknown; role: string; sequence: number; toolCallId?: unknown }[],
): LegacySessionEventWire => {
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

  const currentStageFromMeta = () => {
    const em = stage.executionMeta;
    if (!em || typeof em !== "object" || Array.isArray(em)) return "";

    const sr = (em as Record<string, unknown>).sourceRef;
    if (!sr || typeof sr !== "object" || Array.isArray(sr)) return "";

    const text = (sr as Record<string, unknown>).text;
    return typeof text === "string" ? text : "";
  };

  const fromDb = typeof stage.currentStage === "string" ? stage.currentStage : "";
  const fromMeta = currentStageFromMeta();
  const resolvedCurrentStage = fromDb.trim() || fromMeta.trim() || fromDb;
  const wireCurrentStage = resolvedCurrentStage.trim() ? resolvedCurrentStage : undefined;

  const stageInput = {
    context: stage.contextBefore,
    currentStage: wireCurrentStage ?? "",
  };

  return {
    contextAfter: stage.contextAfter,
    contextAfterTruncated: stage.contextAfterTruncated,
    contextBefore: stage.contextBefore,
    contextBeforeTruncated: stage.contextBeforeTruncated,
    cost: stage.cost,
    currentStage: wireCurrentStage,
    executionMeta: stage.executionMeta,
    model: stage.model ?? "",
    requestId: stage.requestId,
    response,
    sessionId,
    stageChat: stageChat.length ? stageChat : undefined,
    stageIndex: stage.stageIndex,
    stageInput,
    stageInputTruncated: stage.contextBeforeTruncated,
    thinkingMode: stage.thinkingMode ?? false,
    timestamp: stage.timestamp,
    usage: stage.usage ?? {
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      completionTokens: 0,
      reasoningTokens: 0,
    },
  };
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

const requireSessionId = async (sessionId: string) => {
  const session = await Session.findOne({ sessionId }).lean();
  if (!session?._id) {
    throw new Error(`session not found: ${sessionId}`);
  }
  return session._id as mongoose.Types.ObjectId;
};

const requireStage = async (sessionId: string, stageId: string) => {
  const stage = await SessionStage.findOne({ sessionId, stageId }).lean();
  if (!stage?._id) {
    throw new Error(`stage not found: ${sessionId}/${stageId}`);
  }
  return stage;
};

export const createStage = async (sessionId: string, payload: CreateStagePayload) => {
  const sessionObjId = await requireSessionId(sessionId);
  const stageIndex = await SessionStage.countDocuments({ sessionId });

  const created = await SessionStage.create({
    contextBefore: payload.contextBefore,
    contextBeforeTruncated: payload.contextBeforeTruncated,
    currentStage: payload.currentStage,
    executionMeta: payload.executionMeta,
    requestId: payload.requestId,
    session: sessionObjId,
    sessionId,
    stageId: payload.stageId,
    stageIndex,
    timestamp: payload.timestamp,
  });

  await Session.updateOne(
    { sessionId },
    { $set: { updatedAt: new Date() } },
  );

  const row = await Session.findOne({ sessionId }).lean();
  emitLifecycle("updated", sessionId, row);

  return { stageIndex, _id: created._id as mongoose.Types.ObjectId };
};

export const createStageToolCalls = async (
  sessionId: string,
  stageId: string,
  payload: CreateToolCallsPayload,
) => {
  if (!payload.toolCalls.length) return;

  const stage = await requireStage(sessionId, stageId);
  const sessionObjId = stage.session as mongoose.Types.ObjectId;
  const stageObjId = stage._id as mongoose.Types.ObjectId;

  const docs = payload.toolCalls.map((raw, callIndex) =>
    toolDocFrom(raw, callIndex, {
      session: sessionObjId,
      sessionId,
      stage: stageObjId,
      stageId,
    }),
  );

  await SessionToolCall.insertMany(docs, { ordered: false });
};

export const createStageModelResponse = async (
  sessionId: string,
  stageId: string,
  payload: CreateModelResponsePayload,
) => {
  const stage = await requireStage(sessionId, stageId);
  const sessionObjId = stage.session as mongoose.Types.ObjectId;
  const stageObjId = stage._id as mongoose.Types.ObjectId;
  const safeCost = toNumber(payload.cost);

  const spend = await SessionModelSpend.create({
    cacheHitTokens: payload.usage.cacheHitTokens,
    cacheMissTokens: payload.usage.cacheMissTokens,
    completionTokens: payload.usage.completionTokens,
    cost: safeCost,
    durationMs: payload.durationMs,
    model: payload.model,
    reasoningTokens: payload.usage.reasoningTokens,
    requestId: payload.requestId,
    session: sessionObjId,
    sessionId,
    stage: stageObjId,
    stageId,
  });

  const tools = await SessionToolCall.find({ sessionId, stageId }).sort({ callIndex: 1 }).lean();
  const toolIdByIndex = new Map<number, mongoose.Types.ObjectId>();
  tools.forEach((tool) => {
    toolIdByIndex.set(tool.callIndex, tool._id as mongoose.Types.ObjectId);
  });

  const chatIncoming: SessionChatMessagePayload[] = payload.chatMessages?.length
    ? payload.chatMessages
    : [
      {
        content: payload.response?.reply ?? "",
        role: "assistant",
      },
    ];

  const chatDocs = chatIncoming.map((msg, sequence) => ({
    content: msg.content,
    modelSpendId: spend._id as mongoose.Types.ObjectId,
    role: msg.role,
    sequence,
    session: sessionObjId,
    sessionId,
    stage: stageObjId,
    stageId,
    toolCallId:
      typeof msg.toolCallIndex === "number" && toolIdByIndex.has(msg.toolCallIndex)
        ? toolIdByIndex.get(msg.toolCallIndex)
        : undefined,
    usageDelta: msg.usageDelta,
  }));

  if (chatDocs.length) {
    await SessionStageChatMessage.insertMany(chatDocs, { ordered: false });
  }

  await SessionStage.updateOne(
    { _id: stageObjId },
    {
      $set: {
        cost: safeCost,
        llmReplyEnvelope: payload.response
          ? {
            durationMs: payload.response.durationMs ?? payload.durationMs,
            reasoning: payload.response.reasoning ?? null,
            reply: payload.response.reply ?? null,
          }
          : undefined,
        model: payload.model,
        thinkingMode: payload.thinkingMode,
        timestamp: payload.timestamp,
        usage: {
          cacheHitTokens: payload.usage.cacheHitTokens,
          cacheMissTokens: payload.usage.cacheMissTokens,
          completionTokens: payload.usage.completionTokens,
          reasoningTokens: payload.usage.reasoningTokens,
        },
      },
    },
  );

  await Session.updateOne(
    { sessionId },
    { $set: { updatedAt: new Date() } },
  );

  const sseChatMessages: SessionStepChatMessage[] = chatDocs.map((doc) => ({
    content: doc.content,
    modelSpendId: doc.modelSpendId ? String(doc.modelSpendId) : undefined,
    role: doc.role,
    toolCallId: doc.toolCallId ? String(doc.toolCallId) : undefined,
  }));

  emitSessionStep(
    sessionId,
    stepSummary(
      sessionId,
      {
        contextAfter: stage.contextAfter,
        contextAfterTruncated: stage.contextAfterTruncated,
        contextBefore: stage.contextBefore,
        contextBeforeTruncated: stage.contextBeforeTruncated,
        cost: safeCost,
        currentStage: stage.currentStage,
        executionMeta: stage.executionMeta,
        requestId: stage.requestId,
        stageIndex: stage.stageIndex,
      },
      payload,
      sseChatMessages,
    ),
  );

  emitLifecycle("updated", sessionId, await Session.findOne({ sessionId }).lean());
};

export const patchStageRuntimeSnapshot = async (
  sessionId: string,
  stageId: string,
  payload: PatchStageRuntimeSnapshotPayload,
) => {
  const $set: Record<string, unknown> = {};
  if (payload.contextAfter !== undefined) $set.contextAfter = payload.contextAfter;
  if (payload.contextBefore !== undefined) $set.contextBefore = payload.contextBefore;
  if (Object.keys($set).length === 0) return;

  await SessionStage.updateOne({ sessionId, stageId }, { $set });
};

export const finalizeSession = async (
  sessionId: string,
  opts?: { result?: unknown; stages?: ParsedStageWire[] },
) => {
  const updateSet: Record<string, unknown> = {
    finalizedAt: new Date(),
  };
  if (opts?.result !== undefined) {
    updateSet.result = opts.result;
  }
  if (opts?.stages) {
    updateSet.stages = opts.stages;
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
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    totalUsedTimeMs: row.totalUsedTimeMs,
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

  const toolsByStage = new Map<string, typeof tools>();
  for (const t of tools) {
    const list = toolsByStage.get(t.stageId) ?? [];
    list.push(t);
    toolsByStage.set(t.stageId, list);
  }

  const chatsByStage = new Map<string, typeof chats>();
  for (const c of chats) {
    const list = chatsByStage.get(c.stageId) ?? [];
    list.push(c);
    chatsByStage.set(c.stageId, list);
  }

  return stages.map((stage) =>
    buildLegacyEvent(
      sourceSessionId,
      stage,
      toolsByStage.get(stage.stageId) ?? [],
      chatsByStage.get(stage.stageId) ?? [],
    ),
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

  const toolsByStage = new Map<string, typeof tools>();
  for (const t of tools) {
    const list = toolsByStage.get(t.stageId) ?? [];
    list.push(t);
    toolsByStage.set(t.stageId, list);
  }

  const chatsByStage = new Map<string, typeof chats>();
  for (const c of chats) {
    const list = chatsByStage.get(c.stageId) ?? [];
    list.push(c);
    chatsByStage.set(c.stageId, list);
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
    const row = modelAggregates[s.model] ?? {
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      calls: 0,
      completionTokens: 0,
      cost: 0,
      reasoningTokens: 0,
    };

    row.cacheHitTokens += s.cacheHitTokens;
    row.cacheMissTokens += s.cacheMissTokens;
    row.calls += 1;
    row.completionTokens += s.completionTokens;
    row.cost += s.cost;
    row.reasoningTokens += s.reasoningTokens;

    modelAggregates[s.model] = row;
  }

  const events = stages.map((stage) =>
    buildLegacyEvent(sessionId, stage, toolsByStage.get(stage.stageId) ?? [], chatsByStage.get(stage.stageId) ?? []),
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
