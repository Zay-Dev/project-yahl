import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const agentIndexPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'index.ts',
);

describe('nixeryRun stage persist order', () => {
  it('persists the stage before runNixeryDef and does not finish-create after', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const runOneStageStart = src.indexOf('private async runOneStage()');

    assert.ok(runOneStageStart >= 0);

    const runOneStageBody = src.slice(runOneStageStart);
    const nixeryIdx = runOneStageBody.indexOf('if (nixeryRun)');

    assert.ok(nixeryIdx >= 0, 'nixeryRun branch missing from runOneStage');

    const verifyLoopIdx = runOneStageBody.indexOf('const maxVerifyRetries');

    assert.ok(verifyLoopIdx > nixeryIdx);

    const nixeryBranch = runOneStageBody.slice(nixeryIdx, verifyLoopIdx);
    const persistIdx = nixeryBranch.indexOf('persistOrchestratorDirectStage');
    const flushIdx = nixeryBranch.indexOf('sessionTracker?.flush');
    const runIdx = nixeryBranch.indexOf('runNixeryDef');
    const finishCreateIdx = nixeryBranch.indexOf('finishOrchestratorDirectStage');
    const emitFinishIdx = nixeryBranch.indexOf('publisher.emitStageFinish');

    assert.ok(persistIdx >= 0, 'persistOrchestratorDirectStage missing from nixeryRun branch');
    assert.ok(flushIdx >= 0, 'flush missing from nixeryRun branch');
    assert.ok(runIdx >= 0, 'runNixeryDef missing from nixeryRun branch');
    assert.ok(persistIdx < runIdx, 'persistOrchestratorDirectStage must run before runNixeryDef');
    assert.ok(flushIdx < runIdx, 'flush must run before runNixeryDef');
    assert.equal(finishCreateIdx, -1, 'nixeryRun must not call finishOrchestratorDirectStage');
    assert.ok(emitFinishIdx > runIdx, 'emitStageFinish must run after runNixeryDef');
  });
});
