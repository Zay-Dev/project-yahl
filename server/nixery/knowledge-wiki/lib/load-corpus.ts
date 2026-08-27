import {
  getExportTopicStats,
  listExportTopicFiles,
  readExportTopicCorpus,
  shouldUseExportCorpus,
} from './read-export-corpus.js';
import { resolvePagesForNeed } from './resolve-pages-for-need.js';
import { resolveCanonicalTopic } from './topic-registry.js';
import {
  getWikiPageByPath,
  listWikiPagesUnderPrefix,
} from './wiki-client.js';
import {
  resolveTopicWikiPrefix,
  WIKI_LOCALE,
} from './wiki-paths.js';

const formatCorpus = (
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

export const resolveTopicCanonical = async (topic?: string): Promise<string | undefined> => {
  if (!topic?.trim()) {
    return undefined;
  }

  const resolved = await resolveCanonicalTopic({ slug: topic.trim() });

  return resolved.canonical;
};

const loadPrefixCorpus = async (
  prefix: string,
  maxBytes: number,
): Promise<{ corpus: string; source: 'export' }> => {
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
      content: full?.content ?? page.content,
      path: page.path,
    };
  }));

  return {
    corpus: formatCorpus(hydrated, maxBytes),
    source: 'export',
  };
};

export const loadTopicCorpus = async (
  canonical: string,
  options?: { maxBytes?: number },
): Promise<{ corpus: string; source: 'export' }> => {
  const maxBytes = options?.maxBytes ?? 512_000;
  const prefix = resolveTopicWikiPrefix(canonical);

  return loadPrefixCorpus(prefix, maxBytes);
};

export const loadKnowledgeCorpusForNeed = async (
  topic: string | undefined,
  need: string,
  options?: { maxBytes?: number },
): Promise<{ corpus: string; source: 'export' }> => {
  const maxBytes = options?.maxBytes ?? 512_000;

  if (!topic?.trim()) {
    return { corpus: '', source: 'export' };
  }

  const canonical = await resolveTopicCanonical(topic);

  if (!canonical) {
    return { corpus: '', source: 'export' };
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

  if (hydrated.length === 0) {
    return loadTopicCorpus(canonical, { maxBytes });
  }

  return {
    corpus: formatCorpus(hydrated, maxBytes),
    source: 'export',
  };
};

export const listKnowledgeWikiPages = async (topic: string): Promise<Array<{
  page: string;
  pagePath: string;
  source: 'export';
}>> => {
  const canonical = await resolveTopicCanonical(topic);

  if (!canonical) {
    return [];
  }

  const stats = await getExportTopicStats(canonical);

  if (stats.fileCount > 0) {
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
    source: 'export' as const,
  }));
};
