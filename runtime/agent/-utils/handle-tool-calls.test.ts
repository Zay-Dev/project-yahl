import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleToolCalls, SET_CONTEXT_OK_TOOL_RESULT } from './handle-tool-calls';

const toolCall = (
  id: string,
  name: string,
  args: Record<string, unknown> = {},
) => ({
  function: {
    arguments: JSON.stringify(args),
    name,
  },
  id,
  type: 'function' as const,
});

const emptyStorage = () => ({
  context: new Map<string, unknown>(),
  types: new Map<string, unknown>(),
});

describe('handleToolCalls', () => {
  it('emits JSON result for nixery success without newStorage', async () => {
    const payload = JSON.stringify({ data: { paths: ['a.md'] }, ok: true });
    const { toolCallMessages } = await handleToolCalls({
      storage: emptyStorage(),
      toolCall: async () => ({
        hasError: false,
        result: payload,
      }),
      toolCalls: [toolCall('tool-nixery-1', 'nixery', { defId: 'upsert-knowledge-page' })],
    });

    assert.equal(toolCallMessages.length, 1);
    assert.equal(toolCallMessages[0]?.tool_call_id, 'tool-nixery-1');
    assert.equal(toolCallMessages[0]?.content, payload);
  });

  it('emits error content for tool failure without aborting the stage', async () => {
    const { toolCallMessages } = await handleToolCalls({
      storage: emptyStorage(),
      toolCall: async () => ({
        hasError: true,
        result: '{"ok":false,"error":"validation failed"}',
      }),
      toolCalls: [toolCall('tool-nixery-2', 'nixery')],
    });

    assert.match(toolCallMessages[0]?.content ?? '', /tool call error:/);
  });

  it('continues remaining tool calls after hasError', async () => {
    const names: string[] = [];

    const { toolCallMessages } = await handleToolCalls({
      storage: emptyStorage(),
      toolCall: async (call) => {
        names.push(call.function.name);

        if (call.function.name === 'ask_user') {
          return {
            hasError: true,
            result: 'ask_user: question[0] multipleChoice needs at least 2 valid options',
          };
        }

        return {
          hasError: false,
          result: 'OK',
        };
      },
      toolCalls: [
        toolCall('tool-ask-1', 'ask_user'),
        toolCall('tool-set-1', 'set_context'),
      ],
    });

    assert.deepEqual(names, ['ask_user', 'set_context']);
    assert.equal(toolCallMessages.length, 2);
    assert.match(toolCallMessages[0]?.content ?? '', /tool call error:/);
    assert.equal(toolCallMessages[1]?.content, SET_CONTEXT_OK_TOOL_RESULT);
  });

  it('emits applied OK nudge for set_context success with newStorage', async () => {
    const storage = emptyStorage();

    const { toolCallMessages } = await handleToolCalls({
      storage,
      toolCall: async () => ({
        hasError: false,
        newStorage: {
          context: { user_region: { id: 'hko' } },
          types: {},
        },
        result: 'OK',
      }),
      toolCalls: [toolCall('tool-set-1', 'set_context')],
    });

    assert.equal(toolCallMessages[0]?.content, SET_CONTEXT_OK_TOOL_RESULT);
    assert.deepEqual(Object.fromEntries(storage.context.entries()), { user_region: { id: 'hko' } });
  });

  it('emits applied OK nudge for set_context success without newStorage', async () => {
    const { toolCallMessages } = await handleToolCalls({
      storage: emptyStorage(),
      toolCall: async () => ({
        hasError: false,
        result: 'OK',
      }),
      toolCalls: [toolCall('tool-set-2', 'set_context')],
    });

    assert.equal(toolCallMessages[0]?.content, SET_CONTEXT_OK_TOOL_RESULT);
  });

  it('leaves set_context skipped result unchanged', async () => {
    const { toolCallMessages } = await handleToolCalls({
      storage: emptyStorage(),
      toolCall: async () => ({
        hasError: false,
        result: 'skipped',
      }),
      toolCalls: [toolCall('tool-set-3', 'set_context')],
    });

    assert.equal(toolCallMessages[0]?.content, 'skipped');
  });
});
