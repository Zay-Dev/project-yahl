import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateOutput } from './validation.mjs';
import {
  buildMessages,
  completeGateLlmContent,
  isRetryableConsultLlmFailure,
  listScriptInventory,
  mergeExistingIds,
  normalizeGate,
  normalizeNotesHint,
  parseExisting,
  resolveInventoryScriptsDir,
  resolveScriptsDir,
  taskScriptsDir,
} from './run.mjs';

describe('consult-script-candidate validation', () => {
  it('accepts advise and skip shapes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'consult-script-'));
    const advisePath = path.join(dir, 'advise.json');
    const skipPath = path.join(dir, 'skip.json');

    await fs.writeFile(advisePath, JSON.stringify({
      action: 'advise',
      scriptId: 'extract-routes-normalize',
      kind: 'normalize',
      contract: 'coerce extract',
      reasons: ['next piece'],
      existingScripts: ['extract-routes'],
      notesHint: 'strict extract ok:false — grew extract-routes-normalize.js',
    }), 'utf8');

    await fs.writeFile(skipPath, JSON.stringify({
      action: 'skip',
      scriptId: null,
      kind: null,
      contract: null,
      reasons: ['nothing new'],
      existingScripts: [],
      notesHint: 'no ad-hoc free-flow; inventory covers fetch/format/sleep',
    }), 'utf8');

    assert.equal((await validateOutput({ outputPath: advisePath })).ok, true);
    assert.equal((await validateOutput({ outputPath: skipPath })).ok, true);
  });

  it('rejects missing notesHint', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'consult-script-'));
    const skipPath = path.join(dir, 'skip.json');

    await fs.writeFile(skipPath, JSON.stringify({
      action: 'skip',
      scriptId: null,
      kind: null,
      contract: null,
      reasons: ['nothing new'],
      existingScripts: [],
    }), 'utf8');

    const result = await validateOutput({ outputPath: skipPath });

    assert.equal(result.ok, false);
    assert.match(result.reason, /notesHint/);
  });

  it('accepts notes: prefix in reasons as notesHint fallback', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'consult-script-'));
    const skipPath = path.join(dir, 'skip.json');

    await fs.writeFile(skipPath, JSON.stringify({
      action: 'skip',
      scriptId: null,
      kind: null,
      contract: null,
      reasons: ['notes: no ad-hoc free-flow this poll'],
      existingScripts: [],
    }), 'utf8');

    assert.equal((await validateOutput({ outputPath: skipPath })).ok, true);
  });
});

