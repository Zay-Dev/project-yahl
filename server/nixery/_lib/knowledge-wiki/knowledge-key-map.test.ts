import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapKnowledgeKeyToPage } from './knowledge-key-map.js';

describe('mapKnowledgeKeyToPage', () => {
  it('maps unknown keys including source-ops-* to replace by default', () => {
    const mapping = mapKnowledgeKeyToPage('source-ops-sample');

    assert.equal(mapping.mode, 'replace');
    assert.equal(mapping.page, 'source-ops-sample');
    assert.equal(mapping.narrative, true);
    assert.equal(mapping.raw, false);
    assert.equal(mapping.section, undefined);
  });

  it('maps other unknown keys to replace by default', () => {
    const mapping = mapKnowledgeKeyToPage('sources-sample');

    assert.equal(mapping.mode, 'replace');
    assert.equal(mapping.page, 'sources-sample');
  });

  it('keeps summary as brief replace', () => {
    const mapping = mapKnowledgeKeyToPage('summary');

    assert.equal(mapping.mode, 'replace');
    assert.equal(mapping.page, 'brief');
  });

  it('keeps analysis_md dual-write to overview Analysis', () => {
    const mapping = mapKnowledgeKeyToPage('analysis_md');

    assert.equal(mapping.mode, 'replace');
    assert.equal(mapping.page, 'overview');
    assert.equal(mapping.section, 'Analysis');
    assert.equal(mapping.raw, true);
  });
});
