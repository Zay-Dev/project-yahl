import path from "path";

import Redis from "ioredis";

import type { AskUserToolCallEnvelope, StageContextPayload } from "../shared/stage-contract";
import type { StageExecutionMeta } from "../shared/transport";

import { toA2uiFromPlan } from "../shared/a2ui-from-plan";

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
  getBucketForScope,
  resetStageContext,
  setContextValue,
  toStageContextPayload,
} from "./runtime";

import * as agentTrackers from "./-utils/agent-trackers";

import type {
  StageExecuteFn,
  StageLoopMeta,
  StagePosition,
} from "./orchestrator-types";

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const sessionApiBaseUrl = (process.env.SESSION_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
const askUserEnabled = process.env.YAHL_ENABLE_ASK_USER !== "false";
const inlineAskUserPattern = /\/ask-user\(([^)]*)\)/;

export const askUserAnsweredChannelId = (sessionId: string) =>
  `yahl:ask-user-answered:${sessionId}`;

const parsePollEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ASK_USER_POLL_MS = parsePollEnv(process.env.YAHL_ASK_USER_POLL_MS, 250);
const ASK_USER_MAX_WAIT_MS = parsePollEnv(process.env.YAHL_ASK_USER_MAX_WAIT_MS, 1000);
// const ASK_USER_MAX_WAIT_MS = parsePollEnv(process.env.YAHL_ASK_USER_MAX_WAIT_MS, 600_000);

