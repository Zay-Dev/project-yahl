import type { TParsedStageSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';
import type { YahlStage } from '@/shared/yahl-stage';

const sessionApiBaseUrl = () =>
  (process.env.SESSION_API_BASE_URL?.trim() || 'http://127.0.0.1:4000')
    .replace(/\/+$/, '');

const unwrapSessionApiPayload = <T>(json: { data?: T } & Partial<T>): T => {
  if (json.data !== undefined) {
    return json.data;
  }

  return json as T;
};

export type TUserPauseCheckpoint = {
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot?: TParsedStageSnapshot;
  pauseId: string;
  repairInstruction?: string;
  requestId: string;
  stage: YahlStage;
  stageIndex?: number;
  status: 'pending' | 'resumed';
  storageSnapshot: Record<string, unknown>;
};

export const postUserPauseCheckpoint = async (
  sessionId: string,
  body: {
    contextSnapshot: Record<string, unknown>;
    loopMeta?: Record<string, unknown>;
    parsedStageSnapshot: TParsedStageSnapshot;
    repairInstruction?: string;
    requestId: string;
    stage: YahlStage;
    stageIndex?: number;
    storageSnapshot: Record<string, unknown>;
  },
) => {
  const response = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/user-pause-checkpoints`,
    {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `user_pause checkpoint create failed (${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  const json = await response.json() as { pauseId?: string; data?: { pauseId?: string } };

  return json.pauseId ?? json.data?.pauseId ?? '';
};

export const fetchUserPauseCheckpoint = async (sessionId: string, pauseId: string) => {
  const response = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/user-pause-checkpoints/${encodeURIComponent(pauseId)}`,
  );

  if (!response.ok) {
    throw new Error(`user_pause checkpoint not found: ${pauseId}`);
  }

  const json = await response.json() as { data?: TUserPauseCheckpoint } & Partial<TUserPauseCheckpoint>;

  return unwrapSessionApiPayload(json);
};

export { fetchSession } from '@/orchestrator/-ask-user/session-api';
