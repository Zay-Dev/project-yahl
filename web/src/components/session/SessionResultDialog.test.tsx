/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { SessionDetail } from "@/types";

import { SessionResultDialog } from "./SessionResultDialog";

const baseDetail: SessionDetail = {
  createdAt: "2026-01-01T00:00:00.000Z",
  events: [],
  modelAggregates: {},
  result: { raw: { ok: true } },
  sessionId: "session-1",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("SessionResultDialog", () => {
  it("renders parse diagnostics for partial preview support", () => {
    const detail: SessionDetail = {
      ...baseDetail,
      resultA2ui: [
        { createSurface: { catalogId: "std", surfaceId: "s1" }, version: "v0.8" },
        {
          updateComponents: {
            components: [
              { children: ["x"], component: "Column", id: "root" },
              { component: "UnknownWidget", id: "x" },
            ],
            surfaceId: "s1",
          },
          version: "v0.8",
        },
      ],
    };

    const html = renderToStaticMarkup(<SessionResultDialog detail={detail} onClose={() => {}} open />);
    assert.ok(html.includes("Session A2UI (v0.8)"));
    assert.ok(html.includes("skipped 1 unsupported"));
  });
});
