import type { StageExecutionMeta } from "@/shared/transport";

import type { CliOptions } from './orchestrator-types';

import { promises as fs } from "fs";

import { normalizeUsage } from "@/shared/usage";

import * as agentTrackers from "./-utils/agent-trackers";
import { createConsoleTracker } from "./-utils/agent-trackers/console-tracker";
import { createSessionTracker } from "./-utils/agent-trackers/session-tracker";
import { createStepTracker } from "./-utils/agent-trackers/step-tracker";

import { normalizeContainerName } from "./cli-options";
import { composeDown, composeUp, writeSharedOneCliOverride } from "./compose-onecli";
import { execute } from "./execute";
import type { ResumeState } from "./orchestrator-types";
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

  const tracker = createSessionTracker();
  const stepTracker = await _createStepTracker(sessionId, reportPath, cli.forkedFrom);

  agentTrackers.add(tracker);
  agentTrackers.add(createConsoleTracker());
  agentTrackers.add(stepTracker);

  await fs.mkdir(workspacePath, {
    recursive: true,
  });

  const onecliOverrideFilePath = await writeSharedOneCliOverride();

  let finalResult: unknown;

  try {
    let executionMeta: StageExecutionMeta;

    await composeDown(composeProjectName);

    process.env.AGENT_CONTAINER_NAME = agentContainerName;
    process.env.AGENT_SESSION_ID = sessionId;

    await composeUp({
      composeProjectName,
      ...(onecliOverrideFilePath ? { onecliOverrideFilePath } : {}),
    });

    publisher
      .on('pushRequest', envelope => {
        executionMeta = envelope.meta;
        console.log('pushRequest', JSON.stringify(envelope, null, 2));
      })
      .on('toolCall', envelope => {
        console.log('toolCall', JSON.stringify(envelope, null, 2));
      })
      .on('modelResponse', ({ requestId, response }) => {
        agentTrackers.track({
          requestId,
          sessionId,
          executionMeta,

          durationMs: response.durationMs,
          timestamp: new Date().toISOString(),

          model: response.model,
          chatMessages: response.choices.map(({ message }) => message),
          thinkingMode: response.thinkingMode,
          usage: normalizeUsage(response.usage),
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
      {
        patchRuntimeSnapshot: (requestId, patch) =>
          stepTracker.patchRuntimeSnapshot(sessionId, requestId, patch),
      },
    );

    finalResult = runtime.get("context")?.result;

    console.log("result", JSON.stringify(runtime.get("context")?.["result"], null, 2));
  } catch (ex) {
    console.error(ex);
  } finally {
    void stepTracker.finalizeSession(sessionId, { result: finalResult });
    process.stdout.write(`\n${tracker.summaryText(sessionId)}\n`);

    await composeDown(composeProjectName);
  }

  const endTime = process.hrtime.bigint();
  const duration = Number(endTime - startTime) / 1000000000;

  console.log(`Time taken: ${duration} seconds`);
};
