import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveNixeryToolOutputHint, runNixeryInlineTool } from '@/orchestrator/-nixery/inline-tool';

import type { TNixeryDef } from '@project-yahl/shared/nixery/types';

const upsertDef = (): TNixeryDef => ({
  id: 'upsert-knowledge-page',
  output: {
    default: 'result.json',
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
  it('returns ok:false for unknown def ids', async () => {
    const result = await runNixeryInlineTool({
      args: {},
      defId: 'definitely-not-a-nixery-def',
      sessionId: 'test-session',
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /not found|invalid/i);
  });
});
