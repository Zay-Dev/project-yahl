import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TResponseStageListItem } from "@project-yahl/server/modules/sessions/-api-types";

import {
  buildTimelineRows,
  groupLabelFromChildLabel,
  rollupNestedGroupItem,
} from "./timeline-rows";

const stage = (
  overrides: Partial<TResponseStageListItem> = {},
): TResponseStageListItem => ({
  byModel: [],
  createdAt: "",
  domains: [],
  lastModelDurationMs: 0,
  logicPreview: "",
  modelCallCount: 0,
  modelDurationMs: 0,
  requestId: "r1",
  stageId: "s1",
  status: "finished",
  tokenTotals: null,
  toolCallCount: 0,
  updatedAt: "",
  ...overrides,
});

describe("timeline-rows", () => {
  it("derives group label by stripping nested leaf", () => {
    assert.equal(groupLabelFromChildLabel("#10.0 › fetch"), "#10.0");
    assert.equal(groupLabelFromChildLabel("#3"), "#3");
  });

  it("rolls up nested child tokens and status", () => {
    const rolled = rollupNestedGroupItem(
      [
        stage({
          agentMeta: {
            isMainThread: false,
            nestedPath: "monitor/goto",
            parentRequestId: "p1",
          },
          modelCallCount: 2,
          requestId: "a",
          status: "finished",
          tokenTotals: {
            cacheHitTokens: 1,
            cacheMissTokens: 2,
            completionTokens: 3,
            promptTokens: 4,
            reasoningTokens: 0,
            totalTokens: 10,
          },
          toolCallCount: 1,
        }),
        stage({
          agentMeta: {
            isMainThread: false,
            nestedPath: "monitor/extract",
            parentRequestId: "p1",
          },
          modelCallCount: 3,
          requestId: "b",
          status: "running",
          tokenTotals: {
            cacheHitTokens: 0,
            cacheMissTokens: 1,
            completionTokens: 1,
            promptTokens: 1,
            reasoningTokens: 0,
            totalTokens: 3,
          },
          toolCallCount: 4,
        }),
      ],
      "group:x",
    );

    assert.equal(rolled.status, "running");
    assert.equal(rolled.modelCallCount, 5);
    assert.equal(rolled.toolCallCount, 5);
    assert.equal(rolled.tokenTotals?.totalTokens, 13);
    assert.match(rolled.logicPreview, /goto → extract/);
  });

  it("inserts a synthetic group card before nested while children", () => {
    const rows = buildTimelineRows([
      stage({ logicPreview: "init", requestId: "i0" }),
      stage({
        logicPreview: "warm",
        loopIndex: 0,
        loopKind: "warmup",
        parsedStageIndex: 10,
        requestId: "w0",
      }),
      stage({
        agentMeta: {
          isMainThread: false,
          nestedPath: "monitor/goto",
          parentRequestId: "p1",
        },
        logicPreview: "goto",
        loopIndex: 0,
        loopKind: "while",
        parsedStageIndex: 10,
        requestId: "n0",
      }),
      stage({
        agentMeta: {
          isMainThread: false,
          nestedPath: "monitor/extract",
          parentRequestId: "p1",
        },
        logicPreview: "extract",
        loopIndex: 0,
        loopKind: "while",
        parsedStageIndex: 10,
        requestId: "n1",
      }),
      stage({
        agentMeta: {
          isMainThread: false,
          nestedPath: "monitor/goto",
          parentRequestId: "p2",
        },
        logicPreview: "goto",
        loopIndex: 1,
        loopKind: "while",
        parsedStageIndex: 10,
        requestId: "n2",
      }),
    ]);

    assert.equal(rows[0]?.kind, "stage");
    assert.equal(rows[1]?.kind, "stage");
    assert.equal(rows[2]?.kind, "group");
    assert.equal(rows[2]?.label, "#2.0");
    assert.equal(rows[3]?.kind, "stage");
    assert.equal(rows[3]?.label, "#2.0 › goto");
    assert.equal(rows[4]?.kind, "stage");
    assert.equal(rows[4]?.label, "#2.0 › extract");
    assert.equal(rows[5]?.kind, "group");
    assert.equal(rows[5]?.label, "#2.1");
    assert.equal(rows[6]?.kind, "stage");
    assert.equal(rows[6]?.label, "#2.1 › goto");
  });
});
