import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";

import {
  Session,
  SessionForkLineage,
  SessionModelSpend,
  SessionStage,
  SessionStageChatMessage,
  SessionToolCall,
} from "./models";
import { getSession } from "./session-service";

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
  sort: () => chain(result),
});

afterEach(() => {
  while (restorers.length) {
    const restore = restorers.pop();
    restore?.();
  }
});

describe("getSession persisted event contract", () => {
  it("returns stageChat transcript and keeps currentStage as stage source", async () => {
    const stageObjectId = new mongoose.Types.ObjectId();

    mockMethod(Session, "findOne", (() => chain({ createdAt: new Date(), sessionId: "s1", updatedAt: new Date() })) as never);
    mockMethod(SessionStage, "find", (() => chain([{
      _id: stageObjectId,
      executionSequence: 0,
      currentStage: "stage-source",
      model: "gpt",
      requestId: "req-1",
      stageIndex: 0,
      thinkingMode: false,
      timestamp: new Date().toISOString(),
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
      },
    }])) as never);
    mockMethod(SessionToolCall, "find", (() => chain([])) as never);
    mockMethod(SessionStageChatMessage, "find", (() => chain([
      { content: "first", role: "assistant", sequence: 0, stage: stageObjectId },
      { content: "second", role: "assistant", sequence: 1, stage: stageObjectId },
    ])) as never);
    mockMethod(SessionModelSpend, "find", (() => chain([])) as never);
    mockMethod(SessionForkLineage, "findOne", (() => chain(null)) as never);

    const session = await getSession("s1");
    assert.ok(session);
    assert.equal(session.events.length, 1);

    const event = session.events[0] as Record<string, unknown>;
    assert.deepEqual(event.stageChat, [
      { content: "first", reasoning: null, role: "assistant", toolCallId: undefined, modelSpendId: undefined },
      { content: "second", reasoning: null, role: "assistant", toolCallId: undefined, modelSpendId: undefined },
    ]);
    assert.equal(event.currentStage, "stage-source");
    assert.equal("stageInput" in event, false);
    assert.equal("stageInputTruncated" in event, false);
  });
});
