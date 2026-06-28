import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { resolvePrefixVerifyFastForward } from './index';

const agentIndexPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../-agent/index.ts',
);

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

describe('fork prefix fast-forward runYahl', () => {
  it('skips parseYahlDocument when yahl is empty and stages are pre-supplied', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const constructorStart = src.indexOf('constructor(');

    assert.ok(constructorStart >= 0);

    const constructorBody = src.slice(constructorStart, constructorStart + 1200);

    assert.match(constructorBody, /yahl\.trim\(\)/);
    assert.match(constructorBody, /parseYahlDocument\(yahl\)\.runInput/);
    assert.match(constructorBody, /options\.stages\?\.length/);
    assert.match(constructorBody, /runYahl: yahl text or options\.stages is required/);
  });
});
