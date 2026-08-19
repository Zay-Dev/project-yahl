import type { ChatApiMessage } from '@/shared/stage-tools';
import type { TModelResponse } from '@/shared/transports/-types';

import {
  fetchSessionStages,
  fetchStageDetail,
  type TStageDetailForResume,
} from '@/orchestrator/-ask-user/session-api';

export const buildWarmupPrefixMessages = (
  detail: Pick<TStageDetailForResume, 'modelResponses'>,
): ChatApiMessage[] => {
  const messages: ChatApiMessage[] = [];
  const completedToolIds = new Set<string>();

  for (const item of detail.modelResponses) {
    const response = item.response as unknown as TModelResponse;
    const choice = response.choices?.[0]?.message;

    if (!choice) {
      continue;
    }

    messages.push({
      content: choice.content ?? null,
      reasoning_content: (choice as { reasoning_content?: string | null }).reasoning_content ?? null,
      response,
      role: 'assistant',
      tool_calls: choice.tool_calls as ChatApiMessage extends { tool_calls?: infer T } ? T : never,
    });

    for (const call of choice.tool_calls ?? []) {
      if (!call?.id || completedToolIds.has(call.id)) {
        continue;
      }

      completedToolIds.add(call.id);
      messages.push({
        content: JSON.stringify({ ok: true }),
        role: 'tool',
        tool_call_id: call.id,
      });
    }
  }

  return messages;
};

export const loadWarmupPrefixMessages = async (requestId?: string) => {
  const sessionId = globalThis.sessionId;

  if (!requestId || !sessionId) {
    return undefined;
  }

  try {
    await globalThis.sessionTracker?.flush?.();
    const detail = await fetchStageDetail(sessionId, requestId);
    const messages = buildWarmupPrefixMessages(detail);

    return messages.length ? messages : undefined;
  } catch {
    return undefined;
  }
};

export const loadWarmupPrefixForParsedStage = async (parsedStageIndex?: number) => {
  const sessionId = globalThis.sessionId;

  if (!sessionId || parsedStageIndex == null) {
    return undefined;
  }

  try {
    await globalThis.sessionTracker?.flush?.();
    const stages = await fetchSessionStages(sessionId);
    const warmup = [...stages].reverse().find((stage) =>
      stage.parsedStageIndex === parsedStageIndex && stage.loopKind === 'warmup');

    return loadWarmupPrefixMessages(warmup?.requestId);
  } catch {
    return undefined;
  }
};
