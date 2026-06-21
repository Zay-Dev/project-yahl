import type {
  TRequestCreateForkSessionBody,
  TResponseAskUserQuestionListItem,
  TResponseCreateForkSession,
  TResponseDeleteSession,
  TResponseStageDetail,
  TResponseStageListItem,
  TResponseVerifyCheckpoint,
} from "@project-yahl/server/modules/sessions/-api-types";

import { API_BASE_URL } from "@/providers/constants";

const base = API_BASE_URL.replace(/\/$/, "");

const parseJson = async <T,>(response: Response): Promise<T> => {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
};

export const fetchSessionStages = async (sessionId: string) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}/stages`;
  const response = await fetch(url);

  return parseJson<TResponseStageListItem[]>(response);
};

export const fetchSessionStageDetail = async (sessionId: string, requestId: string) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/stages/${encodeURIComponent(requestId)}`;
  const response = await fetch(url);

  return parseJson<TResponseStageDetail>(response);
};

export const createForkSession = async (
  sessionId: string,
  body: TRequestCreateForkSessionBody,
) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}/fork-sessions`;
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  return parseJson<TResponseCreateForkSession>(response);
};

export const fetchPendingAskUserQuestions = async (sessionId: string) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}` +
    '/ask-user/questions?status=pending';
  const response = await fetch(url);

  return parseJson<TResponseAskUserQuestionListItem[]>(response);
};

export const submitAskUserAnswer = async (
  sessionId: string,
  questionId: string,
  body: { freeText?: string; optionIds?: string[] },
) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/ask-user/questions/${encodeURIComponent(questionId)}/answer`;
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  return parseJson<{ ok: true; questionId: string }>(response);
};

export const deleteSession = async (
  sessionId: string,
  mode: 'hard' | 'soft',
) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}?mode=${mode}`;
  const response = await fetch(url, { method: 'DELETE' });

  return parseJson<TResponseDeleteSession>(response);
};

export const fetchVerifyCheckpoint = async (sessionId: string, verifyId: string) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/verify-checkpoints/${encodeURIComponent(verifyId)}`;
  const response = await fetch(url);

  const json = await parseJson<{ data?: TResponseVerifyCheckpoint } & TResponseVerifyCheckpoint>(response);

  return json.data ?? json;
};

export const fetchPendingVerifyCheckpoints = async (sessionId: string) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}` +
    '/verify-checkpoints?status=pending';
  const response = await fetch(url);

  const json = await parseJson<{ data?: TResponseVerifyCheckpoint[] } | TResponseVerifyCheckpoint[]>(
    response,
  );

  return Array.isArray(json) ? json : (json.data ?? []);
};

export const resumeVerifyCheckpoint = async (sessionId: string, verifyId: string) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/verify-checkpoints/${encodeURIComponent(verifyId)}/resume`;
  const response = await fetch(url, { method: 'POST' });

  return parseJson<{ ok: true; verifyId: string }>(response);
};

export const submitVerifyEditAnswer = async (
  sessionId: string,
  verifyId: string,
  body: { freeText?: string; optionIds?: string[] },
) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/verify-checkpoints/${encodeURIComponent(verifyId)}/edit-answer`;
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  return parseJson<{ ok: true; verifyId: string }>(response);
};
