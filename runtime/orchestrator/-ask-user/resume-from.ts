import type {
  TAskUserResumeFrom,
  TChatToolCall,
  TModelResponse,
} from '@/shared/transports/-types';
import type { AskUserBatchToolArguments } from '@/shared/ask-user-batch';

import type { TAskUserCheckpoint } from './session-api';
import type { TStageDetailForResume } from './session-api';

const EMPTY_ASK_USER_BATCH: AskUserBatchToolArguments = {
  batchId: '',
  questions: [],
  title: '',
  version: 'askUserBatch.v1',
};

export const buildMidTurnResumeFrom = (
  stageDetail: TStageDetailForResume,
  options?: {
    batch?: AskUserBatchToolArguments;
    batchAnswers?: TAskUserResumeFrom['batchAnswers'];
    pendingToolCallId?: string;
  },
): TAskUserResumeFrom => {
  const modelResponses = stageDetail.modelResponses.map((item) => ({
    ...(item.response as unknown as TModelResponse),
    durationMs: item.durationMs ?? 0,
    thinkingMode: item.thinkingMode ?? false,
  }));

  const toolCalls: TChatToolCall[] = [];

  for (const doc of stageDetail.toolCalls) {
    for (const tool of doc.tools) {
      toolCalls.push({
        function: {
          arguments: typeof tool.arguments === 'string'
            ? tool.arguments
            : JSON.stringify(tool.arguments ?? {}),
          name: tool.name,
        },
        id: tool.id,
        type: 'function',
      });
    }
  }

  const pendingToolCallId = options?.pendingToolCallId
    ?? (options?.batchAnswers?.length ? (toolCalls.at(-1)?.id ?? '') : '');

  return {
    batch: options?.batch ?? EMPTY_ASK_USER_BATCH,
    batchAnswers: options?.batchAnswers ?? [],
    modelResponses,
    pendingToolCallId,
    toolCalls,
  };
};

export const buildResumeFrom = (
  checkpoint: TAskUserCheckpoint,
  stageDetail: TStageDetailForResume,
): TAskUserResumeFrom => {
  const batchAnswers = (checkpoint.batchAnswers ?? []).map((answer) => ({
    answerValue: answer.answerValue,
    ...(answer.freeText ? { freeText: answer.freeText } : {}),
    questionRef: answer.questionRef,
    ...(answer.optionIds?.length ? { selectedOptionIds: answer.optionIds } : {}),
  }));

  return buildMidTurnResumeFrom(stageDetail, {
    batch: checkpoint.batch,
    batchAnswers,
    pendingToolCallId: checkpoint.toolCallId,
  });
};
