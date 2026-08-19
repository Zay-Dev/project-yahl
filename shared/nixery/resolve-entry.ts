import type { TNixeryDef, TNixeryRuntime } from './types';

const PLUGIN_ROOT = '/opt/nixery/plugin';

export const resolveNixeryEntryArgv = (params: {
  abilityId: string;
  entry: string;
  runtime: TNixeryRuntime;
}): string[] => {
  const abilityId = params.abilityId.trim();
  const entry = params.entry.trim();

  if (!abilityId || abilityId.includes('/') || abilityId.includes('..')) {
    throw new Error(`[nixery] ability id invalid for run.entry: ${params.abilityId}`);
  }

  if (!entry || entry.includes('..') || entry.startsWith('/') || entry.includes('\\')) {
    throw new Error(`[nixery] run.entry must be a relative path under the ability dir: ${params.entry}`);
  }

  const containerEntry = `${PLUGIN_ROOT}/${abilityId}/${entry}`;

  switch (params.runtime) {
    case 'node':
      return ['node', containerEntry];
    case 'tsx':
      return ['npx', 'tsx', containerEntry];
    case 'python':
      return ['python3', containerEntry];
    default:
      throw new Error(`[nixery] unsupported run.runtime: ${params.runtime}`);
  }
};

export const resolveNixeryDefEntryArgv = (def: TNixeryDef): string[] => {
  if (!def.run?.entry?.trim() || !def.run.runtime) {
    throw new Error(`[nixery] def ${def.id} requires run.runtime and run.entry`);
  }

  return resolveNixeryEntryArgv({
    abilityId: def.id,
    entry: def.run.entry,
    runtime: def.run.runtime,
  });
};
