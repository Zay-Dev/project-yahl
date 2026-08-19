import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatElapsedMs,
  resolveCurrentStage,
  resolveStageElapsed,
} from "./stage-live-status";

const stage = (
  overrides: Partial<Parameters<typeof resolveCurrentStage>[0][number]> = {},
) => ({
  createdAt: "2026-08-19T01:00:00.000Z",
  byModel: [],
  domains: [],
  lastModelDurationMs: 0,
  logicPreview: "",
  modelCallCount: 0,
  modelDurationMs: 0,
  requestId: "r1",
  stageId: "s1",
  status: "running" as const,
  tokenTotals: null,
  toolCallCount: 0,
  updatedAt: "2026-08-19T01:00:00.000Z",
  ...overrides,
});

describe("formatElapsedMs", () => {
  it("pads hours minutes and seconds", () => {
    assert.equal(formatElapsedMs(10_000), "00:00:10");
    assert.equal(formatElapsedMs(210_000), "00:03:30");
    assert.equal(formatElapsedMs(3_661_000), "01:01:01");
  });
});

describe("resolveCurrentStage", () => {
  it("returns the last unfinished stage", () => {
    const current = resolveCurrentStage([
      stage({ requestId: "r1", stageId: "s1", status: "finished" }),
      stage({ requestId: "r2", stageId: "s2", status: "running" }),
      stage({ requestId: "r3", stageId: "s3", status: "finished" }),
    ]);

    assert.equal(current?.stage.requestId, "r2");
  });

  it("falls back to the last stage when all are finished", () => {
    const current = resolveCurrentStage([
      stage({ requestId: "r1", stageId: "s1", status: "finished" }),
      stage({ requestId: "r2", stageId: "s2", status: "finished" }),
    ]);

    assert.equal(current?.stage.requestId, "r2");
  });
});

describe("resolveStageElapsed", () => {
  it("ticks the in-flight call from last tool call", () => {
    const elapsed = resolveStageElapsed(
      stage({
        lastModelDurationMs: 4000,
        lastModelResponseAt: "2026-08-19T01:00:10.000Z",
        lastToolCallAt: "2026-08-19T01:00:20.000Z",
        modelDurationMs: 9000,
        status: "running",
      }),
      Date.parse("2026-08-19T01:00:30.000Z"),
    );

    assert.equal(elapsed.inFlight, true);
    assert.equal(elapsed.currentMs, 10_000);
    assert.equal(elapsed.totalMs, 19_000);
  });

  it("uses createdAt when no model responses exist yet", () => {
    const elapsed = resolveStageElapsed(
      stage({
        createdAt: "2026-08-19T01:00:00.000Z",
        status: "running",
      }),
      Date.parse("2026-08-19T01:00:08.000Z"),
    );

    assert.equal(elapsed.inFlight, true);
    assert.equal(elapsed.currentMs, 8_000);
    assert.equal(elapsed.totalMs, 8_000);
  });

  it("freezes on the last completed call duration", () => {
    const elapsed = resolveStageElapsed(
      stage({
        lastModelDurationMs: 2500,
        lastModelResponseAt: "2026-08-19T01:00:40.000Z",
        lastToolCallAt: "2026-08-19T01:00:20.000Z",
        modelDurationMs: 12_000,
        status: "finished",
      }),
      Date.parse("2026-08-19T01:01:00.000Z"),
    );

    assert.equal(elapsed.inFlight, false);
    assert.equal(elapsed.currentMs, 2500);
    assert.equal(elapsed.totalMs, 12_000);
  });
});
