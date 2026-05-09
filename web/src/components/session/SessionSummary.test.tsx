/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { SessionDetail } from "@/types";

import { SessionSummary } from "./SessionSummary";

const detail: SessionDetail = {
  createdAt: "2026-01-01T00:00:00.000Z",
  events: [],
  modelAggregates: {},
  result: { ok: true },
  sessionId: "session-1",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("SessionSummary", () => {
  it("shows open-a2ui button when href exists", () => {
    const html = renderToStaticMarkup(
      <SessionSummary
        a2uiHref="/sessions/session-1/a2ui"
        detail={detail}
        hasStoredResult
        onHardDelete={() => {}}
        onRenameTitle={() => {}}
        onSoftDelete={() => {}}
        onViewResult={() => {}}
        taskPath={null}
        totalUsedMs={0}
      />,
    );
    assert.ok(html.includes("Open A2UI"));
    assert.ok(html.includes("target=\"_blank\""));
    assert.ok(html.includes("/sessions/session-1/a2ui"));
  });

  it("hides open-a2ui button when href is missing", () => {
    const html = renderToStaticMarkup(
      <SessionSummary
        a2uiHref={null}
        detail={detail}
        hasStoredResult
        onHardDelete={() => {}}
        onRenameTitle={() => {}}
        onSoftDelete={() => {}}
        onViewResult={() => {}}
        taskPath={null}
        totalUsedMs={0}
      />,
    );
    assert.ok(!html.includes("Open A2UI"));
  });
});
