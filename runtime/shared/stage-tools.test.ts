import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STAGE_TOOLS,
  parseAskUserToolArguments,
  parseNixeryToolArguments,
  parseRunBashToolArguments,
} from "./stage-tools";

describe("STAGE_TOOLS", () => {
  it("points skill-backed tools at /opt/skills", () => {
    const byName = Object.fromEntries(
      STAGE_TOOLS.map((tool) => [tool.function.name, tool.function.description]),
    );

    assert.match(byName.ask_user ?? "", /\/opt\/skills\/ask-user\/SKILL.md/);
    assert.match(byName.browser ?? "", /\/opt\/skills\/stagehand\/SKILL.md/);
    assert.match(byName.nixery ?? "", /\/opt\/skills\/nixery\/SKILL.md/);
    assert.match(byName.platform ?? "", /\/opt\/skills\/platform\/SKILL.md/);
  });
});

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

describe("parseNixeryToolArguments", () => {
  it("accepts arbitrary defId string", () => {
    const parsed = parseNixeryToolArguments(JSON.stringify({
      args: { topic: "foo" },
      defId: "custom-inline-def",
    }));

    assert.ok(parsed);
    assert.equal(parsed!.defId, "custom-inline-def");
    assert.deepEqual(parsed!.args, { topic: "foo" });
  });
});
