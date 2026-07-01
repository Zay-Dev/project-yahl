import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('session knowledge extract', () => {
  it('writes extract JSON under sessions/{sessionId}/knowledge/', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-session-extract-'));

    process.env.WORKSPACE_ROOT = tmp;

    const {
      resolveSessionKnowledgeWritePath,
      writeSessionKnowledgeExtract,
    } = await import('./session-extract.js');

    const written = await writeSessionKnowledgeExtract({
      absent: false,
      extracted: '{"region":"hk"}',
      key: 'hk-region',
      need: 'preferred region',
      sessionId: 'sess-abc',
      topic: 'hk-weather',
    });

    assert.equal(written.agentPath, '~/knowledge/hk-region.json');

    const raw = await fs.readFile(written.absolute, 'utf8');
    const parsed = JSON.parse(raw) as { absent: boolean; extracted: string; need: string; topic: string };

    assert.equal(parsed.absent, false);
    assert.equal(parsed.extracted, '{"region":"hk"}');
    assert.equal(parsed.need, 'preferred region');
    assert.equal(parsed.topic, 'hk-weather');

    const resolved = resolveSessionKnowledgeWritePath('sess-abc', 'hk-region');

    assert.equal(resolved.absolute, written.absolute);

    delete process.env.WORKSPACE_ROOT;
  });

  it('rejects invalid sessionId', async () => {
    const { validateSessionId } = await import('./session-extract.js');

    assert.equal(validateSessionId(''), 'sessionId required');
    assert.equal(validateSessionId('../evil'), 'invalid sessionId');
    assert.equal(validateSessionId('sess-ok'), null);
  });

  it('suffixes keys on collision within the same session dir', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-session-extract-collision-'));

    process.env.WORKSPACE_ROOT = tmp;

    const { resolveUniqueSessionKnowledgeKey, writeSessionKnowledgeExtract } = await import('./session-extract.js');

    await writeSessionKnowledgeExtract({
      absent: false,
      extracted: 'first',
      key: 'all-keys',
      need: 'all keys',
      sessionId: 'sess-dup',
    });

    const nextKey = await resolveUniqueSessionKnowledgeKey('sess-dup', 'all keys');

    assert.equal(nextKey, 'all-keys-2');

    delete process.env.WORKSPACE_ROOT;
  });

  it('detects absent extract marker', async () => {
    const { isExtractAbsent } = await import('./session-extract.js');

    assert.equal(isExtractAbsent('<none>'), true);
    assert.equal(isExtractAbsent('  <none>  '), true);
    assert.equal(isExtractAbsent('{"foo":1}'), false);
  });
});
