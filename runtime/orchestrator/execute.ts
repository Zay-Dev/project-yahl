import path from "path";

import Redis from "ioredis";

import type {
  AskUserToolCallEnvelope,
  RenderA2uiPlanToolCallEnvelope,
  SetContextToolCallEnvelope,
  StageContextPayload,
} from "../shared/stage-contract";
import type { TStorage } from "../shared/transports/-types";
import type { StageExecutionMeta } from "../shared/transport";
import { toAgentStage, validateYahlStage } from "../shared/yahl-stage";

import { toA2uiFromPlan } from "../shared/a2ui-from-plan";

import { parseAskUserToolArguments } from "../shared/stage-tools";

import {
  applySetContextToolCall,
  filterStageContextPayload,
  resolveSetContextScope,
  shouldApplySetContext,
} from "./stage-field-policy";
import { handleLoop } from "./loop-handling";
import { handleRag } from "./rag-handling";
import {
  firstTraceableLineOffset,
  getLineSinceOffset,
  stripLeadingTemperature,
  toStableHash,
} from "./stage-parse";
import { compileStageLines, resolveStagesFromText } from "./yahl-parse";

import {
  createRuntimeContext,
  getBucketForScope,
  resetStageContext,
  setContextValue,
  toStageContextPayload,
} from "./runtime";

import * as agentTrackers from "./-utils/agent-trackers";

import type {
  ParsedStage,
  StageExecuteFn,
  StageLoopMeta,
  StagePosition,
} from "./orchestrator-types";

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const toPushStorage = (payload: StageContextPayload): TStorage => ({
  context: new Map(Object.entries({
    ...payload.context,
    ...payload.stage,
  })),
  types: new Map(Object.entries(payload.types)),
});

const toPushStorageFromSnapshot = (snapshot: unknown): TStorage | undefined => {
  if (!snapshot || typeof snapshot !== "object") return undefined;

  const record = snapshot as Record<string, unknown>;
  const context = record.context;
  const stageBucket = record.stage;
  const types = record.types;

  return {
    context: new Map(Object.entries({
      ...(context && typeof context === "object" && !Array.isArray(context)
        ? context as Record<string, unknown>
        : {}),
      ...(stageBucket && typeof stageBucket === "object" && !Array.isArray(stageBucket)
        ? stageBucket as Record<string, unknown>
        : {}),
    })),
    types: new Map(Object.entries(
      types && typeof types === "object" && !Array.isArray(types)
        ? types as Record<string, unknown>
        : {},
    )),
  };
};

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

