import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const agentIndexPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'index.ts',
);

describe('goto into loop stage', () => {
  it('consumes enteredViaGoto on the loop path so the next stage clears goto keys', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const loopBranchStart = src.indexOf("stage.type === 'loop'");

    assert.ok(loopBranchStart >= 0);

    const loopBranch = src.slice(loopBranchStart, loopBranchStart + 420);
    const consumeIdx = loopBranch.indexOf('this.enteredViaGoto = false');
    const handleLoopIdx = loopBranch.indexOf('await handleLoop(');

    assert.ok(consumeIdx >= 0, 'loop path must clear enteredViaGoto');
    assert.ok(handleLoopIdx >= 0, 'handleLoop call missing from loop path');
    assert.ok(
      consumeIdx < handleLoopIdx,
      'enteredViaGoto must be consumed before handleLoop',
    );
  });

  it('resetStageContext clears goto keys when not enteredViaGoto', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const resetStart = src.indexOf('private resetStageContext(');

    assert.ok(resetStart >= 0);

    const resetBody = src.slice(resetStart, resetStart + 600);

    assert.match(resetBody, /if \(!this\.enteredViaGoto\)/);
    assert.match(resetBody, /clearStageGotoContext\(this\.storage\)/);
    assert.match(resetBody, /this\.enteredViaGoto = false/);
  });
});
