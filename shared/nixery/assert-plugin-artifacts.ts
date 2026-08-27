import fs from 'node:fs/promises';
import path from 'node:path';

import type { TNixeryPluginMeta } from './types';

const KIND_KEYS = ['skills', 'prompts'] as const;

export const assertNixeryPluginArtifacts = async (
  pluginDir: string,
  meta: TNixeryPluginMeta,
) => {
  const root = path.resolve(pluginDir);

  for (const kind of KIND_KEYS) {
    for (const entry of meta[kind] ?? []) {
      const srcAbs = path.resolve(pluginDir, entry);

      if (srcAbs !== root && !srcAbs.startsWith(root + path.sep)) {
        throw new Error(`plugin artifact escapes plugin root: ${entry}`);
      }

      try {
        await fs.access(srcAbs);
      } catch {
        throw new Error(`plugin artifact missing: ${path.basename(pluginDir)}/${entry}`);
      }
    }
  }
};
