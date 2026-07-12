import fs from 'node:fs/promises';
import path from 'node:path';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TStorage } from '@/shared/transports/-types';

import { wrapVmLogic } from '@/agent/condition-branch';
import { runScript } from '@/agent/-utils/vm-client';
import { sessionWorkspaceRoot } from '@/orchestrator/-utils/workspace-paths';
import { shouldApplySetContext } from '@/orchestrator/-context/stage-field-policy';

const READ_CALL_RE = /\(\*read\(([^)]+)\)\)/g;

const STRING_CONST_RE = /const\s+(\w+)\s*=\s*(['"])(.*?)\2\s*;/g;

const extractStringConsts = (logic: string) => {
  const result = new Map<string, string>();

  for (const match of logic.matchAll(STRING_CONST_RE)) {
    const name = match[1]?.trim();
    const value = match[3]?.trim();

    if (name && value) {
      result.set(name, value);
    }
  }

  return result;
};

const resolveReadPath = (arg: string, consts: Map<string, string>) => {
  const trimmed = arg.trim();
  const quoted = trimmed.match(/^(['"])(.+)\1$/);

  if (quoted) {
    return quoted[2];
  }

  return consts.get(trimmed);
};

const resolveSessionPath = (sessionId: string, input: string) => {
  const trimmed = input.trim();

  if (trimmed.startsWith('~/')) {
    return path.join(sessionWorkspaceRoot(sessionId), trimmed.slice(2));
  }

  if (trimmed === '~') {
    return sessionWorkspaceRoot(sessionId);
  }

  return trimmed;
};

const readSessionJson = async (sessionId: string, inputPath: string) => {
  const absolute = resolveSessionPath(sessionId, inputPath);

  try {
    const raw = await fs.readFile(absolute, 'utf8');

    return JSON.parse(raw) as unknown;
  } catch {
    return { absent: true };
  }
};

const inlineNixeryReads = async (sessionId: string, logic: string) => {
  const consts = extractStringConsts(logic);
  const matches = [...logic.matchAll(READ_CALL_RE)];

  if (matches.length === 0) {
    return logic;
  }

  let result = logic;

  for (const match of matches) {
    const filePath = resolveReadPath(match[1] ?? '', consts);

    if (!filePath) {
      continue;
    }

    const payload = await readSessionJson(sessionId, filePath);
    const literal = JSON.stringify(payload);

    result = result.replace(match[0], literal);
  }

  return result;
};

export const isNixeryReadStage = (stage: ParsedStage) => {
  const spec = stage.spec;

  if (spec.nixeryRun || spec.contextMode || spec.conditionMode || spec.planMode) {
    return false;
  }

  if (!stage.produceContextKeys?.length) {
    return false;
  }

  const logic = spec.logic;

  if (!logic.includes('~/nixery/') || !logic.includes('*read(')) {
    return false;
  }

  if (/\/mastermind\s*\(/.test(logic) || /\/ask-user\s*\(/.test(logic)) {
    return false;
  }

  return true;
};

export const runNixeryReadStage = async (params: {
  sessionId: string;
  stage: ParsedStage;
  storage: TStorage;
}) => {
  const inlined = await inlineNixeryReads(params.sessionId, params.stage.spec.logic);
  const produceKeys = params.stage.produceContextKeys ?? [];
  const script = produceKeys.length > 0
    ? wrapVmLogic(
      `(() => {\n${inlined}\nreturn { ${produceKeys.join(', ')} };\n});`,
    )
    : wrapVmLogic(inlined);
  const output = await runScript(
    script,
    params.storage,
  );
  const values = output && typeof output === 'object' && !Array.isArray(output)
    ? output as Record<string, unknown>
    : {};

  for (const [key, value] of Object.entries(values)) {
    if (!shouldApplySetContext(key, params.stage)) {
      continue;
    }

    params.storage.context.set(key, value);
  }

  return params.storage;
};
