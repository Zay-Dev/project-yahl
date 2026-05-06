import path from "path";

import type { StageExecutionMeta } from "../shared/transport";

import { filterContextByReadUsage } from "./context-filter";
import { handleLoop } from "./loop-handling";
import { handleRag } from "./rag-handling";
import {
  firstTraceableLineOffset,
  getLineSinceOffset,
  parseStages,
  toStableHash,
} from "./stage-parse";

import {
  createRuntimeContext,
  extractAiLogic,
  resetStageContext,
  setContextValue,
  toStageContextPayload,
} from "./runtime";

import type {
  StageExecuteFn,
  StageLoopMeta,
  StagePosition,
} from "./orchestrator-types";

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type StageFilterFn = (lines: string) => {
  generatedLine: number;
  sourceLine: number;
  stageText: string;
};

let _stageIndex = -1;

export const execute: StageExecuteFn = (...args) => _execute(false, ...args);
export const executeAsRoot: StageExecuteFn = (...args) => _execute(true, ...args);

const _execute = async (
  manageStageIndex: boolean,
  text: string,
  stageContext: Record<string, unknown> = {},
  seedTypes: Record<string, unknown> = {},
  sourceFilePath: string,
  sourceBaseLine: number,
  loopMeta?: StageLoopMeta,
) => {
  const aiLogic = extractAiLogic(text);
  if (!aiLogic) {
    throw new Error("No ai.logic block found");
  }

  const stages = parseStages(aiLogic).filter((stage) => stage.lines != "}");
  
  if (stages.length <= 0) {
    throw new Error("No stages parsed from ai.logic");
  }

  if (manageStageIndex) {
    _stageIndex = -1;
  }

  try {
    const runtime = createRuntimeContext();
    Object.assign(runtime.get("types")!, seedTypes);

    for (const { type, lines, sourceStartLine } of stages) {
      resetStageContext(runtime);
      Object.assign(runtime.get("stage")!, stageContext);
      const absoluteSourceStartLine = sourceBaseLine + sourceStartLine - 1;

      if (manageStageIndex) {
        _stageIndex += 1;
      }

      if (type === "loop") {
        await handleLoop(
          lines,
          runtime,
          sourceFilePath,
          absoluteSourceStartLine,
          execute,
        );
        continue;
      }

      console.log("\n", "----- Stage -----", "\n");

      const runStageOnce = async (
        position: StagePosition,
        filterLines?: StageFilterFn,
      ) => {
        let stageRequestId = "";

        try {
          const override = forkRunManager?.getOverride(_stageIndex, loopMeta?.index);

          Object.keys(override?.context ?? {}).forEach((contextKey: any) => {
            Object.keys(override?.context?.[contextKey]).forEach((key) => {
              runtime.set(contextKey, {
                ...runtime.get(contextKey) ?? {},
                [key]: override?.context?.[contextKey]?.[key],
              });
            });
          });
          
          const next = filterLines?.(override?.currentStage || lines);
          const currentStage = next?.stageText || override?.currentStage || lines;

          const stageText = currentStage;
          const meaningfulOffset = firstTraceableLineOffset(stageText);
          const sourceLineText = getLineSinceOffset(stageText, meaningfulOffset);
          const generatedLine = (next?.generatedLine || position.generatedLine) + meaningfulOffset;
          const sourceLine = (next?.sourceLine || position.sourceLine) + meaningfulOffset;

          const rawPayload = toStageContextPayload(runtime);
          const context = {
            ...rawPayload,
            context: filterContextByReadUsage(stageText, rawPayload.context),
            stage: filterContextByReadUsage(stageText, rawPayload.stage),
          };
          const baseStageId = `${path.basename(sourceFilePath)}:${sourceLine}:${type}`;
          const computedStageId = loopMeta ? `${baseStageId}#loop:${loopMeta.index}` : baseStageId;

          const executionMeta: StageExecutionMeta = {
            loopRef: loopMeta ? {
              arraySnapshot: loopMeta.arraySnapshot,
              index: loopMeta.index,
              value: loopMeta.value,
            } : undefined,
            runtimeRef: {
              generatedLine,
            },
            sourceRef: {
              filePath: sourceFilePath,
              line: sourceLine,
              text: sourceLineText,
            },
            stageId: computedStageId,
            stageIndex: _stageIndex,
            stageTextHash: toStableHash(stageText),
          };

          console.log("request", JSON.stringify({ context, currentStage, type }, null, 2));

          console.log("\nContinuing...\n");

          const { requestId, envelope } = await publisher.pushRequest(
            context,
            currentStage,
            executionMeta,
            forkRunManager?.isFastForward(_stageIndex, loopMeta?.index) ?
              forkRunManager?.getContextAfter(_stageIndex, loopMeta?.index) :
              undefined,
          );

          stageRequestId = requestId;

          if (Array.isArray(envelope)) {
            envelope
              .filter((item) => item.type === "tool_call" && item.tool === "set_context")
              .forEach((item) => {
                setContextValue(
                  runtime,
                  item.arguments.scope === "types" ? "types" : "global",
                  item.arguments.key,
                  item.arguments.value,
                  item.arguments.operation,
                );
              });
            process.stdout.write(`[Orchestrator Stage] set_context calls, length: ${envelope.length}\n`);
          } else if (envelope.type === "tool_call" && envelope.tool === "rag") {
            const result = await handleRag(
              runtime,
              envelope.arguments.lookingFor,
              envelope.arguments.chunkSize,
              envelope.arguments.tmp_file_path,
              envelope.arguments.byteLength,
              envelope.arguments.context_key,
              sourceFilePath,
              sourceLine,
              execute,
            );

            Object.assign(runtime.get("stage")!, result);
            delete runtime.get("context")?.lookingFor;
            delete runtime.get("context")?.chunkSize;
            delete runtime.get("context")?.tmp_file_path;
            delete runtime.get("context")?.byteLength;
            delete runtime.get("context")?.context_key;

            if (stageRequestId) {
              const rid = stageRequestId;
              stageRequestId = "";
              publisher.emitStageFinish({
                contextAfter: cloneJson(toStageContextPayload(runtime)),
                requestId: rid,
              });
            }

            await runStageOnce(
              {
                generatedLine: sourceLine,
                sourceLine,
              },
              (rawLines) => {
                const splitted = rawLines.split("\n");
                const skipNumberOfLines = splitted.findIndex((line) =>
                  line.includes("REPLACE:") &&
                  line.includes(` ${envelope.arguments.context_key} `) &&
                  line.includes(" /rag("),
                ) + 1;

                return {
                  generatedLine: skipNumberOfLines + 1,
                  sourceLine: sourceLine + skipNumberOfLines,
                  stageText: splitted.slice(skipNumberOfLines).join("\n"),
                };
              },
            );

            return undefined;
          } else {
            process.stdout.write(`[Orchestrator Stage] ${envelope.type}\n`);
          }
        } finally {
          if (stageRequestId) {
            publisher.emitStageFinish({
              contextAfter: cloneJson(toStageContextPayload(runtime)),
              requestId: stageRequestId,
            });
          }
        }
      };

      await runStageOnce({
        generatedLine: 1,
        sourceLine: absoluteSourceStartLine,
      });
    }

    return { runtime, stages };
  } catch (error) {
    console.error(error);
    throw error;
  }
};
