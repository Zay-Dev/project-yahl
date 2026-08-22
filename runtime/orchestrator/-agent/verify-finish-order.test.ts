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

    assert.ok(verifyIdx >= 0, 'runVerifyGate call missing from runOneStage');

    const afterVerify = runOneStageBody.slice(verifyIdx);
    const finishIdx = afterVerify.indexOf('publisher.emitStageFinish');

    assert.ok(finishIdx >= 0, 'emitStageFinish call missing after runVerifyGate');
  });

  it('runOneStage blocks emitStageFinish when activeStage diverges from bound slot', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const runOneStageStart = src.indexOf('private async runOneStage()');

    assert.ok(runOneStageStart >= 0);

    const runOneStageBody = src.slice(runOneStageStart);
    const verifyIdx = runOneStageBody.indexOf('await runVerifyGate');

    assert.ok(verifyIdx >= 0, 'runVerifyGate call missing from runOneStage');

    const afterVerify = runOneStageBody.slice(verifyIdx);
    const integrityIdx = afterVerify.indexOf('stage slot integrity');
    const finishIdx = afterVerify.indexOf('publisher.emitStageFinish');

    assert.ok(integrityIdx >= 0, 'slot integrity guard missing after runVerifyGate');
    assert.ok(finishIdx >= 0, 'emitStageFinish call missing after runVerifyGate');
    assert.ok(integrityIdx < finishIdx, 'slot integrity guard must run before emitStageFinish');
  });

  it('resetStageContext pins boundParsedStageIndex and boundStage', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const resetStart = src.indexOf('private resetStageContext(');

    assert.ok(resetStart >= 0);

    const resetBody = src.slice(resetStart, resetStart + 800);

    assert.match(resetBody, /this\.boundParsedStageIndex = this\.options\.parsedStageIndex \?\? parsedStageIndex/);
    assert.match(resetBody, /this\.boundStage = stage/);
    assert.match(resetBody, /this\.boundSourceStartLine = stage\.sourceStartLine/);
  });

  it('resetStageContext refreshes today and now_iso before filtering', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const resetStart = src.indexOf('private resetStageContext(');

    assert.ok(resetStart >= 0);

    const resetBody = src.slice(resetStart, resetStart + 1800);
    const seedIdx = resetBody.indexOf('seedDefaultContext(this.storage)');
    const notesIdx = resetBody.indexOf('seedKnowledgeToScriptNotes(this.storage)');
    const filterIdx = resetBody.indexOf('this.filteredStorage = filterStorageForStage');

    assert.ok(seedIdx >= 0, 'seedDefaultContext missing from resetStageContext');
    assert.ok(notesIdx >= 0, 'seedKnowledgeToScriptNotes missing from resetStageContext');
    assert.ok(filterIdx >= 0, 'filterStorageForStage missing from resetStageContext');
    assert.ok(seedIdx < filterIdx, 'seedDefaultContext must run before filterStorageForStage');
    assert.ok(notesIdx < filterIdx, 'seedKnowledgeToScriptNotes must run before filterStorageForStage');
    assert.doesNotMatch(
      resetBody.slice(0, filterIdx),
      /if \(isKnowledgeToScriptEnabled[\s\S]*seedKnowledgeToScriptNotes/,
      'notes seed must be unconditional',
    );
  });

  it('runWhileWithParentVerify wraps handleWhile before suffix stages', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const whileDispatch = src.indexOf("stage.type === 'while'");

    assert.ok(whileDispatch >= 0);

    const whileBody = src.slice(whileDispatch, whileDispatch + 1800);

    assert.match(whileBody, /runWhileWithParentVerify/);
    assert.match(whileBody, /isPostLoopWhileResume/);
    assert.match(whileBody, /firstPass:/);
    assert.match(whileBody, /rerun:/);
    assert.match(whileBody, /handleWhile\(/);
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
