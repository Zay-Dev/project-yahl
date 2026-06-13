import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { toAgentStage } from "@/shared/yahl-stage";

import {
  compileForkRunStage,
  compileStage,
  compileStageLines,
  parseYahlDocument,
  parseYahlFile,
  parseYahlTask,
  toLoopIterationStage,
} from "./parse";

import { fileURLToPath } from "node:url";

const testSkillPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../TASKS/test/SKILL.yahl",
);

describe("parseYahlDocument", () => {
  it("parses test SKILL.yahl", () => {
    const text = readFileSync(testSkillPath, "utf-8");
    const doc = parseYahlDocument(text);

    assert.equal(doc.name, "test the syntax");
    assert.equal(doc.resultContextKey, "result");
    assert.equal(doc.stages.length, 7);
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

  it("parses optional resultContextKey", () => {
    const doc = parseYahlDocument(`
name: x
description: y
resultContextKey: result
stages:
  - logic: "x = 1;"
`);

    assert.equal(doc.resultContextKey, "result");
  });

  it("omits resultContextKey when absent", () => {
    const doc = parseYahlDocument(`
name: x
description: y
stages:
  - logic: "x = 1;"
`);

    assert.equal(doc.resultContextKey, undefined);
  });

  it("rejects empty resultContextKey", () => {
    assert.throws(() => {
      parseYahlDocument(`
name: x
description: y
resultContextKey: "   "
stages:
  - logic: "x = 1;"
`);
    }, /resultContextKey/);
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

describe("parseYahlTask", () => {
  it("returns stages and resultContextKey from test SKILL.yahl", () => {
    const text = readFileSync(testSkillPath, "utf-8");
    const { resultContextKey, stages } = parseYahlTask(text);

    assert.equal(resultContextKey, "result");
    assert.equal(stages.length, 7);
    assert.equal(stages[2]?.type, "loop");
  });
});

describe("parseYahlFile", () => {
  it("compiles test stages with temperature and loop type", () => {
    const stages = parseYahlFile(readFileSync(testSkillPath, "utf-8"));

    assert.equal(stages.length, 7);
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

describe("toAgentStage", () => {
  it("omits loopSetup for agent/redis payloads", () => {
    const agent = toAgentStage({
      contextKeys: ["c"],
      logic: "c += i;",
      loopSetup: "for each i of [1..5,+2]",
      updateContextKeys: ["c"],
    });

    assert.equal(agent.logic, "c += i;");
    assert.equal(agent.loopSetup, undefined);
    assert.deepEqual(agent.contextKeys, ["c"]);
  });
});

describe("toLoopIterationStage", () => {
  it("keeps parent spec for loop body pushes", () => {
    const parent = compileStage({
      contextKeys: ["c"],
      contextMode: true,
      logic: "(() => ({ c: 1 }))",
      loopSetup: "for each i of [1..5]",
      updateContextKeys: ["c"],
    }, 16);

    const iteration = toLoopIterationStage(parent, "CONTEXT: { c: 1 }");

    assert.equal(iteration.type, "plain");
    assert.equal(iteration.spec.contextMode, true);
    assert.equal(iteration.spec.loopSetup, "for each i of [1..5]");
    assert.deepEqual(iteration.spec.contextKeys, ["c"]);
  });
});

describe("compileForkRunStage", () => {
  it("keeps loop type when loopMeta is absent", () => {
    const stage = compileForkRunStage({
      logic: "(() => ({ c: 1 }))",
      loopSetup: "for each i of [1..3]",
    }, undefined, 1);

    assert.equal(stage.type, "loop");
  });

  it("yields plain iteration stage when loopMeta is set", () => {
    const stage = compileForkRunStage({
      contextMode: true,
      logic: "(() => ({ c: context.context.c + context.context.i }))",
      loopSetup: "for each i of [1..5]",
    }, { index: 2, arraySnapshot: [1, 2, 3, 4, 5], value: 3 }, 1);

    assert.equal(stage.type, "plain");
    assert.match(stage.lines, /CONTEXT:/);
    assert.equal(stage.spec.loopSetup, "for each i of [1..5]");
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
