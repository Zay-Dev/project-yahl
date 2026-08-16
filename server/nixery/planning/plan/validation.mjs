import fs from 'node:fs/promises';

const MIN_OUTPUT_CHARS = 32;
const PLAN_HEADING = '# Plan';

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

  if (!raw.includes(PLAN_HEADING)) {
    return { ok: false, reason: 'missing # Plan heading' };
  }

  if (!/^##\s+Steps/m.test(raw)) {
    return { ok: false, reason: 'missing ## Steps section' };
  }

  return { ok: true };
}
