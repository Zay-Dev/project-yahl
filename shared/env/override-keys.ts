import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const OVERRIDABLE_ENV_KEYS = [
  'WHATSAPP_ENABLED',
  'WHATSAPP_WHITELIST',
  'EMAIL_WHITELIST',
  'SYSTEM_ADMIN_EMAIL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_SECURE',
] as const;

export type TOverridableEnvKey = (typeof OVERRIDABLE_ENV_KEYS)[number];

export const isOverridableEnvKey = (key: string): key is TOverridableEnvKey =>
  (OVERRIDABLE_ENV_KEYS as readonly string[]).includes(key);

const ASSIGN_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

export const resolveEnvOverridePath = (): string => {
  const fromEnv = process.env.ENV_OVERRIDE_PATH?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  const hostRoot = process.env.HOST_REPO_ROOT?.trim();

  if (hostRoot) {
    return path.join(hostRoot, '.env.override');
  }

  return path.resolve(process.cwd(), '..', '.env.override');
};

export const statEnvOverridePath = (overridePath: string): 'directory' | 'file' | 'missing' => {
  try {
    const stat = fs.statSync(overridePath);

    if (stat.isFile()) {
      return 'file';
    }

    if (stat.isDirectory()) {
      return 'directory';
    }
  } catch {
    return 'missing';
  }

  return 'missing';
};

const parseAssignmentValue = (raw: string): string => {
  const trimmed = raw.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
    || (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }

  const commentIndex = trimmed.indexOf(' #');

  if (commentIndex >= 0) {
    return trimmed.slice(0, commentIndex).trim();
  }

  return trimmed;
};

const COMMENT_ASSIGN_RE = /^\s*#\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

export const parseOverridableAssignments = (
  raw: string,
  options?: { includeCommented?: boolean },
): Partial<Record<TOverridableEnvKey, string>> => {
  const values: Partial<Record<TOverridableEnvKey, string>> = {};
  const commented: Partial<Record<TOverridableEnvKey, string>> = {};

  for (const line of raw.split(/\r?\n/)) {
    const active = line.match(ASSIGN_RE);

    if (active && isOverridableEnvKey(active[1])) {
      values[active[1]] = parseAssignmentValue(active[2] ?? '');
      continue;
    }

    if (!options?.includeCommented) {
      continue;
    }

    const comment = line.match(COMMENT_ASSIGN_RE);

    if (comment && isOverridableEnvKey(comment[1])) {
      commented[comment[1]] = parseAssignmentValue(comment[2] ?? '');
    }
  }

  if (!options?.includeCommented) {
    return values;
  }

  for (const key of OVERRIDABLE_ENV_KEYS) {
    if (values[key] === undefined && commented[key] !== undefined) {
      values[key] = commented[key];
    }
  }

  return values;
};

export const buildInitialOverrideContent = (
  envRaw: string | null,
  exampleRaw: string | null,
): string => {
  const fromEnv = envRaw ? parseOverridableAssignments(envRaw) : {};
  const fromExample = exampleRaw
    ? parseOverridableAssignments(exampleRaw, { includeCommented: true })
    : {};

  return `${OVERRIDABLE_ENV_KEYS.map((key) => `${key}=${fromEnv[key] ?? fromExample[key] ?? ''}`).join('\n')}\n`;
};

export const stripUnlistedOverrideKeys = (raw: string): {
  content: string;
  droppedKeys: string[];
  values: Partial<Record<TOverridableEnvKey, string>>;
} => {
  const droppedKeys: string[] = [];
  const values: Partial<Record<TOverridableEnvKey, string>> = {};
  const kept: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(ASSIGN_RE);

    if (!match) {
      kept.push(line);
      continue;
    }

    const key = match[1];

    if (!isOverridableEnvKey(key)) {
      droppedKeys.push(key);
      continue;
    }

    values[key] = parseAssignmentValue(match[2] ?? '');
    kept.push(line);
  }

  return {
    content: kept.join('\n'),
    droppedKeys,
    values,
  };
};

export const hashOverrideValues = (
  values: Partial<Record<TOverridableEnvKey, string>>,
): string => {
  const entries = Object.entries(values)
    .filter((entry): entry is [TOverridableEnvKey, string] =>
      isOverridableEnvKey(entry[0]) && typeof entry[1] === 'string')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);

  return createHash('sha256').update(entries.join('\n')).digest('hex').slice(0, 16);
};

export const applyOverrideValues = (
  values: Partial<Record<TOverridableEnvKey, string>>,
): void => {
  for (const [key, value] of Object.entries(values)) {
    if (!isOverridableEnvKey(key) || value === undefined) {
      continue;
    }

    process.env[key] = value;
  }
};
