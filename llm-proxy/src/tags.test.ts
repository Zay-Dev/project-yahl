import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deriveModelResponseTags, mergeTags } from './tags.js';

describe('deriveModelResponseTags', () => {
  it('returns bash for shell tool calls', () => {
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [{ function: { name: 'shell' } }],
      }),
      ['bash'],
    );
  });

  it('returns tool for write_workspace_file and wiki', () => {
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [{ function: { name: 'write_workspace_file' } }],
      }),
      ['tool'],
    );
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [{ function: { name: 'wiki' } }],
      }),
      ['tool'],
    );
  });

  it('returns tool and nixery def tag for nixery calls', () => {
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [{
          function: {
            arguments: JSON.stringify({ args: { topic: 'x' }, defId: 'get-knowledge' }),
            name: 'nixery',
          },
        }],
      }),
      ['tool', 'nixery:get-knowledge'],
    );
  });

  it('drops unknown when a mapped tool is also present', () => {
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [
          { function: { name: 'shell' } },
          { function: { name: 'not_a_real_tool' } },
        ],
      }),
      ['bash'],
    );
  });
});

describe('mergeTags', () => {
  it('drops unknown when a nixery header tag is present', () => {
    assert.deepEqual(
      mergeTags(['nixery:get-knowledge'], ['unknown']),
      ['nixery:get-knowledge'],
    );
  });

  it('keeps bash with a nixery header tag', () => {
    assert.deepEqual(
      mergeTags(['nixery:get-knowledge'], ['bash']),
      ['bash', 'nixery:get-knowledge'],
    );
  });
});
