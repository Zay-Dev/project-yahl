import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

import { startApiServer } from './-api/server.js';
import { exitIfMissingApiKey, markPollSucceeded } from './-health/server.js';
import { assertAgentCliOnBoot } from './-verify/agent-cli.js';
import { sendEmail, sendWhatsApp } from './-channels/outbound.js';
import { runIsolatedBatchCli } from './-cli/run-isolated-batch.js';
import { startCronScheduler } from './-cron/scheduler.js';
import {
  applySettingProposal,
  fetchPendingApproved,
  markWorkDone,
} from './-queue/platform-api.js';

import { config } from './config.js';

const spawnOrchestrate = (sessionId: string, taskId: string) => {
  const runtimeDir = config.runtimeDir;
  const tsxCli = `${runtimeDir}/node_modules/tsx/dist/cli.mjs`;
  const args = [
    tsxCli,
    'orchestrator/index.ts',
    'run',
    '--session-id',
    sessionId,
    '--task-id',
    taskId,
  ];

  const child = spawn(process.execPath, args, {
    cwd: runtimeDir,
    detached: true,
    env: {
      ...process.env,
      MASTERMIND_API_URL: config.mastermindApiUrl,
      REDIS_URL: config.redisUrl,
      SESSION_API_BASE_URL: config.sessionApiBaseUrl,
      WORKER_API_URL: config.workerApiUrl,
    },
    stdio: 'ignore',
  });

  child.unref();
  console.log(`[worker] spawned orchestrate session=${sessionId} taskId=${taskId}`);
};

const processNotification = async (payload: Record<string, unknown>) => {
  const channel = String(payload.channel ?? 'email');
  const to = String(payload.to ?? '');
  const body = String(payload.body ?? '');

  if (!to || !body) {
    return { error: 'missing to/body', ok: false };
  }

  const params = {
    body,
    fromIdentity: typeof payload.fromIdentity === 'string' ? payload.fromIdentity : undefined,
    to,
  };

  if (channel === 'whatsapp') {
    return sendWhatsApp(params);
  }

  return sendEmail(params);
};

const pollApprovedWork = async () => {
  try {
    const items = await fetchPendingApproved();

    for (const item of items) {
      try {
        if (item.kind === 'notification') {
          const result = await processNotification(item.payload);

          if (!result.ok) {
            console.error('[worker] notification failed', item.id, result.error);
            continue;
          }

          await markWorkDone(item.id, 'notification');
          continue;
        }

        if (item.kind === 'setting') {
          await applySettingProposal(item.id);
          await markWorkDone(item.id, 'setting');
        }
      } catch (error) {
        console.error('[worker] item failed', item.id, error);
      }
    }

    markPollSucceeded();
  } catch (error) {
    console.error('[worker] poll failed', error);
  }
};

const main = async () => {
  exitIfMissingApiKey(config.apiKey);

  console.log('[worker] starting');

  await assertAgentCliOnBoot();

  startApiServer();

  startCronScheduler((job) => {
    const sessionId = randomUUID();
    spawnOrchestrate(sessionId, job.taskPath);
  });

  setInterval(() => {
    void pollApprovedWork();
  }, config.pollIntervalMs);

  void pollApprovedWork();

  if (process.env.WORKER_ENABLE_BATCH_POLL === 'true') {
    setInterval(() => {
      void runIsolatedBatchCli('heartbeat batch check', randomUUID());
    }, 86_400_000);
  }
};

void main();
