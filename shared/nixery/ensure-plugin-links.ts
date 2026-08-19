import fs from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

import { assertNixeryPluginArtifacts } from './assert-plugin-artifacts';
import { listNixeryPluginIds } from './list-defs';
import { validateNixeryPluginMeta } from './validate-def';

import type { TNixeryPluginMeta } from './types';

export type TNixeryPluginArtifactKind = 'skills' | 'prompts' | 'task_skills';

export type TNixeryPluginInstall = {
  basename: string;
  containerDest?: string;
  destAbs: string;
  destRel: string;
  kind: TNixeryPluginArtifactKind;
  pluginId: string;
  srcAbs: string;
  srcRel: string;
};

const KIND_KEYS: TNixeryPluginArtifactKind[] = ['skills', 'prompts', 'task_skills'];

const DEST_DIR_REL: Record<TNixeryPluginArtifactKind, string> = {
  prompts: path.join('runtime', 'orchestrator', 'YAHL'),
  skills: path.join('runtime', 'orchestrator', 'SKILLS'),
  task_skills: path.join('server', 'tasks', '_shared', 'skills'),
};

const containerDestFor = (
  kind: TNixeryPluginArtifactKind,
  basename: string,
): string | undefined => {
  if (kind === 'skills') {
    return `/opt/skills/${basename}`;
  }

  if (kind === 'prompts') {
    return `/opt/yahl/${basename}`;
  }

  return undefined;
};

const entriesForKind = (
  meta: TNixeryPluginMeta,
  kind: TNixeryPluginArtifactKind,
): string[] => meta[kind] ?? [];

const readPluginMetaAt = async (pluginYmlPath: string): Promise<TNixeryPluginMeta> => {
  const raw = await fs.readFile(pluginYmlPath, 'utf8');

  return validateNixeryPluginMeta(YAML.parse(raw));
};

const linkRelative = async (srcAbs: string, destAbs: string) => {
  await fs.mkdir(path.dirname(destAbs), { recursive: true });

  const expected = path.relative(path.dirname(destAbs), srcAbs);

  try {
    const st = await fs.lstat(destAbs);

    if (st.isSymbolicLink()) {
      const current = await fs.readlink(destAbs);
      const currentResolved = path.resolve(path.dirname(destAbs), current);

      if (currentResolved === path.resolve(srcAbs) || current === expected) {
        return;
      }

      await fs.unlink(destAbs);
    } else {
      throw new Error(
        `refusing to clobber real path at install destination: ${destAbs}`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.symlink(expected, destAbs);
};

export const ensureNixeryPluginLinks = async (opts: {
  nixeryRoot: string;
  repoRoot: string;
}): Promise<TNixeryPluginInstall[]> => {
  const nixeryRoot = path.resolve(opts.nixeryRoot);
  const repoRoot = path.resolve(opts.repoRoot);
  const pluginIds = await listNixeryPluginIds(nixeryRoot);
  const installs: TNixeryPluginInstall[] = [];
  const claimed = new Map<string, string>();

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
        const destRel = path.join(DEST_DIR_REL[kind], basename);
        const destAbs = path.join(repoRoot, destRel);
        const srcRel = path.relative(repoRoot, srcAbs);

        await linkRelative(srcAbs, destAbs);

        installs.push({
          basename,
          containerDest: containerDestFor(kind, basename),
          destAbs,
          destRel,
          kind,
          pluginId,
          srcAbs,
          srcRel,
        });
      }
    }
  }

  return installs;
};

export { assertNixeryPluginArtifacts } from './assert-plugin-artifacts';

export const AGENT_YAHL_CONTAINER_DIR = '/opt/yahl';

export const formatAgentPluginVolumeLines = (opts: {
  hostRepoRoot: string;
  installs: TNixeryPluginInstall[];
}): string[] => {
  const hostRepoRoot = path.resolve(opts.hostRepoRoot);
  const hostYahl = path.join(hostRepoRoot, 'runtime', 'orchestrator', 'YAHL');
  const lines: string[] = [
    `      - ${JSON.stringify(`${hostYahl}:${AGENT_YAHL_CONTAINER_DIR}:ro`)}`,
  ];

  for (const install of opts.installs) {
    if (!install.containerDest) {
      continue;
    }

    const hostSrc = path.join(hostRepoRoot, install.srcRel);

    lines.push(
      `      - ${JSON.stringify(`${hostSrc}:${install.containerDest}:ro`)}`,
    );
  }

  return lines;
};
