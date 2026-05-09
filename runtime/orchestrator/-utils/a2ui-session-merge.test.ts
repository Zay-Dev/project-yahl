import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSessionA2uiState, flattenSessionA2ui, mergeSessionA2uiSurface } from "./a2ui-session-merge";

describe("a2ui-session-merge", () => {
  it("keeps different surfaces together", () => {
    const state = createSessionA2uiState();
    mergeSessionA2uiSurface(state, {
      envelopes: [{ createSurface: { surfaceId: "s1" }, version: "v0.8" }],
      maxPerSurface: 50,
      mode: "replace",
      surfaceId: "s1",
    });
    mergeSessionA2uiSurface(state, {
      envelopes: [{ createSurface: { surfaceId: "s2" }, version: "v0.8" }],
      maxPerSurface: 50,
      mode: "replace",
      surfaceId: "s2",
    });
    const flattened = flattenSessionA2ui(state, 50);
    assert.equal(flattened.envelopes.length, 2);
  });

  it("replace mode overwrites same surface only", () => {
    const state = createSessionA2uiState();
    mergeSessionA2uiSurface(state, {
      envelopes: [{ id: "old" }],
      maxPerSurface: 50,
      mode: "replace",
      surfaceId: "s1",
    });
    mergeSessionA2uiSurface(state, {
      envelopes: [{ id: "new" }],
      maxPerSurface: 50,
      mode: "replace",
      surfaceId: "s1",
    });
    const flattened = flattenSessionA2ui(state, 50);
    assert.equal(flattened.envelopes.length, 1);
    assert.deepEqual(flattened.envelopes[0], { id: "new" });
  });

  it("append mode preserves same-surface sequence", () => {
    const state = createSessionA2uiState();
    mergeSessionA2uiSurface(state, {
      envelopes: [{ id: "a" }],
      maxPerSurface: 50,
      mode: "replace",
      surfaceId: "s1",
    });
    mergeSessionA2uiSurface(state, {
      envelopes: [{ id: "b" }, { id: "c" }],
      maxPerSurface: 50,
      mode: "append",
      surfaceId: "s1",
    });
    const flattened = flattenSessionA2ui(state, 50);
    assert.deepEqual(flattened.envelopes, [{ id: "a" }, { id: "b" }, { id: "c" }]);
  });
});
