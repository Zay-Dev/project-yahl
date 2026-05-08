import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPatchStageRuntimeSnapshotBody } from "./payload-guards";

describe("isPatchStageRuntimeSnapshotBody", () => {
  it("accepts contextAfter-only patch", () => {
    assert.equal(
      isPatchStageRuntimeSnapshotBody({
        contextAfter: { context: {}, stage: {}, types: {} },
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      true,
    );
  });

  it("rejects empty object", () => {
    assert.equal(isPatchStageRuntimeSnapshotBody({}), false);
  });
});
