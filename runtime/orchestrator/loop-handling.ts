import { pickContextUpdates } from "./context-filter";
import { filterLoopBucket } from "./stage-field-policy";
import { applyKnowledgeUpdate, parseKnowledgeUpdate } from "./loop-knowledge";
import { parseLoop } from "./stage-parse";

import type {
  LoopKnowledge,
  ParsedStage,
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
  stage: ParsedStage,
  execute: StageExecuteFn,
) => {
  const firstLine = lines.split("\n")[0];
  const mode = firstLine.match(/\s+[A-Z_]+:\s*{/)?.[0]?.replace("{", "") || "";
  const body = lines.substring(lines.indexOf("{"));
  const compiledBody = mode ? `${mode} ${body}` : body;

  const isExtends = (key: string) => lines.match(new RegExp(`\\s*EXTENDS:\\s*${key}\\s*=`));

  const stageInput = Object
    .entries({
      ...filterLoopBucket(compiledBody, runtime.get("context")!, stage, indexName),
      ...filterLoopBucket(compiledBody, runtime.get("stage")!, stage, indexName),

      knowledge: JSON.parse(JSON.stringify(knowledge)),
      [indexName]: currentValue,
    })
    .filter(([key]) => !isExtends(key))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, unknown>);

  const { runtime: loopRuntime } = await execute(
    compiledBody,
    stageInput,
    { ...(runtime.get("types") || {}) },
    sourceFilePath,
    loopSourceLine + 1,
    loopMeta,
  );

  const myContext = runtime.get("context")!;
  const loopContext = pickContextUpdates(
    loopRuntime.get("context")!,
    stage.updateContextKeys,
  );
  const myStage = runtime.get("stage")!;
  const loopStage = pickContextUpdates(
    loopRuntime.get("stage")!,
    stage.updateContextKeys,
  );

  for (const key of Object.keys(loopContext)) {
    if (Object.keys(myContext).includes(key)) {
      if (isExtends(key)) {
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
  stage: ParsedStage,
  runtime: RuntimeContext,
  sourceFilePath: string,
  loopSourceLine: number,
  execute: StageExecuteFn,
  loopStageTemperature?: number,
) => {
  const lines = stage.lines;
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
        indexName,
        value: currentValue,
        ...(loopStageTemperature === undefined ? {} : { temperature: loopStageTemperature }),
      },
      stage,
      execute,
    );

    i += step;
  }
};
