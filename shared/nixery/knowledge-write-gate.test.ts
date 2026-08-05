import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertNamespaceWriteAllowed,
  isKnowledgeWriteDef,
} from './knowledge-write-gate.ts';

describe('knowledge-write-gate', () => {
  it('flags write defs', () => {
    assert.equal(isKnowledgeWriteDef('upsert-knowledge-page'), true);
    assert.equal(isKnowledgeWriteDef('run-knowledge-manager'), true);
    assert.equal(isKnowledgeWriteDef('apply-manager-topic'), true);
    assert.equal(isKnowledgeWriteDef('apply-approved-transfers'), true);
    assert.equal(isKnowledgeWriteDef('submit-knowledge-observation'), false);
    assert.equal(isKnowledgeWriteDef('list-pending-observations'), false);
  });

  it('allows knowledge_manager upsert', () => {
    assert.doesNotThrow(() => assertNamespaceWriteAllowed({
      defId: 'upsert-knowledge-page',
      taskId: 'knowledge_manager',
    }));
  });

  it('allows knowledge_manager run-knowledge-manager', () => {
    assert.doesNotThrow(() => assertNamespaceWriteAllowed({
      defId: 'run-knowledge-manager',
      taskId: 'knowledge_manager',
    }));
  });

  it('allows knowledge_manager apply-manager-topic', () => {
    assert.doesNotThrow(() => assertNamespaceWriteAllowed({
      defId: 'apply-manager-topic',
      taskId: 'knowledge_manager',
    }));
  });

  it('forbids traffic_monitor upsert', () => {
    assert.throws(
      () => assertNamespaceWriteAllowed({
        defId: 'upsert-knowledge-page',
        taskId: 'traffic_monitor',
      }),
      /knowledge_write_forbidden/,
    );
  });

  it('forbids traffic_monitor run-knowledge-manager', () => {
    assert.throws(
      () => assertNamespaceWriteAllowed({
        defId: 'run-knowledge-manager',
        taskId: 'traffic_monitor',
      }),
      /knowledge_write_forbidden/,
    );
  });

  it('forbids traffic_monitor apply-manager-topic', () => {
    assert.throws(
      () => assertNamespaceWriteAllowed({
        defId: 'apply-manager-topic',
        taskId: 'traffic_monitor',
      }),
      /knowledge_write_forbidden/,
    );
  });
});
