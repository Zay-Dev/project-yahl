import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseAskUserToolArguments,
  parseRenderA2uiPlanToolArgumentsDetailed,
  parseRenderA2uiPlanToolArguments,
  parseRunBashToolArguments,
  parseSetContextToolArguments,
  setContextArgumentsToEnvelope,
} from "../shared/stage-tools";
import { parseStageEnvelope } from "../shared/stage-contract";

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
    assert.equal(parsed!.mode, "replace");
  });

  it("parses explicit append mode", () => {
    const parsed = parseRenderA2uiPlanToolArguments(
      JSON.stringify({
        dataRef: { key: "out", scope: "stage" },
        mode: "append",
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
    assert.equal(parsed!.mode, "append");
  });

  it("rejects invalid mode", () => {
    const parsed = parseRenderA2uiPlanToolArguments(
      JSON.stringify({
        dataRef: { key: "out", scope: "stage" },
        mode: "merge",
        plan: {
          bindings: { body: "/b", title: "/t" },
          surfaceId: "surf",
          ui_kind: "summary_card",
          version: "a2uiPlan.v1",
        },
        version: "renderA2uiPlan.v1",
      }),
    );
    assert.equal(parsed, null);
  });

  it("returns detailed issue for table without column_bindings", () => {
    const parsed = parseRenderA2uiPlanToolArgumentsDetailed(
      JSON.stringify({
        dataRef: { key: "out", scope: "stage" },
        plan: {
          bindings: { rows: "/rows" },
          surfaceId: "surf",
          ui_kind: "table",
          version: "a2uiPlan.v1",
        },
        version: "renderA2uiPlan.v1",
      }),
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.issue.code, "TABLE_COLUMN_BINDINGS_REQUIRED");
    }
  });

  it("parses link-enabled table columns", () => {
    const parsed = parseRenderA2uiPlanToolArguments(
      JSON.stringify({
        dataRef: { key: "out", scope: "stage" },
        plan: {
          bindings: { rows: "/rows" },
          column_bindings: [
            {
              header: "Source",
              kind: "link",
              labelPath: "/title",
              path: "/source_url",
              urlPath: "/source_url",
            },
          ],
          surfaceId: "surf",
          ui_kind: "table",
          version: "a2uiPlan.v1",
        },
        version: "renderA2uiPlan.v1",
      }),
    );
    assert.ok(parsed);
    assert.equal(parsed!.plan.column_bindings?.[0]?.kind, "link");
  });
});

describe("parseStageEnvelope (tool_call arrays)", () => {
  it("parses mixed set_context and render_a2ui_plan array in order", () => {
    const env = parseStageEnvelope(
      JSON.stringify([
        {
          arguments: {
            key: "title",
            scope: "global",
            value: "daily",
          },
          tool: "set_context",
          type: "tool_call",
        },
        {
          arguments: {
            dataRef: { key: "result", scope: "global" },
            plan: {
              bindings: { body: "/brief_markdown", title: "/title" },
              surfaceId: "surf",
              ui_kind: "summary_card",
              version: "a2uiPlan.v1",
            },
            version: "renderA2uiPlan.v1",
          },
          tool: "render_a2ui_plan",
          type: "tool_call",
        },
      ]),
    );

    assert.ok(Array.isArray(env));
    assert.equal(env.length, 2);
    assert.equal(env[0]?.tool, "set_context");
    assert.equal(env[1]?.tool, "render_a2ui_plan");
  });
});
