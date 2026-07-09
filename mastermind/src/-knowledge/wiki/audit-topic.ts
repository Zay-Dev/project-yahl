import { WIKI_RAW_PREFIX, WIKI_STUDIES_PREFIX } from './content-model.js';
import { mapLegacyKeyToPage } from './legacy-key-map.js';
import { parseJsonFenceFromContent } from './parse-json-fence.js';
import { isJsonFenceOnlyContent } from './section-merge.js';
import { deleteWikiPage, getWikiPageByPath } from './wiki-client.js';
import { resolveTopicWikiPrefix, resolveWikiPagePath } from './wiki-paths.js';
import { listKnowledgeWikiPages, upsertLegacyKnowledgeKey } from './index.js';

export type TTopicWikiIssue =
  | 'orphan_page'
  | 'json_only_wiki'
  | 'missing_overview'
  | 'missing_raw_mirror';

export type TTopicWikiAudit = {
  canonical: string;
  deletedOrphans: string[];
  issues: TTopicWikiIssue[];
  migratedKeys: string[];
  unmigratedOrphans: string[];
  wouldDelete: string[];
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

const legacyKeyFromOrphanPage = (page: string): string | null => {
  const segment = page.split('/').filter(Boolean).pop();

  if (!segment) {
    return null;
  }

  try {
    mapLegacyKeyToPage(segment);

    return segment;
  } catch {
    if (segment.startsWith('study-') || segment.includes('study')) {
      const slug = segment.replace(/\.md$/i, '');

      return `study_${slug.replace(/^study[-_]?/, '')}`;
    }

    return null;
  }
};

const deriveValueForKey = (key: string, content: string): unknown => {
  const parsed = parseJsonFenceFromContent(content);

  if (parsed !== null) {
    return parsed;
  }

  const trimmed = content.trim().replace(/^#[^\n]*\n+/, '').trim();

  if (key === 'background_summary' || key.endsWith('_md') || key.endsWith('_summary')) {
    return { content: trimmed };
  }

  return { content: trimmed };
};

export const auditTopicWiki = async (
  canonical: string,
): Promise<Omit<TTopicWikiAudit, 'deletedOrphans' | 'migratedKeys' | 'wouldDelete' | 'unmigratedOrphans'>> => {
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

    const full = await getWikiPageByPath(entry.pagePath);
    const content = full?.content ?? '';

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
      const mapping = mapLegacyKeyToPage(narrativeKey);

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

export const migrateTopicWiki = async (
  canonical: string,
  options?: { dryRun?: boolean },
): Promise<TTopicWikiAudit> => {
  const dryRun = options?.dryRun !== false;
  const base = await auditTopicWiki(canonical);
  const pages = await listKnowledgeWikiPages(canonical);
  const migratedKeys: string[] = [];
  const deletedOrphans: string[] = [];
  const wouldDelete: string[] = [];
  const unmigratedOrphans: string[] = [];

  const migratePage = async (pagePath: string, key: string, content: string): Promise<boolean> => {
    const value = deriveValueForKey(key, content);

    if (dryRun) {
      migratedKeys.push(key);
      wouldDelete.push(pagePath);

      return true;
    }

    await upsertLegacyKnowledgeKey({ canonical, key, value });
    migratedKeys.push(key);
    await deleteWikiPage(pagePath);
    deletedOrphans.push(pagePath);

    return true;
  };

  for (const entry of pages) {
    const full = await getWikiPageByPath(entry.pagePath);
    const content = full?.content ?? '';

    if (!content.trim()) {
      continue;
    }

    if (!isCanonicalRelativePage(entry.page)) {
      const key = legacyKeyFromOrphanPage(entry.page);

      if (!key) {
        unmigratedOrphans.push(entry.pagePath);
        continue;
      }

      await migratePage(entry.pagePath, key, content);
      continue;
    }

    if (isJsonFenceOnlyContent(content) && !entry.page.startsWith(`${WIKI_RAW_PREFIX}/`)) {
      const key = entry.page.split('/').pop() ?? entry.page;

      try {
        mapLegacyKeyToPage(key);
        await migratePage(entry.pagePath, key, content);
      } catch {
        const segmentKey = legacyKeyFromOrphanPage(entry.page);

        if (segmentKey) {
          await migratePage(entry.pagePath, segmentKey, content);
        }
      }
    }
  }

  return {
    ...base,
    deletedOrphans,
    migratedKeys,
    unmigratedOrphans,
    wouldDelete,
  };
};

export const auditAllTopicWiki = async (): Promise<TTopicWikiAudit[]> => {
  const { listTopicFolderSummaries } = await import('../topic-registry.js');
  const summaries = await listTopicFolderSummaries();

  return Promise.all(summaries.map((summary) => auditTopicWiki(summary.slug)));
};

export const resolveTopicPagePath = (canonical: string, page: string): string =>
  resolveWikiPagePath(canonical, page);

export const topicWikiPrefix = (canonical: string): string =>
  resolveTopicWikiPrefix(canonical);
