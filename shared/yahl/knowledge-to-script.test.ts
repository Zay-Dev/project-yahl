import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  KNOWLEDGE_TO_SCRIPT_NOTES_KEY,
  assertScriptId,
  isKnowledgeToScriptEnabled,
  isKnowledgeToScriptNotesSatisfied,
  resolveKnowledgeToScript,
  scriptFileName,
  seedKnowledgeToScriptNotes,
  validateKnowledgeToScriptField,
} from './knowledge-to-script';

describe('knowledge-to-script', () => {
  it('defaults on for AI stages when field omitted', () => {
    const stage = { logic: 'x = 1;' };

    assert.equal(isKnowledgeToScriptEnabled(stage), true);
    assert.equal(resolveKnowledgeToScript(stage), true);
  });

  it('opts out when knowledgeToScript is false', () => {
    const stage = { knowledgeToScript: false, logic: 'x = 1;' };

    assert.equal(isKnowledgeToScriptEnabled(stage), false);
  });

  it('is off for VM and nixery stages when field omitted', () => {
    assert.equal(isKnowledgeToScriptEnabled({ contextMode: true, logic: 'return {};' }), false);
    assert.equal(isKnowledgeToScriptEnabled({ conditionMode: true, logic: 'IF: END:' }), false);
    assert.equal(
      isKnowledgeToScriptEnabled({
        logic: '(nixery)',
        nixeryInput: { topic: 'x' },
        nixeryRun: 'get-knowledge',
      }),
      false,
    );
  });

  it('accepts explicit true on AI stages', () => {
    const value = validateKnowledgeToScriptField(true, 'stage', {});

    assert.equal(value, true);
  });

  it('rejects explicit true on non-AI stages', () => {
    assert.throws(
      () => validateKnowledgeToScriptField(true, 'stage', { contextMode: true }),
      /cannot enable on contextMode/,
    );
  });

  it('rejects non-boolean knowledgeToScript', () => {
    assert.throws(
      () => validateKnowledgeToScriptField('yes', 'stage', {}),
      /must be true or false/,
    );
  });

  it('validates script ids and file names', () => {
    assert.throws(() => assertScriptId('9bad'), /must match/);
    assert.equal(scriptFileName('extract-routes', 'js'), 'extract-routes.js');
    assert.equal(scriptFileName('extract-routes', 'recipe'), 'extract-routes.recipe.json');
    assert.equal(scriptFileName('extract-routes', 'meta'), 'extract-routes.meta.json');
  });

  it('seeds notes to null and treats reviewed as satisfied', () => {
    const storage = { context: new Map<string, unknown>() };

    seedKnowledgeToScriptNotes(storage);
    assert.equal(storage.context.get(KNOWLEDGE_TO_SCRIPT_NOTES_KEY), null);
    assert.equal(isKnowledgeToScriptNotesSatisfied(null), false);
    assert.equal(isKnowledgeToScriptNotesSatisfied(''), false);
    assert.equal(isKnowledgeToScriptNotesSatisfied('   '), false);
    assert.equal(isKnowledgeToScriptNotesSatisfied(false), false);
    assert.equal(isKnowledgeToScriptNotesSatisfied(0), false);
    assert.equal(isKnowledgeToScriptNotesSatisfied('reviewed'), true);
    assert.equal(isKnowledgeToScriptNotesSatisfied('replayed extract-routes'), true);
  });

  it('re-seeds clears a prior truthy note to null', () => {
    const storage = { context: new Map<string, unknown>() };

    storage.context.set(KNOWLEDGE_TO_SCRIPT_NOTES_KEY, 'reviewed');
    seedKnowledgeToScriptNotes(storage);
    assert.equal(storage.context.get(KNOWLEDGE_TO_SCRIPT_NOTES_KEY), null);
  });
});
