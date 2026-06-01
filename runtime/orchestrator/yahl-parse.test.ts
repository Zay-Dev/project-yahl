import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  compileStage,
  compileStageLines,
  parseYahlDocument,
  parseYahlFile,
} from "./yahl-parse";

import { fileURLToPath } from "node:url";

const testSkillPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "TASKS/test/SKILL.yahl",
);

describe("parseYahlDocument", () => {
  it("parses test SKILL.yahl", () => {
    const text = readFileSync(testSkillPath, "utf-8");
    const doc = parseYahlDocument(text);

    assert.equal(doc.name, "test");
    assert.equal(doc.stages.length, 8);
  });

  it("rejects contextMode and conditionMode together", () => {
    assert.throws(() => {
      parseYahlDocument(`
name: x
description: y
stages:
  - contextMode: true
    conditionMode: true
    logic: |
      IF: true;
      END:
`);
    }, /mutually exclusive/);
  });

  it("rejects conditionMode and loopSetup together", () => {
    assert.throws(() => {
      parseYahlDocument(`
name: x
description: y
stages:
  - conditionMode: true
    loopSetup: for each i of [1..2]
    logic: |
      IF: true;
      END:
`);
    }, /mutually exclusive/);
  });
});

describe("compileStageLines", () => {
  it("wraps plain logic in braces", () => {
    assert.equal(compileStageLines({ logic: "c += 1;" }), "{\nc += 1;\n}");
  });

  it("prefixes contextMode", () => {
    const lines = compileStageLines({
      contextMode: true,
      logic: "(() => ({ a: 1 }))",
    });

    assert.match(lines, /^CONTEXT: \{/);
  });

  it("combines loopSetup and contextMode", () => {
    const lines = compileStageLines({
      contextMode: true,
      logic: "(() => ({ c: 1 }))",
      loopSetup: "for each i of [1..5]",
    });

    assert.match(lines, /^for each i of \[1..5\] CONTEXT:/);
  });
});

describe("parseYahlFile", () => {
  it("compiles test stages with temperature and loop type", () => {
    const stages = parseYahlFile(readFileSync(testSkillPath, "utf-8"));

    assert.equal(stages.length, 8);
    assert.equal(stages[2]?.type, "loop");
    assert.equal(stages[2]?.temperature, 0.2);
    assert.equal(stages[0]?.produceContextKeys?.join(","), "a,b,c");
    assert.match(stages[3]?.lines ?? "", /^IF:/);
  });

  it("prepends types as synthetic stage", () => {
    const stages = parseYahlFile(`
name: t
description: d
types: |
  type T = { a: string };
stages:
  - logic: "x = 1;"
`);

    assert.equal(stages.length, 2);
    assert.match(stages[0]?.lines ?? "", /type T/);
  });
});

describe("compileStage", () => {
  it("retains context key metadata", () => {
    const stage = compileStage({
      contextKeys: ["c"],
      logic: "c += 1;",
      updateContextKeys: ["c"],
    }, 10);

    assert.deepEqual(stage.contextKeys, ["c"]);
    assert.deepEqual(stage.updateContextKeys, ["c"]);
    assert.equal(stage.sourceStartLine, 10);
    assert.equal(stage.spec.logic, "c += 1;");
  });
});
