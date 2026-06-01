import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterContextByKeys,
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
