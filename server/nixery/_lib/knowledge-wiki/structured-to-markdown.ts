import { serializeMarkdownBody, shouldPersistAsMarkdown } from './knowledge-format.js';

import { wikiLink, wikiRawLink } from './content-model.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bulletList = (items: unknown[]): string => {
  const strings = items
    .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
    .filter(Boolean);

  return strings.length > 0 ? strings.map((item) => `- ${item}`).join('\n') : '- _(none)_';
};

const labelize = (key: string): string =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const profileFields = (record: Record<string, unknown>): string =>
  Object.entries(record)
    .map(([field, fieldValue]) => {
      if (Array.isArray(fieldValue)) {
        return `**${labelize(field)}:**\n${bulletList(fieldValue)}`;
      }

      if (typeof fieldValue === 'string' && fieldValue.trim()) {
        return `**${labelize(field)}:** ${fieldValue.trim()}`;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n\n');

export const structuredKeyToWikiMarkdown = (
  key: string,
  value: unknown,
  canonical: string,
): string | null => {
  if (shouldPersistAsMarkdown(key, value)) {
    return serializeMarkdownBody(value);
  }

  if (key === 'identity' && isRecord(value)) {
    return profileFields(value);
  }

  if (key === 'goals' && isRecord(value)) {
    return profileFields(value);
  }

  if (key === 'preferences' && isRecord(value)) {
    return profileFields(value);
  }

  if (key === 'communication_style' && isRecord(value)) {
    return profileFields(value);
  }

  if (key === 'constraints') {
    const items = Array.isArray(value) ? value : [];

    return bulletList(items);
  }

  if (key === 'priorities') {
    const items = Array.isArray(value) ? value : [];

    return bulletList(items);
  }

  if (key === 'background_summary' && typeof value === 'string') {
    return value.trim();
  }

  if (key === 'open_questions' && isRecord(value) && Array.isArray(value.items)) {
    const items = value.items.filter((item): item is string => typeof item === 'string');

    return [
      bulletList(items),
      '',
      `Raw reference: ${wikiRawLink(canonical, 'open_questions')}`,
    ].join('\n');
  }

  if (key === 'onboarding_completed_at') {
    const stamp = typeof value === 'string' ? value : new Date().toISOString();

    return `Onboarding completed at **${stamp}**.`;
  }

  if (key === 'todo' && isRecord(value)) {
    const summaryMd = typeof value.summaryMd === 'string' ? value.summaryMd.trim() : '';
    const items = Array.isArray(value.items) ? value.items : [];
    const pending = items.filter((item) => isRecord(item) && item.status !== 'done');
    const done = items.filter((item) => isRecord(item) && item.status === 'done');

    if (summaryMd) {
      return summaryMd;
    }

    const formatItem = (item: Record<string, unknown>): string => {
      const kind = typeof item.kind === 'string' ? item.kind : 'task';
      const summary = typeof item.summary === 'string' ? item.summary : '_(untitled)_';
      const priority = typeof item.priority === 'string' ? ` (${item.priority})` : '';

      return `- **${kind}**${priority}: ${summary}`;
    };

    return [
      '# Refresh todo',
      '',
      '## Pending',
      pending.length > 0 ? pending.map((item) => formatItem(item as Record<string, unknown>)).join('\n') : '- _(none)_',
      '',
      '## Done',
      done.length > 0 ? done.map((item) => formatItem(item as Record<string, unknown>)).join('\n') : '- _(none)_',
      '',
      `Raw reference: ${wikiRawLink(canonical, 'todo')}`,
    ].join('\n');
  }

  if (key === 'facts' && isRecord(value) && Array.isArray(value.items)) {
    const lines = value.items
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => {
        const claim = typeof item.claim === 'string' ? item.claim : '_(claim missing)_';
        const sourceUrl = typeof item.sourceUrl === 'string' ? item.sourceUrl : '';

        return sourceUrl ? `- ${claim} ([source](${sourceUrl}))` : `- ${claim}`;
      });

    return lines.length > 0 ? lines.join('\n') : '- _(no facts yet)_';
  }

  if (key === 'analysis' && isRecord(value)) {
    const themes = Array.isArray(value.themes) ? value.themes : [];
    const claims = Array.isArray(value.claims) ? value.claims : [];
    const openQuestions = Array.isArray(value.openQuestions) ? value.openQuestions : [];

    return [
      themes.length > 0 ? `**Themes:**\n${bulletList(themes)}` : '',
      claims.length > 0 ? `**Claims:**\n${bulletList(claims)}` : '',
      openQuestions.length > 0 ? `**Open questions:**\n${bulletList(openQuestions)}` : '',
    ].filter(Boolean).join('\n\n');
  }

  if (key.startsWith('study_') && isRecord(value) && typeof value.studyMd === 'string') {
    const title = typeof value.title === 'string' ? value.title : key;
    const url = typeof value.url === 'string' ? value.url : '';
    const studiedAt = typeof value.studiedAt === 'string' ? value.studiedAt : '';
    const header = [
      url ? `**Source:** [${title}](${url})` : `**Source:** ${title}`,
      studiedAt ? `**Studied:** ${studiedAt}` : '',
      `**Reference:** ${wikiRawLink(canonical, key)}`,
    ].filter(Boolean).join('\n');

    return `${header}\n\n${value.studyMd.trim()}`;
  }

  if (key === 'sources' && Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => {
        const title = typeof item.title === 'string' ? item.title : 'Source';
        const url = typeof item.url === 'string' ? item.url : '';
        const studyKey = typeof item.studyKey === 'string' ? item.studyKey : '';

        if (url && studyKey) {
          return `- [${title}](${url}) — study \`${studyKey}\``;
        }

        if (url) {
          return `- [${title}](${url})`;
        }

        return `- ${title}`;
      })
      .join('\n') || '- _(no sources)_';
  }

  if ((key === 'study_plan' || key === 'corpus_assessment' || key === 'learning_contract' || key === 'meta')
    && isRecord(value)) {
    return Object.entries(value)
      .map(([field, fieldValue]) => {
        if (typeof fieldValue === 'string') {
          return `**${labelize(field)}:** ${fieldValue}`;
        }

        if (Array.isArray(fieldValue)) {
          return `**${labelize(field)}:**\n${bulletList(fieldValue)}`;
        }

        return `**${labelize(field)}:** ${JSON.stringify(fieldValue)}`;
      })
      .join('\n\n');
  }

  if (key === 'summary' && isRecord(value)) {
    const parts: string[] = [];

    if (typeof value.summaryMd === 'string' && value.summaryMd.trim()) {
      parts.push(value.summaryMd.trim());
    }

    if (typeof value.personalizedBriefMd === 'string' && value.personalizedBriefMd.trim()) {
      parts.push(`## Personalized brief\n\n${value.personalizedBriefMd.trim()}`);
    }

    if (parts.length > 0) {
      return parts.join('\n\n');
    }
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return null;
};

export const structuredKeyToRawValue = (key: string, value: unknown): unknown => {
  if (key.startsWith('study_') && isRecord(value)) {
    const { studyMd: _studyMd, ...metadata } = value;

    return metadata;
  }

  return value;
};

export const shouldWriteRawReference = (key: string, value: unknown): boolean => {
  if (key.endsWith('_md') || key === 'background_summary') {
    return false;
  }

  if (shouldPersistAsMarkdown(key, value) && !key.startsWith('study_')) {
    return key === 'user_profile_summary' || key === 'summary';
  }

  if (key === 'open_questions_qa' || /^stage\d+_qa$/.test(key)) {
    return true;
  }

  if (key.startsWith('study_') || key === 'facts' || key === 'analysis') {
    return true;
  }

  const structuredProfileKeys = new Set([
    'communication_style',
    'constraints',
    'goals',
    'identity',
    'onboarding_completed_at',
    'open_questions',
    'preferences',
    'priorities',
    'sources',
    'study_plan',
    'corpus_assessment',
    'learning_contract',
    'meta',
    'todo',
    'user_profile_summary',
    'summary',
  ]);

  return structuredProfileKeys.has(key);
};

export const wikiSectionTitleForKey = (key: string): string => {
  const titles: Record<string, string> = {
    communication_style: 'Communication style',
    constraints: 'Constraints',
    goals: 'Goals & priorities',
    identity: 'Identity & background',
    onboarding_completed_at: 'Status',
    open_questions: 'Open questions',
    preferences: 'Preferences',
    priorities: 'Priorities',
  };

  return titles[key] ?? labelize(key);
};
