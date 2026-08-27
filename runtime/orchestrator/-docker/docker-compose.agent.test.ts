import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('docker-compose.agent.yml agent catalog mounts', () => {
  it('bind-mounts materialized .agent-files SKILLS and YAHL', async () => {
    const composePath = path.join(import.meta.dirname, '..', '..', '..', 'docker-compose.agent.yml');
    const content = await readFile(composePath, 'utf8');

    assert.match(content, /\$\{HOST_REPO_ROOT:-\.\}\/runtime\/\.agent-files\/SKILLS:\/opt\/skills:ro/);
    assert.match(content, /\$\{HOST_REPO_ROOT:-\.\}\/runtime\/\.agent-files\/YAHL:\/opt\/yahl:ro/);
    assert.doesNotMatch(content, /orchestrator\/SKILLS:\/opt\/skills/);
  });
});
