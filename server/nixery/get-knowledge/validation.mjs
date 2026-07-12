import fs from 'node:fs/promises';

const MIN_OUTPUT_CHARS = 32;

export async function validateOutput(ctx) {
  let raw = '';

  try {
    raw = await fs.readFile(ctx.outputPath, 'utf8');
  } catch {
    return { ok: false, reason: 'output file missing' };
  }

  if (raw.trim().length < MIN_OUTPUT_CHARS) {
    return { ok: false, reason: 'output too short' };
  }

  return { ok: true };
}
