import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isFinalizeBody } from "./payload-guards";

describe("isFinalizeBody", () => {
  it("accepts resultA2ui with optional result", () => {
    assert.equal(
      isFinalizeBody({
        resultA2ui: [{ version: "v0.8" }],
      }),
      true,
    );
  });
});
