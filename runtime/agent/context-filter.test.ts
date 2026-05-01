import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterContextByReadUsage } from "../orchestrator/context-filter";

describe("filterContextByReadUsage", () => {
  it("includes keys that are read", () => {
    const stageText = `
{
  use value
  summarize(userId)
}
`;
    const filtered = filterContextByReadUsage(stageText, {
      ignored: "x",
      userId: "u_1",
      value: 42,
    });

    assert.deepEqual(filtered, {
      userId: "u_1",
      value: 42,
    });
  });

  it("excludes assignment-only keys", () => {
    const stageText = `
{
  value = "x"
  total=1
}
`;
    const filtered = filterContextByReadUsage(stageText, {
      total: 10,
      value: "old",
    });

    assert.deepEqual(filtered, {});
  });

  it("keeps key that is read after assignment", () => {
    const stageText = `
{
  value = "x"
  emit(value)
}
`;
    const filtered = filterContextByReadUsage(stageText, {
      value: "old",
    });

    assert.deepEqual(filtered, {
      value: "old",
    });
  });

  it("does not match partial identifiers", () => {
    const stageText = `
{
  userIdExtended = "x"
}
`;
    const filtered = filterContextByReadUsage(stageText, {
      userId: "u_1",
    });

    assert.deepEqual(filtered, {});
  });
});
