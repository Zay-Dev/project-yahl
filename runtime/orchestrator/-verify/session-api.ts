import type { YahlStage } from '@/shared/yahl-stage';

import type { TParsedStageSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';

const sessionApiBaseUrl = () =>
  (process.env.SESSION_API_BASE_URL?.trim() || 'http://127.0.0.1:4000')
    .replace(/\/+$/, '');

export type TVerifyCheckpoint = {
  askUserQuestion?: Record<string, unknown>;
  askUserRef?: string;
  editedAnswerFreeText?: string;
  editedAnswerOptionIds?: string[];
  feedback: string;
  kind?: 'produce_keys' | 'verify';
  parsedStageSnapshot?: TParsedStageSnapshot;
  requestId: string;
  resumeAction?: 'edit_answer' | 'follow_up' | 'reask' | 'rerun';
  score: number;
  stage: YahlStage;
  stageIndex?: number;
  status: 'pending' | 'resumed' | 'superseded';
  storageSnapshot: Record<string, unknown>;
  unavailable?: boolean;
  verifyId: string;
};

export const postVerifyCheckpoint = async (
  sessionId: string,
  body: Record<string, unknown>,
): Promise<{ verifyId: string }> => {
  const res = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/verify-checkpoints`,
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`verify checkpoint failed: ${res.status} ${text}`);
  }

  const json = await res.json() as { data: { verifyId: string } };

  return json.data;
};

export const postVerifyPass = async (
  sessionId: string,
  requestId: string,
  body: { feedback: string; score: number },
): Promise<void> => {
  const res = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/stages/${encodeURIComponent(requestId)}/verify-pass`,
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`verify pass failed: ${res.status} ${text}`);
  }
};

export const postVerifyStart = async (
  sessionId: string,
  requestId: string,
): Promise<void> => {
  const res = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/stages/${encodeURIComponent(requestId)}/verify-start`,
    {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`verify start failed: ${res.status} ${text}`);
  }
};

export const fetchVerifyCheckpoint = async (
  sessionId: string,
  verifyId: string,
): Promise<TVerifyCheckpoint> => {
  const res = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/verify-checkpoints/${encodeURIComponent(verifyId)}`,
  );

  if (!res.ok) {
    throw new Error(`verify checkpoint not found: ${verifyId}`);
  }

  const json = await res.json() as { data: TVerifyCheckpoint };

  return json.data;
};
