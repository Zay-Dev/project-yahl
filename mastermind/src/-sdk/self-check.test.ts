import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { TMastermindAgent } from './agent.js';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mastermind-self-check-'));

process.env.MASTERMIND_DATA_ROOT = tempRoot;

await Promise.all([
  'crash-reports',
  'docs',
  'knowledges',
  'rules',
  'store',
].map((dir) => fs.mkdir(path.join(tempRoot, dir), { recursive: true })));

const { runSelfCheck } = await import('./self-check.js');

const readyAgent: TMastermindAgent = {
  prompt: async () => ({ result: 'ok' }),
  status: 'ready',
};

const unconfiguredAgent: TMastermindAgent = {
  prompt: async () => {
    throw new Error('unconfigured');
  },
  status: 'unconfigured',
};

describe('self-check', () => {
  after(async () => {
    await fs.rm(tempRoot, { force: true, recursive: true });
  });

  it('returns ok for ready agent without ping', async () => {
    const result = await runSelfCheck(readyAgent);

    assert.equal(result.ok, true);
    assert.equal(result.agent, 'ready');
    assert.equal(result.checks.dataDirs, 'ok');
    assert.equal(result.checks.sdkAuth, 'skipped');
  });

  it('fails for unconfigured agent', async () => {
    const result = await runSelfCheck(unconfiguredAgent);

    assert.equal(result.ok, false);
    assert.equal(result.agent, 'unconfigured');
    assert.match(result.error ?? '', /not ready/);
  });

  it('runs sdk ping when requested', async () => {
    const result = await runSelfCheck(readyAgent, { ping: true });

    assert.equal(result.ok, true);
    assert.equal(result.checks.sdkAuth, 'ok');
  });
});
