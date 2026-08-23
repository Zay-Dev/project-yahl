import { WIKI_RAW_PREFIX, WIKI_STUDIES_PREFIX } from './content-model.js';
import { mapKnowledgeKeyToPage } from './knowledge-key-map.js';
import { listKnowledgeWikiPages } from './load-corpus.js';
import { readExportPageByPath } from './read-export-corpus.js';
import { isJsonFenceOnlyContent } from './section-merge.js';
import { getWikiPageByPath } from './wiki-client.js';

export type TTopicWikiIssue =
  | 'orphan_page'
  | 'json_only_wiki'
  | 'missing_overview'
  | 'missing_raw_mirror';

export type TTopicWikiAudit = {
  canonical: string;
  issues: TTopicWikiIssue[];
};

const CANONICAL_ROOT_PAGES = new Set([
  'overview',
  'sources',
  'facts',
  'brief',
  'todo',
]);

const isCanonicalRelativePage = (page: string): boolean => {
  const normalized = page.replace(/^\/+/, '').trim();

  if (!normalized) {
    return false;
  }

  if (CANONICAL_ROOT_PAGES.has(normalized)) {
    return true;
  }

  if (normalized.startsWith(`${WIKI_STUDIES_PREFIX}/`)) {
    return true;
  }

  if (normalized.startsWith(`${WIKI_RAW_PREFIX}/`) || normalized === WIKI_RAW_PREFIX) {
    return true;
  }

  return false;
};

const readPageContent = async (pagePath: string): Promise<string> => {
  const full = await getWikiPageByPath(pagePath);

  if (full?.content) {
    return full.content;
  }

  return (await readExportPageByPath(pagePath)) ?? '';
};

export const auditTopicWiki = async (
  canonical: string,
): Promise<TTopicWikiAudit> => {
  const pages = await listKnowledgeWikiPages(canonical);
  const issues = new Set<TTopicWikiIssue>();
  const pageSet = new Set(pages.map((entry) => entry.page));

  if (!pageSet.has('overview')) {
    issues.add('missing_overview');
  }

  for (const entry of pages) {
    if (entry.page.startsWith(`${WIKI_RAW_PREFIX}/`)) {
      continue;
    }

    const content = await readPageContent(entry.pagePath);

    if (!isCanonicalRelativePage(entry.page)) {
      issues.add('orphan_page');

      if (content && isJsonFenceOnlyContent(content)) {
        issues.add('json_only_wiki');
      }

      continue;
    }

    if (content && isJsonFenceOnlyContent(content) && !entry.page.startsWith(`${WIKI_RAW_PREFIX}/`)) {
      issues.add('json_only_wiki');
    }
  }

  for (const entry of pages) {
    if (!entry.page.startsWith(`${WIKI_RAW_PREFIX}/`)) {
      continue;
    }

    const narrativeKey = entry.page.slice(`${WIKI_RAW_PREFIX}/`.length);

    try {
      const mapping = mapKnowledgeKeyToPage(narrativeKey);

      if (mapping.narrative && mapping.raw) {
        const narrativePage = mapping.page.split('#')[0] ?? mapping.page;

        if (!pageSet.has(narrativePage) && narrativePage !== 'todo') {
          issues.add('missing_raw_mirror');
        }
      }
    } catch {
      // raw-only keys are fine
    }
  }

  return {
    canonical,
    issues: [...issues],
  };
};
