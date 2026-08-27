import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateYahlStage } from './validate-stage';
import { resolveMainThreadFlag } from './logic';

describe('mainThread', () => {
  it('defaults nested stages to isolated (mainThread false)', () => {
    const stage = validateYahlStage({
      id: 'fetch',
      logic: 'x = 1;',
    }, 0, { nested: true });

    assert.equal(stage.mainThread, undefined);
    assert.equal(resolveMainThreadFlag(stage), false);
  });

  it('honors mainThread true on nested stages', () => {
    const stage = validateYahlStage({
      id: 'step',
      logic: 'x = 1;',
      mainThread: true,
    }, 0, { nested: true });

    assert.equal(stage.mainThread, true);
    assert.equal(resolveMainThreadFlag(stage), true);
  });

  it('rejects mainThread on fragment/$ref shells', () => {
    assert.throws(
      () => validateYahlStage({
        logic: { stages: [{ logic: 'a = 1;' }] },
        mainThread: true,
      }),
      /mainThread/,
    );
  });

  it('rejects removed subAgent field', () => {
    assert.throws(
      () => validateYahlStage({
        logic: 'a = 1;',
        subAgent: true,
      }),
      /subAgent/,
    );
  });

  it('defaults string shell without mainThread', () => {
    const stage = validateYahlStage({ logic: 'a = 1;' });

    assert.equal(stage.mainThread, undefined);
  });
});
