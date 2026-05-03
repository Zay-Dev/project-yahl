import { filterContextByReadUsage } from "./context-filter";
import { applyKnowledgeUpdate, parseKnowledgeUpdate } from "./loop-knowledge";
import {
  resolveResumeLoopStep,
  runSnapshotStageOnce,
} from "./resume-context";
import { parseLoop, toAiLogic } from "./stage-parse";

import type {
  LoopKnowledge,
  ResumeState,
  StageExecuteFn,
  StageLoopMeta,
} from "./orchestrator-types";
import type { RuntimeContext } from "./runtime";

const _runLoopIteration = async (
  lines: string,
  runtime: RuntimeContext,
  sourceFilePath: string,
  loopSourceLine: number,
  knowledge: LoopKnowledge,
  indexName: string,
  currentValue: unknown,
  loopMeta: StageLoopMeta,
  resumeState: ResumeState,
  execute: StageExecuteFn,
) => {
  const firstLine = lines.split("\n")[0];
  const mode = firstLine.match(/\s+[A-Z_]+:\s*{/)?.[0]?.replace("{", "") || "";
  const aiBlock = toAiLogic(
    `${mode} ${lines.substring(lines.indexOf("{"))}`,
  );

  const { runtime: loopRuntime } = await execute(
    aiBlock,
    {
      ...filterContextByReadUsage(aiBlock, runtime.get("context")!),
      ...filterContextByReadUsage(aiBlock, runtime.get("stage")!),

      knowledge: JSON.parse(JSON.stringify(knowledge)),
      [indexName]: currentValue,
    },
    { ...(runtime.get("types") || {}) },
    sourceFilePath,
    loopSourceLine + 1,
    loopMeta,
    resumeState,
  );

  const myContext = runtime.get("context")!;
  const loopContext = loopRuntime.get("context")!;
  const myStage = runtime.get("stage")!;
  const loopStage = loopRuntime.get("stage")!;

  for (const key of Object.keys(loopContext)) {
    if (Object.keys(myContext).includes(key)) {
      if (lines.match(new RegExp(`\\s*EXTENDS:\\s*${key}\\s*=`))) {
        myContext[key] = [myContext[key], loopContext[key]];
      } else {
        myContext[key] = loopContext[key];
      }
    }
  }

  if (loopStage.result) {
    runtime.set("context", { ...myContext, result: loopStage.result });
  }

  runtime.set("stage", { ...myStage, ...loopStage, ...loopContext });

  const stageKnowledgeRaw = loopStage.knowledge_update;
  const contextKnowledgeRaw = loopContext.knowledge_update;
  const stageKnowledge = parseKnowledgeUpdate(stageKnowledgeRaw);
  const contextKnowledge = parseKnowledgeUpdate(contextKnowledgeRaw);

  if (stageKnowledge) {
    applyKnowledgeUpdate(knowledge, stageKnowledge);
  } else if (contextKnowledge) {
    applyKnowledgeUpdate(knowledge, contextKnowledge);
  } else if (knowledge.notes.length > 0) {
    console.log(`[knowledge] no update for iteration value="${String(currentValue)}"`);
  }
};

export const handleLoop = async (
  lines: string,
  runtime: RuntimeContext,
  sourceFilePath: string,
  loopSourceLine: number,
  resumeState: ResumeState,
  execute: StageExecuteFn,
) => {
  if (resumeState.pendingStageId && resumeState.executionMeta?.loopRef) {
    const matchMeta = lines.match(/^\s*for each (\w+) of (\[.*\])/i);
    if (!matchMeta) {
      console.error(lines);
      throw new Error("Invalid loop setup occurred in the above stage");
    }

    const indexName = matchMeta[1];
    const loopRef = resumeState.executionMeta.loopRef;
    const snapshot = Array.isArray(loopRef.arraySnapshot) ? loopRef.arraySnapshot : [];
    const step = resolveResumeLoopStep(lines, loopRef);
    const knowledge: LoopKnowledge = {
      issues: {},
      notes: [],
    };

    await runSnapshotStageOnce(runtime, resumeState);
    resumeState.pendingStageId = null;

    for (
      let i = loopRef.index + step;
      step >= 0 ? i < snapshot.length : i >= 0;
      i += step
    ) {
      const currentValue = snapshot[i] ?? null;
      await _runLoopIteration(
        lines,
        runtime,
        sourceFilePath,
        loopSourceLine,
        knowledge,
        indexName,
        currentValue,
        {
          arraySnapshot: snapshot,
          index: i,
          value: currentValue,
        },
        resumeState,
        execute,
      );
    }

    return;
  }

  const loopSetup = parseLoop(lines, runtime);
  if (!loopSetup) {
    console.error(lines);
    throw new Error("Invalid loop setup occurred in the above stage");
  }

  const { indexName, startAt, endAfter, step, array } = loopSetup;
  let i = startAt;
  const knowledge: LoopKnowledge = {
    issues: {},
    notes: [],
  };

  while (step >= 0 ? i <= endAfter : i >= endAfter) {
    const currentValue = !!array ? array[i] || null : i;
    await _runLoopIteration(
      lines,
      runtime,
      sourceFilePath,
      loopSourceLine,
      knowledge,
      indexName,
      currentValue,
      {
        arraySnapshot: Array.isArray(array) ? JSON.parse(JSON.stringify(array)) : [],
        index: i,
        value: currentValue,
      },
      resumeState,
      execute,
    );

    i += step;
  }
};
