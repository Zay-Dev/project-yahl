import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toA2uiFromPlan } from "../shared/a2ui-from-plan";
import { parseA2uiPlanV1 } from "../shared/a2ui-plan";
import { parseStageEnvelope } from "../shared/stage-contract";

describe("parseA2uiPlanV1", () => {
  it("parses summary_card plan", () => {
    const plan = parseA2uiPlanV1({
      bindings: { body: "/report", title: "/title" },
      surfaceId: "s1",
      ui_kind: "summary_card",
      version: "a2uiPlan.v1",
    });
    assert.ok(plan);
    assert.equal(plan!.ui_kind, "summary_card");
  });

  it("rejects table without column_bindings", () => {
    assert.equal(
      parseA2uiPlanV1({
        bindings: { rows: "/rows" },
        surfaceId: "s1",
        ui_kind: "table",
        version: "a2uiPlan.v1",
      }),
      null,
    );
  });
});

describe("toA2uiFromPlan", () => {
  it("builds summary_card envelopes", () => {
    const plan = parseA2uiPlanV1({
      bindings: { body: "/b", title: "/t" },
      surfaceId: "surf",
      ui_kind: "summary_card",
      version: "a2uiPlan.v1",
    })!;
    const data = { b: "Hello", t: "Title" };
    const out = toA2uiFromPlan(data, plan);
    assert.ok(out.length >= 2);
    assert.equal(out[0].version, "v0.8");
  });

  it("builds table text", () => {
    const plan = parseA2uiPlanV1({
      bindings: { rows: "/r" },
      column_bindings: [
        { header: "A", path: "/a" },
        { header: "B", path: "/b" },
      ],
      surfaceId: "t1",
      ui_kind: "table",
      version: "a2uiPlan.v1",
    })!;
    const out = toA2uiFromPlan({ r: [{ a: 1, b: 2 }] }, plan);
    const update = out[1] as {
      updateComponents?: { components?: Array<{ id?: string; text?: string }> };
    };
    const textBlock = update.updateComponents?.components?.find((c) => c.id === "tbl");
    assert.ok(String(textBlock?.text).includes("A | B"));
  });

  it("metric_cards with object root yields empty output (orchestrator treats as non-fatal)", () => {
    const plan = parseA2uiPlanV1({
      bindings: { items: "/" },
      limits: { maxItems: 10 },
      surfaceId: "m1",
      ui_kind: "metric_cards",
      version: "a2uiPlan.v1",
    })!;
    const out = toA2uiFromPlan({ a: 1, b: 2 }, plan);
    assert.equal(out.length, 0);
  });
});

describe("parseStageEnvelope render_a2ui_plan", () => {
  it("parses envelope JSON string", () => {
    const env = parseStageEnvelope(
      JSON.stringify({
        arguments: {
          dataRef: { key: "k", scope: "stage" },
          plan: {
            bindings: { body: "/body", title: "/title" },
            surfaceId: "s",
            ui_kind: "summary_card",
            version: "a2uiPlan.v1",
          },
          version: "renderA2uiPlan.v1",
        },
        tool: "render_a2ui_plan",
        type: "tool_call",
      }),
    );
    assert.ok(env && typeof env === "object" && !Array.isArray(env));
    assert.equal((env as { tool: string }).tool, "render_a2ui_plan");
  });
});
