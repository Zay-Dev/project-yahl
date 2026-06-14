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

  const answer = checkpoint.freeText?.trim()
    ? {
      freeText: checkpoint.freeText.trim(),
      selectedLabels: [] as string[],
      selectedOptionIds: [] as string[],
    }
    : {
      selectedLabels: checkpoint.answerLabels ?? [],
      selectedOptionIds: checkpoint.answerIds ?? [],
    };

  return {
    answer,
    modelResponses,
    pendingToolCallId: checkpoint.toolCallId,
    question: checkpoint.question,
    questionRef: checkpoint.questionRef,
    toolCalls,
  };
};
