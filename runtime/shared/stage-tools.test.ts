import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseAskUserToolArguments,
  parseRunBashToolArguments,
} from "./stage-tools";

describe("parseRunBashToolArguments", () => {
  it("parses valid command", () => {
    assert.equal(
      parseRunBashToolArguments(JSON.stringify({ command: "pwd" })),
      "pwd",
    );
  });

  it("rejects empty command", () => {
    assert.equal(parseRunBashToolArguments(JSON.stringify({ command: "" })), null);
  });
});

describe("parseAskUserToolArguments", () => {
  it("parses valid ask_user batch arguments", () => {
    const parsed = parseAskUserToolArguments(
      JSON.stringify({
        batchId: "round1",
        questions: [{
          kind: "multipleChoice",
          options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
          questionRef: "1",
          title: "Pick one",
        }],
        title: "Questions",
        version: "askUserBatch.v1",
      }),
    );

    assert.ok(parsed);
    assert.equal(parsed!.batchId, "round1");
    assert.equal(parsed!.questions[0]?.questionRef, "1");
    assert.equal(parsed!.questions[0]?.options?.length, 2);
  });

  it("rejects invalid ask_user batch arguments", () => {
    const parsed = parseAskUserToolArguments(
      JSON.stringify({
        batchId: "round1",
        questions: [{
          kind: "multipleChoice",
          options: [{ id: "a", label: "A" }],
          questionRef: "1",
          title: "Pick one",
        }],
        title: "Questions",
        version: "askUserBatch.v1",
      }),
    );
    assert.equal(parsed, null);
  });
});
