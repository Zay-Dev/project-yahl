import { expandTopicSlugs, listTopicFolderSummaries, resolveCanonicalTopic } from '../topic-registry.js';

import { mapLegacyKeyToPage } from './legacy-key-map.js';
import { rawReferenceToMarkdown } from './raw-reference.js';
import {
  getExportTopicStats,
  listExportTopicFiles,
  readExportTopicCorpus,
  shouldUseExportCorpus,
} from './read-export-corpus.js';
import { resolvePagesForNeed } from './resolve-pages-for-need.js';
import { isJsonFenceOnlyContent, mergeWikiSection, parseWikiPageRef } from './section-merge.js';
import {
  shouldWriteRawReference,
  structuredKeyToRawValue,
  structuredKeyToWikiMarkdown,
  wikiSectionTitleForKey,
} from './structured-to-markdown.js';
import {
  getWikiPageByPath,
  listWikiPagesUnderPrefix,
  searchWikiPages,
  upsertWikiPage,
  type TUpsertWikiMode,
} from './wiki-client.js';
import {
  resolveTopicExportPrefix,
  resolveTopicWikiPrefix,
  resolveWikiPagePath,
  slugifyPageSegment,
  WIKI_LOCALE,
} from './wiki-paths.js';

export { wikiConfigured } from './wiki-client.js';
export { resolveTopicExportPrefix, resolveTopicWikiPrefix, resolveWikiPagePath } from './wiki-paths.js';
export { TOPIC_PAGE_LAYOUT, wikiLink, wikiRawLink, WIKI_RAW_PREFIX, WIKI_TOPIC_PAGES } from './content-model.js';
export { resolvePagesForNeed } from './resolve-pages-for-need.js';

const formatGraphqlCorpus = (
  pages: Array<{ content: string; path: string }>,
  maxBytes = 512_000,
): string => {
  const parts: string[] = [];
  let total = 0;

  for (const page of pages) {
    const header = `--- ${page.path} ---\n`;
    const chunk = header + page.content;

    if (total + chunk.length > maxBytes) {
      const remaining = maxBytes - total;

      if (remaining > header.length) {
        parts.push(chunk.slice(0, remaining));
      }

      break;
    }

    parts.push(chunk);
    total += chunk.length;
  }

  return parts.join('\n\n');
};

