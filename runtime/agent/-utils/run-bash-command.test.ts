import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runBashCommand } from './run-bash-command';

describe('runBashCommand', () => {
  it('returns stdout for a short command', async () => {
    const result = await runBashCommand('echo ok', 5_000);

    assert.equal(result.timedOut, false);
    assert.equal(result.ok, true);
    assert.match(result.output, /ok/);
  });

  it('kills a long sleep within the timeout window', async () => {
    const started = Date.now();
    const result = await runBashCommand('sleep 30', 500);
    const elapsed = Date.now() - started;

    assert.equal(result.timedOut, true);
    assert.equal(result.ok, false);
    assert.match(result.output, /timed out after 500ms/);
    assert.match(result.output, /bashTimeoutMs=500/);
    assert.ok(elapsed < 5_000, `expected kill within 5s, got ${elapsed}ms`);
  });
});
