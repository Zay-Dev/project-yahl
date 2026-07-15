import fs from 'node:fs/promises';

const TODO_KINDS = new Set([
  'expand_questions',
  'plan_study',
  'elaborate_section',
  'research_source',
]);

const parseGateJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isCheck = (value) =>
  typeof value === 'object'
  && value !== null
  && typeof value.id === 'string'
  && typeof value.pass === 'boolean';

const isTodo = (value) =>
  typeof value === 'object'
  && value !== null
  && typeof value.id === 'string'
  && TODO_KINDS.has(value.kind)
  && typeof value.summary === 'string';

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
    if (!parsed.review || typeof parsed.review !== 'object' || Array.isArray(parsed.review)) {
      return { ok: false, reason: 'success gate requires review object' };
    }

    if (!Array.isArray(parsed.review.checks) || !parsed.review.checks.every(isCheck)) {
      return { ok: false, reason: 'review.checks must be a valid array' };
    }

    if (!Array.isArray(parsed.review.todos) || !parsed.review.todos.every(isTodo)) {
      return { ok: false, reason: 'review.todos must be a valid array' };
    }

    if (typeof parsed.review.topic !== 'string' || !parsed.review.topic.trim()) {
      return { ok: false, reason: 'review.topic required' };
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
