import fs from 'node:fs/promises';

const SCRIPT_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const KINDS = new Set(['js', 'recipe', 'normalize']);

const parseGateJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isStringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const resolveNotesHint = (parsed) => {
  if (typeof parsed.notesHint === 'string' && parsed.notesHint.trim()) {
    return parsed.notesHint.trim();
  }

  if (isStringArray(parsed.reasons)) {
    const fromReasons = parsed.reasons.find((item) => /^notes:\s*/i.test(item.trim()));

    if (fromReasons) {
      return fromReasons.replace(/^notes:\s*/i, '').trim();
    }
  }

  return '';
};

export async function validateOutput(ctx) {
  let raw = '';

  try {
    raw = await fs.readFile(ctx.outputPath, 'utf8');
  } catch {
    return { ok: false, reason: 'output file missing' };
  }

  const parsed = parseGateJson(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid json gate file' };
  }

  if (parsed.action !== 'advise' && parsed.action !== 'skip') {
    return { ok: false, reason: 'action must be advise or skip' };
  }

  if (!isStringArray(parsed.reasons) || parsed.reasons.length === 0) {
    return { ok: false, reason: 'reasons must be a non-empty string array' };
  }

  if (!isStringArray(parsed.existingScripts)) {
    return { ok: false, reason: 'existingScripts must be a string array' };
  }

  if (!resolveNotesHint(parsed)) {
    return { ok: false, reason: 'notesHint must be a non-empty string' };
  }

  if (parsed.action === 'skip') {
    if (parsed.scriptId !== null || parsed.kind !== null || parsed.contract !== null) {
      return { ok: false, reason: 'skip must set scriptId/kind/contract to null' };
    }

    return { ok: true };
  }

  if (typeof parsed.scriptId !== 'string' || !SCRIPT_ID_PATTERN.test(parsed.scriptId)) {
    return { ok: false, reason: 'advise requires valid scriptId' };
  }

  if (typeof parsed.kind !== 'string' || !KINDS.has(parsed.kind)) {
    return { ok: false, reason: 'advise kind must be js|recipe|normalize' };
  }

  if (typeof parsed.contract !== 'string' || !parsed.contract.trim()) {
    return { ok: false, reason: 'advise requires non-empty contract' };
  }

  return { ok: true };
}

export function parseOutput(raw) {
  const parsed = parseGateJson(raw);

  if (!parsed) {
    return {
      action: 'skip',
      scriptId: null,
      kind: null,
      contract: null,
      reasons: ['absent'],
      existingScripts: [],
      notesHint: 'absent',
    };
  }

  const notesHint = resolveNotesHint(parsed);

  return {
    ...parsed,
    notesHint: notesHint || 'absent',
  };
}
