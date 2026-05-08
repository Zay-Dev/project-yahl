import path from "path";

import type { CliOptions, CliResume, ParsedStage } from './orchestrator-types';

import { promises as fs } from "fs";

import type { StageContextPayload } from "@/shared/stage-contract";
import { normalizeUsage } from "@/shared/usage";

import * as agentTrackers from "./-utils/agent-trackers";
import { createConsoleTracker } from "./-utils/agent-trackers/console-tracker";
import { createSessionTracker } from "./-utils/agent-trackers/session-tracker";
import { createStepTracker } from "./-utils/agent-trackers/step-tracker";

import { normalizeContainerName } from "./cli-options";
import { composeDown, composeUp, writeSharedOneCliOverride } from "./compose-onecli";
import { buildAskUserContinuationWithContext, executeAsRoot, toAskUserAnswerValue } from "./execute";
import { workspacePath } from "./paths";
import { getAiLogicStartLineInFile, parseStages } from "./stage-parse";
import { resolveReportPromptPath } from "./task-resolve";
import { extractAiLogic } from "./runtime";

type AskUserResumePayloadV1 = {
  currentStageText: string;
  questionId: string;
  requestId: string;
  runtimeSnapshot: {
    context: Record<string, unknown>;
    stage: Record<string, unknown>;
    types: Record<string, unknown>;
  };
  sourceRef: {
    filePath: string;
    line: number;
  };
  stageId: string;
  version: string;
};

const _createStepTracker = async (
  sessionId: string,
  taskYahlPath: string,
  resume?: CliResume,
) => {
  const tracker = createStepTracker();

  await tracker.registerSession(sessionId, {
    ...(resume
      ? {
        forkLineage: {
          sourceRequestId: resume.sourceRequestId,
          sourceSessionId: resume.sourceSessionId,
          stageIndex: resume.stepIndex,
        },
      }
      : {}),
    taskYahlPath,
  });

  return tracker;
};

