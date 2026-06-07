import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mergeContextPayloadToStorage,
  storageFromContextPayload,
  storageFromSerializedRecord,
  storageFromSnapshot,
} from './storage-context';

describe('storage-context', () => {
  it('reads serialized redis storage shape', () => {
    const storage = storageFromSerializedRecord({
      context: { foo: 1 },
      types: { Bar: { x: 2 } },
    });

    assert.equal(storage?.context.get('foo'), 1);
    assert.deepEqual(storage?.types.get('Bar'), { x: 2 });
  });

  it('reads nested UI bucket payload', () => {
    const storage = storageFromContextPayload({
      context: { a: 1 },
      stage: { b: 2 },
      types: { T: { c: 3 } },
    });

    assert.equal(storage.context.get('a'), 1);
    assert.equal(storage.context.get('b'), 2);
    assert.deepEqual(storage.types.get('T'), { c: 3 });
  });

  it('mergeContextPayloadToStorage overlays keys onto existing storage', () => {
    const storage = storageFromContextPayload({
      context: { bar: 2, foo: 1 },
    });

    mergeContextPayloadToStorage(storage, {
      context: { bar: 99, baz: 3 },
    });

    assert.equal(storage.context.get('foo'), 1);
    assert.equal(storage.context.get('bar'), 99);
    assert.equal(storage.context.get('baz'), 3);
  });

  it('reads flat and stage-context payloads via storageFromSnapshot', () => {
    const flat = storageFromSnapshot({
      context: { a: 1, b: 2 },
      types: {},
    });
    const stagePayload = storageFromSnapshot({
      context: { a: 1 },
      stage: { b: 2 },
      types: {},
    });

    assert.equal(flat?.context.get('a'), 1);
    assert.equal(stagePayload?.context.get('a'), 1);
    assert.equal(stagePayload?.context.get('b'), 2);
  });

  it('storageFromSerializedRecord delegates to storageFromSnapshot', () => {
    const storage = storageFromSerializedRecord({
      context: { result: 14 },
      types: {},
    });

    assert.equal(storage?.context.get('result'), 14);
  });

  it('mergeContextPayloadToStorage leaves storage unchanged for empty payload', () => {
    const storage = storageFromContextPayload({
      context: { foo: 1 },
      types: { T: { x: 2 } },
    });

    mergeContextPayloadToStorage(storage, undefined);

    assert.equal(storage.context.get('foo'), 1);
    assert.deepEqual(storage.types.get('T'), { x: 2 });
  });
});
