import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  effectiveApiKey,
  hasRealApiKey,
  normalizeStagehandModel,
} from "./llm-transport";

describe("llm-transport", () => {
  it("prefixes bare model names for Stagehand", () => {
    assert.equal(normalizeStagehandModel("deepseek-flash"), "openai/deepseek-flash");
    assert.equal(normalizeStagehandModel("deepseek/deepseek-chat"), "deepseek/deepseek-chat");
  });

  it("treats placeholder keys as OneCLI proxy mode", () => {
    assert.equal(hasRealApiKey(""), false);
    assert.equal(hasRealApiKey("placeholder"), false);
    assert.equal(hasRealApiKey("sk-real-key"), true);
    assert.equal(effectiveApiKey(""), "placeholder");
    assert.equal(effectiveApiKey("sk-real-key"), "placeholder");
  });
});
