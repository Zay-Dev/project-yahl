const sessionApiBaseUrl = () =>
  (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, '');

const PLATFORM_DEADLINE_MS = 60_000;

export type TPlatformSkillResponse = {
  data?: unknown;
  error?: string;
  ok: boolean;
};

export type TVerifyStageSnapshot = {
  askUser?: Record<string, unknown>[];
  contextKeys?: string[];
  logic?: string;
  produceContextKeys?: string[];
};

const platformFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  if (init?.signal) {
    return fetch(url, init);
  }

  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(PLATFORM_DEADLINE_MS),
  });
};

const parseJson = async (res: Response): Promise<Record<string, unknown>> => {
  try {
    return await res.json() as Record<string, unknown>;
  } catch {
    return {};
  }
};

const unwrapData = (payload: Record<string, unknown>): unknown => {
  if (payload.data !== undefined) {
    return payload.data;
  }

  return payload;
};

const failure = (error: string): TPlatformSkillResponse => ({ error, ok: false });

const runDispatchTaskRun = async (
  args: Record<string, unknown>,
): Promise<TPlatformSkillResponse> => {
  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : '';

  if (!taskId) {
    return failure('dispatch-task-run requires taskId');
  }

  const runInput = args.runInput && typeof args.runInput === 'object' && !Array.isArray(args.runInput)
    ? args.runInput as Record<string, unknown>
    : undefined;

  const body: Record<string, unknown> = { taskId };

  if (runInput && Object.keys(runInput).length > 0) {
    body.runInput = runInput;
  }

  const res = await platformFetch(`${sessionApiBaseUrl()}/api/runs`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = await parseJson(res);

  if (!res.ok) {
    return failure(
      typeof payload.error === 'string'
        ? payload.error
        : `dispatch-task-run failed (${res.status})`,
    );
  }

  const data = unwrapData(payload) as Record<string, unknown>;

  return {
    data: {
      sessionId: data.sessionId,
      taskId: data.taskId ?? taskId,
    },
    ok: true,
  };
};

const runProposeNotification = async (
  args: Record<string, unknown>,
  sessionId?: string,
): Promise<TPlatformSkillResponse> => {
  const body = {
    ...args,
    sessionId: typeof args.sessionId === 'string' ? args.sessionId : sessionId,
  };

  const res = await platformFetch(`${sessionApiBaseUrl()}/api/platform/proposals/notifications`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = await parseJson(res);

  if (!res.ok) {
    return failure(
      typeof payload.error === 'string'
        ? payload.error
        : `propose-notification failed (${res.status})`,
    );
  }

  const data = unwrapData(payload) as Record<string, unknown>;

  return {
    data: { proposalId: data.id ?? data.proposalId },
    ok: true,
  };
};

const runProposeKnowledgeTransfer = async (
  args: Record<string, unknown>,
  sessionId?: string,
): Promise<TPlatformSkillResponse> => {
  const sourceTopic = typeof args.sourceTopic === 'string' ? args.sourceTopic.trim() : '';
  const targetTopic = typeof args.targetTopic === 'string' ? args.targetTopic.trim() : '';

  if (!sourceTopic || !targetTopic) {
    return failure('propose-knowledge-transfer requires sourceTopic and targetTopic');
  }

  if (sourceTopic === targetTopic) {
    return failure('sourceTopic and targetTopic must differ');
  }

  const body = {
    ...args,
    sessionId: typeof args.sessionId === 'string' ? args.sessionId : sessionId,
    sourceTopic,
    targetTopic,
  };

  const res = await platformFetch(`${sessionApiBaseUrl()}/api/platform/proposals/knowledge-transfers`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = await parseJson(res);

  if (!res.ok) {
    return failure(
      typeof payload.error === 'string'
        ? payload.error
        : `propose-knowledge-transfer failed (${res.status})`,
    );
  }

  const data = unwrapData(payload) as Record<string, unknown>;
  const proposalId = data.id ?? data.proposalId;
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL?.trim();

  if (adminEmail && proposalId) {
    await platformFetch(`${sessionApiBaseUrl()}/api/platform/proposals/notifications`, {
      body: JSON.stringify({
        body: [
          'New pending knowledge_transfer approval.',
          `proposalId: ${proposalId}`,
          `source: ${sourceTopic}`,
          `target: ${targetTopic}`,
          `claim: ${typeof args.claim === 'string' ? args.claim : ''}`,
          'Review at /platform/approvals',
        ].join('\n'),
        channel: 'email',
        direction: 'to_user',
        to: adminEmail,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => undefined);
  }

  return {
    data: { proposalId },
    ok: true,
  };
};

export const callPlatformSkill = async (
  name: string,
  args: Record<string, unknown>,
  sessionId?: string,
  requestId?: string,
): Promise<TPlatformSkillResponse> => {
  const startedAt = Date.now();
  const baseUrl = sessionApiBaseUrl();
  const argsPreview = JSON.stringify(args);
  const truncatedArgs = argsPreview.length > 200 ? `${argsPreview.slice(0, 200)}…` : argsPreview;

  console.log(
    `[platform-client] skill=${name} url=${baseUrl} sessionId=${sessionId ?? '-'} `
    + `requestId=${requestId ?? '-'} args=${truncatedArgs}`,
  );

  try {
    let result: TPlatformSkillResponse;

    switch (name) {
      case 'dispatch-task-run':
        result = await runDispatchTaskRun(args);
        break;
      case 'propose-notification':
        result = await runProposeNotification(args, sessionId);
        break;
      case 'propose-knowledge-transfer':
        result = await runProposeKnowledgeTransfer(args, sessionId);
        break;
      default:
        result = failure(`unknown platform skill: ${name}`);
    }

    console.log(
      `[platform-client] ${name} ok=${result.ok} durationMs=${Date.now() - startedAt} `
      + `sessionId=${sessionId ?? '-'} requestId=${requestId ?? '-'}`,
    );

    if (!result.ok && result.error) {
      const errorPreview = result.error.length > 200
        ? `${result.error.slice(0, 200)}…`
        : result.error;

      console.log(
        `[platform-client] ${name} errorBody sessionId=${sessionId ?? '-'} requestId=${requestId ?? '-'} `
        + `error=${errorPreview}`,
      );
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'platform skill failed';

    console.log(
      `[platform-client] ${name} failed durationMs=${Date.now() - startedAt} error=${message} `
      + `sessionId=${sessionId ?? '-'} requestId=${requestId ?? '-'}`,
    );

    return failure(message);
  }
};