const postAskUserQuestion = async (
  sessionId: string,
  requestId: string,
  stageId: string,
  question: AskUserToolCallEnvelope["arguments"],
) => {
  const response = await fetch(`${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}/ask-user/questions`, {
    body: JSON.stringify({ question, requestId, stageId }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`ask_user create failed (${response.status})`);
  }
  const json = await response.json() as { questionId: string };
  return json.questionId;
};

const fetchAskUserAnswerState = async (sessionId: string, questionId: string) => {
  const response = await fetch(
    `${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}/ask-user/questions/${encodeURIComponent(questionId)}`,
  );
  if (!response.ok) return null;
  const json = await response.json() as {
    answerIds: string[];
    options: { id: string; label: string }[];
    status: "answered" | "pending";
  };
  if (json.status !== "answered") return null;
  const selected = json.options.filter((option) => json.answerIds.includes(option.id));
  return {
    selectedLabels: selected.map((option) => option.label),
    selectedOptionIds: json.answerIds,
  };
};

const waitForAskUserAnswer = async (sessionId: string, questionId: string) => {
  const redisUrl = process.env.REDIS_URL?.trim();
  const channel = askUserAnsweredChannelId(sessionId);
  const deadline = Date.now() + ASK_USER_MAX_WAIT_MS;
  let sub: Redis | null = null;
  let wake: (() => void) | null = null;

  const bump = () => {
    wake?.();
  };

  const teardown = async () => {
    wake = null;
    if (!sub) return;

    try {
      await sub.unsubscribe(channel);
      sub.removeAllListeners();
      await sub.quit();
    } catch {
      void sub.disconnect();
    } finally {
      sub = null;
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  if (redisUrl) {
    try {
      sub = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
      await sub.subscribe(channel);
      sub.on("message", (topic, payload) => {
        if (topic !== channel) return;

        try {
          const parsed = JSON.parse(payload) as { questionId?: string };
          if (parsed.questionId === questionId) bump();
        } catch {
          return;
        }
      });
    } catch {
      await teardown();
    }
  }

  try {
    while (Date.now() < deadline) {
      const hit = await fetchAskUserAnswerState(sessionId, questionId);
      if (hit) return hit;

      const sleepMs = Math.min(ASK_USER_POLL_MS, Math.max(0, deadline - Date.now()));
      if (sleepMs <= 0) break;

      const bumped = new Promise<void>((resolve) => {
        wake = resolve;
      });

      await (sub ? Promise.race([sleep(sleepMs), bumped]) : sleep(sleepMs));
      wake = null;
    }

    throw new Error("ask_user timeout waiting for answer");
  } finally {
    await teardown();
  }
};

const persistTimedOutAskUserRecovery = async (params: {
  currentStageText: string;
  questionId: string;
  requestId: string;
  sessionId: string;
  snapshot: StageContextPayload;
  sourceRef: { filePath: string; line: number };
  stageId: string;
}) => {
  try {
    const response = await fetch(
      `${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(params.sessionId)}/ask-user/recovery/timed-out`,
      {
        body: JSON.stringify({
          currentStageText: params.currentStageText,
          questionId: params.questionId,
          requestId: params.requestId,
          runtimeSnapshot: params.snapshot,
          sourceRef: params.sourceRef,
          stageId: params.stageId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    if (!response.ok) {
      process.stderr.write(`[ask-user] timed-out recovery persist failed (${response.status})\n`);
    }
  } catch (error) {
    process.stderr.write(`[ask-user] timed-out recovery persist error: ${String(error)}\n`);
  }
};

export const toAskUserAnswerValue = (optionId: string | undefined) => {
  if (!optionId) return "";
  const trimmed = optionId.trim();
  if (/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;
  }
  return trimmed;
};

export const buildAskUserContinuation = (
  rawLines: string,
  answerValue: number | string,
) => {
  const splitted = rawLines.split("\n");
  const askUserLineIndex = splitted.findIndex((line) => inlineAskUserPattern.test(line));
  if (askUserLineIndex < 0) {
    return null;
  }

  const askUserLine = splitted[askUserLineIndex] || "";
  const serialized = JSON.stringify(answerValue);
  const patchedAskUserLine = askUserLine.replace(inlineAskUserPattern, serialized);
  const stageText = [patchedAskUserLine, ...splitted.slice(askUserLineIndex + 1)].join("\n");

  return {
    skipNumberOfLines: askUserLineIndex,
    stageText,
  };
};

export const buildAskUserContinuationWithContext = (rawLines: string) => {
  const splitted = rawLines.split("\n");
  const askUserLineIndex = splitted.findIndex((line) => inlineAskUserPattern.test(line));
  if (askUserLineIndex < 0) {
    return null;
  }

  const askUserLine = splitted[askUserLineIndex] || "";
  const patchedAskUserLine = askUserLine.replace(inlineAskUserPattern, "ask_user_last_answer");
  const stageText = [patchedAskUserLine, ...splitted.slice(askUserLineIndex + 1)].join("\n");

  return {
    skipNumberOfLines: askUserLineIndex,
    stageText,
  };
};

type StageFilterFn = (lines: string) => {
  generatedLine: number;
  sourceLine: number;
  stageText: string;
};

let _stageIndex = -1;

export const execute: StageExecuteFn = (text, stageContext, seedTypes, sourceFilePath, sourceBaseLine, loopMeta, hydrate) =>
  _execute(false, text, stageContext, seedTypes, sourceFilePath, sourceBaseLine, loopMeta, hydrate);
export const executeAsRoot: StageExecuteFn = (text, stageContext, seedTypes, sourceFilePath, sourceBaseLine, loopMeta, hydrate) =>
  _execute(true, text, stageContext, seedTypes, sourceFilePath, sourceBaseLine, loopMeta, hydrate);

const _execute = async (
  manageStageIndex: boolean,
  text: string,
  stageContext: Record<string, unknown> = {},
  seedTypes: Record<string, unknown> = {},
  sourceFilePath: string,
  sourceBaseLine: number,
  loopMeta?: StageLoopMeta,
  resumeHydrate?: StageContextPayload | null,
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
    if (resumeHydrate) {
      Object.assign(runtime.get("context")!, resumeHydrate.context ?? {});
      Object.assign(runtime.get("types")!, resumeHydrate.types ?? {});
    }
    Object.assign(runtime.get("types")!, seedTypes);

    let appliedResumeHydrateStage = false;

    for (const { type, lines, sourceStartLine } of stages) {
      resetStageContext(runtime);
      Object.assign(runtime.get("stage")!, stageContext);
      if (resumeHydrate && !appliedResumeHydrateStage) {
        Object.assign(runtime.get("stage")!, resumeHydrate.stage ?? {});
        appliedResumeHydrateStage = true;
      }
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
          } else if (envelope.type === "tool_call" && envelope.tool === "render_a2ui_plan") {
            const { dataRef, plan } = envelope.arguments;
            const bucket = getBucketForScope(dataRef.scope);
            const rootData = runtime.get(bucket)?.[dataRef.key];
            const surfaceOverride = envelope.arguments.surfaceId?.trim();
            const mergedPlan = {
              ...plan,
              surfaceId: surfaceOverride || plan.surfaceId,
            };
            try {
              const resultA2ui = toA2uiFromPlan(rootData, mergedPlan);
              if (!resultA2ui.length) {
                process.stderr.write(
                  `[render_a2ui_plan] empty output ui_kind=${mergedPlan.ui_kind} ` +
                    `dataRef=${JSON.stringify(dataRef)}\n`,
                );
              } else {
                const sessionId = process.env.AGENT_SESSION_ID?.trim();
                if (sessionId) {
                  await agentTrackers.sessionA2ui({
                    envelopes: resultA2ui,
                    sessionId,
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              process.stderr.write(
                `[render_a2ui_plan] error ui_kind=${mergedPlan.ui_kind} ` +
                  `dataRef=${JSON.stringify(dataRef)}: ${msg}\n`,
              );
            }
            if (stageRequestId) {
              const rid = stageRequestId;
              stageRequestId = "";
              publisher.emitStageFinish({
                contextAfter: cloneJson(toStageContextPayload(runtime)),
                requestId: rid,
              });
            }
            return undefined;
          } else if (envelope.type === "tool_call" && envelope.tool === "ask_user") {
            if (!askUserEnabled) {
              throw new Error("ask_user is disabled (YAHL_ENABLE_ASK_USER=false)");
            }
            const sessionId = process.env.AGENT_SESSION_ID;
            if (!sessionId) {
              throw new Error("AGENT_SESSION_ID missing for ask_user tool");
            }
            const questionId = await postAskUserQuestion(
              sessionId,
              requestId,
              executionMeta.stageId,
              envelope.arguments,
            );
            let answer: { selectedLabels: string[]; selectedOptionIds: string[] };
            try {
              answer = await waitForAskUserAnswer(sessionId, questionId);
            } catch (error) {
              if (error instanceof Error && error.message === "ask_user timeout waiting for answer") {
                await persistTimedOutAskUserRecovery({
                  currentStageText: currentStage,
                  questionId,
                  requestId,
                  sessionId,
                  snapshot: cloneJson(toStageContextPayload(runtime)),
                  sourceRef: {
                    filePath: executionMeta.sourceRef.filePath,
                    line: executionMeta.sourceRef.line,
                  },
                  stageId: executionMeta.stageId,
                });
              }
              throw error;
            }

            const answerValue = toAskUserAnswerValue(answer.selectedOptionIds[0]);
            setContextValue(runtime, "stage", "ask_user_last_answer", answerValue);

            const continuation = buildAskUserContinuation(currentStage, answerValue);
            if (continuation && stageRequestId) {
              const rid = stageRequestId;
              stageRequestId = "";
              publisher.emitStageFinish({
                contextAfter: cloneJson(toStageContextPayload(runtime)),
                requestId: rid,
              });

              await runStageOnce(
                {
                  generatedLine: sourceLine,
                  sourceLine,
                },
                (rawLines) => {
                  const nextContinuation = buildAskUserContinuation(rawLines, answerValue) || continuation;
                  const nextGeneratedLine = nextContinuation.skipNumberOfLines + 1;
                  return {
                    generatedLine: nextGeneratedLine,
                    sourceLine: sourceLine + nextContinuation.skipNumberOfLines,
                    stageText: nextContinuation.stageText,
                  };
                },
              );
            }

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
