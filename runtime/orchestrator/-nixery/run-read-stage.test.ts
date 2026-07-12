import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

import { createStorage } from '@/orchestrator/-tools/set_context';
import { sessionWorkspaceRoot } from '@/orchestrator/-utils/workspace-paths';
import { runNixeryReadStage } from './run-read-stage';

describe('runNixeryReadStage', () => {
  it('inlines *read(variable) from a prior const path', async () => {
    const sessionId = 'test-nixery-read';
    const workspace = path.join(sessionWorkspaceRoot(sessionId), 'nixery', 'get-knowledge');

    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(
      path.join(workspace, 'identity.json'),
      JSON.stringify({ absent: false, extracted: 'test-user' }),
    );

    const prevSessionId = globalThis.sessionId;
    globalThis.sessionId = sessionId;

    try {
      const storage = createStorage();
      const stage = {
        lines: [],
        produceContextKeys: ['extract_ref', 'extracted'],
        sourceStartLine: 1,
        spec: {
          logic: [
            "const extractPath = '~/nixery/get-knowledge/identity.json';",
            'const extractFile = (*read(extractPath));',
            'const extract_ref = { absent: extractFile.absent ?? !extractFile.extracted, path: extractPath };',
            "const extracted = extract_ref.absent ? '<none>' : extractFile.extracted;",
          ].join('\n'),
          produceContextKeys: ['extract_ref', 'extracted'],
        },
        type: 'stage' as const,
      };

      await runNixeryReadStage({ sessionId, stage, storage });

      assert.equal(storage.context.get('extracted'), 'test-user');
      assert.deepEqual(storage.context.get('extract_ref'), {
        absent: false,
        path: '~/nixery/get-knowledge/identity.json',
      });
    } finally {
      globalThis.sessionId = prevSessionId;
      await fs.rm(sessionWorkspaceRoot(sessionId), {
        force: true,
        recursive: true,
      });
    }
  });
});
