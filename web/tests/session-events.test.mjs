import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPTY_VALUE } from "../src/lib/format.ts";
import {
  getCurrentStage,
  getCurrentStageDisplay,
  getStageChatDisplay,
  getStageChatTranscript,
} from "../src/lib/session-events.ts";

describe("session-events stage and chat display", () => {
  it("resolves currentStage from stage-level field, not chat content", () => {
    const event = {
      currentStage: "stage-source",
      requestId: "req-1",
      sessionId: "s1",
      stageChat: [
        { content: "first", role: "assistant" },
        { content: { text: "second" }, role: "assistant" },
      ],
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
      },
    };

    assert.equal(getCurrentStage(event), "stage-source");
    assert.equal(getCurrentStageDisplay(event), "stage-source");
  });

  it("renders stageChat transcript in order for chat display helper", () => {
    const event = {
      requestId: "req-1",
      sessionId: "s1",
      stageChat: [
        { content: "first", role: "assistant" },
        { content: { text: "second" }, role: "assistant" },
        { content: ["third-a", "third-b"], role: "assistant" },
      ],
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
      },
    };

    assert.equal(getStageChatTranscript(event), "first\n\nsecond\n\nthird-a\nthird-b");
    assert.equal(getStageChatDisplay(event), "first\n\nsecond\n\nthird-a\nthird-b");
  });

  it("returns empty marker when stageChat has no renderable content", () => {
    const event = {
      requestId: "req-1",
      sessionId: "s1",
      stageChat: [{ content: null, role: "assistant" }],
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
      },
    };

    assert.equal(getStageChatTranscript(event), null);
    assert.equal(getStageChatDisplay(event), EMPTY_VALUE);
  });
});
