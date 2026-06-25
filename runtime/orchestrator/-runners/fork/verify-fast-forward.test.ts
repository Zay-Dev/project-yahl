import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { resolvePrefixVerifyFastForward } from './index';

const verifyParsed = {
  lines: '{\nlogic;\n}',
  sourceStartLine: 1,
  spec: {
    logic: 'logic;',
    verify: true,
  },
  type: 'plain',
} as ParsedStage;

const plainParsed = {
  lines: '{\nlogic;\n}',
  sourceStartLine: 1,
  spec: { logic: 'logic;' },
  type: 'plain',
} as ParsedStage;

describe('resolvePrefixVerifyFastForward', () => {
  it('returns source verify when stage has verify and source passed', () => {
    const result = resolvePrefixVerifyFastForward(verifyParsed, {
      feedback: 'ok',
      pass: true,
      score: 0.9,
    });

    assert.deepEqual(result, { feedback: 'ok', score: 0.9 });
  });

  it('returns undefined when source verify did not pass', () => {
    assert.equal(
      resolvePrefixVerifyFastForward(verifyParsed, {
        feedback: 'fail',
        pass: false,
        score: 0.2,
      }),
      undefined,
    );
  });

  it('returns undefined when stage has no verify flag', () => {
    assert.equal(
      resolvePrefixVerifyFastForward(plainParsed, {
        feedback: 'ok',
        pass: true,
        score: 1,
      }),
      undefined,
    );
  });
});
