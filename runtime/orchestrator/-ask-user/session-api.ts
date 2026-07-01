import type { AskUserBatchAnswerInput, AskUserBatchToolArguments } from '@/shared/ask-user-batch';
import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import type { TParsedStageSnapshot } from './parsed-stage-snapshot';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

const sessionApiBaseUrl = (process.env.SESSION_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

export type TAskUserBatchAnswerRecord = {
  answerValue: number | string | string[];
  freeText?: string;
  optionIds?: string[];
  questionRef: string;
};

export type TAskUserCheckpoint = {
  batch: AskUserBatchToolArguments;
  batchAnswers?: TAskUserBatchAnswerRecord[];
  batchId: string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot?: TParsedStageSnapshot;
  questionId: string;
  requestId: string;
  stage: Record<string, unknown>;
  stageIndex?: number;
  status: 'answered' | 'pending';
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
};

export type TStageDetailForResume = {
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  finishedAt?: string;
  loopMeta?: Record<string, unknown>;
  modelResponses: {
    durationMs?: number;
    response: Record<string, unknown>;
    thinkingMode?: boolean;
  }[];
  stage: Record<string, unknown>;
  toolCalls: { tools: { arguments: unknown; id: string; name: string }[] }[];
};

export type TSessionFetch = {
  forkedFrom?: {
    anchorStageId: string;
    forkSessionId: string;
    sourceSessionId: string;
  };
  parsedStages: ParsedStage[];
  resultContextKey?: string;
  runInput: Record<string, unknown>;
  sessionId: string;
  taskId: string;
  taskSkills: TTaskSkillFile[];
  taskYahl: string;
};

export const postAskUserBatch = async (
  sessionId: string,
  body: {
    batch: AskUserBatchToolArguments;
    batchId: string;
    contextSnapshot: Record<string, unknown>;
    forkSetupIndex?: number;
    loopMeta?: Record<string, unknown>;
    parsedStageSnapshot: TParsedStageSnapshot;
    requestId: string;
    stage: Record<string, unknown>;
    stageIndex?: number;
    storageSnapshot: Record<string, unknown>;
    toolCallId: string;
  },
) => {
  const response = await fetch(
    `${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}/ask-user/batches`,
    {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `ask_user batch create failed (${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  const json = await response.json() as { questionId: string };

  return json.questionId;
};

export const fetchAskUserCheckpoint = async (
  sessionId: string,
  questionId: string,
) => {
  const response = await fetch(
    `${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/ask-user/questions/${encodeURIComponent(questionId)}`,
  );

  if (!response.ok) {
    throw new Error(`ask_user checkpoint fetch failed (${response.status})`);
  }

  return response.json() as Promise<TAskUserCheckpoint>;
};

export const fetchStageDetail = async (sessionId: string, requestId: string) => {
  const response = await fetch(
    `${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/stages/${encodeURIComponent(requestId)}`,
  );

  if (!response.ok) {
    throw new Error(`stage detail fetch failed (${response.status})`);
  }

  return response.json() as Promise<TStageDetailForResume>;
};

export const fetchSession = async (sessionId: string) => {
  const response = await fetch(
    `${sessionApiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}`,
  );

  if (!response.ok) {
    throw new Error(`session fetch failed (${response.status})`);
  }

  return response.json() as Promise<TSessionFetch>;
};

export type { AskUserBatchAnswerInput };
