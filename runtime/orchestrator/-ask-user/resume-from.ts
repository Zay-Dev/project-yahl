import type {
  TAskUserResumeFrom,
  TChatToolCall,
  TModelResponse,
} from '@/shared/transports/-types';

import type { TAskUserCheckpoint } from './session-api';
import type { TStageDetailForResume } from './session-api';

export const buildResumeFrom = (
  checkpoint: TAskUserCheckpoint,
  stageDetail: TStageDetailForResume,
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

  const batchAnswers = (checkpoint.batchAnswers ?? []).map((answer) => ({
    answerValue: answer.answerValue,
    ...(answer.freeText ? { freeText: answer.freeText } : {}),
    questionRef: answer.questionRef,
    ...(answer.optionIds?.length ? { selectedOptionIds: answer.optionIds } : {}),
  }));

  return {
    batch: checkpoint.batch,
    batchAnswers,
    modelResponses,
    pendingToolCallId: checkpoint.toolCallId,
    toolCalls,
  };
};
