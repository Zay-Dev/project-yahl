import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';

const cliPath = path.join(import.meta.dirname, 'validation-cli.mjs');

describe('validation-cli.mjs', () => {
  it('exits 1 when NIXERY_VALIDATE_CTX is missing', () => {
    const result = spawnSync(process.execPath, [cliPath], {
      env: {
        ...process.env,
        NIXERY_VALIDATE_CTX: '',
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr.toString(), /NIXERY_VALIDATE_CTX is required/);
  });

  it('exits 1 when ctx JSON is invalid', () => {
    const result = spawnSync(process.execPath, [cliPath], {
      env: {
        ...process.env,
        NIXERY_VALIDATE_CTX: '{',
      },
    });

    assert.notEqual(result.status, 0);
  });
});
