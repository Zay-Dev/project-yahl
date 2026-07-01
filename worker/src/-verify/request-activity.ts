import type { TRequestActivityRecord } from '@project-yahl/shared/verify/types';

const TERMINAL_RETENTION_MS = 10 * 60 * 1000;

const records = new Map<string, TRequestActivityRecord>();

let verifyQueueDepth = 0;

const activityKey = (sessionId: string, requestId: string, invocationId?: string) => {
  const trimmedInvocationId = invocationId?.trim();

  if (trimmedInvocationId) {
    return `${sessionId}:${requestId}:${trimmedInvocationId}`;
  }

  return `${sessionId}:${requestId}`;
};

const nowIso = () => new Date().toISOString();

const pruneTerminalRecords = () => {
  const cutoff = Date.now() - TERMINAL_RETENTION_MS;

  for (const [key, record] of records.entries()) {
    if (
      (record.status === 'failed' || record.status === 'succeeded')
      && Date.parse(record.updatedAt) < cutoff
    ) {
      records.delete(key);
    }
  }
};

export const registerRequestActivity = (params: {
  invocationId?: string;
  requestId: string;
  sessionId: string;
}) => {
  pruneTerminalRecords();

  const at = nowIso();
  const record: TRequestActivityRecord = {
    kind: 'verify',
    requestId: params.requestId,
    sessionId: params.sessionId,
    ...(params.invocationId ? { invocationId: params.invocationId } : {}),
    startedAt: at,
    status: 'queued',
    updatedAt: at,
  };

  records.set(
    activityKey(params.sessionId, params.requestId, params.invocationId),
    record,
  );
};

export const markRequestActivityRunning = (
  sessionId: string,
  requestId: string,
  invocationId?: string,
) => {
  const record = records.get(activityKey(sessionId, requestId, invocationId));

  if (!record || record.status === 'failed' || record.status === 'succeeded') {
    return;
  }

  record.status = 'running';
  record.updatedAt = nowIso();
};

const RESULT_DATA_MAX_BYTES = 64 * 1024;

export const markRequestActivitySucceeded = (
  sessionId: string,
  requestId: string,
  invocationId?: string,
  resultData?: string,
) => {
  const record = records.get(activityKey(sessionId, requestId, invocationId));

  if (!record) {
    return;
  }

  record.status = 'succeeded';
  record.updatedAt = nowIso();

  if (resultData) {
    record.resultData = resultData.slice(0, RESULT_DATA_MAX_BYTES);
  }
};

export const setRequestActivityFailed = (params: {
  error: string;
  invocationId?: string;
  requestId: string;
  sessionId: string;
  unavailable?: boolean;
}) => {
  pruneTerminalRecords();

  const at = nowIso();

  records.set(activityKey(params.sessionId, params.requestId, params.invocationId), {
    error: params.error,
    kind: 'verify',
    requestId: params.requestId,
    sessionId: params.sessionId,
    ...(params.invocationId ? { invocationId: params.invocationId } : {}),
    startedAt: at,
    status: 'failed',
    updatedAt: at,
    ...(params.unavailable ? { unavailable: true } : {}),
  });
};

export const getRequestActivity = (
  sessionId: string,
  requestId: string,
  invocationId?: string,
): TRequestActivityRecord | null => {
  pruneTerminalRecords();

  const trimmedInvocationId = invocationId?.trim();

  if (trimmedInvocationId) {
    return records.get(activityKey(sessionId, requestId, trimmedInvocationId)) ?? null;
  }

  return getLatestRequestActivity(sessionId, requestId);
};

export const getLatestRequestActivity = (
  sessionId: string,
  requestId: string,
): TRequestActivityRecord | null => {
  pruneTerminalRecords();

  const prefix = `${sessionId}:${requestId}`;
  let latest: TRequestActivityRecord | null = null;

  for (const [key, record] of records.entries()) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    if (
      !latest
      || Date.parse(record.updatedAt) >= Date.parse(latest.updatedAt)
    ) {
      latest = record;
    }
  }

  return latest;
};

export const buildRequestStatusPayload = (params: {
  request: TRequestActivityRecord | null;
  ready: boolean;
}) => {
  const failed = params.request?.status === 'failed';

  return {
    agent: params.ready ? 'ready' : 'unconfigured',
    ok: !failed,
    queueDepth: verifyQueueDepth,
    ...(params.request ? { request: params.request } : { request: null }),
    ...(failed && params.request?.error ? { error: params.request.error } : {}),
    ...(failed && params.request?.unavailable ? { unavailable: true } : {}),
  };
};

export const setVerifyQueueDepth = (depth: number) => {
  verifyQueueDepth = depth;
};

export const resetRequestActivityForTests = () => {
  records.clear();
  verifyQueueDepth = 0;
};
