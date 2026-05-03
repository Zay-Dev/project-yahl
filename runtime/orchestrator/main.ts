import type { CliOptions, ParsedStage, ResumeState } from './orchestrator-types';

import { promises as fs } from "fs";

import { normalizeUsage } from "@/shared/usage";

import * as agentTrackers from "./-utils/agent-trackers";
import { createConsoleTracker } from "./-utils/agent-trackers/console-tracker";
import { createSessionTracker } from "./-utils/agent-trackers/session-tracker";
import { createStepTracker } from "./-utils/agent-trackers/step-tracker";

import { normalizeContainerName } from "./cli-options";
import { composeDown, composeUp, writeSharedOneCliOverride } from "./compose-onecli";
import { execute } from "./execute";
import { workspacePath } from "./paths";
import { getAiLogicStartLineInFile } from "./stage-parse";
import { resolveReportPromptPath } from "./task-resolve";

type CliForkedFrom = CliOptions["forkedFrom"];

const _createStepTracker = async (
  sessionId: string,
  taskYahlPath: string,
  forkedFrom: CliForkedFrom,
) => {
  const tracker = createStepTracker();

  await tracker.registerSession(sessionId, {
    ...(forkedFrom
      ? {
        forkLineage: {
          sourceRequestId: forkedFrom.requestId,
          sourceSessionId: forkedFrom.sourceSessionId,
          stageIndex: forkedFrom.stepIndex,
        },
      }
      : {}),
    taskYahlPath,
  });

  return tracker;
};

export const main = async (cli: CliOptions) => {
  const reportPath = await resolveReportPromptPath(cli);
  const reportSkill = await fs.readFile(reportPath, "utf-8");
  const aiLogicStartLine = getAiLogicStartLineInFile(reportSkill);

  const startTime = process.hrtime.bigint();
  const sessionId = cli.sessionId;
  const composeProjectName = normalizeContainerName(`${cli.composeProjectPrefix}-${sessionId}`);
  const agentContainerName = normalizeContainerName(`${cli.agentContainerPrefix}-${sessionId}`);

  const sessionTracker = createSessionTracker();
  const stepTracker = await _createStepTracker(sessionId, reportPath, cli.forkedFrom);

  agentTrackers.add(sessionTracker);
  agentTrackers.add(createConsoleTracker());
  agentTrackers.add(stepTracker);

  await fs.mkdir(workspacePath, {
    recursive: true,
  });

  const onecliOverrideFilePath = await writeSharedOneCliOverride();

  const requestIdToStageId = new Map<string, string>();

  let finalResult: unknown;
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

    const resumeState: ResumeState = {
      ...(cli.resume ? { executionMeta: cli.resume.executionMeta } : {}),
      pendingStageId: cli.resume?.executionMeta?.stageId || null,
      ...(cli.resume ? { requestSnapshotOverride: cli.resume.requestSnapshotOverride } : {}),
      started: !cli.resume,
    };
    const { runtime, stages } = await execute(
      reportSkill,
      {},
      {},
      reportPath,
      aiLogicStartLine,
      undefined,
      resumeState,
    );

    finalResult = runtime.get("context")?.result;
    parsedStages = stages;

    console.log("result", JSON.stringify(runtime.get("context")?.["result"], null, 2));
  } catch (ex) {
    console.error(ex);
  } finally {
    await agentTrackers.finalResult({
      result: finalResult,
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
