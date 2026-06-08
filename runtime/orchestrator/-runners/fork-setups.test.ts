import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resetAskUserStageForRerun } from '@/orchestrator/-ask-user';
import { compileStage } from '@/orchestrator/yahl-parse';

describe('fork-setups edited stage path', () => {
  it('compiles heavily edited fork stage without parsedStages fingerprint', () => {
    const edited = {
      askUser: [{ id: 1, options: [{ id: '1', label: 'a' }, { id: '2', label: 'b' }], question: 'pick' }],
      logic: 'value = completely_new_body();',
    };

    const parsed = compileStage(resetAskUserStageForRerun(edited), 1);

    assert.match(parsed.lines, /completely_new_body/);
    assert.equal(parsed.spec.logic, edited.logic);
  });
});
