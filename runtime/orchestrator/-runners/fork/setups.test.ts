import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resetAskUserStageForRerun } from '@/orchestrator/-ask-user';
import { compileStage } from '@/orchestrator/-utils/yahl';

import { hasMoreLoopIterations } from '../pipeline-continuation';

describe('fork-setups edited stage path', () => {
  it('compiles heavily edited fork stage without parsedStages fingerprint', () => {
    const edited = {
      askUser: [{ id: '1', options: [{ id: '1', label: 'a' }, { id: '2', label: 'b' }], question: 'pick' }],
      logic: 'value = completely_new_body();',
    };

    const parsed = compileStage(resetAskUserStageForRerun(edited), 1);

    assert.match(parsed.lines, /completely_new_body/);
    assert.equal(parsed.spec.logic, edited.logic);
  });
});

describe('fork loop setup continuation gate', () => {
  it('detects remaining loop iterations after anchor setup index 2', () => {
    const loopMeta = {
      arraySnapshot: new Array(6).fill({ url: 'https://example.com' }),
      index: 2,
      indexName: 'src',
      value: { url: 'https://example.com' },
    };

    assert.equal(hasMoreLoopIterations(loopMeta), true);
    assert.equal(hasMoreLoopIterations({
      ...loopMeta,
      index: 5,
    }), false);
  });
});
