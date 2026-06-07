import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isVmConditionBranch, wrapVmLogic } from "./condition-branch";
import { runScript } from "./-utils/vm-client";

describe("isVmConditionBranch", () => {
  it("detects IIFE branch bodies", () => {
    assert.equal(
      isVmConditionBranch("(() => ({ c: context.context.c * 2 }));"),
      true,
    );
  });

  it("detects object-literal and const snippets", () => {
    assert.equal(isVmConditionBranch("{ c: 1 }"), true);
    assert.equal(isVmConditionBranch("const x = 1;\n(() => ({ c: x }))"), true);
  });

  it("rejects plain natural-language logic", () => {
    assert.equal(isVmConditionBranch("Set c to double the current value."), false);
  });
});

describe("condition VM branch execution", () => {
  it("evaluates winning IIFE and returns context updates", async () => {
    const output = await runScript(
      wrapVmLogic("(() => ({ c: context.context.c * 2 }));"),
      {
        context: new Map([["c", 28]]),
        types: new Map(),
      },
    );

    assert.deepEqual(output, { c: 56 });
  });
});
