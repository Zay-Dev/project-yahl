import fs from 'node:fs/promises';

const parseGateJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

  if (typeof parsed.ok !== 'boolean') {
    return { ok: false, reason: 'missing ok boolean' };
  }

  if (parsed.ok === true) {
    if (parsed.paths !== undefined && !Array.isArray(parsed.paths)) {
      return { ok: false, reason: 'paths must be an array when present' };
    }

    if (Array.isArray(parsed.paths) && parsed.paths.some((item) => typeof item !== 'string')) {
      return { ok: false, reason: 'paths must be string entries' };
    }

    return { ok: true };
  }

  if (typeof parsed.error !== 'string' || !parsed.error.trim()) {
    return { ok: false, reason: 'failed gate requires error string' };
  }

  return { ok: true };
}

export function parseOutput(raw) {
  return parseGateJson(raw) ?? { absent: true };
}
