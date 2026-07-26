import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import type { IPublisher } from '@/shared/transports/-types';

import { createSessionEventTracker } from '@/orchestrator/-utils/session-event-tracker';
import { runYahl } from './index';

const agentIndexPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'index.ts',
);

const typesStage = {
  lines: '{\ntype TResult = { absent: boolean; };\n}',
  sourceStartLine: 6,
  spec: { logic: 'type TResult = { absent: boolean; };' },
  type: 'plain' as const,
};

describe('types preamble stage persistence', () => {
  it('wires seedTypesPreamble through finishOrchestratorDirectStage', () => {
    const src = readFileSync(agentIndexPath, 'utf8');
    const branchStart = src.indexOf('isTypesPreambleStage(stage, stageIndex)');

    assert.ok(branchStart >= 0);

    const branch = src.slice(branchStart, branchStart + 280);

    assert.match(branch, /seedTypesPreamble/);
    assert.match(branch, /resetStageContext/);
    assert.match(branch, /finishOrchestratorDirectStage/);
  });

  it('records createStage and stageFinish for types-only first stage', async () => {
    const prevSessionId = globalThis.sessionId;
    const prevTracker = globalThis.sessionTracker;
    const prevPublisher = globalThis.publisher;

    let createdStage: {
      parsedStageIndex?: number;
      sourceStartLine?: number;
      stage?: { logic?: string };
      context?: { types?: Record<string, unknown> };
    } | undefined;
    let finishedEnvelope: {
      contextAfter?: { types?: Map<string, unknown> | Record<string, unknown> };
      requestId?: string;
    } | undefined;

    globalThis.sessionId = 'test-types-preamble';
    globalThis.sessionTracker = {
      ...createSessionEventTracker(),
      createStage: (_sessionId, envelope) => {
        createdStage = envelope;
      },
      flush: async () => {},
    } as ReturnType<typeof createSessionEventTracker>;
    globalThis.publisher = {
      emitStageFinish: (envelope) => {
        finishedEnvelope = envelope;
      },
    } as IPublisher;

    try {
      const { storage } = await runYahl('', {
        stages: [typesStage],
      });

      assert.equal(createdStage?.parsedStageIndex, 0);
      assert.equal(createdStage?.sourceStartLine, 6);
      assert.match(createdStage?.stage?.logic ?? '', /type TResult/);
      assert.ok(storage.types.get('TResult'));
      assert.ok(finishedEnvelope?.requestId);
      assert.ok(storage.types.get('TResult'));

      const finishedTypes = finishedEnvelope?.contextAfter?.types;

      if (finishedTypes instanceof Map) {
        assert.ok(finishedTypes.get('TResult'));
      } else {
        assert.ok(finishedTypes?.TResult);
      }
    } finally {
      globalThis.sessionId = prevSessionId;
      globalThis.sessionTracker = prevTracker;
      globalThis.publisher = prevPublisher;
    }
  });
});
