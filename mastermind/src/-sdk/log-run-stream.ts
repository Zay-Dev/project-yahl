import type { Run, SDKMessage } from '@cursor/sdk';

import { config } from '../config.js';

type TStreamMeta = {
  agent_id: string;
  role?: string;
  run_id: string;
  type: string;
};

type TSdkStreamLogState = {
  lastMetaKey: string;
};

const streamMetaKey = (meta: TStreamMeta, callId?: string) =>
  `${meta.type}|${meta.agent_id}|${meta.run_id}|${meta.role ?? ''}|${callId ?? ''}`;

const extractStreamMeta = (event: SDKMessage): TStreamMeta | null => {
  if (event.type === 'assistant' || event.type === 'user') {
    return {
      agent_id: event.agent_id,
      role: event.message.role,
      run_id: event.run_id,
      type: event.type,
    };
  }

  if (
    event.type === 'tool_call'
    || event.type === 'thinking'
    || event.type === 'status'
    || event.type === 'system'
    || event.type === 'request'
    || event.type === 'task'
  ) {
    return {
      agent_id: event.agent_id,
      run_id: event.run_id,
      type: event.type,
    };
  }

  return null;
};

const extractStreamBody = (event: SDKMessage): unknown => {
  switch (event.type) {
    case 'assistant':
    case 'user':
      return event.message.content;

    case 'tool_call':
      return {
        args: event.args,
        call_id: event.call_id,
        name: event.name,
        result: event.result,
        status: event.status,
        truncated: event.truncated,
      };

    case 'thinking':
      return {
        text: event.text,
        thinking_duration_ms: event.thinking_duration_ms,
      };

    case 'status':
      return {
        message: event.message,
        status: event.status,
      };

    case 'system':
      return {
        model: event.model,
        subtype: event.subtype,
        tools: event.tools,
      };

    case 'request':
      return { request_id: event.request_id };

    case 'task':
      return {
        status: event.status,
        text: event.text,
      };

    default:
      return event;
  }
};

export const createSdkStreamLogState = (): TSdkStreamLogState => ({
  lastMetaKey: '',
});

export const logSdkStreamEvent = (
  event: SDKMessage,
  state: TSdkStreamLogState,
): void => {
  const meta = extractStreamMeta(event);

  if (!meta) {
    console.log('[mastermind][sdk-stream]', JSON.stringify(event, null, 2));

    return;
  }

  const metaKey = streamMetaKey(
    meta,
    event.type === 'tool_call' ? event.call_id : undefined,
  );

  if (metaKey !== state.lastMetaKey) {
    console.log('[mastermind][sdk-stream] meta', JSON.stringify(meta));
    state.lastMetaKey = metaKey;
  }

  const body = extractStreamBody(event);

  console.log('[mastermind][sdk-stream] body');
  console.log(JSON.stringify(body, null, 2));
};

export const logRunStreamIfEnabled = async (run: Run): Promise<void> => {
  if (!config.sdkStreamLog) {
    return;
  }

  if (!run.supports('stream')) {
    return;
  }

  const state = createSdkStreamLogState();

  for await (const event of run.stream()) {
    logSdkStreamEvent(event, state);
  }
};
