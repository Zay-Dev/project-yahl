import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveSessionStatusLabel,
  resolveSessionStuckCopy,
} from "./session-stuck-copy";

describe("resolveSessionStuckCopy", () => {
  it("uses budget exhausted copy for budget_burnout", () => {
    const copy = resolveSessionStuckCopy({
      lastError: {
        at: "2026-08-29T19:39:41.215Z",
        code: "budget_burnout",
        message: "stage maxTurns exhausted (12)",
        stageId: "notify_and_sleep",
      },
    });

    assert.equal(copy.title, "Budget exhausted");
    assert.match(copy.body, /stage maxTurns exhausted \(12\)/);
    assert.match(copy.body, /notify_and_sleep/);
  });

  it("uses run failed copy for other lastError codes", () => {
    const copy = resolveSessionStuckCopy({
      lastError: {
        at: "2026-08-29T19:39:41.215Z",
        code: "stage_failed",
        message: "agent crashed",
      },
    });

    assert.equal(copy.title, "Run failed");
    assert.match(copy.body, /agent crashed/);
  });

  it("falls back to generic stuck copy", () => {
    const copy = resolveSessionStuckCopy({});

    assert.equal(copy.title, "Run stopped unexpectedly");
  });
});

describe("resolveSessionStatusLabel", () => {
  it("labels budget burnout stuck sessions", () => {
    assert.equal(
      resolveSessionStatusLabel({
        lastError: {
          at: "2026-08-29T19:39:41.215Z",
          code: "budget_burnout",
          message: "stage maxTurns exhausted (12)",
        },
        runState: "stuck",
      }),
      "Budget exhausted",
    );
  });

  it("labels generic stuck sessions", () => {
    assert.equal(
      resolveSessionStatusLabel({ runState: "stuck" }),
      "Stuck",
    );
  });
});
