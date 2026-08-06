import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BROWSER_TOOL_CONTENT_MAX_CHARS, clipToolContent } from "./clip-tool-content";
import { isContextLengthError } from "./context-length-error";

describe("clipToolContent", () => {
  it("returns content unchanged under the budget", () => {
    const content = JSON.stringify({ data: { ok: true }, ok: true });

    assert.equal(clipToolContent(content), content);
  });

  it("truncates oversized content into a compact error payload", () => {
    const huge = "x".repeat(BROWSER_TOOL_CONTENT_MAX_CHARS + 5_000);
    const clipped = clipToolContent(huge);

    assert.ok(clipped.length <= BROWSER_TOOL_CONTENT_MAX_CHARS);
    const parsed = JSON.parse(clipped) as { error: string; ok: boolean };

    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /truncated/);
  });
});

describe("isContextLengthError", () => {
  it("detects provider context length messages", () => {
    assert.equal(
      isContextLengthError(
        new Error(
          "This model's maximum context length is 1048576 tokens. However, you requested 1257163 tokens",
        ),
      ),
      true,
    );
    assert.equal(isContextLengthError(new Error("network timeout")), false);
  });
});
