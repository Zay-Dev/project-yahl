import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildFreshRunStorage } from './resolve-prepared-run.js';

const taskYahl = [
  'name: knowledge-refresh',
  'description: test fixture',
  'runInput:',
  '  - knowledge_topic',
  '  - rerun_intent',
  'stages:',
  '  - produceContextKeys: [knowledge_topic, rerun_intent]',
  '    logic: |',
  '      const knowledge_topic = knowledge_topic;',
  '  - contextMode: true',
  '    logic: |',
  '      (() => ({}))',
].join('\n');

describe('buildFreshRunStorage', () => {
  it('seeds runInput into storage when storageSeed is an empty object', () => {
    const storage = buildFreshRunStorage({
      runInput: { knowledge_topic: 'my-slug' },
      storageSeed: { context: {}, types: {} },
      taskYahl,
    });

    assert.equal(storage.context.get('knowledge_topic'), 'my-slug');
  });

  it('seeds nested rerun_intent object into storage context', () => {
    const rerunIntent = {
      isRerun: true,
      proceedMode: 'update_selected',
      updateScope: ['studies', 'facts'],
      addressOpenQuestions: false,
    };
    const storage = buildFreshRunStorage({
      runInput: { knowledge_topic: 'my-slug', rerun_intent: rerunIntent },
      storageSeed: { context: {}, types: {} },
      taskYahl,
    });

    assert.equal(storage.context.get('knowledge_topic'), 'my-slug');
    assert.deepEqual(storage.context.get('rerun_intent'), rerunIntent);
  });
});
