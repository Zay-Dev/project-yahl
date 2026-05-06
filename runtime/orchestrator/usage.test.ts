import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeUsage } from "../shared/usage";

describe("normalizeUsage", () => {
  it("keeps reasoningTokens at 0 when reasoning metadata is missing", () => {
    const usage = normalizeUsage({
      completion_tokens: 12,
      prompt_tokens: 8,
      total_tokens: 20,
    } as never);

    assert.equal(usage.completionTokens, 12);
    assert.equal(usage.promptTokens, 8);
    assert.equal(usage.totalTokens, 20);
    assert.equal(usage.reasoningTokens, 0);
  });

  it("uses provider reasoning_tokens when present", () => {
    const usage = normalizeUsage({
      completion_tokens: 20,
      completion_tokens_details: {
        reasoning_tokens: 7,
      },
      prompt_tokens: 10,
      total_tokens: 30,
    } as never);

    assert.equal(usage.reasoningTokens, 7);
  });
});
