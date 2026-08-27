import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('clearSessionControl on resume/spawn', () => {
  it('resumeUserPauseCheckpoint clears control before spawn', () => {
    const source = readFileSync(
      path.join(root, 'use-cases/user-pause-write.ts'),
      'utf8',
    );

    assert.match(source, /clearSessionControl/);
    const clearIdx = source.indexOf('await clearSessionControl(params.sessionId)');
    const spawnIdx = source.indexOf("spawnOrchestrate(params.sessionId, ['--user-pause-resume-id'");

    assert.ok(clearIdx >= 0);
    assert.ok(spawnIdx >= 0);
    assert.ok(clearIdx < spawnIdx);
  });

  it('spawnOrchestrate clears control at start', () => {
    const source = readFileSync(
      path.join(root, 'use-cases/spawn-orchestrate.ts'),
      'utf8',
    );

    assert.match(source, /clearSessionControl/);
    const clearIdx = source.indexOf('await clearSessionControl(sessionId)');
    const resolveIdx = source.indexOf('resolveSessionBySessionId(sessionId)');

    assert.ok(clearIdx >= 0);
    assert.ok(resolveIdx >= 0);
    assert.ok(clearIdx < resolveIdx);
  });
});
