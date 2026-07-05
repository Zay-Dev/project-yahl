import type { TYahlStage } from './types';

const _stripBucket = (bucket: Record<string, unknown>) => {
  const next = { ...bucket };

  delete next.ask_user_last_answer;

  for (const key of Object.keys(next)) {
    if (key.startsWith('ask_user_') && key.endsWith('_answer')) {
      delete next[key];
    }
  }

  return next;
};

export const resetAskUserStageForRerun = (stage: TYahlStage): TYahlStage => {
  if (!stage.askUser?.length) {
    return stage;
  }

  return {
    ...stage,
    askUser: stage.askUser.map(({ answer: _answer, ...entry }) => entry),
  };
};

export const stripAskUserAnswersFromContext = (
  payload: Record<string, unknown> | undefined,
) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const contextBucket = payload.context;

  if (contextBucket && typeof contextBucket === 'object' && !Array.isArray(contextBucket)) {
    return {
      ...payload,
      context: _stripBucket(contextBucket as Record<string, unknown>),
      ...(payload.stage && typeof payload.stage === 'object' && !Array.isArray(payload.stage)
        ? { stage: _stripBucket(payload.stage as Record<string, unknown>) }
        : {}),
    };
  }

  return _stripBucket(payload);
};
