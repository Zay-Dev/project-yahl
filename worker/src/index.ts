import type { TCronJobDef } from './-cron/scheduler.js';

import { sendEmail, sendWhatsApp } from './-channels/outbound.js';
import { initWhatsApp, isWhatsAppReady } from './-channels/whatsapp/client.js';
import { whatsappConfig } from './-channels/whatsapp/config.js';
import { startCronScheduler } from './-cron/scheduler.js';
import { configureWhatsAppHealth, markPollSucceeded, startHealthServer } from './-health/server.js';
import {
  applySettingProposal,
  fetchPendingApproved,
  markWorkDone,
  postTaskRun,
} from './-queue/platform-api.js';

import { config } from './config.js';

let pollInFlight = false;

const handleCronTick = async (job: TCronJobDef) => {
  await postTaskRun(job.taskPath, job.runInput);
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
    if (whatsappConfig.enabled && !isWhatsAppReady()) {
      console.log(
        '[worker][whatsapp] skip approved notification: not logged in',
        { to },
      );
      return { error: 'whatsapp not logged in', ok: false, skipped: true };
    }

    return sendWhatsApp(params);
  }

  return sendEmail(params);
};

const pollApprovedWork = async () => {
  if (pollInFlight) {
    return;
  }

  pollInFlight = true;

  try {
    const items = await fetchPendingApproved();

    for (const item of items) {
      try {
        if (item.kind === 'notification') {
          const result = await processNotification(item.payload);

          if (!result.ok) {
            if ('skipped' in result && result.skipped) {
              continue;
            }

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
  } finally {
    pollInFlight = false;
  }
};

const main = async () => {
  const mode = whatsappConfig.enabled
    ? 'cron + platform poll + whatsapp'
    : 'cron + platform poll';

  console.log(`[worker] starting (${mode})`);

  configureWhatsAppHealth(() => ({
    enabled: whatsappConfig.enabled,
    ready: isWhatsAppReady(),
  }));
  startHealthServer();

  await initWhatsApp();

  startCronScheduler((job) => {
    void handleCronTick(job);
  });

  setInterval(() => {
    void pollApprovedWork();
  }, config.pollIntervalMs);

  void pollApprovedWork();
};

void main();
