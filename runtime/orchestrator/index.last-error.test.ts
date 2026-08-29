import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('orchestrator hard-failure lastError', () => {
  it('patches lastError with budget_burnout detection on hard failure', async () => {
    const source = await readFile(path.join(here, 'index.ts'), 'utf8');

    assert.match(source, /lastError/);
    assert.match(source, /budget_burnout/);
    assert.match(source, /maxTurns exhausted/i);
    assert.match(source, /orchestratorFailureInfo/);
  });

  it('agent race error stashes requestId and stageId for lastError', async () => {
    const source = await readFile(path.join(here, '-agent/index.ts'), 'utf8');

    assert.match(source, /orchestratorFailureInfo/);
    assert.match(source, /requestId: this\.requestId/);
    assert.match(source, /stageId:/);
  });
});
