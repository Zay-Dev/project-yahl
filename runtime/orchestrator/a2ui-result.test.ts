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

  it("rejects metric_cards without items binding", () => {
    assert.equal(
      parseA2uiPlanV1({
        bindings: { body: "/brief_markdown" },
        surfaceId: "s1",
        ui_kind: "metric_cards",
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

  it("builds summary_card with markdown body and subtitle", () => {
    const plan = parseA2uiPlanV1({
      bindings: { body: "/brief_markdown", subtitle: "/generated_at", title: "/title" },
      surfaceId: "surf",
      ui_kind: "summary_card",
      version: "a2uiPlan.v1",
    })!;
    const data = {
      brief_markdown: "# Daily brief\n\n- item",
      generated_at: "2026-05-08T17:51:52.732Z",
      title: "EV Daily Brief",
    };
    const out = toA2uiFromPlan(data, plan);
    const update = out[1] as {
      updateComponents?: { components?: Array<{ id?: string; text?: string }> };
    };
    const body = update.updateComponents?.components?.find((c) => c.id === "body");
    const subtitle = update.updateComponents?.components?.find((c) => c.id === "subtitle");
    assert.equal(body?.text, "# Daily brief\n\n- item");
    assert.equal(subtitle?.text, "2026-05-08T17:51:52.732Z");
  });

  it("builds structured table header and row components", () => {
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
      updateComponents?: { components?: Array<{ children?: string[]; component?: string; id?: string }> };
    };
    const components = update.updateComponents?.components || [];
    const header = components.find((c) => c.id === "tbl_header");
    const firstRow = components.find((c) => c.id === "tbl_row_0");
    assert.equal(header?.component, "Row");
    assert.equal(firstRow?.component, "Row");
  });

  it("builds table with link action cells", () => {
    const plan = parseA2uiPlanV1({
      bindings: { rows: "/r" },
      column_bindings: [
        { header: "Title", path: "/title" },
        {
          header: "Source",
          kind: "link",
          labelPath: "/title",
          path: "/source_url",
          urlPath: "/source_url",
        },
      ],
      surfaceId: "t2",
      ui_kind: "table",
      version: "a2uiPlan.v1",
    })!;
    const out = toA2uiFromPlan({
      r: [{ source_url: "https://example.com", title: "News item" }],
    }, plan);
    const update = out[1] as {
      updateComponents?: { components?: Array<{ component?: string; id?: string }> };
    };
    const hasButton = (update.updateComponents?.components || []).some((c) => c.component === "Button");
    assert.equal(hasButton, true);
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
    assert.equal((env as { arguments: { mode: string } }).arguments.mode, "replace");
  });

  it("parses explicit append mode", () => {
    const env = parseStageEnvelope(
      JSON.stringify({
        arguments: {
          dataRef: { key: "k", scope: "stage" },
          mode: "append",
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
    assert.equal((env as { arguments: { mode: string } }).arguments.mode, "append");
  });

  it("rejects invalid mode", () => {
    const env = parseStageEnvelope(
      JSON.stringify({
        arguments: {
          dataRef: { key: "k", scope: "stage" },
          mode: "merge",
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
    assert.equal(env, null);
  });

  it("parses multiple render_a2ui_plan tool calls in array", () => {
    const env = parseStageEnvelope(
      JSON.stringify([
        {
          arguments: {
            dataRef: { key: "result", scope: "global" },
            plan: {
              bindings: { body: "/brief_markdown", title: "/title" },
              surfaceId: "s",
              ui_kind: "summary_card",
              version: "a2uiPlan.v1",
            },
            version: "renderA2uiPlan.v1",
          },
          tool: "render_a2ui_plan",
          type: "tool_call",
        },
        {
          arguments: {
            dataRef: { key: "result", scope: "global" },
            plan: {
              bindings: { rows: "/raw_intel" },
              column_bindings: [{ header: "Title", path: "/title" }],
              surfaceId: "s",
              ui_kind: "table",
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
    assert.equal(env[0]?.tool, "render_a2ui_plan");
    assert.equal(env[1]?.tool, "render_a2ui_plan");
  });
});
