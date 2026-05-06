import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";

import {
  Session,
  SessionModelSpend,
  SessionStage,
  SessionStageChatMessage,
  SessionToolCall,
} from "../../models";
import { createStageModelResponse } from "../../session-service";
import type { CreateModelResponsePayload } from "../../types";

type Restorer = () => void;

const restorers: Restorer[] = [];

const mockMethod = <T extends object, K extends keyof T>(obj: T, key: K, value: T[K]) => {
  const original = obj[key];
  restorers.push(() => {
    obj[key] = original;
  });
  obj[key] = value;
};

const chain = (result: unknown) => ({
  lean: async () => result,
  select: () => chain(result),
  sort: () => chain(result),
});

const payload = (): CreateModelResponsePayload => ({
  chatMessages: [
    { content: "A", reasoning: "rA", role: "assistant" },
    { content: "B", role: "assistant" },
  ],
  model: "gpt",
  requestId: "req-1",
  thinkingMode: false,
  timestamp: new Date().toISOString(),
  usage: {
    cacheHitTokens: 1,
    cacheMissTokens: 2,
    completionTokens: 3,
    reasoningTokens: 4,
  },
});

afterEach(() => {
  while (restorers.length) {
    const restore = restorers.pop();
    restore?.();
  }
});

describe("createStageModelResponse sequencing", () => {
  it("starts at sequence 0 when no existing stage chat messages", async () => {
    const sessionObjectId = new mongoose.Types.ObjectId();
    const stageObjectId = new mongoose.Types.ObjectId();
    const inserted: Array<{ reasoning?: string | null; sequence: number }> = [];

    mockMethod(SessionStage, "findOne", (() =>
      chain({
        _id: stageObjectId,
        contextAfter: null,
        contextAfterTruncated: false,
        contextBefore: null,
        contextBeforeTruncated: false,
        currentStage: "stage",
        executionMeta: {},
        requestId: "req-1",
        session: sessionObjectId,
        stageIndex: 0,
      })) as never);
    mockMethod(SessionModelSpend, "create", (async () => ({ _id: new mongoose.Types.ObjectId() })) as never);
    mockMethod(SessionToolCall, "find", (() => chain([])) as never);
    let chatFilter: unknown;
    mockMethod(SessionStageChatMessage, "findOne", (((filter: unknown) => {
      chatFilter = filter;
      return chain(null);
    }) as unknown) as never);
    mockMethod(SessionStageChatMessage, "insertMany", (async (docs: Array<{ sequence: number }>) => {
      inserted.push(...docs);
      return docs;
    }) as never);
    mockMethod(SessionStage, "updateOne", (async () => ({})) as never);
    mockMethod(Session, "updateOne", (async () => ({})) as never);
    mockMethod(Session, "findOne", (() => chain({ sessionId: "s1" })) as never);

    await createStageModelResponse("s1", "stage-1", payload());

    assert.deepEqual(
      inserted.map((doc) => doc.sequence),
      [0, 1],
    );
    assert.deepEqual(inserted.map((doc) => doc.reasoning), ["rA", null]);
    assert.deepEqual(chatFilter, { requestId: "req-1", sessionId: "s1" });
  });

  it("continues from max sequence for same requestId", async () => {
    const sessionObjectId = new mongoose.Types.ObjectId();
    const stageObjectId = new mongoose.Types.ObjectId();
    const inserted: Array<{ sequence: number }> = [];

    mockMethod(SessionStage, "findOne", (() =>
      chain({
        _id: stageObjectId,
        contextAfter: null,
        contextAfterTruncated: false,
        contextBefore: null,
        contextBeforeTruncated: false,
        currentStage: "stage",
        executionMeta: {},
        requestId: "req-1",
        session: sessionObjectId,
        stageIndex: 0,
      })) as never);
    mockMethod(SessionModelSpend, "create", (async () => ({ _id: new mongoose.Types.ObjectId() })) as never);
    mockMethod(SessionToolCall, "find", (() => chain([])) as never);
    mockMethod(SessionStageChatMessage, "findOne", (() => chain({ sequence: 4 })) as never);
    mockMethod(SessionStageChatMessage, "insertMany", (async (docs: Array<{ sequence: number }>) => {
      inserted.push(...docs);
      return docs;
    }) as never);
    mockMethod(SessionStage, "updateOne", (async () => ({})) as never);
    mockMethod(Session, "updateOne", (async () => ({})) as never);
    mockMethod(Session, "findOne", (() => chain({ sessionId: "s1" })) as never);

    await createStageModelResponse("s1", "stage-1", payload());

    assert.deepEqual(
      inserted.map((doc) => doc.sequence),
      [5, 6],
    );
  });

  it("restarts sequence for a different requestId", async () => {
    const sessionObjectId = new mongoose.Types.ObjectId();
    const stageObjectId = new mongoose.Types.ObjectId();
    const inserted: Array<{ sequence: number }> = [];

    mockMethod(SessionStage, "findOne", (() =>
      chain({
        _id: stageObjectId,
        contextAfter: null,
        contextAfterTruncated: false,
        contextBefore: null,
        contextBeforeTruncated: false,
        currentStage: "stage",
        executionMeta: {},
        requestId: "req-2",
        session: sessionObjectId,
        stageIndex: 0,
      })) as never);
    mockMethod(SessionModelSpend, "create", (async () => ({ _id: new mongoose.Types.ObjectId() })) as never);
    mockMethod(SessionToolCall, "find", (() => chain([])) as never);
    mockMethod(SessionStageChatMessage, "findOne", (() => chain(null)) as never);
    mockMethod(SessionStageChatMessage, "insertMany", (async (docs: Array<{ sequence: number }>) => {
      inserted.push(...docs);
      return docs;
    }) as never);
    mockMethod(SessionStage, "updateOne", (async () => ({})) as never);
    mockMethod(Session, "updateOne", (async () => ({})) as never);
    mockMethod(Session, "findOne", (() => chain({ sessionId: "s1" })) as never);

    await createStageModelResponse("s1", "stage-1", payload());

    assert.deepEqual(
      inserted.map((doc) => doc.sequence),
      [0, 1],
    );
  });
});
