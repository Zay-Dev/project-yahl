import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseBridgeBrowserBody } from "./stagehand-browser-bridge";

describe("stagehand-browser-bridge", () => {
  it("parses goto / act bodies for script callers", () => {
    const gotoArgs = parseBridgeBrowserBody({
      mode: "goto",
      url: "https://example.com/driving",
      instruction: "open driving search",
    });

    assert.deepEqual(gotoArgs, {
      instruction: "open driving search",
      mode: "goto",
      url: "https://example.com/driving",
    });

    const actArgs = parseBridgeBrowserBody({
      mode: "act",
      instruction: "Type {{bind_origin}} into the From field",
    });

    assert.equal(actArgs?.mode, "act");
    assert.match(actArgs?.instruction ?? "", /From field/);
  });

  it("rejects invalid bridge bodies", () => {
    assert.equal(parseBridgeBrowserBody({ mode: "goto" }), null);
    assert.equal(parseBridgeBrowserBody({ mode: "act", instruction: "" }), null);
    assert.equal(parseBridgeBrowserBody("not-json"), null);
  });
});
