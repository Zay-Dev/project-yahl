import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveForkSuffixFromSetupIndex } from './resume';

describe('resolveForkSuffixFromSetupIndex', () => {
  it('continues fork suffix from the setup after the anchor', () => {
    assert.equal(resolveForkSuffixFromSetupIndex(0), 1);
    assert.equal(resolveForkSuffixFromSetupIndex(2), 3);
  });

  it('defaults missing forkSetupIndex to anchor setup 0', () => {
    assert.equal(resolveForkSuffixFromSetupIndex(undefined), 1);
  });
});
