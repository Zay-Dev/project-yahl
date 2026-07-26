import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveNixeryToolOutputHint, runNixeryInlineTool } from '@/orchestrator/-nixery/inline-tool';

import type { TNixeryDef } from '@project-yahl/shared/nixery/types';

const upsertDef = (): TNixeryDef => ({
  id: 'upsert-knowledge-page',
  output: {
    default: 'result.json',
    inlineTool: true,
    validate: 'validation.mjs',
  },
  packages: ['nodejs'],
});

describe('resolveNixeryToolOutputHint', () => {
  it('uses def.output.default when args.output omitted', () => {
    assert.equal(resolveNixeryToolOutputHint(upsertDef(), {}), 'result.json');
  });

  it('prefers args.output over def default', () => {
    assert.equal(
      resolveNixeryToolOutputHint(upsertDef(), { output: 'custom.json' }),
      'custom.json',
    );
  });
});

describe('runNixeryInlineTool', () => {
  it('rejects defs with output.inlineTool: false', async () => {
    await assert.rejects(
      () => runNixeryInlineTool({
        args: {},
        defId: 'get-knowledge',
        sessionId: 'test-session',
      }),
      /not enabled for inline tool calls/,
    );
  });
});
