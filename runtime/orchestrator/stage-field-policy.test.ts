import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createStorage } from "./-tools/set_context";
import {
  applySetContextToolCall,
  filterStageBucket,
  filterStorageForStage,
  pickContextUpdates,
  resolveSetContextScope,
  shouldApplySetContext,
} from "./stage-field-policy";

import type { ParsedStage } from "./orchestrator-types";

const plainStage = (overrides: Partial<ParsedStage> = {}): ParsedStage => ({
  lines: "{\n  x = a + b;\n}",
  sourceStartLine: 1,
  spec: { logic: "x = a + b;" },
  type: "plain",
  ...overrides,
});

describe("filterStageBucket", () => {
  it("uses contextKeys allowlist when set", () => {
    const records = { a: 1, b: 2, c: 3 };
    const filtered = filterStageBucket(
      "x = a;",
      records,
      plainStage({ contextKeys: ["a"] }),
    );

    assert.deepEqual(filtered, { a: 1 });
  });

  it("includes loop index in allowlist extras", () => {
    const records = { c: 1, i: 2 };
    const filtered = filterStageBucket(
      "c += i;",
      records,
      plainStage({ contextKeys: ["c"] }),
      "i",
    );

    assert.deepEqual(filtered, { c: 1, i: 2 });
  });
});

describe("shouldApplySetContext", () => {
  it("denies keys outside produceContextKeys", () => {
    assert.equal(
      shouldApplySetContext("d", plainStage({ produceContextKeys: ["a", "b", "c"] })),
      false,
    );
    assert.equal(
      shouldApplySetContext("a", plainStage({ produceContextKeys: ["a", "b", "c"] })),
      true,
    );
  });

  it("uses updateContextKeys when no produce filters", () => {
    const stage = plainStage({ updateContextKeys: ["c"] });

    assert.equal(shouldApplySetContext("c", stage), true);
    assert.equal(shouldApplySetContext("result", stage), false);
  });
});

describe("resolveSetContextScope", () => {
  it("routes produceTypeKeys to types", () => {
    assert.equal(
      resolveSetContextScope("T", plainStage({ produceTypeKeys: ["T"] }), "global"),
      "types",
    );
  });
});

describe("filterStorageForStage", () => {
  it("filters context and types maps", () => {
    const storage = createStorage();
    storage.context.set("a", 1);
    storage.context.set("b", 2);
    storage.types.set("T", { x: 1 });

    const filtered = filterStorageForStage(
      storage,
      "x = a;",
      plainStage({ contextKeys: ["a"] }),
    );

    assert.equal(filtered.context.get("a"), 1);
    assert.equal(filtered.context.has("b"), false);
    assert.equal(filtered.types.has("T"), false);
  });
});

describe("applySetContextToolCall", () => {
  it("skips disallowed keys", async () => {
    const storage = createStorage();
    const stage = plainStage({ produceContextKeys: ["a"] });

    const applied = await applySetContextToolCall(storage, {
      function: {
        arguments: JSON.stringify({
          key: "d",
          operation: "set",
          scope: "global",
          value: 9,
        }),
        name: "set_context",
      },
      id: "1",
      type: "function",
    }, stage);

    assert.equal(applied, false);
    assert.equal(storage.context.has("d"), false);
  });

  it("writes allowed keys to types when produceTypeKeys matches", async () => {
    const storage = createStorage();
    const stage = plainStage({ produceTypeKeys: ["T"] });

    await applySetContextToolCall(storage, {
      function: {
        arguments: JSON.stringify({
          key: "T",
          operation: "set",
          scope: "global",
          value: { x: 1 },
        }),
        name: "set_context",
      },
      id: "1",
      type: "function",
    }, stage);

    assert.deepEqual(storage.types.get("T"), { x: 1 });
    assert.equal(storage.context.has("T"), false);
  });
});

describe("pickContextUpdates for loops", () => {
  it("merges only updateContextKeys when set", () => {
    const picked = pickContextUpdates({ a: 1, b: 2, c: 3 }, ["c"]);

    assert.deepEqual(picked, { c: 3 });
  });
});