export const main = async (cli: CliOptions) => {
  const startTime = process.hrtime.bigint();
  const sessionId = cli.sessionId;
  const sessionApiBaseUrl = (process.env.SESSION_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

  if (forkRunManager && cli.resumeAskUserRecoveryPath) {
    throw new Error("--resume-ask-user-recovery cannot be combined with fork resume mode");
  }

  let resumePayload: AskUserResumePayloadV1 | null = null;
  let resumeHydrate: StageContextPayload | undefined;
  let resumeSyntheticFence: string | undefined;

  if (cli.resumeAskUserRecoveryPath) {
    const raw = await fs.readFile(path.resolve(cli.resumeAskUserRecoveryPath), "utf-8");
    const parsed = JSON.parse(raw) as AskUserResumePayloadV1;
    if (parsed.version !== "askUserResume.v1") {
      throw new Error("invalid ask-user resume file version");
    }

    const questionRes = await fetch(
      `${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}/ask-user/questions/${encodeURIComponent(parsed.questionId)}`,
    );
    if (!questionRes.ok) {
      throw new Error(`resume: failed to load question (${questionRes.status})`);
    }

    const qjson = await questionRes.json() as { answerIds: string[]; status: string };
    if (qjson.status !== "answered") {
      throw new Error("resume: question is not answered yet");
    }

    const answerValue = toAskUserAnswerValue(qjson.answerIds[0]);
    const continuation = buildAskUserContinuationWithContext(parsed.currentStageText);
    if (!continuation) {
      throw new Error("resume: missing inline /ask-user(...) in saved stage text");
    }
    const resumeSourceText = await fs.readFile(parsed.sourceRef.filePath, "utf-8");
    const resumeAiLogic = extractAiLogic(resumeSourceText);
    const resumeStages = parseStages(resumeAiLogic).filter((stage) => stage.lines !== "}");
    const resumeAiStartLine = getAiLogicStartLineInFile(resumeSourceText);
    const timedOutStageIndex = resumeStages.findIndex((stage) => {
      const absoluteStartLine = resumeAiStartLine + stage.sourceStartLine - 1;
      return absoluteStartLine === parsed.sourceRef.line;
    });

    if (timedOutStageIndex < 0) {
      throw new Error("resume: cannot locate timed-out stage in source file");
    }

    const resumedAiLogic = [
      continuation.stageText,
      ...resumeStages.slice(timedOutStageIndex + 1).map((stage) => stage.lines),
    ].join("\n\n");

    resumeSyntheticFence = `\`\`\`ai.logic\n${resumedAiLogic}\n\`\`\``;
    resumePayload = parsed;
    resumeHydrate = {
      context: parsed.runtimeSnapshot.context ?? {},
      stage: {
        ...(parsed.runtimeSnapshot.stage ?? {}),
        ask_user_last_answer: answerValue,
      },
      types: parsed.runtimeSnapshot.types ?? {},
    };
  }

  const reportPath = resumePayload
    ? resumePayload.sourceRef.filePath
    : forkRunManager?.reportPath || await resolveReportPromptPath(cli);

  const sourceText = resumeSyntheticFence
    ?? forkRunManager?.aiLogic
    ?? await fs.readFile(reportPath, "utf-8");

  const aiLogicStartLine = getAiLogicStartLineInFile(sourceText);

  const composeProjectName = normalizeContainerName(`${cli.composeProjectPrefix}-${sessionId}`);
  const agentContainerName = normalizeContainerName(`${cli.agentContainerPrefix}-${sessionId}`);

  const sessionTracker = createSessionTracker();
  const stepTracker = await _createStepTracker(sessionId, reportPath, cli.resume);

  agentTrackers.add(sessionTracker);
  agentTrackers.add(createConsoleTracker());
  agentTrackers.add(stepTracker);
  agentTrackers.add({
    sessionA2ui: (event) => {
      lastSessionA2ui = event.envelopes;
    },
  });

  await fs.mkdir(workspacePath, {
    recursive: true,
  });

  const onecliOverrideFilePath = await writeSharedOneCliOverride();

  const requestIdToStageId = new Map<string, string>();

  let finalResult: unknown;
  let lastSessionA2ui: unknown | undefined;
  let parsedStages: ParsedStage[] = [];

  try {
    await composeDown(composeProjectName);

    process.env.AGENT_CONTAINER_NAME = agentContainerName;
    process.env.AGENT_SESSION_ID = sessionId;

    await composeUp({
      composeProjectName,
      ...(onecliOverrideFilePath ? { onecliOverrideFilePath } : {}),
    });

    publisher
      .on('pushRequest', async ({ requestId, context, currentStage, meta }) => {
        requestIdToStageId.set(requestId, meta.stageId);
        await agentTrackers.pushRequest({
          contextBefore: context,
          currentStage,
          executionMeta: meta,
          requestId,
          sessionId,
          timestamp: new Date().toISOString(),
        });
      })
      .on('toolCall', async ({ requestId, toolCalls }) => {
        const stageId = requestIdToStageId.get(requestId);
        if (!stageId) return;

        await agentTrackers.toolCall({
          requestId,
          sessionId,
          stageId,
          timestamp: new Date().toISOString(),
          toolCalls,
        });
      })
      .on('modelResponse', async ({ requestId, response }) => {
        const stageId = requestIdToStageId.get(requestId);
        if (!stageId) return;

        await agentTrackers.modelResponse({
          durationMs: response.durationMs,
          model: response.model,
          requestId,
          response,
          sessionId,
          stageId,
          thinkingMode: response.thinkingMode,
          timestamp: new Date().toISOString(),
          usage: normalizeUsage(response.usage),
        });
      })
      .on('stageFinish', async ({ requestId, contextAfter }) => {
        const stageId = requestIdToStageId.get(requestId);
        if (!stageId) return;

        await agentTrackers.stageFinish({
          contextAfter,
          requestId,
          sessionId,
          stageId,
          timestamp: new Date().toISOString(),
        });
      });

    await publisher.waitForReady();
    
    const { runtime, stages } = await executeAsRoot(
      sourceText,
      {},
      {},
      reportPath,
      aiLogicStartLine,
      undefined,
      resumeHydrate,
    );

    if (resumePayload) {
      const del = await fetch(
        `${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}/ask-user/recovery`,
        { method: "DELETE" },
      );
      if (!del.ok) {
        process.stderr.write(`[resume ask-user] clear recovery failed (${del.status})\n`);
      }
    }

    finalResult = runtime.get("context")?.result;
    parsedStages = stages;

    console.log("result", JSON.stringify(runtime.get("context")?.["result"], null, 2));
  } catch (ex) {
    console.error(ex);
  } finally {
    await agentTrackers.finalResult({
      result: finalResult,
      resultA2ui: lastSessionA2ui,
      sessionId,
      stages: parsedStages,
    });
    process.stdout.write(`\n${sessionTracker.summaryText(sessionId)}\n`);

    await composeDown(composeProjectName);
  }

  const endTime = process.hrtime.bigint();
  const duration = Number(endTime - startTime) / 1000000000;

  console.log(`Time taken: ${duration} seconds`);
};
