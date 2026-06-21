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

  it('runOneStage blocks emitStageFinish when activeStage diverges from bound slot', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const runOneStageStart = src.indexOf('private async runOneStage()');

    assert.ok(runOneStageStart >= 0);

    const runOneStageBody = src.slice(runOneStageStart);
    const integrityIdx = runOneStageBody.indexOf('stage slot integrity');
    const finishIdx = runOneStageBody.indexOf('publisher.emitStageFinish');

    assert.ok(integrityIdx >= 0, 'slot integrity guard missing from runOneStage');
    assert.ok(finishIdx >= 0, 'emitStageFinish call missing from runOneStage');
    assert.ok(integrityIdx < finishIdx, 'slot integrity guard must run before emitStageFinish');
  });

  it('resetStageContext pins boundParsedStageIndex and boundStage', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const resetStart = src.indexOf('private resetStageContext(');

    assert.ok(resetStart >= 0);

    const resetBody = src.slice(resetStart, resetStart + 800);

    assert.match(resetBody, /this\.boundParsedStageIndex = parsedStageIndex/);
    assert.match(resetBody, /this\.boundStage = stage/);
    assert.match(resetBody, /this\.boundSourceStartLine = stage\.sourceStartLine/);
  });

  it('verify auto-retry rotates requestId when stage doc was created for wrong slot', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const runOneStageStart = src.indexOf('private async runOneStage()');

    assert.ok(runOneStageStart >= 0);

    const runOneStageBody = src.slice(runOneStageStart);

    assert.match(runOneStageBody, /shouldRotateRequestIdForBoundStage/);
    assert.match(runOneStageBody, /resolveActiveStageForVerifyRecoveryBound/);
  });
});
