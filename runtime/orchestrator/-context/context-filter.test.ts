import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterContextByKeys,
  filterContextByReadUsage,
  pickContextUpdates,
} from "./context-filter";

describe("filterContextByKeys", () => {
  it("allowlists keys and extra loop index", () => {
    const filtered = filterContextByKeys(
      { a: 1, b: 2, c: 3, i: 4 },
      ["c"],
      ["i"],
    );

    assert.deepEqual(filtered, { c: 3, i: 4 });
  });

  it("returns all records when keys omitted", () => {
    const records = { a: 1, b: 2 };

    assert.deepEqual(filterContextByKeys(records, undefined), records);
  });
});

describe("pickContextUpdates", () => {
  it("picks only listed keys", () => {
    const picked = pickContextUpdates({ a: 1, b: 2, c: 3 }, ["c", "missing"]);

    assert.deepEqual(picked, { c: 3 });
  });

  it("returns full records when update keys omitted", () => {
    const records = { a: 1 };

    assert.deepEqual(pickContextUpdates(records, undefined), records);
  });
});

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
