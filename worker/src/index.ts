import type { TCronJobDef } from './-cron/scheduler.js';

import {
  getSystemAdminEmail,
  isSmtpConfigured,
  sendEmail,
  sendWhatsApp,
} from './-channels/outbound.js';
import {
  initWhatsApp,
  isWhatsAppBrowserDeathError,
  isWhatsAppReady,
  isWhatsAppRecoverableInitError,
  scheduleWhatsAppReinit,
  setWhatsAppReadyListener,
} from './-channels/whatsapp/client.js';
import { whatsappConfig } from './-channels/whatsapp/config.js';
import { startCronScheduler, stopCronJob } from './-cron/scheduler.js';
import { configureWhatsAppHealth, markPollSucceeded, startHealthServer } from './-health/server.js';
import {
  applySettingProposal,
  deleteCronJob,
  fetchPendingApproved,
  markWorkDone,
  postTaskRun,
} from './-queue/platform-api.js';

import { config } from './config.js';

let pollInFlight = false;

const whatsappDownAlertedIds = new Set<string>();

const swallowWhatsAppWorkerError = (error: unknown, label: string): boolean => {
  if (isWhatsAppBrowserDeathError(error)) {
    console.warn(`[worker] swallowed WhatsApp browser-death ${label}`, error);
    scheduleWhatsAppReinit('unhandled_browser_death');
    return true;
  }

  if (isWhatsAppRecoverableInitError(error)) {
    console.warn(`[worker] swallowed WhatsApp recoverable init ${label}`, error);
    scheduleWhatsAppReinit('expose_function_conflict');
    return true;
  }

  return false;
};

const installProcessSafetyNet = (): void => {
  process.on('unhandledRejection', (reason) => {
    if (swallowWhatsAppWorkerError(reason, 'rejection')) {
      return;
    }

    console.error('[worker] unhandledRejection', reason);
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    if (swallowWhatsAppWorkerError(error, 'exception')) {
      return;
    }

    console.error('[worker] uncaughtException', error);
    process.exit(1);
  });
};

const handleCronTick = async (job: TCronJobDef) => {
  if (job.deleteAfterRun) {
    stopCronJob(job.id);
    await deleteCronJob(job.id);
  }

  await postTaskRun(job.taskPath, job.runInput);
};

const alertWhatsAppDown = async (params: {
  body: string;
  proposalId: string;
  to: string;
}): Promise<void> => {
  if (!isSmtpConfigured()) {
    return;
  }

  const adminEmail = getSystemAdminEmail();

  if (!adminEmail) {
    return;
  }

  if (whatsappDownAlertedIds.has(params.proposalId)) {
    return;
  }

  const snippet = params.body.slice(0, 500);
  const result = await sendEmail({
    body: [
      'WhatsApp is disconnected or logged out.',
      `Undelivered notification for: ${params.to}`,
      `Proposal id: ${params.proposalId}`,
      '',
      'Original body:',
      snippet,
    ].join('\n'),
    subject: `WhatsApp unavailable — undelivered to ${params.to}`,
    to: adminEmail,
  });

  if (result.ok) {
    whatsappDownAlertedIds.add(params.proposalId);
    console.log(
      '[worker][whatsapp] admin alerted for undelivered notification',
      params.proposalId,
    );
  } else {
    console.error(
      '[worker][whatsapp] admin alert failed',
      params.proposalId,
      result.error,
    );
  }
};

const processNotification = async (
  proposalId: string,
  payload: Record<string, unknown>,
) => {
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
      await alertWhatsAppDown({ body, proposalId, to });
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
          const result = await processNotification(item.id, item.payload);

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
  installProcessSafetyNet();

  const mode = whatsappConfig.enabled
    ? 'cron + platform poll + whatsapp'
    : 'cron + platform poll';

  console.log(`[worker] starting (${mode})`);

  configureWhatsAppHealth(() => ({
    enabled: whatsappConfig.enabled,
    ready: isWhatsAppReady(),
  }));
  startHealthServer();

  setWhatsAppReadyListener(() => {
    whatsappDownAlertedIds.clear();
  });

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
