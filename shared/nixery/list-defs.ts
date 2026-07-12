import fs from 'node:fs/promises';
import path from 'node:path';

import { loadNixeryDefFromFile } from './load-def';
import { resolveNixeryOutputSpec } from './output-contract';

import type { TNixeryDef } from './types';

export const listNixeryDefIds = async (nixeryRoot: string): Promise<string[]> => {
  let entries: string[];

  try {
    entries = await fs.readdir(nixeryRoot);
  } catch {
    return [];
  }

  const ids: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith('_') || entry.startsWith('.')) {
      continue;
    }

    const indexPath = path.join(nixeryRoot, entry, 'index.yml');

    try {
      await fs.access(indexPath);
      ids.push(entry);
    } catch {
      // skip non-def folders
    }
  }

  return ids.sort();
};

export const loadAllNixeryDefs = async (nixeryRoot: string): Promise<TNixeryDef[]> => {
  const ids = await listNixeryDefIds(nixeryRoot);

  return Promise.all(ids.map(async (defId) => {
    const def = await loadNixeryDefFromFile(path.join(nixeryRoot, defId, 'index.yml'));

    if (def.id !== defId) {
      throw new Error(`nixery def id mismatch: folder ${defId} vs index id ${def.id}`);
    }

    return def;
  }));
};

export const listInlineNixeryDefIds = async (nixeryRoot: string): Promise<string[]> => {
  const defs = await loadAllNixeryDefs(nixeryRoot);

  return defs
    .filter((def) => resolveNixeryOutputSpec(def).inlineTool)
    .map((def) => def.id)
    .sort();
};
