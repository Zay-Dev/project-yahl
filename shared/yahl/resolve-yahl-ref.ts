import fs from 'fs';
import path from 'path';

import YAML from 'yaml';

import {
  MAX_YAHL_REF_DEPTH,
  assertSafeYahlRefPath,
  isYahlFragment,
  isYahlLogicRef,
} from './logic';
import type { TYahlFragment, TYahlLogicRef } from './types';
import { validateYahlFragment } from './validate-fragment';

export type TResolveYahlRefOptions = {
  depth?: number;
  label?: string;
  readFile?: (absolutePath: string) => string;
  refsOut?: Record<string, string>;
  taskRoot: string;
};

export const resolveYahlRefPath = (
  ref: string,
  taskRoot: string,
  label = 'logic',
): string => {
  const relative = assertSafeYahlRefPath(ref, label);
  const absolute = path.resolve(taskRoot, relative);
  const root = path.resolve(taskRoot);

  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label}.$ref: path escapes task root`);
  }

  return absolute;
};

export const loadYahlFragmentFromRef = (
  ref: TYahlLogicRef,
  options: TResolveYahlRefOptions,
): TYahlFragment => {
  const label = options.label ?? 'logic';
  const depth = options.depth ?? 0;

  if (depth > MAX_YAHL_REF_DEPTH) {
    throw new Error(`${label}.$ref: max depth ${MAX_YAHL_REF_DEPTH} exceeded`);
  }

  const relative = assertSafeYahlRefPath(ref.$ref, label);
  const absolute = resolveYahlRefPath(relative, options.taskRoot, label);
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
  let text: string;

  try {
    text = readFile(absolute);
  } catch (error) {
    throw new Error(
      `${label}.$ref: failed to read "${relative}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (options.refsOut) {
    options.refsOut[relative] = text;
  }

  let parsed: unknown;

  try {
    parsed = YAML.parse(text);
  } catch (error) {
    throw new Error(
      `${label}.$ref: invalid YAML in "${relative}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return validateYahlFragment(parsed, `${label}($ref:${relative})`, {
    allowNestedLogic: false,
  });
};

export const resolveLogicToFragment = (
  logic: unknown,
  options: TResolveYahlRefOptions,
): TYahlFragment | undefined => {
  if (isYahlLogicRef(logic)) {
    return loadYahlFragmentFromRef(logic, options);
  }

  if (isYahlFragment(logic)) {
    return validateYahlFragment(logic, options.label ?? 'logic', {
      allowNestedLogic: false,
    });
  }

  return undefined;
};
