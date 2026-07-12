import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleToolCalls } from './handle-tool-calls';

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
      error: async () => {},
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

  it('emits error content for nixery failure', async () => {
    let reported: Error | undefined;

    const { toolCallMessages } = await handleToolCalls({
      error: async (error) => {
        reported = error;
      },
      storage: emptyStorage(),
      toolCall: async () => ({
        hasError: true,
        result: '{"ok":false,"error":"validation failed"}',
      }),
      toolCalls: [toolCall('tool-nixery-2', 'nixery')],
    });

    assert.ok(reported);
    assert.match(toolCallMessages[0]?.content ?? '', /tool call error:/);
  });

  it('emits OK for set_context success with newStorage', async () => {
    const storage = emptyStorage();

    const { toolCallMessages } = await handleToolCalls({
      error: async () => {},
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

    assert.equal(toolCallMessages[0]?.content, 'tool call result: OK');
    assert.deepEqual(Object.fromEntries(storage.context.entries()), { user_region: { id: 'hko' } });
  });
});
