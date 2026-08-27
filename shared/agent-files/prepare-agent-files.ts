import fs from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

import { assertNixeryPluginArtifacts } from '../nixery/assert-plugin-artifacts';
import { listNixeryPluginIds } from '../nixery/list-defs';
import { validateNixeryPluginMeta } from '../nixery/validate-def';

import type { TNixeryPluginMeta } from '../nixery/types';

export const AGENT_FILES_DIR_REL = path.join('runtime', '.agent-files');

export const AGENT_SKILLS_CONTAINER_DIR = '/opt/skills';

export const AGENT_YAHL_CONTAINER_DIR = '/opt/yahl';

export type TAgentFilesArtifactKind = 'skills' | 'prompts';

export type TAgentFilesLayout = {
  agentFilesRoot: string;
  skillsDir: string;
  yahlDir: string;
};

export type TAgentFilesCopied = {
  basename: string;
  kind: TAgentFilesArtifactKind;
  pluginId: string;
};

export type TPrepareAgentFilesResult = {
  copied: TAgentFilesCopied[];
  layout: TAgentFilesLayout;
};

const KIND_KEYS: TAgentFilesArtifactKind[] = ['skills', 'prompts'];

const entriesForKind = (
  meta: TNixeryPluginMeta,
  kind: TAgentFilesArtifactKind,
): string[] => meta[kind] ?? [];

const readPluginMetaAt = async (pluginYmlPath: string): Promise<TNixeryPluginMeta> => {
  const raw = await fs.readFile(pluginYmlPath, 'utf8');

  return validateNixeryPluginMeta(YAML.parse(raw));
};

const resetDir = async (dir: string) => {
  await fs.rm(dir, { force: true, recursive: true });
  await fs.mkdir(dir, { recursive: true });
};

const copyPath = async (srcAbs: string, destAbs: string) => {
  const st = await fs.lstat(srcAbs);

  await fs.rm(destAbs, { force: true, recursive: true });

  if (st.isDirectory()) {
    await fs.cp(srcAbs, destAbs, { recursive: true });

    return;
  }

  await fs.mkdir(path.dirname(destAbs), { recursive: true });
  await fs.copyFile(srcAbs, destAbs);
};

const isSymlink = async (entryPath: string) => {
  try {
    const st = await fs.lstat(entryPath);

    return st.isSymbolicLink();
  } catch {
    return false;
  }
};

export const resolveAgentFilesLayout = (repoRoot: string): TAgentFilesLayout => {
  const root = path.resolve(repoRoot);
  const agentFilesRoot = path.join(root, AGENT_FILES_DIR_REL);

  return {
    agentFilesRoot,
    skillsDir: path.join(agentFilesRoot, 'SKILLS'),
    yahlDir: path.join(agentFilesRoot, 'YAHL'),
  };
};

const copyBuiltinSkills = async (repoRoot: string, skillsDir: string) => {
  const sourceDir = path.join(repoRoot, 'runtime', 'orchestrator', 'SKILLS');
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    const srcAbs = path.join(sourceDir, entry.name);

    if (await isSymlink(srcAbs)) {
      continue;
    }

    await copyPath(srcAbs, path.join(skillsDir, entry.name));
  }
};

const copyBuiltinYahl = async (repoRoot: string, yahlDir: string) => {
  const sourceDir = path.join(repoRoot, 'runtime', 'orchestrator', 'YAHL');
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const srcAbs = path.join(sourceDir, entry.name);

    if (await isSymlink(srcAbs)) {
      continue;
    }

    await copyPath(srcAbs, path.join(yahlDir, entry.name));
  }
};

const destAbsForPluginEntry = (
  layout: TAgentFilesLayout,
  kind: TAgentFilesArtifactKind,
  basename: string,
): string => {
  if (kind === 'skills') {
    return path.join(layout.skillsDir, basename);
  }

  return path.join(layout.yahlDir, basename);
};

export const prepareAgentFiles = async (opts: {
  repoRoot: string;
}): Promise<TPrepareAgentFilesResult> => {
  const repoRoot = path.resolve(opts.repoRoot);
  const layout = resolveAgentFilesLayout(repoRoot);
  const nixeryRoot = path.join(repoRoot, 'server', 'nixery');
  const pluginIds = await listNixeryPluginIds(nixeryRoot);
  const copied: TAgentFilesCopied[] = [];
  const claimed = new Map<string, string>();

  await fs.mkdir(layout.agentFilesRoot, { recursive: true });
  await resetDir(layout.skillsDir);
  await resetDir(layout.yahlDir);

  await copyBuiltinSkills(repoRoot, layout.skillsDir);
  await copyBuiltinYahl(repoRoot, layout.yahlDir);

  for (const pluginId of pluginIds) {
    const pluginDir = path.join(nixeryRoot, pluginId);
    const meta = await readPluginMetaAt(path.join(pluginDir, 'plugin.yml'));

    await assertNixeryPluginArtifacts(pluginDir, meta);

    for (const kind of KIND_KEYS) {
      for (const entry of entriesForKind(meta, kind)) {
        const basename = path.basename(entry);
        const claimKey = `${kind}:${basename}`;
        const prior = claimed.get(claimKey);

        if (prior) {
          throw new Error(
            `plugin artifact basename collision: ${claimKey} claimed by ${prior} and ${pluginId}`,
          );
        }

        claimed.set(claimKey, pluginId);

        const srcAbs = path.resolve(pluginDir, entry);
        const destAbs = destAbsForPluginEntry(layout, kind, basename);

        await copyPath(srcAbs, destAbs);

        copied.push({ basename, kind, pluginId });
      }
    }
  }

  return { copied, layout };
};
