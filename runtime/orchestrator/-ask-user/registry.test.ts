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
  it('accepts matching title and ref', () => {
    const error = validateAskUserToolCall(stage, {
      kind: 'multipleChoice',
      options: [
        { id: '1', label: 'One' },
        { id: '2', label: 'Two' },
      ],
      questionRef: '1',
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
      questionRef: '1',
      title: 'Wrong title',
      version: 'askUser.v1',
    });

    assert.match(error ?? '', /title must match/);
  });
});
