import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  AGENT_YAHL_CONTAINER_DIR,
  ensureNixeryPluginLinks,
  formatAgentPluginVolumeLines,
} from './ensure-plugin-links';
import { validateNixeryPluginMeta } from './validate-def';

test('validateNixeryPluginMeta accepts skills/prompts/task_skills lists', () => {
  const meta = validateNixeryPluginMeta({
    name: 'Fixture',
    skills: ['SKILLS/nixery'],
    prompts: ['prompts/nixery.md'],
    task_skills: ['task-skills/resolve-errors-with-knowledge'],
  });

  assert.deepEqual(meta.skills, ['SKILLS/nixery']);
  assert.deepEqual(meta.prompts, ['prompts/nixery.md']);
  assert.deepEqual(meta.task_skills, ['task-skills/resolve-errors-with-knowledge']);
});

test('validateNixeryPluginMeta rejects parent-path artifacts', () => {
  assert.throws(() => validateNixeryPluginMeta({
    skills: ['../escape'],
  }));
});

test('validateNixeryPluginMeta rejects absolute artifact paths', () => {
  assert.throws(() => validateNixeryPluginMeta({
    prompts: ['/tmp/prompt.md'],
  }));
});

test('ensureNixeryPluginLinks creates relative symlinks and is idempotent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-plugin-links-'));

  try {
    const pluginDir = path.join(root, 'server', 'nixery', 'fixture');
    const skillSrc = path.join(pluginDir, 'SKILLS', 'fixture-skill');
    const promptSrc = path.join(pluginDir, 'prompts', 'fixture.md');
    const taskSrc = path.join(pluginDir, 'task-skills', 'fixture-task');

    await fs.mkdir(skillSrc, { recursive: true });
    await fs.mkdir(path.dirname(promptSrc), { recursive: true });
    await fs.mkdir(taskSrc, { recursive: true });
    await fs.writeFile(path.join(skillSrc, 'SKILL.md'), '# fixture\n');
    await fs.writeFile(promptSrc, '# prompt\n');
    await fs.writeFile(path.join(taskSrc, 'SKILL.md'), '# task\n');
    await fs.writeFile(path.join(pluginDir, 'plugin.yml'), [
      'name: Fixture',
      'skills:',
      '  - SKILLS/fixture-skill',
      'prompts:',
      '  - prompts/fixture.md',
      'task_skills:',
      '  - task-skills/fixture-task',
      '',
    ].join('\n'));

    const first = await ensureNixeryPluginLinks({
      nixeryRoot: path.join(root, 'server', 'nixery'),
      repoRoot: root,
    });
    const second = await ensureNixeryPluginLinks({
      nixeryRoot: path.join(root, 'server', 'nixery'),
      repoRoot: root,
    });

    assert.equal(first.length, 3);
    assert.equal(second.length, 3);

    const skillDest = path.join(root, 'runtime', 'orchestrator', 'SKILLS', 'fixture-skill');
    const promptDest = path.join(root, 'runtime', 'orchestrator', 'YAHL', 'fixture.md');
    const taskDest = path.join(root, 'server', 'tasks', '_shared', 'skills', 'fixture-task');

    assert.equal(await fs.readlink(skillDest), path.relative(path.dirname(skillDest), skillSrc));
    assert.equal(await fs.readlink(promptDest), path.relative(path.dirname(promptDest), promptSrc));
    assert.equal(await fs.readlink(taskDest), path.relative(path.dirname(taskDest), taskSrc));

    const volumes = formatAgentPluginVolumeLines({
      hostRepoRoot: root,
      installs: first,
    }).join('\n');

    assert.match(volumes, new RegExp(`${AGENT_YAHL_CONTAINER_DIR}:ro`));
    assert.match(volumes, /\/opt\/skills\/fixture-skill:ro/);
    assert.match(volumes, /\/opt\/yahl\/fixture\.md:ro/);
    assert.match(volumes, /server\/nixery\/fixture\/SKILLS\/fixture-skill/);
    assert.doesNotMatch(volumes, /fixture-task/);
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});

test('ensureNixeryPluginLinks refuses to clobber a real destination tree', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-plugin-clobber-'));

  try {
    const pluginDir = path.join(root, 'server', 'nixery', 'fixture');
    const skillSrc = path.join(pluginDir, 'SKILLS', 'fixture-skill');

    await fs.mkdir(skillSrc, { recursive: true });
    await fs.writeFile(path.join(skillSrc, 'SKILL.md'), '# fixture\n');
    await fs.writeFile(path.join(pluginDir, 'plugin.yml'), [
      'name: Fixture',
      'skills:',
      '  - SKILLS/fixture-skill',
      '',
    ].join('\n'));

    const skillDest = path.join(root, 'runtime', 'orchestrator', 'SKILLS', 'fixture-skill');
    await fs.mkdir(skillDest, { recursive: true });
    await fs.writeFile(path.join(skillDest, 'SKILL.md'), '# real\n');

    await assert.rejects(
      () => ensureNixeryPluginLinks({
        nixeryRoot: path.join(root, 'server', 'nixery'),
        repoRoot: root,
      }),
      /refusing to clobber real path/,
    );
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});

test('live plugin destinations for declared artifacts are symlinks', async () => {
  const repoRoot = path.join(import.meta.dirname, '..', '..');
  const installs = await ensureNixeryPluginLinks({
    nixeryRoot: path.join(repoRoot, 'server', 'nixery'),
    repoRoot,
  });

  assert.ok(installs.length >= 18);

  for (const install of installs) {
    const st = await fs.lstat(install.destAbs);

    assert.equal(st.isSymbolicLink(), true, install.destAbs);
  }

  const persist = installs.find((install) => (
    install.kind === 'prompts' && install.basename === 'knowledge-persist.md'
  ));

  assert.ok(persist);
  assert.equal(persist.containerDest, `${AGENT_YAHL_CONTAINER_DIR}/knowledge-persist.md`);

  const volumes = formatAgentPluginVolumeLines({
    hostRepoRoot: repoRoot,
    installs,
  }).join('\n');

  assert.match(volumes, /\/opt\/yahl\/knowledge-persist\.md:ro/);
});
