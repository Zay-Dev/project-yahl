import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { YahlStage } from '@/shared/yahl-stage';

import { resolveAskUserEntry, validateAskUserToolCall } from './registry';

const stage: YahlStage = {
  askUser: [
    { id: '1', question: 'Pick a number' },
  ],
  logic: 'c += /ask-user(1);',
};

describe('resolveAskUserEntry', () => {
  it('finds registry entries by ref', () => {
    assert.equal(resolveAskUserEntry(stage, '1')?.question, 'Pick a number');
    assert.equal(resolveAskUserEntry(stage, '9'), null);
  });
});

describe('validateAskUserToolCall', () => {
  it('accepts valid batch tool call', () => {
    const error = validateAskUserToolCall(stage, {
      batchId: 'round1',
      questions: [{
        kind: 'multipleChoice',
        options: [
          { id: '1', label: 'One' },
          { id: '2', label: 'Two' },
        ],
        questionRef: '1',
        title: 'Pick a number',
      }],
      title: 'Answer required',
      version: 'askUserBatch.v1',
    });

    assert.equal(error, null);
  });

  it('rejects already answered refs', () => {
    const answeredStage: YahlStage = {
      askUser: [{ answer: 3, id: '1', question: 'Pick a number' }],
      logic: 'c += /ask-user(1);',
    };

    const error = validateAskUserToolCall(answeredStage, {
      batchId: 'round1',
      questions: [{
        kind: 'multipleChoice',
        options: [
          { id: '1', label: 'One' },
          { id: '2', label: 'Two' },
        ],
        questionRef: '1',
        title: 'Pick a number',
      }],
      title: 'Answer required',
      version: 'askUserBatch.v1',
    });

    assert.match(error ?? '', /already answered/);
  });
});
