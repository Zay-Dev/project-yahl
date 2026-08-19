import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  handleVerifyToolCall,
  readSnapshotKey,
  resolveAllowedOutputPath,
} from './verify-tools.mjs';
import { parseVerifyContent } from '../stage-verify/run.mjs';

const parseVerify = (text) => parseVerifyContent({
  classifyResume: false,
  minScore: 0.75,
  text,
});

const toolCall = (name, args) => ({
  function: {
    arguments: JSON.stringify(args),
    name,
  },
  id: 'call-1',
});

describe('resolveAllowedOutputPath', () => {
  it('allows the output name under workspace', () => {
    const workspace = '/workspace';

    assert.equal(
      resolveAllowedOutputPath('result.json', 'result.json', workspace),
      path.resolve(workspace, 'result.json'),
    );
    assert.equal(
      resolveAllowedOutputPath('/workspace/result.json', 'result.json', workspace),
      path.resolve(workspace, 'result.json'),
    );
  });

  it('rejects other paths', () => {
    assert.throws(
      () => resolveAllowedOutputPath('other.json', 'result.json', '/workspace'),
      /path must be result.json/,
    );
    assert.throws(
      () => resolveAllowedOutputPath('../result.json', 'result.json', '/workspace'),
      /path must be result.json/,
    );
    assert.throws(
      () => resolveAllowedOutputPath('', 'result.json', '/workspace'),
      /path is required/,
    );
  });
});

describe('readSnapshotKey', () => {
  const snapshot = {
    context: { topic: 'alpha', blob: 'z'.repeat(40) },
    types: { kind: 'note' },
  };

  it('returns missing keys', () => {
    assert.equal(
      readSnapshotKey({ bucket: 'context', key: 'nope', snapshot }),
      'missing context key: nope',
    );
    assert.equal(
      readSnapshotKey({ bucket: 'types', key: 'nope', snapshot }),
      'missing types key: nope',
    );
  });

  it('returns compact json and truncates with a suffix', () => {
    assert.equal(
      readSnapshotKey({ bucket: 'context', key: 'topic', snapshot }),
      '"alpha"',
    );
    assert.equal(
      readSnapshotKey({ bucket: 'types', key: 'kind', snapshot }),
      '"note"',
    );
    assert.equal(
      readSnapshotKey({
        bucket: 'context',
        key: 'blob',
        maxChars: 8,
        snapshot,
      }),
      '"zzzzzzz\n...[truncated]',
    );
  });
});

describe('handleVerifyToolCall', () => {
  it('reads context and types keys', async () => {
    const snapshot = {
      context: { topic: 'alpha' },
      types: { kind: 'note' },
    };

    assert.deepEqual(
      await handleVerifyToolCall({
        parseVerify,
        snapshot,
        toolCall: toolCall('read_context_key', { key: 'topic' }),
      }),
      { message: '"alpha"', parsed: null },
    );
    assert.deepEqual(
      await handleVerifyToolCall({
        parseVerify,
        snapshot,
        toolCall: toolCall('read_type_key', { key: 'kind' }),
      }),
      { message: '"note"', parsed: null },
    );
  });

  it('writes result.json and returns parsed gate json', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-tools-'));
    const content = JSON.stringify({
      feedback: 'ok',
      pass: true,
      score: 1,
    });

    try {
      const handled = await handleVerifyToolCall({
        outputName: 'result.json',
        parseVerify,
        snapshot: { context: {}, types: {} },
        toolCall: toolCall('write_workspace_file', {
          content,
          path: 'result.json',
        }),
        workspace,
      });

      assert.deepEqual(handled.parsed, {
        feedback: 'ok',
        pass: true,
        score: 1,
      });
      assert.match(handled.message, /wrote /);
      assert.equal(
        await fs.readFile(path.join(workspace, 'result.json'), 'utf8'),
        content,
      );
    } finally {
      await fs.rm(workspace, { force: true, recursive: true });
    }
  });

  it('rejects writes to other files', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-tools-'));

    try {
      const handled = await handleVerifyToolCall({
        outputName: 'result.json',
        parseVerify,
        snapshot: { context: {}, types: {} },
        toolCall: toolCall('write_workspace_file', {
          content: '{}',
          path: 'other.json',
        }),
        workspace,
      });

      assert.equal(handled.parsed, null);
      assert.match(handled.message, /path must be result.json/);
    } finally {
      await fs.rm(workspace, { force: true, recursive: true });
    }
  });
});
