import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseAskUserToolArguments,
  parseRenderA2uiPlanToolArguments,
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
    assert.equal(parsed.operation, "set");
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

  it("parses types scope", () => {
    const raw = JSON.stringify({
      key: "TItem",
      scope: "types",
      value: "type TItem = { id: string };",
    });
    const parsed = parseSetContextToolArguments(raw);

    assert.ok(parsed);
    assert.equal(parsed!.scope, "types");
    assert.equal(parsed!.key, "TItem");
    assert.equal(parsed!.operation, "set");
  });

  it("parses extend operation", () => {
    const raw = JSON.stringify({
      key: "records",
      operation: "extend",
      scope: "global",
      value: [1, 2, 3],
    });
    const parsed = parseSetContextToolArguments(raw);

    assert.ok(parsed);
    assert.equal(parsed!.operation, "extend");
  });

  it("rejects invalid operation", () => {
    const raw = JSON.stringify({
      key: "records",
      operation: "append",
      scope: "global",
      value: [1, 2, 3],
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
    assert.equal(envelope.arguments.operation, "set");
  });

  it("builds orchestrator envelope with explicit operation", () => {
    const args = parseSetContextToolArguments(
      JSON.stringify({ key: "k", operation: "extend", scope: "global", value: { a: 1 } }),
    );

    assert.ok(args);
    const envelope = setContextArgumentsToEnvelope(args);

    assert.equal(envelope.arguments.operation, "extend");
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
  it("parses valid ask_user arguments", () => {
    const parsed = parseAskUserToolArguments(
      JSON.stringify({
        kind: "multipleChoice",
        options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
        title: "Pick one",
        version: "askUser.v1",
      }),
    );

    assert.ok(parsed);
    assert.equal(parsed!.kind, "multipleChoice");
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

describe("parseRenderA2uiPlanToolArguments", () => {
  it("parses valid render_a2ui_plan arguments", () => {
    const parsed = parseRenderA2uiPlanToolArguments(
      JSON.stringify({
        dataRef: { key: "out", scope: "stage" },
        plan: {
          bindings: { body: "/b", title: "/t" },
          surfaceId: "surf",
          ui_kind: "summary_card",
          version: "a2uiPlan.v1",
        },
        version: "renderA2uiPlan.v1",
      }),
    );
    assert.ok(parsed);
    assert.equal(parsed!.plan.ui_kind, "summary_card");
  });
});
