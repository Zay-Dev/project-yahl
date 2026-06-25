import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseVerifyResponse } from '@project-yahl/shared/verify/parse-response';
import { isVerifyInfraError } from '@project-yahl/shared/verify/verify-infra';

import { resetRequestActivityForTests } from './request-activity.js';
import { resetVerifyQueueForTests } from './verify-queue.js';

describe('worker verify helpers', () => {
  it('classifies empty verify response as infra', () => {
    assert.equal(isVerifyInfraError('verify returned empty response'), true);
  });

  it('parses rubric failure without resume action', () => {
    const result = parseVerifyResponse({
      classifyResume: false,
      minScore: 0.75,
      text: '{"score":0.2,"pass":false,"feedback":"missing studyMd"}',
    });

    assert.equal(result.pass, false);
    assert.equal(result.resumeAction, undefined);
  });
});

describe('worker verify queue', () => {
  it('resets queue state for tests', () => {
    resetVerifyQueueForTests();
    resetRequestActivityForTests();
  });
});
