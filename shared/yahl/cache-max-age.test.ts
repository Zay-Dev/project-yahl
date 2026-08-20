import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateCacheMaxAgeField } from './cache-max-age';
import { validateYahlStage } from './validate-stage';

describe('cacheMaxAge', () => {
  it('accepts positive integer minutes on AI stages', () => {
    const stage = validateYahlStage({
      cacheMaxAge: 1440,
      logic: 'const x = 1;',
    });

    assert.equal(stage.cacheMaxAge, 1440);
  });

  it('rejects zero and non-integers', () => {
    assert.throws(
      () => validateCacheMaxAgeField(0, 'stage'),
      /positive integer/,
    );
    assert.throws(
      () => validateCacheMaxAgeField(1.5, 'stage'),
      /positive integer/,
    );
  });

  it('rejects cacheMaxAge on contextMode', () => {
    assert.throws(
      () => validateYahlStage({
        cacheMaxAge: 60,
        contextMode: true,
        logic: '(() => ({ a: 1 }))',
        produceContextKeys: ['a'],
      }),
      /cacheMaxAge/,
    );
  });
});
