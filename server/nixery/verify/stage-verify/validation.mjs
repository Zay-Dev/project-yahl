import fs from 'node:fs/promises';

const RESUME_ACTIONS = new Set(['rerun', 'edit_answer', 'reask', 'follow_up']);

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

  if (typeof parsed.pass !== 'boolean') {
    return { ok: false, reason: 'missing pass boolean' };
  }

  if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 1) {
    return { ok: false, reason: 'score must be a number from 0 to 1' };
  }

  if (typeof parsed.feedback !== 'string') {
    return { ok: false, reason: 'feedback must be a string' };
  }

  if (parsed.resumeAction !== undefined && !RESUME_ACTIONS.has(parsed.resumeAction)) {
    return { ok: false, reason: 'invalid resumeAction' };
  }

  if (parsed.askUserRef !== undefined && typeof parsed.askUserRef !== 'string') {
    return { ok: false, reason: 'askUserRef must be a string when present' };
  }

  if (parsed.unavailable !== undefined && typeof parsed.unavailable !== 'boolean') {
    return { ok: false, reason: 'unavailable must be a boolean when present' };
  }

  if (parsed.unavailable === true) {
    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';

    return { ok: false, reason: feedback || 'verify unavailable' };
  }

  return { ok: true };
}
