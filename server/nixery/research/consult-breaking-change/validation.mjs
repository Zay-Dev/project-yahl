import fs from 'node:fs/promises';

const parseGateJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isStringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

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

  if (typeof parsed.agree !== 'boolean') {
    return { ok: false, reason: 'missing agree boolean' };
  }

  if (!isStringArray(parsed.reasons) || parsed.reasons.length === 0) {
    return { ok: false, reason: 'reasons must be a non-empty string array' };
  }

  if (!isStringArray(parsed.alternatives)) {
    return { ok: false, reason: 'alternatives must be a string array' };
  }

  return { ok: true };
}

export function parseOutput(raw) {
  return parseGateJson(raw) ?? { agree: false, reasons: ['absent'], alternatives: [] };
}
