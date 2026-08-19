import type { ChatApiMessage } from '@/shared/stage-tools';
import type { TModelResponse } from '@/shared/transports/-types';
import type { TStageDetailForResume } from '@/orchestrator/-ask-user/session-api';

import {
  fetchSessionStages,
  fetchStageDetail,
} from '@/orchestrator/-ask-user/session-api';
import { truncateToolResult } from '@/shared/tool-result-truncate';
import { isStubToolResultContent, STUB_TOOL_RESULT_JSON } from '@/shared/tool-result-stub';

const STUB_TOOL_RESULT = STUB_TOOL_RESULT_JSON;

const resultByToolCallId = (
  detail: Pick<TStageDetailForResume, 'toolCalls'>,
) => {
  const byId = new Map<string, string>();

  for (const batch of detail.toolCalls ?? []) {
    for (const tool of batch.tools ?? []) {
      if (
        typeof tool.result === 'string'
        && tool.result.length
        && !isStubToolResultContent(tool.result)
      ) {
        byId.set(tool.id, truncateToolResult(tool.result));
      }
    }
  }

  return byId;
};

export const buildWarmupPrefixMessages = (
  detail: Pick<TStageDetailForResume, 'modelResponses' | 'toolCalls'>,
): ChatApiMessage[] => {
  const messages: ChatApiMessage[] = [];
  const completedToolIds = new Set<string>();
  const results = resultByToolCallId(detail);

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
        content: results.get(call.id) ?? STUB_TOOL_RESULT,
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
