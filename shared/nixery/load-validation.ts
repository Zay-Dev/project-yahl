import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveNixeryAbilityLocation } from './list-defs';
import { resolveNixeryOutputSpec } from './output-contract';

import type { TNixeryAbilityLocation, TNixeryDef } from './types';

export type TNixeryValidationContext = {
  defId: string;
  input: Record<string, unknown>;
  outputPath: string;
  workspace: string;
};

export type TNixeryValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type TNixeryValidationModule = {
  /** Optional — structured defs with inlineTool (e.g. dedup-knowledge, upsert-knowledge-page). */
  parseOutput?: (raw: string) => unknown;
  validateOutput: (ctx: TNixeryValidationContext) => Promise<TNixeryValidationResult>;
};

export const DEFAULT_VALIDATION_MODULE = 'validation.mjs';

export const resolveValidationModulePath = (
  abilityDir: string,
  validateFile?: string,
) => path.join(abilityDir, validateFile?.trim() || DEFAULT_VALIDATION_MODULE);

export const resolveValidationModulePathFromLocation = (
  location: TNixeryAbilityLocation,
  def: TNixeryDef,
) => resolveValidationModulePath(location.abilityDir, resolveNixeryOutputSpec(def).validate);

const validationModuleCache = new Map<string, Promise<TNixeryValidationModule>>();

export const loadDefValidationModule = async (
  nixeryRoot: string,
  defId: string,
  validateFile?: string,
): Promise<TNixeryValidationModule> => {
  const location = await resolveNixeryAbilityLocation(nixeryRoot, defId);
  const modulePath = resolveValidationModulePath(location.abilityDir, validateFile);
  const cached = validationModuleCache.get(modulePath);

  if (cached) {
    return cached;
  }

  const loaded = import(pathToFileURL(modulePath).href).then((mod) => {
    if (typeof mod.validateOutput !== 'function') {
      throw new Error(`[nixery] ${modulePath} must export validateOutput`);
    }

    return mod as TNixeryValidationModule;
  });

  validationModuleCache.set(modulePath, loaded);

  return loaded;
};
