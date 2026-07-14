import fs from 'node:fs/promises';

const parseGateJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const MIN_MARKDOWN_CHARS = 32;

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

  if (parsed.ok !== true) {
    return { ok: false, reason: 'gate ok must be true' };
  }

  if (typeof parsed.markdown !== 'string' || parsed.markdown.trim().length < MIN_MARKDOWN_CHARS) {
    return { ok: false, reason: 'markdown too short' };
  }

  return { ok: true };
}

export function parseOutput(raw) {
  return parseGateJson(raw) ?? { absent: true };
}
