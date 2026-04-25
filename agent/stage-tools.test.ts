import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseRunBashToolArguments,
  parseSetContextToolArguments,
  setContextArgumentsToEnvelope,
} from "../shared/stage-tools";

describe("parseSetContextToolArguments", () => {
  it("parses valid arguments", () => {
    const raw = JSON.stringify({
      key: "topic",
      scope: "global",
      value: "x",
    });
    const parsed = parseSetContextToolArguments(raw);

    assert.ok(parsed);
    assert.equal(parsed.scope, "global");
    assert.equal(parsed.key, "topic");
    assert.equal(parsed.value, "x");
  });

  it("rejects empty key", () => {
    const raw = JSON.stringify({
      key: "   ",
      scope: "stage",
      value: 1,
    });
    assert.equal(parseSetContextToolArguments(raw), null);
  });

  it("builds orchestrator envelope", () => {
    const args = parseSetContextToolArguments(
      JSON.stringify({ key: "k", scope: "global", value: { a: 1 } }),
    );

    assert.ok(args);
    const envelope = setContextArgumentsToEnvelope(args);

    assert.equal(envelope.type, "tool_call");
    assert.equal(envelope.tool, "set_context");
    assert.equal(envelope.arguments.key, "k");
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
