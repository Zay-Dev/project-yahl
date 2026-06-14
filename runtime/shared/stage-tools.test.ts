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
  it("parses valid ask_user arguments", () => {
    const parsed = parseAskUserToolArguments(
      JSON.stringify({
        kind: "multipleChoice",
        options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
        questionRef: "1",
        title: "Pick one",
        version: "askUser.v1",
      }),
    );

    assert.ok(parsed);
    assert.equal(parsed!.kind, "multipleChoice");
    assert.equal(parsed!.questionRef, "1");
    assert.equal(parsed!.options.length, 2);
  });

  it("rejects invalid ask_user arguments", () => {
    const parsed = parseAskUserToolArguments(
      JSON.stringify({
        kind: "multipleChoice",
        options: [{ id: "a", label: "A" }],
        title: "Pick one",
        version: "askUser.v1",
      }),
    );
    assert.equal(parsed, null);
  });
});
