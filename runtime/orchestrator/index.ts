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
import { program, resolveSessionId, runCommand } from './-cli';

import { parseYahlTask } from './-utils/yahl';
import { createSessionEventTracker } from './-utils/session-event-tracker';
import { publishSessionResult } from './-utils/session-result';
import { ensureSessionWorkspace } from './-utils/workspace-paths';

import { runYahl } from './-agent';
import { AskUserPausedError } from './-ask-user';
import { initForkSessionManager } from './-runners/fork/manager';

import { runForkSession } from './-runners/fork';
import { prepareTaskWorkspace } from './-runners/prepare-task-workspace';
import { runAskUserResume } from './-runners/resume';
import { runVerifyResume } from './-runners/verify-resume';
import { runProduceKeysResume } from './-runners/produce-keys-resume';
import { fetchTaskYahl } from './-tasks/session-api';
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
  tracker: ReturnType<typeof createSessionEventTracker>,
) => {
  await ensureSessionWorkspace(sessionId);

  const liveView = isStagehandLiveview();

  const sessionOverrideFilePath = await writeAgentSessionOverride({
    publishVnc: liveView,
    sessionId,
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
    await _composeUp(agentName, sessionId, tracker);
    await _setupPublisher(tracker, sessionId);

    const runMode = options.taskId
      ? 'task'
      : options.forkrunId
        ? 'fork'
        : options.resumeId
          ? 'ask-user-resume'
          : options.verifyResumeId
            ? 'verify-resume'
            : options.produceKeysResumeId
              ? 'produce-keys-resume'
              : 'unknown';

    console.log(`[orchestrator] mode=${runMode} sessionId=${sessionId}`);

    if (options.taskId) {
      const task = await fetchTaskYahl(options.taskId);
      const { resultContextKey, stages } = parseYahlTask(task.yahl);
      const taskSkills = task.taskSkills;

      await tracker.registerSession(sessionId, {
        parsedStages: stages,
        resultContextKey,
        taskId: task.taskId,
        taskSkills,
        taskYahl: task.yahl,
      });

      const { session, systemAppend } = await prepareTaskWorkspace(sessionId);

      console.log(`[orchestrator] runYahl start sessionId=${sessionId} stageCount=${stages.length}`);

      const { storage } = await runYahl(session.taskYahl, {
        runInput: session.runInput,
        stages,
        systemAppend,
      });

      await publishSessionResult(sessionId, resultContextKey, storage);
    } else if (options.forkrunId) {
      const forkManager = await initForkSessionManager(options.forkrunId);
      globalThis.forkSessionManager = forkManager;

      if (sessionId !== forkManager.targetSessionId) {
        throw new Error(
          `Session id mismatch: CLI ${sessionId} vs fork target ${forkManager.targetSessionId}`,
        );
      }

      await prepareTaskWorkspace(sessionId);

      const { storage } = await runForkSession(options.forkrunId, forkManager);

      await publishSessionResult(sessionId, forkManager.resultContextKey, storage);
    } else if (options.resumeId) {
      const { systemAppend } = await prepareTaskWorkspace(sessionId);

      const { resultContextKey, storage } = await runAskUserResume(
        sessionId,
        options.resumeId,
        { systemAppend },
      );

      await publishSessionResult(sessionId, resultContextKey, storage);
    } else if (options.verifyResumeId) {
      const { systemAppend } = await prepareTaskWorkspace(sessionId);

      const { resultContextKey, storage } = await runVerifyResume(
        sessionId,
        options.verifyResumeId,
        { systemAppend },
      );

      await publishSessionResult(sessionId, resultContextKey, storage);
    } else if (options.produceKeysResumeId) {
      const { systemAppend } = await prepareTaskWorkspace(sessionId);

      const { resultContextKey, storage } = await runProduceKeysResume(
        sessionId,
        options.produceKeysResumeId,
        { systemAppend },
      );

      await publishSessionResult(sessionId, resultContextKey, storage);
    } else {
      throw new Error('No task id, resume id, verify resume id, produce-keys resume id, or forkrun id provided');
    }
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
