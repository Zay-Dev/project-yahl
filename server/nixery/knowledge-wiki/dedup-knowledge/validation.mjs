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
