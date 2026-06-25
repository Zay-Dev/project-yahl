import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TRunYahl, TStorage } from '@/orchestrator/-agent/-types';

import { createStorage } from '@/orchestrator/-tools/set_context';
import { resolveLoopIndexName, runLoopIteration } from '@/orchestrator/-agent/loop';
import { compileStage } from '@/orchestrator/-utils/yahl';

const testLoopStage = compileStage({
  contextKeys: ['c'],
  contextMode: true,
  logic: '(() => ({ c: context.context.c + context.context.i }))',
  loopSetup: 'for each i of [1..5]',
  updateContextKeys: ['c'],
}, 1);

describe('resolveLoopIndexName', () => {
  it('falls back to stage.spec.loopSetup when loopMeta.indexName is absent', () => {
    const indexName = resolveLoopIndexName(testLoopStage, {
      arraySnapshot: [1],
      index: 0,
      value: 1,
    });

    assert.equal(indexName, 'i');
  });
});

describe('runLoopIteration', () => {
  it('injects loop index into scoped storage passed to runner', async () => {
    const storage = createStorage();
    storage.context.set('c', 4);

    let scopedC: unknown;
    let scopedI: unknown;

    const runner: TRunYahl = async (_, options) => {
      const scopedStorage = options?.useStorage?.();

      scopedC = scopedStorage?.context.get('c');
      scopedI = scopedStorage?.context.get('i');

      scopedStorage!.context.set('c', 5);

      return { storage: scopedStorage! };
    };

    await runLoopIteration(testLoopStage, storage, {
      arraySnapshot: [1, 2, 3, 4, 5],
      index: 0,
      value: 1,
    }, runner);

    assert.equal(scopedC, 4);
    assert.equal(scopedI, 1);
    assert.equal(storage.context.get('c'), 5);
  });

  it('resolves index name from loopSetup when loopMeta.indexName is omitted', async () => {
    const storage = createStorage();
    storage.context.set('c', 4);

    let scopedStorage: TStorage | undefined;

    const runner: TRunYahl = async (_, options) => {
      scopedStorage = options?.useStorage?.();

      return { storage: scopedStorage! };
    };

    await runLoopIteration(testLoopStage, storage, {
      arraySnapshot: [1],
      index: 0,
      value: 1,
    }, runner);

    assert.equal(scopedStorage?.context.get('i'), 1);
  });
});

describe('handleLoop dotted context paths', () => {
  it('iterates study_plan.sources from nested context', async () => {
    const storage = createStorage();

    storage.context.set('study_plan', {
      sources: [{ url: 'https://example.com' }, { url: 'https://example.org' }],
    });

    const loopStage = compileStage({
      contextKeys: ['study_plan'],
      logic: '(() => ({ src }))',
      loopSetup: 'for each src of [study_plan.sources]',
      updateContextKeys: ['study_plan'],
    }, 1);

    let iterationCount = 0;

    const runner: TRunYahl = async () => {
      iterationCount += 1;

      return { storage: createStorage() };
    };

    const { handleLoop } = await import('@/orchestrator/-agent/loop');

    await handleLoop(loopStage, storage, runner);

    assert.equal(iterationCount, 2);
  });
});