export const postAskUserQuestion = async (
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

export const waitForAskUserAnswer = async (sessionId: string, questionId: string) => {
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

export const validateSurfaceUiKindConflict = (
  knownSurfaceUiKinds: Map<string, string>,
  surfaceId: string,
  uiKind: string,
) => {
  const existingUiKind = knownSurfaceUiKinds.get(surfaceId);
  if (!existingUiKind || existingUiKind === uiKind) return null;

  return (
    `surfaceId "${surfaceId}" already initialized as ${existingUiKind}; ` +
    `cannot re-create with ${uiKind}. Use a new surfaceId.`
  );
};

type StageFilterFn = (lines: string) => {
  generatedLine: number;
  sourceLine: number;
  stageText: string;
};

let _stageIndex = -1;

export const execute: StageExecuteFn = (
  text,
  stageContext,
  seedTypes,
  sourceFilePath,
  sourceBaseLine,
  loopMeta,
  hydrate,
  stagesOverride,
) =>
  _execute(false, text, stageContext, seedTypes, sourceFilePath, sourceBaseLine, loopMeta, hydrate, stagesOverride);
export const executeAsRoot: StageExecuteFn = (
  text,
  stageContext,
  seedTypes,
  sourceFilePath,
  sourceBaseLine,
  loopMeta,
  hydrate,
  stagesOverride,
) =>
  _execute(true, text, stageContext, seedTypes, sourceFilePath, sourceBaseLine, loopMeta, hydrate, stagesOverride);

export const executeAsRootFromStages = (
  stages: ParsedStage[],
  stageContext: Record<string, unknown>,
  seedTypes: Record<string, unknown>,
  sourceFilePath: string,
  sourceBaseLine: number,
  hydrate?: StageContextPayload | null,
) =>
  _execute(true, "", stageContext, seedTypes, sourceFilePath, sourceBaseLine, undefined, hydrate, stages);

export const executeStages = (
  stages: ParsedStage[],
  stageContext: Record<string, unknown>,
  seedTypes: Record<string, unknown>,
  sourceFilePath: string,
  sourceBaseLine: number,
  loopMeta?: StageLoopMeta,
  hydrate?: StageContextPayload | null,
) =>
  _execute(false, "", stageContext, seedTypes, sourceFilePath, sourceBaseLine, loopMeta, hydrate, stages);

const _execute = async (
  manageStageIndex: boolean,
  text: string,
  stageContext: Record<string, unknown> = {},
  seedTypes: Record<string, unknown> = {},
  sourceFilePath: string,
  sourceBaseLine: number,
  loopMeta?: StageLoopMeta,
  resumeHydrate?: StageContextPayload | null,
  stagesOverride?: ParsedStage[],
) => {
  const stages = (stagesOverride ?? resolveStagesFromText(text))
    .filter((stage) => stage.lines !== "}");

  if (stages.length <= 0) {
    throw new Error("No stages parsed from SKILL.yahl");
  }

  if (manageStageIndex) {
    _stageIndex = -1;
  }

  try {
    const runtime = createRuntimeContext();
    const surfaceUiKinds = new Map<string, string>();
    if (resumeHydrate) {
      Object.assign(runtime.get("context")!, resumeHydrate.context ?? {});
      Object.assign(runtime.get("types")!, resumeHydrate.types ?? {});
    }
    Object.assign(runtime.get("types")!, seedTypes);

    let appliedResumeHydrateStage = false;

    for (const stage of stages) {
      const { lines, sourceStartLine, temperature: stageTemperature, type } = stage;
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
          stage,
          runtime,
          sourceFilePath,
          absoluteSourceStartLine,
          execute,
          stageTemperature,
        );
        continue;
      }

      console.log("\n", "----- Stage -----", "\n");

      const runStageOnce = async (
        position: StagePosition,
        filterLines?: StageFilterFn,
      ) => {
        let stageRequestId = "";
        const applyRenderA2uiEnvelope = async (renderEnvelope: RenderA2uiPlanToolCallEnvelope) => {
          const { dataRef, mode, plan } = renderEnvelope.arguments;
          const bucket = getBucketForScope(dataRef.scope);
          const rootData = runtime.get(bucket)?.[dataRef.key];
          const surfaceOverride = renderEnvelope.arguments.surfaceId?.trim();
          const mergedPlan = {
            ...plan,
            surfaceId: surfaceOverride || plan.surfaceId,
          };
          const logMeta =
            `mode=${mode} ui_kind=${mergedPlan.ui_kind} surfaceId=${mergedPlan.surfaceId} ` +
            `dataRefScope=${dataRef.scope} dataRefKey=${dataRef.key}`;
          const conflictMessage = validateSurfaceUiKindConflict(
            surfaceUiKinds,
            mergedPlan.surfaceId,
            mergedPlan.ui_kind,
          );
          if (conflictMessage) {
            process.stderr.write(`[render_a2ui_plan] conflict ${logMeta}: ${conflictMessage}\n`);
            throw new Error(conflictMessage);
          }

          const resultA2ui = toA2uiFromPlan(rootData, mergedPlan);
          if (!resultA2ui.length) {
            process.stderr.write(
              `[render_a2ui_plan] empty output ${logMeta}\n`,
            );
            return;
          }

          surfaceUiKinds.set(mergedPlan.surfaceId, mergedPlan.ui_kind);

          const sessionId = process.env.AGENT_SESSION_ID?.trim();
          if (sessionId) {
            await agentTrackers.sessionA2ui({
              envelopes: resultA2ui,
              mode,
              sessionId,
              surfaceId: mergedPlan.surfaceId,
              timestamp: new Date().toISOString(),
            });
          }
        };

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
          
          const effectiveSpec = override?.stage
            ? validateYahlStage(override.stage)
            : stage.spec;
          const effectiveLines = compileStageLines(effectiveSpec);
          const next = filterLines?.(effectiveLines);
          const rawStage = next?.stageText || effectiveLines;
          const { temperature: restripTemp, text: stageText } = stripLeadingTemperature(rawStage);
          const effectiveTemperature =
            effectiveSpec.temperature ?? restripTemp ?? stageTemperature ?? loopMeta?.temperature;
          const meaningfulOffset = firstTraceableLineOffset(stageText);
          const sourceLineText = getLineSinceOffset(stageText, meaningfulOffset);
          const generatedLine = (next?.generatedLine || position.generatedLine) + meaningfulOffset;
          const sourceLine = (next?.sourceLine || position.sourceLine) + meaningfulOffset;

          const rawPayload = toStageContextPayload(runtime);
          const filtered = filterStageContextPayload(
            stageText,
            rawPayload.context,
            rawPayload.stage,
            rawPayload.types,
            stage,
            loopMeta,
          );
          const context = {
            ...rawPayload,
            ...filtered,
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

          const agentSpec = toAgentStage(effectiveSpec);

          console.log("request", JSON.stringify({ context, stage: agentSpec, type }, null, 2));

          console.log("\nContinuing...\n");

          const pushStorage = toPushStorage(context);
          const { requestId, wait, getWaitForToolCall } = await publisher.pushRequest(
            pushStorage,
            agentSpec,
            effectiveTemperature,
            {
              contextAfter: forkRunManager?.isFastForward(_stageIndex, loopMeta?.index)
                ? toPushStorageFromSnapshot(
                  forkRunManager.getContextAfter(_stageIndex, loopMeta?.index),
                )
                : undefined,
              executionMeta,
              loopMeta,
              persistedStage: effectiveSpec,
            },
          );

          stageRequestId = requestId;

          const toolCallHandlers = getWaitForToolCall(async (toolCall) => {
            if (toolCall.function.name === "set_context") {
              const applied = await applySetContextToolCall(pushStorage, toolCall, stage);

              return {
                hasError: false,
                newStorage: pushStorage,
                result: applied ? "OK" : "skipped",
              };
            }

            if (toolCall.function.name === "ask_user") {
              if (!askUserEnabled) {
                return { hasError: true, result: "ask_user is disabled" };
              }

              const sessionId = process.env.AGENT_SESSION_ID?.trim();
              if (!sessionId) {
                return { hasError: true, result: "AGENT_SESSION_ID missing for ask_user" };
              }

              const args = parseAskUserToolArguments(toolCall.function.arguments ?? "");
              if (!args) {
                return { hasError: true, result: "ask_user: invalid arguments" };
              }

              const questionId = await postAskUserQuestion(
                sessionId,
                requestId,
                executionMeta.stageId,
                args,
              );
              const answer = await waitForAskUserAnswer(sessionId, questionId);
              const answerValue = toAskUserAnswerValue(answer.selectedOptionIds[0]);

              pushStorage.context.set("ask_user_last_answer", answerValue);
              runtime.get("stage")!.ask_user_last_answer = answerValue;

              return {
                hasError: false,
                newStorage: pushStorage,
                result: JSON.stringify({
                  selectedLabels: answer.selectedLabels,
                  selectedOptionIds: answer.selectedOptionIds,
                }),
              };
            }

            return {
              hasError: true,
              result: `No such tool: ${toolCall.function.name}`,
            };
          });

          toolCallHandlers.wait();
          await wait();
          toolCallHandlers.dispose();

          Object.assign(runtime.get("context")!, Object.fromEntries(pushStorage.context));
          Object.assign(runtime.get("types")!, Object.fromEntries(pushStorage.types));
        } finally {
          if (stageRequestId) {
            publisher.emitStageFinish({
              contextAfter: toPushStorage(cloneJson(toStageContextPayload(runtime))),
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
