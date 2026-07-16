import { randomUUID } from 'crypto';

import { markPollSucceeded } from './-health/server.js';
import { sendEmail, sendWhatsApp } from './-channels/outbound.js';
import { runIsolatedBatchCli } from './-cli/run-isolated-batch.js';
import { startCronScheduler, type TCronJobDef } from './-cron/scheduler.js';
import {
  applySettingProposal,
  fetchPendingApproved,
  markWorkDone,
  postTaskRun,
} from './-queue/platform-api.js';

import { config } from './config.js';

const handleCronTick = async (job: TCronJobDef) => {
  await postTaskRun(job.taskPath);
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
  console.log('[worker] starting (outbound-only: cron + platform poll)');

  if (process.env.WORKER_ENABLE_BATCH_POLL === 'true' && !config.apiKey) {
    console.error('[worker] fatal: CURSOR_API_KEY required when WORKER_ENABLE_BATCH_POLL=true');
    process.exit(1);
  }

  startCronScheduler((job) => {
    void handleCronTick(job);
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
