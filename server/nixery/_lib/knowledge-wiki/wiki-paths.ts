import { sanitizeSegment } from './topic-slug.js';

import { WIKI_RAW_PREFIX } from './content-model.js';

export const WIKI_TOPICS_ROOT = 'topics';

export const WIKI_LOCALE = 'en';

export const resolveTopicWikiPrefix = (canonical: string): string => {
  const slug = sanitizeSegment(canonical);

  return `${WIKI_TOPICS_ROOT}/${slug}`;
};

export const resolveExportTopicsRoot = (): string => `${WIKI_LOCALE}/${WIKI_TOPICS_ROOT}`;

export const resolveTopicExportPrefix = (canonical: string): string => {
  const slug = sanitizeSegment(canonical);

  return `${WIKI_LOCALE}/${WIKI_TOPICS_ROOT}/${slug}`;
};

export const resolveExportPagePath = (canonical: string, page: string): string => {
  const topicPrefix = resolveTopicExportPrefix(canonical);
  const normalizedPage = page
    .trim()
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${topicPrefix}/`), '');

  return `${topicPrefix}/${normalizedPage}`;
};

export const resolveWikiPagePath = (canonical: string, page: string): string => {
  const topicPrefix = resolveTopicWikiPrefix(canonical);
  const normalizedPage = page
    .trim()
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${topicPrefix}/`), '');

  return `${topicPrefix}/${normalizedPage}`;
};

export const pageTitleFromPath = (pagePath: string): string => {
  const segment = pagePath.split('/').filter(Boolean).pop() ?? pagePath;

  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const slugifyPageSegment = (input: string): string => sanitizeSegment(input);

export const resolveRawWikiPagePath = (canonical: string, key: string): string =>
  resolveWikiPagePath(canonical, `${WIKI_RAW_PREFIX}/${slugifyPageSegment(key)}`);

export const isRawWikiPagePath = (pagePath: string): boolean =>
  /\/raw(\/|$)/.test(pagePath.replace(/^\/+/, ''));
