import fs from 'node:fs/promises';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isNonEmptyStringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());

const isValidSource = (source) =>
  source
  && typeof source === 'object'
  && typeof source.url === 'string'
  && source.url.trim()
  && typeof source.priority === 'string'
  && typeof source.rounds === 'number'
  && source.rounds >= 1
  && source.rounds <= 3;

const isValidPage = (page) => {
  if (!page || typeof page !== 'object') {
    return false;
  }

  const pagePath = typeof page.path === 'string' ? page.path.trim() : '';

  if (!pagePath || !SLUG_PATTERN.test(pagePath)) {
    return false;
  }

  if (pagePath.startsWith('raw') || pagePath.startsWith('studies')) {
    return false;
  }

  if (page.origin !== 'suggested' && page.origin !== 'custom') {
    return false;
  }

  if (page.action !== 'populate' && page.action !== 'skip' && page.action !== 'defer') {
    return false;
  }

  return true;
};

export async function validateOutput(ctx) {
  let raw = '';

  try {
    raw = await fs.readFile(ctx.outputPath, 'utf8');
  } catch {
    return { ok: false, reason: 'output file missing' };
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'output is not valid JSON' };
  }

  const studyPlan = parsed?.study_plan;
  const wikiStructure = parsed?.wiki_structure;

  if (!studyPlan || typeof studyPlan !== 'object') {
    return { ok: false, reason: 'missing study_plan' };
  }

  if (!isNonEmptyStringArray(studyPlan.researchQuestions)) {
    return { ok: false, reason: 'study_plan.researchQuestions must be a non-empty string array' };
  }

  if (!isNonEmptyStringArray(studyPlan.successCriteria)) {
    return { ok: false, reason: 'study_plan.successCriteria must be a non-empty string array' };
  }

  if (!Array.isArray(studyPlan.sources)) {
    return { ok: false, reason: 'study_plan.sources must be an array' };
  }

  if (!studyPlan.sources.every(isValidSource)) {
    return { ok: false, reason: 'study_plan.sources entries need url, priority, rounds (1-3)' };
  }

  if (!wikiStructure || typeof wikiStructure !== 'object') {
    return { ok: false, reason: 'missing wiki_structure' };
  }

  if (!Array.isArray(wikiStructure.pages) || wikiStructure.pages.length === 0) {
    return { ok: false, reason: 'wiki_structure.pages must be a non-empty array' };
  }

  if (!wikiStructure.pages.every(isValidPage)) {
    return { ok: false, reason: 'invalid wiki_structure.pages entry' };
  }

  const overviewPopulate = wikiStructure.pages.some(
    (page) => page.path === 'overview' && page.action === 'populate',
  );

  if (!overviewPopulate) {
    return { ok: false, reason: 'wiki_structure must include overview with action populate' };
  }

  return { ok: true };
}
