import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resetAskUserStageForRerun,
  stripAskUserAnswersFromContext,
} from './reset-for-rerun';

describe('resetAskUserStageForRerun', () => {
  it('strips askUser answer but keeps registry fields', () => {
    const reset = resetAskUserStageForRerun({
      askUser: [{
        answer: 3,
        id: '1',
        options: [{ id: '1', label: 'one' }, { id: '2', label: 'two' }],
        question: 'pick one',
      }],
      logic: 'c += /ask-user(1);',
    });

    assert.equal(reset.askUser?.[0]?.id, '1');
    assert.equal(reset.askUser?.[0]?.question, 'pick one');
    assert.equal(reset.askUser?.[0]?.options?.length, 2);
    assert.equal(reset.askUser?.[0]?.answer, undefined);
  });

  it('returns stage unchanged when askUser is absent', () => {
    const stage = { logic: 'const x = 1;' };

    assert.deepEqual(resetAskUserStageForRerun(stage), stage);
  });
});

describe('stripAskUserAnswersFromContext', () => {
  it('removes ask_user answer keys from flat context', () => {
    const stripped = stripAskUserAnswersFromContext({
      ask_user_1_answer: 3,
      ask_user_last_answer: 3,
      c: 10,
    });

    assert.deepEqual(stripped, { c: 10 });
  });

  it('removes ask_user answer keys from nested fork context payload', () => {
    const stripped = stripAskUserAnswersFromContext({
      context: {
        ask_user_1_answer: 3,
        ask_user_last_answer: 3,
        c: 10,
      },
      types: { t: 1 },
    });

    assert.deepEqual(stripped, {
      context: { c: 10 },
      types: { t: 1 },
    });
  });

  it('returns undefined when payload is missing', () => {
    assert.equal(stripAskUserAnswersFromContext(undefined), undefined);
  });

  it('leaves unrelated keys untouched', () => {
    const stripped = stripAskUserAnswersFromContext({
      a: 1,
      ask_user_registry: 'keep',
      b: 2,
    });

    assert.deepEqual(stripped, {
      a: 1,
      ask_user_registry: 'keep',
      b: 2,
    });
  });
});
