import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildAskUserContinuation,
  extractAskUserRefsFromLogic,
  toAskUserAnswerValue,
} from './continuation';

describe('toAskUserAnswerValue', () => {
  it('coerces numeric ids to numbers', () => {
    assert.equal(toAskUserAnswerValue('5'), 5);
    assert.equal(toAskUserAnswerValue('3.5'), 3.5);
  });

  it('keeps non numeric ids as strings', () => {
    assert.equal(toAskUserAnswerValue('apac'), 'apac');
    assert.equal(toAskUserAnswerValue(''), '');
  });
});

describe('buildAskUserContinuation', () => {
  it('replaces inline ask-user ref and keeps remaining lines', () => {
    const next = buildAskUserContinuation(
      [
        'const a = 1;',
        'c += /ask-user(question_1);',
        'const result = c;',
      ].join('\n'),
      'question_1',
      3,
    );

    assert.ok(next);
    assert.equal(next?.skipNumberOfLines, 1);
    assert.equal(
      next?.stageText,
      [
        'const a = 1;',
        'c += 3;',
        'const result = c;',
      ].join('\n'),
    );
  });

  it('preserves wrapped compiled lines when replacing ask-user ref', () => {
    const next = buildAskUserContinuation(
      [
        '{',
        'c += /ask-user(question_1);',
        '}',
      ].join('\n'),
      'question_1',
      3,
    );

    assert.ok(next);
    assert.equal(next?.stageText, '{\nc += 3;\n}');
  });

  it('returns null when stage has no matching ask-user ref', () => {
    const next = buildAskUserContinuation('const c = 1;\nconst r = c;', 'question_1', '');
    assert.equal(next, null);
  });
});

describe('extractAskUserRefsFromLogic', () => {
  it('collects question refs from logic', () => {
    const refs = extractAskUserRefsFromLogic('a += /ask-user(question_1);\nb += /ask-user(question_2);');
    assert.deepEqual(refs, ['question_1', 'question_2']);
  });
});
