import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const agentIndexPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'index.ts',
);

describe('verify finish order', () => {
  it('runOneStage calls runVerifyGate before emitStageFinish', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const runOneStageStart = src.indexOf('private async runOneStage()');

    assert.ok(runOneStageStart >= 0);

    const runOneStageBody = src.slice(runOneStageStart);
    const verifyIdx = runOneStageBody.indexOf('await runVerifyGate');
    const finishIdx = runOneStageBody.indexOf('publisher.emitStageFinish');

    assert.ok(verifyIdx >= 0, 'runVerifyGate call missing from runOneStage');
    assert.ok(finishIdx >= 0, 'emitStageFinish call missing from runOneStage');
    assert.ok(verifyIdx < finishIdx, 'runVerifyGate must run before emitStageFinish');
  });
});
