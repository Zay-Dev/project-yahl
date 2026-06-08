import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { YahlStage } from '@/shared/yahl-stage';

import {
  normalizeQuestionRef,
  questionRefFromId,
  resolveAskUserEntry,
  validateAskUserToolCall,
} from './registry';

const stage: YahlStage = {
  askUser: [
    { id: 1, question: 'Pick a number' },
  ],
  logic: 'c += /ask-user(question_1);',
};

describe('questionRefFromId', () => {
  it('builds question_<id> refs', () => {
    assert.equal(questionRefFromId(1), 'question_1');
    assert.equal(questionRefFromId('scope'), 'question_scope');
  });
});

describe('resolveAskUserEntry', () => {
  it('finds registry entries by ref', () => {
    assert.equal(resolveAskUserEntry(stage, 'question_1')?.question, 'Pick a number');
    assert.equal(resolveAskUserEntry(stage, 'question_9'), null);
  });
});

describe('normalizeQuestionRef', () => {
  it('accepts raw registry ids', () => {
    assert.equal(normalizeQuestionRef('1', stage.askUser ?? []), 'question_1');
  });
});

describe('validateAskUserToolCall', () => {
  it('accepts matching title and ref', () => {
    const error = validateAskUserToolCall(stage, {
      kind: 'multipleChoice',
      options: [
        { id: '1', label: 'One' },
        { id: '2', label: 'Two' },
      ],
      questionRef: 'question_1',
      title: 'Pick a number',
      version: 'askUser.v1',
    });

    assert.equal(error, null);
  });

  it('rejects title mismatch', () => {
    const error = validateAskUserToolCall(stage, {
      kind: 'multipleChoice',
      options: [
        { id: '1', label: 'One' },
        { id: '2', label: 'Two' },
      ],
      questionRef: 'question_1',
      title: 'Wrong title',
      version: 'askUser.v1',
    });

    assert.match(error ?? '', /title must match/);
  });
});
