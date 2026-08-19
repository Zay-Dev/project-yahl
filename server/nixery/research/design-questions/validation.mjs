import fs from 'node:fs/promises';

const parseGateJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isQuestion = (value) =>
  typeof value === 'object'
  && value !== null
  && typeof value.questionRef === 'string'
  && typeof value.kind === 'string'
  && typeof value.title === 'string';

const isBatch = (value) =>
  typeof value === 'object'
  && value !== null
  && typeof value.batchId === 'string'
  && typeof value.title === 'string'
  && Array.isArray(value.questions)
  && value.questions.every(isQuestion);

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

  if (!Array.isArray(parsed.batches) || parsed.batches.length === 0) {
    return { ok: false, reason: 'batches must be a non-empty array' };
  }

  if (!parsed.batches.every(isBatch)) {
    return { ok: false, reason: 'invalid batch shape' };
  }

  if (typeof parsed.done !== 'boolean') {
    return { ok: false, reason: 'done must be boolean' };
  }

  return { ok: true };
}

export function parseOutput(raw) {
  return parseGateJson(raw) ?? { absent: true };
}
