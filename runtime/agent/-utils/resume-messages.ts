import type { TAskUserResumeFrom } from '@/shared/transports/-types';
import type { ChatApiMessage } from '@/shared/stage-tools';

export const buildResumeStageMessages = (
  resumeFrom: TAskUserResumeFrom,
): ChatApiMessage[] => {
  const messages: ChatApiMessage[] = [];

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
  }

  const completedToolIds = new Set<string>();

  for (const response of resumeFrom.modelResponses) {
    const toolCalls = response.choices?.[0]?.message?.tool_calls ?? [];

    for (const call of toolCalls) {
      if (!call?.id || call.id === resumeFrom.pendingToolCallId) continue;

      if (completedToolIds.has(call.id)) continue;

      completedToolIds.add(call.id);
      messages.push({
        content: JSON.stringify({ ok: true }),
        role: 'tool',
        tool_call_id: call.id,
      });
    }
  }

  const answerPayload = JSON.stringify({
    ...(resumeFrom.answer.freeText
      ? { freeText: resumeFrom.answer.freeText }
      : {
        selectedLabels: resumeFrom.answer.selectedLabels,
        selectedOptionIds: resumeFrom.answer.selectedOptionIds,
      }),
  });

  messages.push({
    content: answerPayload,
    role: 'tool',
    tool_call_id: resumeFrom.pendingToolCallId,
  });

  return messages;
};
