import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSdkAuthError,
  isSdkRetryableError,
  isSdkStallAbortError,
  isVerifyInfraError,
} from './verify-infra.js';

describe('verify-infra', () => {
  it('classifies SDK stall abort as retryable and verify infra', () => {
    const error = new Error('[canceled] This operation was aborted');

    assert.equal(isSdkStallAbortError(error), true);
    assert.equal(isSdkRetryableError(error), true);
    assert.equal(isVerifyInfraError(error.message), true);
  });

  it('classifies SDK auth errors as verify infra', () => {
    const error = new Error('ConnectError: [unauthenticated] Error');

    assert.equal(isSdkAuthError(error), true);
    assert.equal(isVerifyInfraError(error.message), true);
    assert.equal(isVerifyInfraError('verify returned empty response'), true);
    assert.equal(isVerifyInfraError('empty cli response'), true);
  });

  it('classifies agent CLI missing as verify infra', () => {
    assert.equal(isVerifyInfraError('agent CLI not found on PATH'), true);
    assert.equal(isVerifyInfraError('spawn agent ENOENT'), true);
  });

  it('does not classify rubric failures as infra', () => {
    assert.equal(isVerifyInfraError('score below threshold'), false);
    assert.equal(isSdkStallAbortError('score below threshold'), false);
    assert.equal(isSdkAuthError('score below threshold'), false);
  });
});
