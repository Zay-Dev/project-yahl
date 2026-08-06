export const WIKI_REQUIRED_PAGES = {
  overview: 'Overview — living narrative; merge on refresh, not wholesale replace',
} as const;

export const WIKI_SUGGESTED_PAGES = {
  brief: 'Brief — personalized summary for the user',
  facts: 'Facts — structured key facts and analysis artifacts',
  sources: 'Sources — seed URLs, study plan, corpus assessment',
  todo: 'Todo — refresh backlog for knowledge_refresh pickup',
} as const;

export const WIKI_TOPIC_PAGES = {
  ...WIKI_REQUIRED_PAGES,
  ...WIKI_SUGGESTED_PAGES,
} as const;

export const WIKI_STUDIES_PREFIX = 'studies';

export const WIKI_RAW_PREFIX = 'raw';

export const WIKI_OBSERVATIONS_PREFIX = 'raw/observations';

export const wikiLink = (canonical: string, page: string): string =>
  `[[topics/${canonical}/${page}]]`;

export const wikiRawLink = (canonical: string, key: string): string =>
  `[[topics/${canonical}/${WIKI_RAW_PREFIX}/${key}]]`;

export const formatSuggestedPagesForPrompt = (): string =>
  Object.entries(WIKI_SUGGESTED_PAGES)
    .map(([slug, desc]) => `- **${slug}** — ${desc}`)
    .join('\n');

export const formatRequiredPagesForPrompt = (): string =>
  Object.entries(WIKI_REQUIRED_PAGES)
    .map(([slug, desc]) => `- **${slug}** — ${desc}`)
    .join('\n');

export const TOPIC_PAGE_LAYOUT = [
  'topics/{slug}/overview',
  'topics/{slug}/sources',
  'topics/{slug}/studies/{study-slug}',
  'topics/{slug}/facts',
  'topics/{slug}/brief',
  'topics/{slug}/todo',
  `topics/{slug}/${WIKI_RAW_PREFIX}/{key}`,
  `topics/{slug}/${WIKI_OBSERVATIONS_PREFIX}/{YYYY-MM-DD}/{id}`,
] as const;
