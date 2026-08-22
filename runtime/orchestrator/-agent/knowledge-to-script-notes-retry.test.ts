import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KNOWLEDGE_TO_SCRIPT_NOTES_KEY } from '@project-yahl/shared/yahl/knowledge-to-script';

import { createStorage } from '@/orchestrator/-tools/set_context';
import {
  filterStageBucket,
  shouldApplySetContext,
} from '@/orchestrator/-context/stage-field-policy';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import {
  buildKnowledgeToScriptNotesSystemAppend,
  isKnowledgeToScriptNotesMissing,
  isKnowledgeToScriptNotesRetryAppend,
  resetKnowledgeToScriptNotes,
} from './knowledge-to-script-notes-retry';

const plainStage = (overrides: Partial<ParsedStage> = {}): ParsedStage => ({
  lines: '{\n  x = a + b;\n}',
  sourceStartLine: 1,
  spec: { logic: 'x = a + b;' },
  type: 'plain',
  ...overrides,
});

describe('knowledge-to-script notes gate helpers', () => {
  it('allows set_context for notes even with produceContextKeys filter', () => {
    assert.equal(
      shouldApplySetContext(
        KNOWLEDGE_TO_SCRIPT_NOTES_KEY,
        plainStage({ produceContextKeys: ['a', 'b'] }),
      ),
      true,
    );
  });

  it('keeps notes visible in filtered stage bucket', () => {
    const filtered = filterStageBucket(
      'x = a;',
      { a: 1, [KNOWLEDGE_TO_SCRIPT_NOTES_KEY]: null },
      plainStage({ contextKeys: ['a'] }),
    );

    assert.equal(filtered.a, 1);
    assert.equal(filtered[KNOWLEDGE_TO_SCRIPT_NOTES_KEY], null);
  });

  it('detects missing notes and builds retry append', () => {
    const storage = createStorage();

    resetKnowledgeToScriptNotes(storage);
    assert.equal(isKnowledgeToScriptNotesMissing(storage), true);

    storage.context.set(KNOWLEDGE_TO_SCRIPT_NOTES_KEY, 'reviewed');
    assert.equal(isKnowledgeToScriptNotesMissing(storage), false);

    const append = buildKnowledgeToScriptNotesSystemAppend();

    assert.match(append, /__knowledge-to-script__notes/);
    assert.match(append, /reviewed/);
    assert.match(append, /ad-hoc free-flow/);
    assert.match(append, /Do not list scripts you already ran/);
    assert.equal(isKnowledgeToScriptNotesRetryAppend(append), true);
  });

  it('clears a prior truthy note back to null on reset', () => {
    const storage = createStorage();

    storage.context.set(KNOWLEDGE_TO_SCRIPT_NOTES_KEY, 'reviewed');
    resetKnowledgeToScriptNotes(storage);

    assert.equal(storage.context.get(KNOWLEDGE_TO_SCRIPT_NOTES_KEY), null);
    assert.equal(isKnowledgeToScriptNotesMissing(storage), true);
  });
});
