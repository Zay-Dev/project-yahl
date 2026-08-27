import fs from 'fs';
import path from 'path';

import YAML from 'yaml';

import {
  MAX_YAHL_REF_DEPTH,
  assertSafeYahlRefPath,
  assertYahlStageRefShell,
  isYahlFragment,
  isYahlLogicRef,
  isYahlStageRefShell,
} from './logic';
import type { TYahlFragment, TYahlLogicRef, TYahlStage } from './types';
import { validateYahlFragment } from './validate-fragment';
import { validateYahlStage } from './validate-stage';
import { STAGE_ID_PATTERN } from './stage-goto';

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

const readRefText = (
  relative: string,
  options: TResolveYahlRefOptions,
  label: string,
): string => {
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

  return text;
};

const parseRefYaml = (text: string, relative: string, label: string): unknown => {
  try {
    return YAML.parse(text);
  } catch (error) {
    throw new Error(
      `${label}.$ref: invalid YAML in "${relative}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
  const text = readRefText(relative, options, label);
  const parsed = parseRefYaml(text, relative, label);

  return validateYahlFragment(parsed, `${label}($ref:${relative})`, {
    allowNestedLogic: false,
  });
};

export const loadYahlStageFromRef = (
  shell: { $ref: string; id?: string },
  options: TResolveYahlRefOptions,
): TYahlStage => {
  const label = options.label ?? 'stage';
  const depth = options.depth ?? 0;

  if (depth > MAX_YAHL_REF_DEPTH) {
    throw new Error(`${label}.$ref: max depth ${MAX_YAHL_REF_DEPTH} exceeded`);
  }

  const relative = assertSafeYahlRefPath(shell.$ref, label);
  const text = readRefText(relative, options, label);
  const parsed = parseRefYaml(text, relative, label);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}($ref:${relative}): expected a YAML stage mapping`);
  }

  const doc = parsed as Record<string, unknown>;

  if (doc.name !== undefined || doc.description !== undefined) {
    throw new Error(`${label}($ref:${relative}): stage file must not set name or description`);
  }

  if (doc.$ref !== undefined) {
    throw new Error(`${label}($ref:${relative}): stage file must not set $ref`);
  }

  if (doc.id !== undefined) {
    if (typeof doc.id !== 'string' || !STAGE_ID_PATTERN.test(doc.id.trim())) {
      throw new Error(`${label}($ref:${relative}).id: must match ${STAGE_ID_PATTERN}`);
    }

    if (shell.id && doc.id.trim() !== shell.id) {
      throw new Error(
        `${label}($ref:${relative}).id: must match shell id "${shell.id}"`,
      );
    }
  }

  const { id: _fileId, ...body } = doc;
  const merged = {
    ...body,
    ...(shell.id ? { id: shell.id } : {}),
  };

  return validateYahlStage(merged, undefined, {
    labelPrefix: `${label}($ref:${relative})`,
  });
};

export const resolveDocumentStageEntries = (
  stages: unknown[],
  options: TResolveYahlRefOptions,
): unknown[] =>
  stages.map((entry, index) => {
    if (!isYahlStageRefShell(entry)) {
      return entry;
    }

    const shell = assertYahlStageRefShell(entry, `stages[${index}]`);

    return loadYahlStageFromRef(shell, {
      ...options,
      depth: (options.depth ?? 0) + 1,
      label: `stages[${index}]`,
    });
  });

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