describe('consult-script-candidate inventory helpers', () => {
  it('parses existingScripts lists', () => {
    assert.deepEqual(
      parseExisting('extract-routes.recipe.json,format-report-run.js'),
      ['extract-routes', 'format-report-run'],
    );
    assert.deepEqual(parseExisting('["alpha.js","beta"]'), ['alpha', 'beta']);
  });

  it('resolves task scripts dir from taskId', () => {
    assert.equal(taskScriptsDir('traffic_monitor'), '/tasks/traffic_monitor/scripts');
    assert.equal(taskScriptsDir('../evil'), null);
    assert.equal(resolveScriptsDir('traffic_monitor'), '/tasks/traffic_monitor/scripts');
    assert.equal(resolveScriptsDir(''), '/session/scripts');
  });

  it('lists and truncates script inventory from a directory', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scripts-inv-'));

    await fs.writeFile(path.join(dir, 'alpha.js'), `${'x'.repeat(100)}\n`, 'utf8');
    await fs.writeFile(
      path.join(dir, 'beta.recipe.json'),
      `${JSON.stringify({ steps: [] })}\n`,
      'utf8',
    );
    await fs.writeFile(path.join(dir, 'beta.meta.json'), '{"k":1}\n', 'utf8');
    await fs.writeFile(path.join(dir, 'readme.txt'), 'ignore', 'utf8');

    const inventory = await listScriptInventory(dir);

    assert.deepEqual(inventory.ids, ['alpha', 'beta']);
    assert.equal(inventory.snippets.length, 2);
    assert.ok(inventory.snippets.every((item) => item.text.length <= 2000));
  });

  it('lists inventory under a tasks/{taskId}/scripts layout', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tasks-root-'));
    const scriptsDir = path.join(root, 'traffic_monitor', 'scripts');

    await fs.mkdir(scriptsDir, { recursive: true });
    await fs.writeFile(path.join(scriptsDir, 'format-fetch-section.js'), 'export {}\n', 'utf8');

    const inventory = await listScriptInventory(scriptsDir);

    assert.deepEqual(inventory.ids, ['format-fetch-section']);
    assert.equal(inventory.snippets[0]?.file, 'format-fetch-section.js');
  });

  it('resolveInventoryScriptsDir returns empty session default when mounts absent', async () => {
    const inventory = await resolveInventoryScriptsDir('missing_task_xyz');

    assert.equal(inventory.scriptsDir, '/session/scripts');
    assert.deepEqual(inventory.ids, []);
  });

  it('merges ids and builds consultant messages with mission/need/brief/plan', () => {
    const existing = mergeExistingIds(['alpha'], ['beta', 'alpha']);

    assert.deepEqual(existing, ['alpha', 'beta']);

    const messages = buildMessages({
      mission: 'Monitor poll prep',
      need: 'Advise next script or skip',
      pain: 'legacy',
      stageHint: 'monitor-warmUp',
      stageBrief: 'While monitor: bind OD then fetch routes',
      plan: '1) inventory 2) one small script 3) validate',
      existingScripts: existing,
      snippets: [{ file: 'alpha.js', id: 'alpha', text: 'console.log(1)' }],
      scriptsDir: '/session/scripts',
      guidelineContent: 'Guideline: one piece at a time',
      sourceContent: '## HOWTO',
    });

    assert.equal(messages.length, 2);
    assert.match(messages[0].content, /too thin to advise safely/);
    assert.match(messages[0].content, /Session layout under \/session/);
    assert.match(messages[0].content, /notesHint/);
    assert.match(messages[0].content, /yahl-browser/);
    assert.match(messages[0].content, /agent-free/);
    assert.match(messages[0].content, /__knowledge-to-script__notes/);
    assert.match(messages[1].content, /Monitor poll prep/);
    assert.match(messages[1].content, /Stage brief:\nWhile monitor/);
    assert.match(messages[1].content, /Plan:\n1\) inventory/);
    assert.match(messages[1].content, /Advise next script or skip/);
    assert.match(messages[1].content, /Guideline: one piece at a time/);
    assert.match(messages[1].content, /## HOWTO/);
    assert.match(messages[1].content, /alpha\.js/);
    assert.match(messages[1].content, /\/session\/scripts/);
    assert.match(messages[1].content, /\/session\/nixery/);
  });

  it('prefers need over pain in the user message', () => {
    const messages = buildMessages({
      need: 'real need',
      pain: 'legacy pain',
      existingScripts: [],
      snippets: [],
      scriptsDir: '/session/scripts',
    });

    assert.match(messages[1].content, /Need:\nreal need/);
    assert.match(messages[1].content, /Pain \(legacy\):\nlegacy pain/);
  });

  it('normalizes advise and skip gates', () => {
    assert.deepEqual(
      normalizeGate({
        action: 'skip',
        scriptId: 'x',
        kind: 'js',
        contract: 'nope',
        reasons: ['reuse'],
        notesHint: 'no ad-hoc free-flow; inventory covers ops',
      }, ['a']),
      {
        action: 'skip',
        scriptId: null,
        kind: null,
        contract: null,
        reasons: ['reuse'],
        existingScripts: ['a'],
        notesHint: 'no ad-hoc free-flow; inventory covers ops',
      },
    );

    assert.equal(
      normalizeGate({
        action: 'advise',
        scriptId: 'format-fetch-section',
        kind: 'js',
        contract: 'stdin → markdown',
        reasons: ['missing formatter'],
        notesHint: 'inline jq format — grew format-fetch-section.js',
      }, ['extract-routes']).scriptId,
      'format-fetch-section',
    );
  });

  it('normalizes notesHint from field or reasons prefix', () => {
    assert.equal(
      normalizeNotesHint({ notesHint: '  grew normalize  ' }),
      'grew normalize',
    );
    assert.equal(
      normalizeNotesHint({ reasons: ['notes: observe recovery — rewrite extract-routes'] }),
      'observe recovery — rewrite extract-routes',
    );
    assert.equal(normalizeNotesHint({ reasons: ['other'] }), '');
  });

  it('requires notesHint when normalizing gates', () => {
    assert.throws(
      () => normalizeGate({
        action: 'skip',
        scriptId: null,
        kind: null,
        contract: null,
        reasons: ['reuse'],
      }, []),
      /notesHint/,
    );
  });
});

describe('consult-script-candidate empty LLM retry', () => {
  it('detects empty and length failures as retryable', () => {
    assert.equal(isRetryableConsultLlmFailure(new Error('finish_reason=length')), true);
    assert.equal(isRetryableConsultLlmFailure(new Error('consult-script-candidate returned empty LLM content')), true);
    assert.equal(isRetryableConsultLlmFailure(new Error('openai chat failed: 500')), false);
  });

  it('retries once after empty content', async () => {
    const messages = [{ content: 'system', role: 'system' }];
    let calls = 0;

    const content = await completeGateLlmContent({
      defId: 'consult-script-candidate',
      messages,
      complete: async () => {
        calls += 1;

        if (calls === 1) {
          return '';
        }

        return '{"action":"skip"}';
      },
    });

    assert.equal(content, '{"action":"skip"}');
    assert.equal(calls, 2);
    assert.equal(messages.length, 2);
    assert.match(messages[1].content, /gate JSON object only/);
  });

  it('retries once after finish_reason=length throw', async () => {
    const messages = [{ content: 'system', role: 'system' }];
    let calls = 0;

    const content = await completeGateLlmContent({
      defId: 'consult-script-candidate',
      messages,
      complete: async () => {
        calls += 1;

        if (calls === 1) {
          throw new Error('openai chat finish_reason=length (output truncated; raise OPENAI_MAX_TOKENS)');
        }

        return '{"action":"advise","scriptId":"fetch-driving-routes"}';
      },
    });

    assert.match(content, /fetch-driving-routes/);
    assert.equal(calls, 2);
  });
});
