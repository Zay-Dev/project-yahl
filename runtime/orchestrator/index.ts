import type { IPublisher } from '@/shared/transports/-types';

import config from "./config";

import Redis from "ioredis";

import { RedisPublisher } from '@/shared/transports/redis';

import {
  buildAgent,
  composeUp,
  resolvePublishedVncPort,
  shutdownAgent,
  writeAgentSessionOverride,
  writeSharedOneCliOverride,
} from './-docker';
import { program, resolveOrchestratorRun, resolveSessionId, runCommand } from './-cli';

import { loadNixeryDef, parseNixeryRunInputJson, runNixeryDef } from './-nixery';

import { createSessionEventTracker } from './-utils/session-event-tracker';
import { publishSessionResult } from './-utils/session-result';

import { AskUserPausedError } from './-ask-user';

import { prepareTaskWorkspace } from './-runners/prepare-task-workspace';
import { resolvePreparedRun } from './-runners/resolve-prepared-run';
import { runSessionFrom } from './-runners/run-session-from';

import { ProduceKeysFailedError, VerifyFailedError, VerifyUnavailableError } from './-verify';
import {
  acquireOrchestratorRunLock,
  releaseOrchestratorRunLock,
} from './-utils/run-lock';

declare global {
  var sessionId: string;

  var publisher: IPublisher;

  var sessionTracker: ReturnType<typeof createSessionEventTracker>;
}

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

const _setupPublisher = async (tracker: ReturnType<typeof createSessionEventTracker>, sessionId: string) => {
  publisher
    .on('pushRequest', (params) => {
      tracker.createStage(sessionId, params);
    })
    .on('toolCall', (params) => {
      tracker.appendToolCall(sessionId, params);
    })
    .on('modelResponse', (params) => {
      tracker.appendModelResponse(sessionId, params);
    })
    .on('stageFinish', (params) => {
      tracker.patchStage(sessionId, params);
    });

  await publisher.waitForReady();
};

const isStagehandLiveview = () => {
  const value = process.env.STAGEHAND_LIVEVIEW?.trim().toLowerCase();

  return value === "1" || value === "true";
};

const _shutdownAgent = (
  agentName: string,
  sessionId: string,
) => shutdownAgent(agentName, sessionId);

const _composeUp = async (
  agentName: string,
  sessionId: string,
  taskId: string,
  tracker: ReturnType<typeof createSessionEventTracker>,
) => {
  const liveView = isStagehandLiveview();

  const sessionOverrideFilePath = await writeAgentSessionOverride({
    publishVnc: liveView,
    sessionId,
    taskId,
  });
  const onecliOverrideFilePath = await writeSharedOneCliOverride();

  process.env.AGENT_CONTAINER_NAME = agentName;
  process.env.AGENT_SESSION_ID = sessionId;

  await composeUp({
    composeOverrideFilePaths: [
      sessionOverrideFilePath,
      ...(onecliOverrideFilePath ? [onecliOverrideFilePath] : []),
    ],
    composeProjectName: agentName,
  });

  if (liveView) {
    const vncHostPort = await resolvePublishedVncPort(agentName);

    console.log(`[stagehand] live view enabled — VNC → localhost:${vncHostPort}`);
    await tracker.patchLiveViewVncPort(sessionId, vncHostPort);
    await tracker.flush();
  }
};

