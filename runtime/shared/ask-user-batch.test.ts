import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  explainAskUserBatchParseFailure,
  parseAskUserBatchToolArguments,
} from './ask-user-batch';

const validQuestions = [
  {
    kind: 'multipleChoice',
    options: [
      { id: '1', label: '1' },
      { id: '2', label: '2' },
    ],
    questionRef: '1',
    title: 'pick',
  },
];

describe('parseAskUserBatchToolArguments', () => {
  it('accepts a full askUserBatch.v1 payload', () => {
    const parsed = parseAskUserBatchToolArguments(JSON.stringify({
      batchId: 'stage1_round1',
      questions: validQuestions,
      title: 'Choose',
      version: 'askUserBatch.v1',
    }));

    assert.ok(parsed);
    assert.equal(parsed.version, 'askUserBatch.v1');
    assert.equal(parsed.batchId, 'stage1_round1');
    assert.equal(parsed.questions.length, 1);
  });

  it('defaults missing version to askUserBatch.v1', () => {
    const parsed = parseAskUserBatchToolArguments(JSON.stringify({
      batchId: 'stage1_round1',
      questions: validQuestions,
      title: 'Choose',
    }));

    assert.ok(parsed);
    assert.equal(parsed.version, 'askUserBatch.v1');
  });

  it('rejects an unsupported version', () => {
    const parsed = parseAskUserBatchToolArguments(JSON.stringify({
      batchId: 'stage1_round1',
      questions: validQuestions,
      title: 'Choose',
      version: 'askUserBatch.v0',
    }));

    assert.equal(parsed, null);
  });

  it('rejects missing batchId', () => {
    const parsed = parseAskUserBatchToolArguments(JSON.stringify({
      questions: validQuestions,
      title: 'Choose',
      version: 'askUserBatch.v1',
    }));

    assert.equal(parsed, null);
  });
});

describe('explainAskUserBatchParseFailure', () => {
  it('explains bad JSON', () => {
    assert.equal(
      explainAskUserBatchParseFailure('{'),
      'ask_user: arguments must be valid JSON',
    );
  });

  it('explains unsupported version', () => {
    assert.equal(
      explainAskUserBatchParseFailure(JSON.stringify({
        batchId: 'x',
        questions: validQuestions,
        title: 'Choose',
        version: 'askUserBatch.v0',
      })),
      'ask_user: version must be "askUserBatch.v1"',
    );
  });

  it('explains missing batchId', () => {
    assert.equal(
      explainAskUserBatchParseFailure(JSON.stringify({
        questions: validQuestions,
        title: 'Choose',
      })),
      'ask_user: batchId is required',
    );
  });

  it('explains missing title', () => {
    assert.equal(
      explainAskUserBatchParseFailure(JSON.stringify({
        batchId: 'stage1_round1',
        questions: validQuestions,
      })),
      'ask_user: title is required',
    );
  });

  it('explains invalid multipleChoice options', () => {
    assert.match(
      explainAskUserBatchParseFailure(JSON.stringify({
        batchId: 'stage1_round1',
        questions: [{
          kind: 'multipleChoice',
          options: [{ id: '1', label: '1' }],
          questionRef: '1',
          title: 'pick',
        }],
        title: 'Choose',
      })),
      /at least 2 valid options/,
    );
  });
});
