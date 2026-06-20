import type { IPublisher } from '@/shared/transports/-types';

import config from "./config";

import fs from 'fs/promises';
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

import { deriveTaskNameFromYahl, parseYahlTask } from './-utils/yahl';
import { createSessionEventTracker } from './-utils/session-event-tracker';
import { publishSessionResult } from './-utils/session-result';
import { ensureSessionWorkspace } from './-utils/workspace-paths';

import { runYahl } from './-agent';
import { AskUserPausedError } from './-ask-user';
import { initForkSessionManager } from './-runners/fork/manager';

import { runForkSession } from './-runners/fork';
import { runAskUserResume } from './-runners/resume';
import { runVerifyResume } from './-runners/verify-resume';
import { runProduceKeysResume } from './-runners/produce-keys-resume';
import { resolveTaskPath } from './-runners/path';
import { ProduceKeysFailedError, VerifyFailedError } from './-verify';

declare global {
  var sessionId: string;

  var publisher: IPublisher;

  var sessionTracker: ReturnType<typeof createSessionEventTracker>;
}

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
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

  globalThis.sessionId = sessionId;
  globalThis.publisher = new RedisPublisher(redis, sessionId);
  globalThis.sessionTracker = tracker;

  try {
    buildAgent();

    await _shutdownAgent(agentName, sessionId);
    await _composeUp(agentName, sessionId, tracker);
    await _setupPublisher(tracker, sessionId);

    if (options.taskPath) {
      const taskYahlPath = await resolveTaskPath(options.taskPath);
      const yahl = await fs.readFile(taskYahlPath, 'utf-8');
      const { stages, resultContextKey } = parseYahlTask(yahl);
      const taskId = options.taskId ?? deriveTaskNameFromYahl(yahl, taskYahlPath);

      await tracker.registerSession(sessionId, {
        parsedStages: stages,
        resultContextKey,
        taskId,
        taskYahlPath,
      });

      const { storage } = await runYahl(yahl, { stages });

      await publishSessionResult(sessionId, resultContextKey, storage);
    } else if (options.forkrunId) {
      const forkManager = await initForkSessionManager(options.forkrunId);
      globalThis.forkSessionManager = forkManager;
  
      if (sessionId !== forkManager.targetSessionId) {
        throw new Error(
          `Session id mismatch: CLI ${sessionId} vs fork target ${forkManager.targetSessionId}`,
        );
      }

      const { storage } = await runForkSession(options.forkrunId, forkManager);

      await publishSessionResult(sessionId, forkManager.resultContextKey, storage);
    } else if (options.resumeId) {
      const { resultContextKey, storage } = await runAskUserResume(sessionId, options.resumeId);

      await publishSessionResult(sessionId, resultContextKey, storage);
    } else if (options.verifyResumeId) {
      const { resultContextKey, storage } = await runVerifyResume(sessionId, options.verifyResumeId);

      await publishSessionResult(sessionId, resultContextKey, storage);
    } else if (options.produceKeysResumeId) {
      const { resultContextKey, storage } = await runProduceKeysResume(sessionId, options.produceKeysResumeId);

      await publishSessionResult(sessionId, resultContextKey, storage);
    } else {
      throw new Error('No task path, resume id, verify resume id, produce-keys resume id, or forkrun id provided');
    }
  } catch (error) {
    if (error instanceof AskUserPausedError) {
      await tracker.flush();
      process.exit(0);
      return;
    }

    if (error instanceof VerifyFailedError) {
      await tracker.flush();
      process.exit(0);
      return;
    }

    if (error instanceof ProduceKeysFailedError) {
      await tracker.flush();
      process.exit(0);
      return;
    }

    console.error('[orchestrator] run failed:', error);
    process.exitCode = 1;
    throw error;
  }

  await _shutdownAgent(agentName, sessionId);
  await publisher.close();
  process.exit(0);
});

program.parse();