const loadPrefixCorpus = async (
  prefix: string,
  maxBytes: number,
): Promise<{ corpus: string; source: 'export' | 'graphql' }> => {
  const canonical = prefix.replace(/^topics\//, '').split('/')[0];

  if (canonical) {
    const stats = await getExportTopicStats(canonical);

    if (shouldUseExportCorpus(stats) && stats.fileCount > 0) {
      return {
        corpus: await readExportTopicCorpus(canonical, maxBytes),
        source: 'export',
      };
    }
  }

  const pages = await listWikiPagesUnderPrefix(prefix);
  const hydrated = await Promise.all(pages.map(async (page) => {
    const full = await getWikiPageByPath(page.path);

    return {
      content: full?.content ?? '',
      path: page.path,
    };
  }));

  return {
    corpus: formatGraphqlCorpus(hydrated, maxBytes),
    source: 'graphql',
  };
};

export const loadKnowledgeCorpus = async (
  topic?: string,
  options?: { maxBytes?: number },
): Promise<{ corpus: string; source: 'export' | 'graphql' }> => {
  const maxBytes = options?.maxBytes ?? 512_000;

  if (topic?.trim()) {
    const canonical = await resolveTopicCanonical(topic);

    if (canonical) {
      return loadTopicCorpus(canonical, { maxBytes });
    }
  }

  const summaries = await listTopicFolderSummaries();
  const parts: string[] = [];
  let total = 0;
  let source: 'export' | 'graphql' = 'graphql';

  for (const summary of summaries) {
    const loaded = await loadTopicCorpus(summary.slug, { maxBytes });

    if (total + loaded.corpus.length > maxBytes) {
      break;
    }

    if (loaded.corpus.trim()) {
      parts.push(loaded.corpus);
      total += loaded.corpus.length;
      source = loaded.source;
    }
  }

  return {
    corpus: parts.join('\n\n'),
    source,
  };
};

export const loadKnowledgeCorpusForNeed = async (
  topic: string | undefined,
  need: string,
  options?: { maxBytes?: number },
): Promise<{ corpus: string; source: 'export' | 'graphql' }> => {
  const maxBytes = options?.maxBytes ?? 512_000;

  if (!topic?.trim()) {
    return loadKnowledgeCorpus(topic, options);
  }

  const canonical = await resolveTopicCanonical(topic);

  if (!canonical) {
    return { corpus: '', source: 'graphql' };
  }

  const resolved = resolvePagesForNeed(need, canonical);

  if (resolved.broad) {
    return loadTopicCorpus(canonical, { maxBytes });
  }

  const hydrated: Array<{ content: string; path: string }> = [];

  for (const pagePath of resolved.pagePaths) {
    const exact = await getWikiPageByPath(pagePath);

    if (exact?.content) {
      hydrated.push({ content: exact.content, path: exact.path });
      continue;
    }

    const under = await listWikiPagesUnderPrefix(pagePath);

    for (const listed of under) {
      const full = await getWikiPageByPath(listed.path);

      if (full?.content) {
        hydrated.push({ content: full.content, path: full.path });
      }
    }
  }

  return {
    corpus: formatGraphqlCorpus(hydrated, maxBytes),
    source: 'graphql',
  };
};

export const resolveTopicCanonical = async (topic?: string): Promise<string | undefined> => {
  if (!topic?.trim()) {
    return undefined;
  }

  const resolved = await resolveCanonicalTopic({ slug: topic.trim() });

  return resolved.canonical;
};

export const loadTopicCorpus = async (
  canonical: string,
  options?: { maxBytes?: number },
): Promise<{ corpus: string; source: 'export' | 'graphql' }> => {
  const maxBytes = options?.maxBytes ?? 512_000;
  const prefix = resolveTopicWikiPrefix(canonical);

  return loadPrefixCorpus(prefix, maxBytes);
};

export const loadWikiPageContent = async (
  canonical: string,
  page: string,
): Promise<string | null> => {
  const pagePath = resolveWikiPagePath(canonical, page);
  const graphqlPage = await getWikiPageByPath(pagePath);

  if (graphqlPage?.content) {
    return graphqlPage.content;
  }

  const stats = await getExportTopicStats(canonical);

  if (shouldUseExportCorpus(stats)) {
    const exportFiles = await listExportTopicFiles(canonical);
    const exportPrefix = resolveTopicExportPrefix(canonical);
    const wikiPrefix = resolveTopicWikiPrefix(canonical);
    const suffix = page.replace(/^\/+/, '');
    const match = exportFiles.find((file) => {
      const rel = file.relativePath.replace(/\.md$/i, '');

      return rel.endsWith(`/${suffix}`)
        || rel === `${exportPrefix}/${suffix}`
        || rel === `${wikiPrefix}/${suffix}`
        || rel.endsWith(`/${wikiPrefix}/${suffix}`);
    });

    return match?.content ?? null;
  }

  return null;
};

const upsertWikiPageWithSection = async (input: {
  canonical: string;
  content: string;
  mode?: TUpsertWikiMode;
  page: string;
  section?: string;
  title?: string;
}): Promise<{ pagePath: string; wikiPath: string }> => {
  const { page, section } = parseWikiPageRef(input.page);
  let content = input.content;
  let mode = input.mode ?? 'replace';

  if (section) {
    const existing = await loadWikiPageContent(input.canonical, page);
    const sectionTitle = input.section ?? section;

    content = mergeWikiSection(existing ?? '', sectionTitle, content);
    mode = 'replace';
  }

  return upsertKnowledgeWikiPage({
    canonical: input.canonical,
    content,
    mode,
    page,
    title: input.title,
  });
};

export const upsertKnowledgeWikiPage = async (input: {
  canonical: string;
  content: string;
  mode?: TUpsertWikiMode;
  page: string;
  title?: string;
}): Promise<{ pagePath: string; wikiPath: string }> => {
  const pagePath = resolveWikiPagePath(input.canonical, input.page);
  const page = await upsertWikiPage({
    content: input.content,
    mode: input.mode,
    pagePath,
    title: input.title,
  });

  return {
    pagePath,
    wikiPath: page.path,
  };
};

export const upsertLegacyKnowledgeKey = async (input: {
  canonical: string;
  key: string;
  value: unknown;
}): Promise<{
  key: string;
  page: string;
  pagePath: string;
  quality?: string;
  rawPath?: string;
  wikiPath: string;
}> => {
  const mapping = mapLegacyKeyToPage(input.key);
  let pagePath = '';
  let wikiPath = '';
  let quality: string | undefined;
  let rawPath: string | undefined;

  if (mapping.narrative) {
    const narrative = structuredKeyToWikiMarkdown(input.key, input.value, input.canonical);

    if (narrative) {
      const sectionTitle = mapping.section ?? wikiSectionTitleForKey(input.key);
      const result = await upsertWikiPageWithSection({
        canonical: input.canonical,
        content: narrative,
        mode: mapping.mode,
        page: mapping.section ? `${mapping.page}#${sectionTitle}` : mapping.page,
        section: mapping.section ? sectionTitle : undefined,
      });

      pagePath = result.pagePath;
      wikiPath = result.wikiPath;

      if (isJsonFenceOnlyContent(narrative)) {
        quality = 'json_only';
      }
    }
  }

  if (mapping.raw && shouldWriteRawReference(input.key, input.value)) {
    const rawValue = structuredKeyToRawValue(input.key, input.value);
    const rawContent = rawReferenceToMarkdown(input.key, rawValue);
    const rawPage = `raw/${slugifyPageSegment(input.key)}`;
    const rawResult = await upsertKnowledgeWikiPage({
      canonical: input.canonical,
      content: rawContent,
      mode: 'replace',
      page: rawPage,
    });

    rawPath = rawResult.pagePath;

    if (!pagePath) {
      pagePath = rawResult.pagePath;
      wikiPath = rawResult.wikiPath;
    }
  }

  if (!pagePath) {
    throw new Error(`upsert-knowledge-page: nothing written for key "${input.key}"`);
  }

  return {
    key: input.key,
    page: mapping.page.split('#')[0] ?? mapping.page,
    pagePath,
    quality,
    rawPath,
    wikiPath,
  };
};

export const listKnowledgeWikiPages = async (topic: string): Promise<Array<{
  page: string;
  pagePath: string;
  source: 'export' | 'graphql';
}>> => {
  const canonical = await resolveTopicCanonical(topic);

  if (!canonical) {
    return [];
  }

  const stats = await getExportTopicStats(canonical);

  if (shouldUseExportCorpus(stats) && stats.fileCount > 0) {
    const wikiPrefix = resolveTopicWikiPrefix(canonical);

    return (await listExportTopicFiles(canonical)).map((file) => {
      const withoutExt = file.relativePath.replace(/\.md$/i, '');
      const pagePath = withoutExt.startsWith(`${WIKI_LOCALE}/`)
        ? withoutExt.slice(`${WIKI_LOCALE}/`.length)
        : withoutExt;

      return {
        page: pagePath.replace(`${wikiPrefix}/`, ''),
        pagePath,
        source: 'export' as const,
      };
    });
  }

  const prefix = resolveTopicWikiPrefix(canonical);
  const pages = await listWikiPagesUnderPrefix(prefix);

  return pages.map((page) => ({
    page: page.path.replace(`${prefix}/`, ''),
    pagePath: page.path,
    source: 'graphql' as const,
  }));
};

export const searchKnowledgeWiki = async (query: string, topic?: string) => {
  const pages = await searchWikiPages(query);
  const topicSlugs = topic ? await expandTopicSlugs(topic) : [];
  const prefix = topicSlugs[0] ? resolveTopicWikiPrefix(topicSlugs[0]) : null;

  return pages
    .filter((page) => !prefix || page.path.startsWith(`${prefix}/`) || page.path === prefix)
    .map((page) => ({
      pagePath: page.path,
      title: page.title,
      updatedAt: page.updatedAt,
    }));
};
