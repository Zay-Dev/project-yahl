import { randomUUID } from 'node:crypto';

import type { TVerifyStageSnapshot } from '@project-yahl/shared/verify/types';
import type { TRequestStatusResponse } from '@project-yahl/shared/request-activity/types';

import {
  ActivityRequestFailedError,
  DEFAULT_ACTIVITY_DEADLINE_MS,
  fetchRequestStatus,
  formatActivityFetchError,
  postWithActivityRecovery,
} from '@project-yahl/shared/request-activity/client';

const workerBaseUrl = () =>
  (process.env.WORKER_API_URL?.trim() || 'http://worker:4200').replace(/\/+$/, '');

const activityOptions = () => ({
  deadlineMs: DEFAULT_ACTIVITY_DEADLINE_MS,
  errorPrefix: 'worker' as const,
  onPollError: (error: unknown) => {
    const message = error instanceof Error ? error.message : 'request-status poll failed';

    console.log(`[worker-client] request-status poll error=${message}`);
  },
});

export type TWorkerVerifyResponse = {
  askUserRef?: string;
  feedback: string;
  pass: boolean;
  resumeAction?: 'edit_answer' | 'reask' | 'rerun' | 'follow_up';
  score: number;
  unavailable?: boolean;
};

export type TWorkerRequestStatusResponse = TRequestStatusResponse;

const resolveActivityWatch = (sessionId?: string, requestId?: string) => {
  const trimmedSessionId = sessionId?.trim();
  const trimmedRequestId = requestId?.trim();

  if (!trimmedSessionId || !trimmedRequestId) {
    return null;
  }

  return {
    invocationId: randomUUID(),
    requestId: trimmedRequestId,
    sessionId: trimmedSessionId,
  };
};

export const fetchWorkerRequestStatus = async (params: {
  invocationId?: string;
  requestId: string;
  sessionId: string;
}): Promise<TWorkerRequestStatusResponse> =>
  fetchRequestStatus(workerBaseUrl(), params);

export const callWorkerVerify = async (body: {
  contextSnapshot: Record<string, unknown>;
  minScore?: number;
  requestId: string;
  rubric?: string;
  sessionId: string;
  stageIndex: number;
  stageSnapshot?: TVerifyStageSnapshot;
  stageVersion?: number;
  verifyResume?: boolean;
}): Promise<TWorkerVerifyResponse> => {
  const baseUrl = workerBaseUrl();
  const url = `${baseUrl}/v1/verify`;
  const startedAt = Date.now();
  const watch = resolveActivityWatch(body.sessionId, body.requestId);
  const options = activityOptions();

  console.log(
    `[worker-client] POST verify sessionId=${body.sessionId} requestId=${body.requestId} stageIndex=${body.stageIndex} invocationId=${watch?.invocationId ?? '-'}`,
  );

  try {
    const { lastStatus, recovered, response: res } = await postWithActivityRecovery(
      baseUrl,
      url,
      {
        ...body,
        ...(watch ? { invocationId: watch.invocationId } : {}),
      },
      watch,
      options,
    );

    if (recovered && lastStatus?.resultData) {
      const durationMs = Date.now() - startedAt;
      const result = JSON.parse(lastStatus.resultData) as TWorkerVerifyResponse;

      console.log(
        `[worker-client] verify recovered pass=${result.pass} score=${result.score} durationMs=${durationMs}`,
      );

      return result;
    }

    if (!res.ok) {
      const durationMs = Date.now() - startedAt;

      console.log(
        `[worker-client] verify http=${res.status} pass=false durationMs=${durationMs}`,
      );
      throw new Error(`worker verify failed: ${res.status}`);
    }

    const result = await res.json() as TWorkerVerifyResponse;
    const durationMs = Date.now() - startedAt;

    console.log(
      `[worker-client] verify http=${res.status} pass=${result.pass} score=${result.score} recovered=${recovered} durationMs=${durationMs}`,
    );

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('worker verify failed:')) {
      throw error;
    }

    const durationMs = Date.now() - startedAt;
    const message = error instanceof ActivityRequestFailedError
      ? error.message
      : formatActivityFetchError(error, null, 'worker');
    const unavailable = error instanceof ActivityRequestFailedError
      ? error.unavailable
      : true;

    console.log(`[worker-client] verify failed durationMs=${durationMs} error=${message}`);

    return {
      feedback: message,
      pass: false,
      score: 0,
      unavailable,
    };
  }
};

export { ActivityRequestFailedError as WorkerRequestFailedError };
