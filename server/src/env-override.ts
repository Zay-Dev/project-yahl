import fs from 'node:fs';
import path from 'node:path';

import {
  applyOverrideValues,
  buildInitialOverrideContent,
  hashOverrideValues,
  resolveEnvOverridePath,
  statEnvOverridePath,
  stripUnlistedOverrideKeys,
} from '@project-yahl/shared/env/override-keys';

let appliedVersion = '';

const warnDirectoryOverride = (overridePath: string): void => {
  console.warn(
    `[env-override] ${overridePath} is a directory (Docker created one because the bind source was missing). `
    + 'Stop server/worker/code-server, rm -rf that path, touch .env.override, then start again.',
  );
};

const resolveAppEnvFile = (name: string): string | null => {
  const appDir = process.env.OMNIFLEX_APP_DIR?.trim() || 'project-yahl';
  const candidates = [
    path.resolve(process.cwd(), '..', name),
    path.resolve(process.cwd(), name),
    path.join('/omniflex', appDir, name),
  ];

  for (const candidate of candidates) {
    if (statEnvOverridePath(candidate) === 'file') {
      return candidate;
    }
  }

  return null;
};

const readUtf8 = (filePath: string | null): string | null => {
  if (!filePath) {
    return null;
  }

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
};

const seedOverrideFile = (overridePath: string): string => {
  const content = buildInitialOverrideContent(
    readUtf8(resolveAppEnvFile('.env')),
    readUtf8(resolveAppEnvFile('.env.example')),
  );

  fs.mkdirSync(path.dirname(overridePath), { recursive: true });
  fs.writeFileSync(overridePath, content);

  return content;
};

export const getAppliedEnvOverrideVersion = (): string => appliedVersion;

export const resolveCurrentEnvOverride = (): {
  currentVersion: string;
  droppedKeys: string[];
  path: string;
} => {
  const overridePath = resolveEnvOverridePath();
  const kind = statEnvOverridePath(overridePath);

  if (kind === 'directory') {
    warnDirectoryOverride(overridePath);
    return { currentVersion: hashOverrideValues({}), droppedKeys: [], path: overridePath };
  }

  if (kind !== 'file') {
    return { currentVersion: hashOverrideValues({}), droppedKeys: [], path: overridePath };
  }

  const raw = fs.readFileSync(overridePath, 'utf8');
  const stripped = stripUnlistedOverrideKeys(raw);

  return {
    currentVersion: hashOverrideValues(stripped.values),
    droppedKeys: stripped.droppedKeys,
    path: overridePath,
  };
};

export const loadEnvOverrideFile = (): void => {
  const overridePath = resolveEnvOverridePath();
  const kind = statEnvOverridePath(overridePath);

  if (kind === 'directory') {
    warnDirectoryOverride(overridePath);
    appliedVersion = hashOverrideValues({});
    return;
  }

  let raw = kind === 'file' ? fs.readFileSync(overridePath, 'utf8') : '';

  if (kind !== 'file' || raw.trim() === '') {
    try {
      raw = seedOverrideFile(overridePath);
    } catch {
      appliedVersion = hashOverrideValues({});
      return;
    }
  }

  const stripped = stripUnlistedOverrideKeys(raw);

  if (stripped.droppedKeys.length > 0) {
    fs.writeFileSync(overridePath, stripped.content);

    for (const key of stripped.droppedKeys) {
      console.warn(`[env-override] stripped unlisted key ${key} from ${overridePath}`);
    }
  }

  applyOverrideValues(stripped.values);
  appliedVersion = hashOverrideValues(stripped.values);
};
