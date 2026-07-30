import { mapKnowledgeKeyToPage } from './knowledge-key-map.js';
import { rawReferenceToMarkdown } from './raw-reference.js';
import {
  isJsonFenceOnlyContent,
  mergeWikiSection,
  parseWikiPageRef,
} from './section-merge.js';
import {
  shouldWriteRawReference,
  structuredKeyToRawValue,
  structuredKeyToWikiMarkdown,
  wikiSectionTitleForKey,
} from './structured-to-markdown.js';
import { resolveTopicForPersist } from './topic-persist.js';
import {
  hasPathArgs,
  normalizePersistKnowledgeValue,
  validatePersistKnowledgeValue,
  validatePersistPayloadSize,
} from './validate-persist.js';
import {
  getWikiPageByPath,
  upsertWikiPage,
  wikiConfigured,
  type TUpsertWikiMode,
} from './wiki-client.js';
import {
  resolveWikiPagePath,
  slugifyPageSegment,
} from './wiki-paths.js';

export type TUpsertKnowledgePageInput = {
  content?: string;
  key?: string;
  mode?: TUpsertWikiMode;
  page?: string;
  seedUrls?: string[];
  title?: string;
  topic?: string;
  topicText?: string;
  value?: unknown;
};

export type TUpsertKnowledgePageResult = {
  absolutePath: string;
  canonicalTopic: string;
  key?: string;
  ok: true;
  page?: string;
  pagePath: string;
  path: string;
  quality?: string;
  rawPath?: string;
  redirectedFrom?: string;
  relativePath: string;
  wikiPath: string;
};

export type TUpsertKnowledgePageError = {
  error: string;
  ok: false;
};

const toPageContent = (content: string | undefined, value: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

const loadWikiPageContent = async (
  canonical: string,
  page: string,
): Promise<string | null> => {
  const pagePath = resolveWikiPagePath(canonical, page);
  const graphqlPage = await getWikiPageByPath(pagePath);

  return graphqlPage?.content ?? null;
};

const upsertKnowledgeWikiPage = async (input: {
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

const upsertKnowledgeKey = async (input: {
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
  const mapping = mapKnowledgeKeyToPage(input.key);
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

export const runUpsertKnowledgePage = async (
  args: TUpsertKnowledgePageInput,
): Promise<TUpsertKnowledgePageResult | TUpsertKnowledgePageError> => {
  if (hasPathArgs(args as Record<string, unknown>)) {
    return { ok: false, error: 'upsert-knowledge-page does not accept file paths' };
  }

  const topic = typeof args.topic === 'string' ? args.topic.trim() : undefined;
  const topicText = typeof args.topicText === 'string' ? args.topicText.trim() : undefined;
  const seedUrls = Array.isArray(args.seedUrls)
    ? args.seedUrls.filter((url): url is string => typeof url === 'string')
    : undefined;
  const key = typeof args.key === 'string' ? args.key.trim() : '';
  const page = typeof args.page === 'string' ? args.page.trim() : '';
  const content = typeof args.content === 'string' ? args.content : undefined;
  const mode = args.mode === 'append' || args.mode === 'create' || args.mode === 'replace'
    ? args.mode
    : undefined;

  if (!wikiConfigured()) {
    return {
      error: 'Wiki.js not configured (WIKI_API_TOKEN required)',
      ok: false,
    };
  }

  if (!topic && !topicText) {
    return {
      error: 'upsert-knowledge-page requires topic or topicText',
      ok: false,
    };
  }

  let normalizedValue: unknown;

  if (key) {
    const rawValue = args.value !== undefined
      ? args.value
      : (content !== undefined ? content : undefined);

    if (rawValue === undefined) {
      return { ok: false, error: 'upsert-knowledge-page requires value when key is set' };
    }

    normalizedValue = normalizePersistKnowledgeValue(key, rawValue);
    const shapeError = validatePersistKnowledgeValue(key, normalizedValue);

    if (shapeError) {
      return { ok: false, error: shapeError };
    }

    const sizeError = validatePersistPayloadSize(key, normalizedValue);

    if (sizeError) {
      return { ok: false, error: sizeError };
    }
  } else if (!page || (content === undefined && args.value === undefined)) {
    return { ok: false, error: 'upsert-knowledge-page requires page+content or key+value' };
  }

  try {
    const resolved = await resolveTopicForPersist({ seedUrls, topic, topicText });
    const canonicalTopic = resolved.canonical;

    if (key) {
      const written = await upsertKnowledgeKey({
        canonical: canonicalTopic,
        key,
        value: normalizedValue,
      });

      return {
        absolutePath: written.pagePath,
        canonicalTopic,
        key,
        ok: true,
        page: written.page,
        pagePath: written.pagePath,
        path: written.pagePath,
        relativePath: written.pagePath,
        wikiPath: written.wikiPath,
        ...(written.rawPath ? { rawPath: written.rawPath } : {}),
        ...(written.quality ? { quality: written.quality } : {}),
        ...(topic && topic !== canonicalTopic ? { redirectedFrom: topic } : {}),
      };
    }

    const written = await upsertKnowledgeWikiPage({
      canonical: canonicalTopic,
      content: toPageContent(content, args.value),
      mode,
      page,
      title: typeof args.title === 'string' ? args.title : undefined,
    });

    return {
      absolutePath: written.pagePath,
      canonicalTopic,
      ok: true,
      page,
      pagePath: written.pagePath,
      path: written.pagePath,
      relativePath: written.pagePath,
      wikiPath: written.wikiPath,
      ...(topic && topic !== canonicalTopic ? { redirectedFrom: topic } : {}),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'upsert-knowledge-page failed',
      ok: false,
    };
  }
};
