import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const skillsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'skills.ts',
);

const readSkillsSource = () => readFileSync(skillsPath, 'utf8');

const parseCatchBody = (src: string) => {
  const catchStart = src.indexOf('} catch (parseError) {');

  assert.ok(catchStart >= 0, 'parseError catch block missing');

  const crashStart = src.indexOf('void writeAndAnalyzeCrash({', catchStart);

  assert.ok(crashStart >= 0, 'writeAndAnalyzeCrash missing from parse catch');

  const returnStart = src.indexOf('feedback: text ||', crashStart);

  assert.ok(returnStart >= 0, 'parse catch return missing');

  return src.slice(catchStart, returnStart + 80);
};

describe('runVerify parse crash reporting', () => {
  it('runVerify uses agent mode for mastermind prompt', () => {
    const src = readSkillsSource();
    const runVerifyStart = src.indexOf('export const runVerify = async');

    assert.ok(runVerifyStart >= 0);

    const runVerifyBody = src.slice(runVerifyStart, runVerifyStart + 3500);

    assert.match(runVerifyBody, /await agent\.prompt\(prompt, \{ mode: 'agent' \}\)/);
  });

  it('parse catch calls writeAndAnalyzeCrash before returning empty verify feedback', () => {
    const src = readSkillsSource();
    const body = parseCatchBody(src);
    const crashIdx = body.indexOf('writeAndAnalyzeCrash');
    const returnIdx = body.indexOf('feedback: text ||');

    assert.ok(crashIdx >= 0, 'writeAndAnalyzeCrash missing from parse catch');
    assert.ok(returnIdx >= 0, 'parse catch return missing');
    assert.ok(crashIdx < returnIdx, 'writeAndAnalyzeCrash must run before parse catch return');
  });

  it('parse catch includes requestId and responsePreview in crash args', () => {
    const body = parseCatchBody(readSkillsSource());

    assert.match(body, /requestId: body\.requestId/);
    assert.match(body, /responsePreview: text\.slice\(0, 500\)/);
  });

  it('parse catch returns mastermind verify returned empty response when text is blank', () => {
    const body = parseCatchBody(readSkillsSource());

    assert.match(body, /mastermind verify returned empty response/);
  });

  it('parse catch uses empty-response error in crash report when agent text is blank', () => {
    const body = parseCatchBody(readSkillsSource());

    assert.match(body, /verify parse failed: empty agent response/);
    assert.match(body, /error: text/);
  });
});
