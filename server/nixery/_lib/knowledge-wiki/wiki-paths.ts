import { sanitizeSegment } from './topic-slug.js';

import { WIKI_RAW_PREFIX } from './content-model.js';

export const WIKI_TOPICS_ROOT = 'topics';

export const WIKI_WHATSAPP_ROOT = 'whatsapp';

export const WIKI_GREETS_ROOT = 'greets';

export const WIKI_LOCALE = 'en';

export const resolveTopicWikiPrefix = (canonical: string): string => {
  const slug = sanitizeSegment(canonical);

  return `${WIKI_TOPICS_ROOT}/${slug}`;
};

export const resolveWhatsAppWikiPrefix = (chatFolder: string): string => {
  const folder = sanitizeSegment(chatFolder);

  return `${WIKI_WHATSAPP_ROOT}/${folder}`;
};

export const resolveWhatsAppWikiPath = (chatFolder: string, page: string): string => {
  const prefix = resolveWhatsAppWikiPrefix(chatFolder);
  const normalizedPage = page
    .trim()
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${prefix}/`), '');

  return `${prefix}/${normalizedPage}`;
};

export const resolveGreetsWikiPrefix = (entity: string): string => {
  const slug = sanitizeSegment(entity);

  return `${WIKI_GREETS_ROOT}/${slug}`;
};

export const resolveGreetsWikiPath = (entity: string, page: string): string => {
  const prefix = resolveGreetsWikiPrefix(entity);
  const normalizedPage = page
    .trim()
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${prefix}/`), '');

  return `${prefix}/${normalizedPage}`;
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
