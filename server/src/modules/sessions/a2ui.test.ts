import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toA2uiMultipleChoice } from "./a2ui";

describe("toA2uiMultipleChoice", () => {
  it("builds a v0.8 envelope list", () => {
    const out = toA2uiMultipleChoice("surface-1", {
      kind: "multipleChoice",
      options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      title: "Pick one",
      version: "askUser.v1",
    });

    assert.equal(out.length, 3);
    assert.equal(out[0].version, "v0.8");
    assert.equal("createSurface" in out[0], true);
  });
});
