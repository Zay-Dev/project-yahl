import type { IPublisher } from '@/shared/transports/-types';

import config from "./config";

import Redis from "ioredis";
import { RedisPublisher } from '@/shared/transports/redis';

import { program, resolveSessionId, runCommand } from './-commander';
import { composeDown, composeUp, writeSharedOneCliOverride } from "./compose-onecli";

import { buildAgent } from './-docker';
import { createSessionEventTracker } from './-utils/session-event-tracker';

import { initForkSessionManager } from './fork-session-manager';

import { runTaskPath } from './-runners/path';
import { runForkSession } from './-runners/fork';
import { deriveTaskIdFromYahlPath } from './derive-task-id';

declare global {
  var sessionId: string;

  var publisher: IPublisher;
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

const _composeUp = async (agentName: string) => {
  const onecliOverrideFilePath = await writeSharedOneCliOverride();

  process.env.AGENT_CONTAINER_NAME = agentName;
  process.env.AGENT_SESSION_ID = sessionId;

  await composeUp({
    composeProjectName: agentName,
    ...(onecliOverrideFilePath ? { onecliOverrideFilePath } : {}),
  });
};

runCommand.action(async options => {
  const sessionId = resolveSessionId(options.sessionId);

  console.log(`sessionId=${sessionId}`);

  const agentName = `agent-${sessionId}`;
  const tracker = createSessionEventTracker();

  globalThis.sessionId = sessionId;
  globalThis.publisher = new RedisPublisher(redis, sessionId);

  const forkManager = options.forkrunId
    ? await initForkSessionManager(options.forkrunId)
    : undefined;

  if (forkManager) {
    globalThis.forkSessionManager = forkManager;

    if (sessionId !== forkManager.targetSessionId) {
      throw new Error(
        `Session id mismatch: CLI ${sessionId} vs fork target ${forkManager.targetSessionId}`,
      );
    }
  }

  try {
    buildAgent();

    const taskYahlPath = options.taskPath ?? forkManager?.taskYahlPath ?? '';
    const taskId = options.taskId ?? deriveTaskIdFromYahlPath(taskYahlPath);

    await tracker.registerSession(sessionId, {
      taskId,
      taskYahlPath,
    });

    await composeDown(agentName);
    await _composeUp(agentName);
    await _setupPublisher(tracker, sessionId);

    if (options.taskPath) {
      await runTaskPath(options.taskPath);
    } else if (options.resumeId) {
      console.log('resumeId', options.resumeId);
    } else if (options.forkrunId) {
      await runForkSession(options.forkrunId, forkManager);
    } else {
      throw new Error('No task path, resume id, or forkrun id provided');
    }
  } catch (error) {
    console.error('[orchestrator] run failed:', error);
    process.exitCode = 1;
    throw error;
  }

  await composeDown(agentName);
  await publisher.close();
  process.exit(0);
});

program.parse();
