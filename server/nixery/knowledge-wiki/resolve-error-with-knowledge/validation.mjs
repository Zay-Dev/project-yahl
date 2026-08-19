import fs from 'node:fs/promises';

const validObservation = (value) =>
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && value.ok === true
  && typeof value.observationId === 'string'
  && value.observationId
  && typeof value.path === 'string'
  && value.path;

const validCitation = (value) =>
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && typeof value.path === 'string'
  && value.path.trim()
  && typeof value.excerpt === 'string'
  && value.excerpt.trim();

export async function validateOutput(ctx) {
  let value;

  try {
    value = JSON.parse(await fs.readFile(ctx.outputPath, 'utf8'));
  } catch {
    return { ok: false, reason: 'output must be valid JSON' };
  }

  if (value?.ok === false) {
    return typeof value.error === 'string' && value.error
      ? { ok: true }
      : { ok: false, reason: 'failed result requires error' };
  }

  if (value?.ok !== true || !validObservation(value.observation)) {
    return { ok: false, reason: 'result requires persisted observation metadata' };
  }

  if (value.status === 'found') {
    if (typeof value.solution !== 'string' || !value.solution.trim()) {
      return { ok: false, reason: 'found result requires solution' };
    }

    if (!Array.isArray(value.citations) || value.citations.length === 0) {
      return { ok: false, reason: 'found result requires citations' };
    }

    return value.citations.every(validCitation)
      ? { ok: true }
      : { ok: false, reason: 'found result has invalid citation' };
  }

  if (value.status !== 'not_found' && value.status !== 'unavailable') {
    return { ok: false, reason: 'status must be found, not_found, or unavailable' };
  }

  if (value.solution !== null || !Array.isArray(value.citations) || value.citations.length !== 0) {
    return { ok: false, reason: `${value.status} result must not include a solution or citations` };
  }

  return typeof value.message === 'string' && value.message.trim()
    ? { ok: true }
    : { ok: false, reason: `${value.status} result requires investigation guidance` };
}