runCommand.action(async options => {
  const sessionId = resolveSessionId(options.sessionId);
  const nixeryDef = typeof options.nixeryDef === 'string' ? options.nixeryDef.trim() : '';

  if (nixeryDef) {
    acquireOrchestratorRunLock(sessionId);

    try {
      const def = await loadNixeryDef(nixeryDef);
      const input = parseNixeryRunInputJson(
        typeof options.nixeryInput === 'string' && options.nixeryInput.trim()
          ? options.nixeryInput
          : '{}',
        def,
      );

      await runNixeryDef({ defId: nixeryDef, input, sessionId });
    } catch (error) {
      console.error('[orchestrator] nixery run failed:', error);
      process.exit(1);
    } finally {
      releaseOrchestratorRunLock(sessionId);
    }

    return;
  }

  const agentName = `agent-${sessionId}`;
  const tracker = createSessionEventTracker();

  console.log(`sessionId=${sessionId}`);
  console.log(`agentName=${agentName}`);
  console.log(`[yahl-diag] orchestrator start pid=${process.pid} sessionId=${sessionId}`);

  globalThis.sessionId = sessionId;
  globalThis.publisher = new RedisPublisher(redis, sessionId);
  globalThis.sessionTracker = tracker;

  let exitCode = 0;
  let skipFinallyTeardown = false;

  acquireOrchestratorRunLock(sessionId);

  try {
    buildAgent();

    await _shutdownAgent(agentName, sessionId);

    const run = resolveOrchestratorRun(options);

    console.log(`[orchestrator] mode=${run.mode} sessionId=${sessionId}`);

    const { session } = await prepareTaskWorkspace(sessionId);
    await _composeUp(agentName, sessionId, session.taskId, tracker);
    await _setupPublisher(tracker, sessionId);

    const prepared = await resolvePreparedRun(sessionId, run);

    console.log(
      `[orchestrator] runSessionFrom start sessionId=${sessionId} stageIndex=${prepared.cursor.stageIndex} stageCount=${prepared.parsedStages.length}`,
    );

    const { resultContextKey, storage } = await runSessionFrom(sessionId, prepared);

    await publishSessionResult(sessionId, resultContextKey, storage);
  } catch (error) {
    const catchKind = error instanceof AskUserPausedError
      ? 'AskUserPausedError'
      : error instanceof VerifyFailedError
        ? 'VerifyFailedError'
        : error instanceof VerifyUnavailableError
          ? 'VerifyUnavailableError'
          : error instanceof ProduceKeysFailedError
            ? 'ProduceKeysFailedError'
            : error instanceof Error
              ? error.name
              : 'unknown';

    console.log(`[yahl-diag] catch kind=${catchKind} pid=${process.pid} sessionId=${sessionId}`);

    if (error instanceof AskUserPausedError) {
      skipFinallyTeardown = true;
      await tracker.flush();
      exitCode = 0;
    } else if (error instanceof VerifyFailedError) {
      skipFinallyTeardown = true;
      await tracker.flush();
      exitCode = 0;
    } else if (error instanceof VerifyUnavailableError) {
      skipFinallyTeardown = true;
      await tracker.flush();
      exitCode = 0;
    } else if (error instanceof ProduceKeysFailedError) {
      skipFinallyTeardown = true;
      await tracker.flush();
      exitCode = 0;
    } else {
      console.error('[orchestrator] run failed:', error);
      exitCode = 1;
    }
  } finally {
    console.log(`[yahl-diag] finally enter pid=${process.pid} exitCode=${exitCode} sessionId=${sessionId}`);

    if (!skipFinallyTeardown) {
      try {
        await _shutdownAgent(agentName, sessionId);
        console.log(`[yahl-diag] finally shutdownAgent done pid=${process.pid} sessionId=${sessionId}`);
      } catch (shutdownError) {
        console.error('[orchestrator] shutdownAgent failed:', shutdownError);
      }

    } else {
      console.log(
        `[yahl-diag] finally skip shutdownAgent pid=${process.pid} sessionId=${sessionId}`,
      );
    }

    try {
      await publisher.close();
      console.log(`[yahl-diag] finally publisher.close done pid=${process.pid} sessionId=${sessionId}`);
    } catch {
      // ignore publisher close errors during teardown
    }

    releaseOrchestratorRunLock(sessionId);
  }

  console.log(`[yahl-diag] exit pid=${process.pid} code=${exitCode} sessionId=${sessionId}`);
  console.log(`[orchestrator] exit code=${exitCode} sessionId=${sessionId}`);

  process.exit(exitCode);
});

program.parse();
