import type { IPublisher } from '@/shared/transports/-types';

import config from "./config";

import fs from 'fs/promises';
import Redis from "ioredis";

import { RedisPublisher } from '@/shared/transports/redis';

import { buildAgent, composeDown, composeUp, writeSharedOneCliOverride } from './-docker';
import { program, resolveSessionId, runCommand } from './-cli';

import { deriveTaskNameFromYahl, parseYahlTask } from './-utils/yahl';
import { createSessionEventTracker } from './-utils/session-event-tracker';
import { publishSessionResult } from './-utils/session-result';

import { runYahl } from './-agent';
import { AskUserPausedError } from './-ask-user';
import { initForkSessionManager } from './-runners/fork/manager';

import { runForkSession } from './-runners/fork';
import { runAskUserResume } from './-runners/resume';
import { resolveTaskPath } from './-runners/path';

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
  
  const agentName = `agent-${sessionId}`;
  const tracker = createSessionEventTracker();

  console.log(`sessionId=${sessionId}`);
  console.log(`agentName=${agentName}`);

  globalThis.sessionId = sessionId;
  globalThis.publisher = new RedisPublisher(redis, sessionId);
  globalThis.sessionTracker = tracker;

  try {
    buildAgent();

    await composeDown(agentName);
    await _composeUp(agentName);
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
    } else {
      throw new Error('No task path, resume id, or forkrun id provided');
    }
  } catch (error) {
    if (error instanceof AskUserPausedError) {
      await tracker.flush();
      process.exit(0);
      return;
    }

    console.error('[orchestrator] run failed:', error);
    process.exitCode = 1;
    throw error;
  }

  await composeDown(agentName);
  await publisher.close();
  process.exit(0);
});

program.parse();
