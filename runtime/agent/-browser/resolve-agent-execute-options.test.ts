import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveAgentExecuteOptions } from './resolve-agent-execute-options';

describe('resolveAgentExecuteOptions', () => {
  it('excludes screenshot by default', () => {
    assert.deepEqual(
      resolveAgentExecuteOptions({
        instruction: 'fill the form',
        maxSteps: 15,
      }),
      {
        excludeTools: ['screenshot'],
        instruction: 'fill the form',
        maxSteps: 15,
      },
    );
  });

  it('keeps screenshot when preferScreenshot is true', () => {
    assert.deepEqual(
      resolveAgentExecuteOptions({
        instruction: 'verify visually',
        maxSteps: 8,
        preferScreenshot: true,
      }),
      {
        instruction: 'verify visually',
        maxSteps: 8,
      },
    );
  });
});
