const TODO_KINDS = new Set([
  'expand_questions',
  'plan_study',
  'elaborate_section',
  'research_source',
]);

const TODO_PRIORITIES = new Set(['high', 'medium', 'low']);

const isCheck = (value) =>
  typeof value === 'object'
  && value !== null
  && typeof value.id === 'string'
  && typeof value.pass === 'boolean'
  && (value.note === undefined || typeof value.note === 'string');

const isTodo = (value) =>
  typeof value === 'object'
  && value !== null
  && typeof value.id === 'string'
  && TODO_KINDS.has(value.kind)
  && TODO_PRIORITIES.has(value.priority)
  && typeof value.summary === 'string'
  && (value.detail === undefined || typeof value.detail === 'string');

export const parseKnowledgeQaReviewResponse = (text) => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? text);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('knowledge-qa-review: response is not an object');
  }

  if (typeof parsed.topic !== 'string' || !parsed.topic.trim()) {
    throw new Error('knowledge-qa-review: topic required');
  }

  if (!Array.isArray(parsed.checks) || !parsed.checks.every(isCheck)) {
    throw new Error('knowledge-qa-review: invalid checks array');
  }

  if (!Array.isArray(parsed.todos) || !parsed.todos.every(isTodo)) {
    throw new Error('knowledge-qa-review: invalid todos array');
  }

  if (parsed.summary !== undefined && typeof parsed.summary !== 'string') {
    throw new Error('knowledge-qa-review: summary must be string when present');
  }

  return {
    checks: parsed.checks,
    ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
    todos: parsed.todos,
    topic: parsed.topic.trim(),
  };
};
