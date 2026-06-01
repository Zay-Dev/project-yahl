import type { IPublisher } from '@/shared/transports/-types';

import config from "./config";

import Redis from "ioredis";
import { RedisPublisher } from '@/shared/transports/redis';

import { initForkRunManager } from './forkrun-manager';

import { program, resolveSessionId, runCommand } from './-commander';
import { composeDown, composeUp, writeSharedOneCliOverride } from "./compose-onecli";

import { buildAgent } from './-docker';
import { runTaskPath } from './-runners/path';
import { createSessionEventTracker } from './-utils/session-event-tracker';

declare global {
  var sessionId: string;

  var publisher: IPublisher;
  var forkRunManager: undefined | Awaited<ReturnType<typeof initForkRunManager>>;
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

buildAgent();

runCommand.action(async options => {
  const sessionId = resolveSessionId(options.sessionId);

  console.log(`sessionId=${sessionId}`);

  const agentName = `agent-${sessionId}`;
  const tracker = createSessionEventTracker();

  globalThis.sessionId = sessionId;
  globalThis.publisher = new RedisPublisher(redis, sessionId);

  await tracker.registerSession(sessionId, {
    taskYahlPath: options.taskPath ?? '',
  });

  await composeDown(agentName);
  await _composeUp(agentName);
  await _setupPublisher(tracker, sessionId);

  if (options.taskPath) {
    await runTaskPath(options.taskPath);
  } else if (options.resumeId) {
    console.log('resumeId', options.resumeId);
  } else if (options.forkrunId) {
    console.log('forkrunId', options.forkrunId);
  } else {
    throw new Error('No task path, resume id, or forkrun id provided');
  }

  await composeDown(agentName);
  await publisher.close();
  process.exit(0);
});

program.parse();
