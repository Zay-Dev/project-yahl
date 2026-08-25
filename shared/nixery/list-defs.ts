import fs from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

import { assertNixeryPluginArtifacts } from './assert-plugin-artifacts';
import { loadNixeryDefFromFile } from './load-def';
import { validateNixeryPluginMeta } from './validate-def';

import type { TNixeryAbilityLocation, TNixeryDef, TNixeryPluginMeta } from './types';

const SKIP_ABILITY_NAMES = new Set(['lib', 'SKILLS', 'prompts', 'task-skills']);

const isSkippedDir = (name: string) =>
  name.startsWith('_') || name.startsWith('.') || SKIP_ABILITY_NAMES.has(name);

const readPluginMeta = async (pluginDir: string): Promise<TNixeryPluginMeta> => {
  const pluginYmlPath = path.join(pluginDir, 'plugin.yml');
  const raw = await fs.readFile(pluginYmlPath, 'utf8');
  const meta = validateNixeryPluginMeta(YAML.parse(raw));

  await assertNixeryPluginArtifacts(pluginDir, meta);

  return meta;
};

export const listNixeryPluginIds = async (nixeryRoot: string): Promise<string[]> => {
  let entries: string[];

  try {
    entries = await fs.readdir(nixeryRoot);
  } catch {
    return [];
  }

  const plugins: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith('_') || entry.startsWith('.')) {
      continue;
    }

    try {
      await fs.access(path.join(nixeryRoot, entry, 'plugin.yml'));
      plugins.push(entry);
    } catch {
      // skip non-plugin folders
    }
  }

  return plugins.sort();
};

export const resolveNixeryAbilityLocations = async (
  nixeryRoot: string,
): Promise<TNixeryAbilityLocation[]> => {
  const pluginIds = await listNixeryPluginIds(nixeryRoot);
  const locations: TNixeryAbilityLocation[] = [];
  const seenIds = new Map<string, string>();

  for (const pluginId of pluginIds) {
    const pluginDir = path.join(nixeryRoot, pluginId);

    await readPluginMeta(pluginDir);

    let children: string[];

    try {
      children = await fs.readdir(pluginDir);
    } catch {
      continue;
    }

    for (const child of children) {
      if (isSkippedDir(child)) {
        continue;
      }

      const abilityDir = path.join(pluginDir, child);
      const indexPath = path.join(abilityDir, 'index.yml');
      const stat = await fs.stat(abilityDir).catch(() => null);

      if (!stat?.isDirectory()) {
        continue;
      }

      try {
        await fs.access(indexPath);
      } catch {
        continue;
      }

      const prior = seenIds.get(child);

      if (prior) {
        throw new Error(
          `nixery ability id collision: ${child} in plugins ${prior} and ${pluginId}`,
        );
      }

      seenIds.set(child, pluginId);
      locations.push({
        abilityId: child,
        abilityDir,
        indexPath,
        pluginDir,
        pluginId,
      });
    }
  }

  return locations.sort((a, b) => a.abilityId.localeCompare(b.abilityId));
};

export const resolveNixeryAbilityLocation = async (
  nixeryRoot: string,
  abilityId: string,
): Promise<TNixeryAbilityLocation> => {
  const id = abilityId.trim();

  if (!id || id.includes('/') || id.includes('..')) {
    throw new Error(`nixery ability id invalid: ${abilityId}`);
  }

  const locations = await resolveNixeryAbilityLocations(nixeryRoot);
  const match = locations.find((loc) => loc.abilityId === id);

  if (!match) {
    throw new Error(`nixery ability not found: ${id}`);
  }

  return match;
};

export const listNixeryDefIds = async (nixeryRoot: string): Promise<string[]> => {
  const locations = await resolveNixeryAbilityLocations(nixeryRoot);

  return locations.map((loc) => loc.abilityId);
};

export const loadAllNixeryDefs = async (nixeryRoot: string): Promise<TNixeryDef[]> => {
  const locations = await resolveNixeryAbilityLocations(nixeryRoot);

  return Promise.all(locations.map(async (loc) => {
    const def = await loadNixeryDefFromFile(loc.indexPath);

    if (def.id !== loc.abilityId) {
      throw new Error(
        `nixery def id mismatch: folder ${loc.abilityId} vs index id ${def.id} `
        + `(plugin ${loc.pluginId})`,
      );
    }

    return def;
  }));
};

