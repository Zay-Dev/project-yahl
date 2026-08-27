import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  AGENT_FILES_DIR_REL,
  prepareAgentFiles,
  resolveAgentFilesLayout,
} from './prepare-agent-files';

test('prepareAgentFiles materializes builtins and plugin artifacts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-agent-files-'));

  try {
    const pluginDir = path.join(root, 'server', 'nixery', 'fixture');
    const skillSrc = path.join(pluginDir, 'SKILLS', 'fixture-skill');
    const workflowSrc = path.join(pluginDir, 'SKILLS', 'fixture-workflow');
    const promptSrc = path.join(pluginDir, 'prompts', 'fixture.md');
    const builtinSkill = path.join(root, 'runtime', 'orchestrator', 'SKILLS', 'platform');
    const builtinYahl = path.join(root, 'runtime', 'orchestrator', 'YAHL');

    await fs.mkdir(skillSrc, { recursive: true });
    await fs.mkdir(workflowSrc, { recursive: true });
    await fs.mkdir(path.dirname(promptSrc), { recursive: true });
    await fs.mkdir(builtinSkill, { recursive: true });
    await fs.mkdir(builtinYahl, { recursive: true });
    await fs.writeFile(path.join(skillSrc, 'SKILL.md'), '# fixture skill\n');
    await fs.writeFile(path.join(workflowSrc, 'SKILL.md'), '# fixture workflow\n');
    await fs.writeFile(promptSrc, '# fixture prompt\n');
    await fs.writeFile(path.join(builtinSkill, 'SKILL.md'), '# platform\n');
    await fs.writeFile(path.join(builtinYahl, 'index.md'), '# index\n');
    await fs.writeFile(path.join(pluginDir, 'plugin.yml'), [
      'name: Fixture',
      'skills:',
      '  - SKILLS/fixture-skill',
      '  - SKILLS/fixture-workflow',
      'prompts:',
      '  - prompts/fixture.md',
      '',
    ].join('\n'));

    const first = await prepareAgentFiles({ repoRoot: root });
    const second = await prepareAgentFiles({ repoRoot: root });
    const layout = resolveAgentFilesLayout(root);

    assert.equal(first.layout.skillsDir, layout.skillsDir);
    assert.equal(first.copied.length, 3);
    assert.equal(second.copied.length, 3);

    const skillMd = await fs.readFile(
      path.join(layout.skillsDir, 'fixture-skill', 'SKILL.md'),
      'utf8',
    );
    const workflowMd = await fs.readFile(
      path.join(layout.skillsDir, 'fixture-workflow', 'SKILL.md'),
      'utf8',
    );
    const platformMd = await fs.readFile(
      path.join(layout.skillsDir, 'platform', 'SKILL.md'),
      'utf8',
    );
    const promptMd = await fs.readFile(path.join(layout.yahlDir, 'fixture.md'), 'utf8');
    const indexMd = await fs.readFile(path.join(layout.yahlDir, 'index.md'), 'utf8');

    assert.match(skillMd, /fixture skill/);
    assert.match(workflowMd, /fixture workflow/);
    assert.match(platformMd, /platform/);
    assert.match(promptMd, /fixture prompt/);
    assert.match(indexMd, /index/);

    const skillStat = await fs.lstat(path.join(layout.skillsDir, 'fixture-skill'));

    assert.equal(skillStat.isSymbolicLink(), false);
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});

test('prepareAgentFiles rejects plugin artifact basename collisions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-agent-files-collision-'));

  try {
    const pluginA = path.join(root, 'server', 'nixery', 'plugin-a');
    const pluginB = path.join(root, 'server', 'nixery', 'plugin-b');
    const skillA = path.join(pluginA, 'SKILLS', 'dup-skill');
    const skillB = path.join(pluginB, 'SKILLS', 'dup-skill');

    await fs.mkdir(skillA, { recursive: true });
    await fs.mkdir(skillB, { recursive: true });
    await fs.mkdir(path.join(root, 'runtime', 'orchestrator', 'SKILLS'), { recursive: true });
    await fs.mkdir(path.join(root, 'runtime', 'orchestrator', 'YAHL'), { recursive: true });
    await fs.writeFile(path.join(skillA, 'SKILL.md'), '# a\n');
    await fs.writeFile(path.join(skillB, 'SKILL.md'), '# b\n');
    await fs.writeFile(path.join(pluginA, 'plugin.yml'), 'name: A\nskills:\n  - SKILLS/dup-skill\n');
    await fs.writeFile(path.join(pluginB, 'plugin.yml'), 'name: B\nskills:\n  - SKILLS/dup-skill\n');

    await assert.rejects(
      () => prepareAgentFiles({ repoRoot: root }),
      /basename collision/,
    );
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});

test('live repo prepareAgentFiles includes nixery catalog and workflow skills', async () => {
  const repoRoot = path.join(import.meta.dirname, '..', '..');
  const { layout } = await prepareAgentFiles({ repoRoot });

  assert.equal(
    layout.agentFilesRoot,
    path.join(repoRoot, AGENT_FILES_DIR_REL),
  );

  const nixerySkill = await fs.readFile(
    path.join(layout.skillsDir, 'nixery', 'SKILL.md'),
    'utf8',
  );
  const nixeryPrompt = await fs.readFile(path.join(layout.yahlDir, 'nixery.md'), 'utf8');
  const workflowSkill = await fs.readFile(
    path.join(layout.skillsDir, 'worth-persisting-knowledge', 'SKILL.md'),
    'utf8',
  );

  assert.match(nixerySkill, /catalog-only/);
  assert.match(nixeryPrompt, /Plug-and-play defs/);
  assert.match(workflowSkill, /worth-persisting-knowledge/);
});
