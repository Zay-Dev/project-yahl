import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isTimedOutRecoveryBody } from "./payload-guards";

describe("isTimedOutRecoveryBody", () => {
  it("accepts valid timed-out recovery payload", () => {
    const body = {
      currentStageText: "c += /ask-user(x)",
      questionId: "req:stage",
      requestId: "req",
      runtimeSnapshot: {
        context: { a: 1 },
        stage: { b: 2 },
        types: { c: "d" },
      },
      sourceRef: {
        filePath: "/workspace/x.yahl",
        line: 35,
      },
      stageId: "SKILL.yahl:35:plain",
    };
    assert.equal(isTimedOutRecoveryBody(body), true);
  });

  it("rejects missing nested snapshot keys", () => {
    assert.equal(isTimedOutRecoveryBody({
      currentStageText: "x",
      questionId: "q",
      requestId: "r",
      runtimeSnapshot: { context: {}, stage: {} },
      sourceRef: { filePath: "/a", line: 1 },
      stageId: "s",
    }), false);
  });
});
