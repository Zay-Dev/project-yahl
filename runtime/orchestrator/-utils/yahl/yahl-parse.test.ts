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
  "../../../../server/tasks/test/SKILL.yaml",
);

const trafficMonitorPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../server/tasks/traffic_monitor/SKILL.yaml",
);

describe("parseYahlDocument", () => {
  it("parses test SKILL.yaml", () => {
    const text = readFileSync(testSkillPath, "utf-8");
    const doc = parseYahlDocument(text);

    assert.equal(doc.name, "test the syntax");
    assert.equal(doc.resultContextKey, "result");
    assert.equal(doc.stages.length, 9);
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

  it("parses optional runInput context keys", () => {
    const doc = parseYahlDocument(`
name: x
description: y
runInput:
  - knowledge_topic
stages:
  - logic: "x = 1;"
`);

    assert.deepEqual(doc.runInput, ["knowledge_topic"]);
  });

  it("omits runInput when absent", () => {
    const doc = parseYahlDocument(`
name: x
description: y
stages:
  - logic: "x = 1;"
`);

    assert.equal(doc.runInput, undefined);
  });

  it("rejects empty runInput entries", () => {
    assert.throws(() => {
      parseYahlDocument(`
name: x
description: y
runInput:
  - "   "
stages:
  - logic: "x = 1;"
`);
    }, /runInput\[0\]/);
  });

  it("rejects duplicate runInput keys", () => {
    assert.throws(() => {
      parseYahlDocument(`
name: x
description: y
runInput:
  - knowledge_topic
  - knowledge_topic
stages:
  - logic: "x = 1;"
`);
    }, /duplicate key/);
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

  it("rejects conditionMode and whileSetup together", () => {
    assert.throws(() => {
      parseYahlDocument(`
name: x
description: y
stages:
  - conditionMode: true
    whileSetup: "context.context.c < 3"
    logic: |
      IF: true;
      END:
`);
    }, /mutually exclusive/);
  });

  it("rejects loopSetup and whileSetup together", () => {
    assert.throws(() => {
      parseYahlDocument(`
name: x
description: y
stages:
  - loopSetup: for each i of [1..2]
    whileSetup: "context.context.c < 3"
    logic: "c += 1;"
`);
    }, /mutually exclusive/);
  });

  it("rejects warmUp without a loop", () => {
    assert.throws(() => {
      parseYahlDocument(`
name: x
description: y
stages:
  - warmUp: "c += 1;"
    logic: "c += 1;"
`);
    }, /warmUp requires loopSetup or whileSetup/);
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

  it("does not prepend whileSetup onto agent lines", () => {
    const lines = compileStageLines({
      logic: "c += 1;",
      whileSetup: "context.context.c < 10",
    });

    assert.equal(lines, "{\nc += 1;\n}");
    assert.doesNotMatch(lines, /whileSetup/);
  });
});

describe("parseYahlTask", () => {
  it("returns stages and resultContextKey from test SKILL.yaml", () => {
    const text = readFileSync(testSkillPath, "utf-8");
    const { resultContextKey, stages } = parseYahlTask(text);

    assert.equal(resultContextKey, "result");
    assert.equal(stages.length, 9);
    assert.equal(stages[2]?.type, "loop");
    assert.equal(stages[7]?.type, "while");
    assert.equal(stages[7]?.spec.whileSetup, "context.context.c < 20");
  });

  it("returns runInputContextKeys from task metadata", () => {
    const { runInputContextKeys } = parseYahlTask(`
name: x
description: y
runInput:
  - knowledge_topic
stages:
  - logic: "x = 1;"
`);

    assert.deepEqual(runInputContextKeys, ["knowledge_topic"]);
  });
});

describe("parseYahlFile", () => {
  it("compiles test stages with temperature and loop type", () => {
    const stages = parseYahlFile(readFileSync(testSkillPath, "utf-8"));

    assert.equal(stages.length, 9);
    assert.equal(stages[2]?.type, "loop");
    assert.equal(stages[2]?.temperature, 0.2);
    assert.equal(stages[0]?.produceContextKeys?.join(","), "a,b,c");
    assert.match(stages[3]?.lines ?? "", /^IF:/);
    assert.equal(stages[7]?.type, "while");
    assert.equal(stages[7]?.spec.warmUp?.trim(), "c += 1;");
  });

  it("compiles traffic_monitor monitor as while with following assemble", () => {
    const stages = parseYahlFile(readFileSync(trafficMonitorPath, "utf-8"));
    const monitorIndex = stages.findIndex((stage) => stage.spec.id === "monitor");
    const monitor = stages[monitorIndex];
    const assemble = stages[monitorIndex + 1];

    assert.equal(monitor?.type, "while");
    assert.match(
      (typeof monitor?.spec.whileSetup === "string"
        ? monitor.spec.whileSetup
        : monitor?.spec.whileSetup?.condition) ?? "",
      /started_at/,
    );
    assert.equal(
      typeof monitor?.spec.whileSetup === "object"
        ? monitor.spec.whileSetup.doAtLeast
        : 1,
      2,
    );
    assert.match(monitor?.spec.warmUp ?? "", /bind_origin/);
    assert.match(monitor?.spec.warmUp ?? "", /stagehand\/SKILL\.md/);
    assert.ok(monitor?.spec.verify);
    assert.equal(assemble?.spec.contextMode, true);
    assert.equal(assemble?.spec.verify, undefined);
    assert.deepEqual(assemble?.produceContextKeys, ["monitor"]);
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

  it("omits whileSetup and warmUp for agent/redis payloads", () => {
    const agent = toAgentStage({
      logic: "c += 1;",
      warmUp: "c += 0;",
      whileSetup: "context.context.c < 10",
    });

    assert.equal(agent.logic, "c += 1;");
    assert.equal(agent.whileSetup, undefined);
    assert.equal(agent.warmUp, undefined);
  });

  it("omits verify for agent/redis payloads", () => {
    const agent = toAgentStage({
      logic: "c += 1;",
      verify: {
        defId: "stage-verify",
        autoRetry: true,
        minScore: 0.75,
        rubric: "Pass when c is set.",
      },
    });

    assert.equal(agent.logic, "c += 1;");
    assert.equal(agent.verify, undefined);
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

describe("compileStage while", () => {
  it("marks whileSetup stages as type while", () => {
    const stage = compileStage({
      logic: "c += 1;",
      whileSetup: "context.context.c < 10",
      warmUp: "c += 0;",
    }, 4);

    assert.equal(stage.type, "while");
    assert.equal(stage.spec.whileSetup, "context.context.c < 10");
    assert.equal(stage.spec.warmUp, "c += 0;");
    assert.match(stage.lines, /c \+= 1;/);
    assert.doesNotMatch(stage.lines, /whileSetup/);
  });

  it("keeps object whileSetup with doAtLeast", () => {
    const stage = compileStage({
      logic: "c += 1;",
      whileSetup: {
        condition: "false",
        doAtLeast: 2,
      },
    }, 4);

    assert.equal(stage.type, "while");
    assert.deepEqual(stage.spec.whileSetup, {
      condition: "false",
      doAtLeast: 2,
    });
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
