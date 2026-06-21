import type { TAskUserResumeFrom } from '@/shared/transports/-types';
import type { ChatApiMessage } from '@/shared/stage-tools';

export const buildResumeStageMessages = (
  resumeFrom: TAskUserResumeFrom,
): ChatApiMessage[] => {
  const messages: ChatApiMessage[] = [];
  const completedToolIds = new Set<string>();

  const answerPayload = JSON.stringify({
    batchId: resumeFrom.batch.batchId,
    answers: resumeFrom.batchAnswers.map((answer) => ({
      ...(answer.freeText ? { freeText: answer.freeText } : {}),
      ...(answer.selectedOptionIds?.length
        ? { optionIds: answer.selectedOptionIds }
        : {}),
      questionRef: answer.questionRef,
    })),
    ok: true,
  });

  for (const response of resumeFrom.modelResponses) {
    const choice = response.choices?.[0]?.message;

    if (!choice) continue;

    messages.push({
      content: choice.content ?? null,
      reasoning_content: (choice as { reasoning_content?: string | null }).reasoning_content ?? null,
      response,
      role: 'assistant',
      tool_calls: choice.tool_calls as ChatApiMessage extends { tool_calls?: infer T } ? T : never,
    });

    for (const call of choice.tool_calls ?? []) {
      if (!call?.id || completedToolIds.has(call.id)) continue;

      completedToolIds.add(call.id);

      const content = call.id === resumeFrom.pendingToolCallId
        ? answerPayload
        : JSON.stringify({ ok: true });

      messages.push({
        content,
        role: 'tool',
        tool_call_id: call.id,
      });
    }
  }

  return messages;
};
