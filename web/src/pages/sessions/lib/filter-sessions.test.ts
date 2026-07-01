import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import {
  countHiddenBackgroundSessions,
  filterSessionsForList,
} from "./filter-sessions";

const sessions: TResponseSessionListItem[] = [
  {
    _id: "1",
    createdAt: "2026-01-01T00:00:00.000Z",
    isBackground: true,
    sessionId: "bg-1",
    tokenTotals: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    _id: "2",
    createdAt: "2026-01-02T00:00:00.000Z",
    sessionId: "fg-1",
    tokenTotals: null,
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

describe("filterSessionsForList", () => {
  it("hides background sessions by default", () => {
    assert.deepEqual(
      filterSessionsForList(sessions, false).map((session) => session.sessionId),
      ["fg-1"],
    );
    assert.equal(countHiddenBackgroundSessions(sessions, false), 1);
  });

  it("shows all sessions when toggle is on", () => {
    assert.equal(filterSessionsForList(sessions, true).length, 2);
    assert.equal(countHiddenBackgroundSessions(sessions, true), 0);
  });
});
