export type TKnowledgeFileExtension = '.json' | '.md';

const STRUCTURED_JSON_KEYS = new Set([
  'analysis',
  'communication_style',
  'constraints',
  'corpus_assessment',
  'facts',
  'goals',
  'identity',
  'learning_contract',
  'meta',
  'onboarding_completed_at',
  'preferences',
  'priorities',
  'sources',
  'study_plan',
  'summary',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isContentWrapper = (value: unknown): value is { content: string } =>
  isRecord(value)
  && typeof value.content === 'string'
  && Object.keys(value).length === 1;

const isProfileSummaryValue = (
  value: unknown,
): value is { agent?: string; mastermind: string } => {
  if (!isRecord(value) || typeof value.mastermind !== 'string') {
    return false;
  }

  const keys = Object.keys(value);

  return keys.every((key) => key === 'mastermind' || key === 'agent')
    && (value.agent === undefined || typeof value.agent === 'string');
};

export const shouldPersistAsMarkdown = (key: string, value: unknown): boolean => {
  if (STRUCTURED_JSON_KEYS.has(key) || key.startsWith('study_')) {
    return false;
  }

  if (isProfileSummaryValue(value) || isContentWrapper(value) || typeof value === 'string') {
    return true;
  }

  if (key.endsWith('_md') || key.endsWith('_summary') || key === 'background_summary') {
    return true;
  }

  return false;
};

export const resolveKnowledgeFileExtension = (
  key: string,
  value: unknown,
  existingExtension?: string,
): TKnowledgeFileExtension => {
  if (existingExtension === '.json' || existingExtension === '.md') {
    return existingExtension;
  }

  return shouldPersistAsMarkdown(key, value) ? '.md' : '.json';
};

const ensureTrailingNewline = (content: string) => (content.endsWith('\n') ? content : `${content}\n`);

export const serializeMarkdownBody = (value: unknown): string => {
  if (typeof value === 'string') {
    return ensureTrailingNewline(value);
  }

  if (isContentWrapper(value)) {
    return ensureTrailingNewline(value.content);
  }

  if (isProfileSummaryValue(value)) {
    if (typeof value.agent === 'string' && value.agent.trim()) {
      return ensureTrailingNewline(`## Mastermind\n\n${value.mastermind}\n\n## Agent\n\n${value.agent}`);
    }

    return ensureTrailingNewline(value.mastermind);
  }

  throw new Error('cannot serialize value as markdown');
};

export const measurePersistPayloadBytes = (
  key: string,
  value: unknown,
  extension: TKnowledgeFileExtension,
): number => {
  if (extension === '.md') {
    return Buffer.byteLength(serializeMarkdownBody(value), 'utf8');
  }

  return Buffer.byteLength(JSON.stringify({ [key]: value }), 'utf8');
};
