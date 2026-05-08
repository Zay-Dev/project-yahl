import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAskUserContinuation, toAskUserAnswerValue } from "./execute";

describe("toAskUserAnswerValue", () => {
  it("coerces numeric ids to numbers", () => {
    assert.equal(toAskUserAnswerValue("5"), 5);
    assert.equal(toAskUserAnswerValue("3.5"), 3.5);
  });

  it("keeps non numeric ids as strings", () => {
    assert.equal(toAskUserAnswerValue("apac"), "apac");
    assert.equal(toAskUserAnswerValue(""), "");
  });
});

describe("buildAskUserContinuation", () => {
  it("replaces inline ask-user expression and keeps remaining lines", () => {
    const next = buildAskUserContinuation(
      [
        "const a = 1;",
        "c += /ask-user(which number of 1,2,3,4,5);",
        "const result = c;",
      ].join("\n"),
      3,
    );

    assert.ok(next);
    assert.equal(next?.skipNumberOfLines, 1);
    assert.equal(
      next?.stageText,
      [
        "c += 3;",
        "const result = c;",
      ].join("\n"),
    );
  });

  it("returns null when stage has no ask-user call", () => {
    const next = buildAskUserContinuation("const c = 1;\nconst r = c;", "");
    assert.equal(next, null);
  });
});
