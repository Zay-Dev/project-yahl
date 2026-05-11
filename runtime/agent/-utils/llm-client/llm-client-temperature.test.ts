import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("chat.completions temperature option shaping", () => {
  it("omits temperature when undefined (mirrors llm-client _chat spread)", () => {
    const options = {} as { temperature?: number };
    const payload = {
      model: "m",
      stream: false,
      ...options.temperature !== undefined && { temperature: options.temperature },
    };

    assert.ok(!("temperature" in payload));
  });

  it("includes temperature when set", () => {
    const options = { temperature: 0.4 };
    const payload = {
      model: "m",
      stream: false,
      ...options.temperature !== undefined && { temperature: options.temperature },
    };

    assert.equal((payload as { temperature: number }).temperature, 0.4);
  });
});
