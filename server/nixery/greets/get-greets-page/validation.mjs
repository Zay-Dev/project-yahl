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

  if (parsed.ok !== true || !parsed.pagePath || !parsed.markdown) {
    return { ok: false, reason: parsed.error ?? 'get-greets-page failed' };
  }

  if (typeof parsed.absent !== 'boolean') {
    return { ok: false, reason: 'absent flag missing' };
  }

  return { ok: true };
}
