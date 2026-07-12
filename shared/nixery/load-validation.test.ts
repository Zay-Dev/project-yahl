import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { loadDefValidationModule } from './load-validation';

const nixeryRoot = path.join(import.meta.dirname, '..', '..', 'server', 'nixery');

describe('loadDefValidationModule', () => {
  it('loads get-knowledge validation.mjs', async () => {
    const mod = await loadDefValidationModule(nixeryRoot, 'get-knowledge');

    assert.equal(typeof mod.validateOutput, 'function');
    assert.equal(mod.parseOutput, undefined);
  });

  it('loads dedup-knowledge parseOutput for inline tool', async () => {
    const mod = await loadDefValidationModule(nixeryRoot, 'dedup-knowledge');

    assert.equal(typeof mod.validateOutput, 'function');
    assert.equal(typeof mod.parseOutput, 'function');
  });
});
