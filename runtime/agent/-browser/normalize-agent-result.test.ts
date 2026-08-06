import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeAgentExecuteResult } from "./normalize-agent-result";

describe("normalizeAgentExecuteResult", () => {
  it("keeps success message actions usage completed and drops messages", () => {
    const normalized = normalizeAgentExecuteResult({
      actions: [{ type: "click" }],
      completed: true,
      message: "filled the form",
      messages: [
        {
          content: [{ output: { value: [{ type: "image", data: "base64..." }] }, type: "tool-result" }],
          role: "tool",
        },
      ],
      success: true,
      usage: { input_tokens: 12 },
    });

    assert.deepEqual(normalized, {
      actions: [{ type: "click" }],
      completed: true,
      message: "filled the form",
      success: true,
      usage: { input_tokens: 12 },
    });
    assert.equal(JSON.stringify(normalized).includes("base64"), false);
  });

  it("strips messages when known keys are absent", () => {
    const normalized = normalizeAgentExecuteResult({
      extra: "keep",
      messages: [{ role: "user", content: "huge" }],
      other: 1,
    });

    assert.deepEqual(normalized, { extra: "keep", other: 1 });
  });

  it("passes through non-objects", () => {
    assert.equal(normalizeAgentExecuteResult("ok"), "ok");
    assert.equal(normalizeAgentExecuteResult(null), null);
    assert.deepEqual(normalizeAgentExecuteResult([1, 2]), [1, 2]);
  });
});
