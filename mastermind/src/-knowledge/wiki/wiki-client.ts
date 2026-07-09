import { config } from '../../config.js';

import { readExportPageByPath } from './read-export-corpus.js';
import { pageTitleFromPath, WIKI_LOCALE } from './wiki-paths.js';

type TGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type TPageRecord = {
  content: string;
  id: number;
  path: string;
  title: string;
  updatedAt?: string;
};

type TResponseResult = {
  errorCode?: number;
  message?: string;
  succeeded: boolean;
};

const wikiConfigured = (): boolean =>
  Boolean(config.wikiGraphqlUrl.trim() && config.wikiApiToken.trim());

export const assertWikiConfigured = (): void => {
  if (!wikiConfigured()) {
    throw new Error('Wiki.js is not configured (WIKI_GRAPHQL_URL and WIKI_API_TOKEN required)');
  }
};

const truncateErrorBody = (body: string, maxLength = 500): string => {
  const trimmed = body.trim();

  if (!trimmed) {
    return '';
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
};

const readResponseText = async (res: Response): Promise<string> => {
  try {
    return await res.text();
  } catch {
    return '';
  }
};

export const buildWikiAncestorPaths = (pagePath: string): string[] => {
  const segments = pagePath
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean);

  if (segments.length <= 1) {
    return [];
  }

  const ancestors: string[] = [];

  for (let index = 1; index < segments.length; index += 1) {
    ancestors.push(segments.slice(0, index).join('/'));
  }

  return ancestors;
};

const wikiGraphql = async <T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  assertWikiConfigured();

  const res = await fetch(config.wikiGraphqlUrl, {
    body: JSON.stringify({ query, variables }),
    headers: {
      Authorization: `Bearer ${config.wikiApiToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const bodyText = await readResponseText(res);

  if (!res.ok) {
    const detail = truncateErrorBody(bodyText);
    throw new Error(`Wiki.js GraphQL HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  const payload = JSON.parse(bodyText) as TGraphqlResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  if (!payload.data) {
    throw new Error('Wiki.js GraphQL returned no data');
  }

  return payload.data;
};

const mapPage = (page: {
  content?: string;
  id?: number;
  path?: string;
  title?: string;
  updatedAt?: string;
} | null | undefined): TPageRecord | null => {
  if (!page?.path || page.id === undefined) {
    return null;
  }

  return {
    content: page.content ?? '',
    id: page.id,
    path: page.path,
    title: page.title ?? pageTitleFromPath(page.path),
    updatedAt: page.updatedAt,
  };
};

const isWikiPageNotFoundError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('This page does not exist');

export const getWikiPageByPath = async (pagePath: string): Promise<TPageRecord | null> => {
  if (!wikiConfigured()) {
    const content = await readExportPageByPath(pagePath);

    if (content === null) {
      return null;
    }

    return {
      content,
      id: 0,
      path: pagePath,
      title: pageTitleFromPath(pagePath),
    };
  }

  try {
    const data = await wikiGraphql<{
      pages: {
        singleByPath: {
          content?: string;
          id?: number;
          path?: string;
          title?: string;
          updatedAt?: string;
        } | null;
      };
    }>(`
      query GetPage($path: String!, $locale: String!) {
        pages {
          singleByPath(path: $path, locale: $locale) {
            id
            path
            title
            content
            updatedAt
          }
        }
      }
    `, { locale: WIKI_LOCALE, path: pagePath });

    return mapPage(data.pages.singleByPath);
  } catch (error) {
    if (isWikiPageNotFoundError(error)) {
      return null;
    }

    throw error;
  }
};

export const listWikiPagesUnderPrefix = async (prefix: string): Promise<TPageRecord[]> => {
  const data = await wikiGraphql<{
    pages: {
      list: Array<{
        content?: string;
        id?: number;
        path?: string;
        title?: string;
        updatedAt?: string;
      }>;
    };
  }>(`
    query ListPages($locale: String!) {
      pages {
        list(locale: $locale) {
          id
          path
          title
          updatedAt
        }
      }
    }
  `, { locale: WIKI_LOCALE });

  const normalizedPrefix = prefix.replace(/^\/+/, '').replace(/\/+$/, '');

  return data.pages.list
    .filter((page) => page.path?.startsWith(`${normalizedPrefix}/`) || page.path === normalizedPrefix)
    .map((page) => mapPage(page))
    .filter((page): page is TPageRecord => page !== null);
};

export const searchWikiPages = async (query: string): Promise<TPageRecord[]> => {
  const data = await wikiGraphql<{
    pages: {
      search: {
        results: Array<{
          id?: string;
          path?: string;
          title?: string;
        }>;
      };
    };
  }>(`
    query SearchPages($query: String!) {
      pages {
        search(query: $query) {
          results {
            id
            path
            title
          }
        }
      }
    }
  `, { query });

  return (data.pages.search.results ?? [])
    .map((page) => mapPage({
      id: page.id ? Number(page.id) : undefined,
      path: page.path,
      title: page.title,
    }))
    .filter((page): page is TPageRecord => page !== null);
};

export const createWikiPage = async (input: {
  content: string;
  pagePath: string;
  title?: string;
}): Promise<TPageRecord> => {
  const data = await wikiGraphql<{
    pages: {
      create: {
        page?: {
          content?: string;
          id?: number;
          path?: string;
          title?: string;
          updatedAt?: string;
        };
        responseResult: TResponseResult;
      };
    };
  }>(`
    mutation CreatePage(
      $content: String!
      $description: String!
      $editor: String!
      $isPublished: Boolean!
      $isPrivate: Boolean!
      $locale: String!
      $path: String!
      $tags: [String]!
      $title: String!
    ) {
      pages {
        create(
          content: $content
          description: $description
          editor: $editor
          isPublished: $isPublished
          isPrivate: $isPrivate
          locale: $locale
          path: $path
          tags: $tags
          title: $title
        ) {
          responseResult {
            succeeded
            message
            errorCode
          }
          page {
            id
            path
            title
            content
            updatedAt
          }
        }
      }
    }
  `, {
    content: input.content,
    description: '',
    editor: 'markdown',
    isPrivate: false,
    isPublished: true,
    locale: WIKI_LOCALE,
    path: input.pagePath,
    tags: [],
    title: input.title ?? pageTitleFromPath(input.pagePath),
  });

  const result = data.pages.create;

  if (!result.responseResult.succeeded) {
    throw new Error(result.responseResult.message ?? 'Wiki.js page create failed');
  }

  const page = mapPage(result.page);

  if (!page) {
    throw new Error('Wiki.js page create returned no page');
  }

  return page;
};

const wikiVariables = (variables: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(variables).filter(([, value]) => value !== undefined));

export const updateWikiPage = async (input: {
  content: string;
  id: number;
  title?: string;
}): Promise<TPageRecord> => {
  const data = await wikiGraphql<{
    pages: {
      update: {
        page?: {
          content?: string;
          id?: number;
          path?: string;
          title?: string;
          updatedAt?: string;
        };
        responseResult: TResponseResult;
      };
    };
  }>(`
    mutation UpdatePage(
      $content: String!
      $description: String!
      $id: Int!
      $title: String
      $editor: String!
      $isPublished: Boolean!
      $isPrivate: Boolean!
      $tags: [String]!
    ) {
      pages {
        update(
          id: $id
          content: $content
          description: $description
          title: $title
          editor: $editor
          isPublished: $isPublished
          isPrivate: $isPrivate
          tags: $tags
        ) {
          responseResult {
            succeeded
            message
            errorCode
          }
          page {
            id
            path
            title
            content
            updatedAt
          }
        }
      }
    }
  `, wikiVariables({
    content: input.content,
    description: '',
    editor: 'markdown',
    id: input.id,
    isPrivate: false,
    isPublished: true,
    tags: [],
    title: input.title,
  }));

  const result = data.pages.update;

  if (!result?.responseResult) {
    throw new Error('Wiki.js page update returned no response');
  }

  if (!result.responseResult.succeeded) {
    throw new Error(result.responseResult.message ?? 'Wiki.js page update failed');
  }

  const page = mapPage(result.page);

  if (!page) {
    throw new Error('Wiki.js page update returned no page');
  }

  return page;
};

export const deleteWikiPage = async (pagePath: string): Promise<boolean> => {
  const existing = await getWikiPageByPath(pagePath);

  if (!existing) {
    return false;
  }

  const data = await wikiGraphql<{
    pages: {
      delete: {
        responseResult: TResponseResult;
      };
    };
  }>(`
    mutation DeletePage($id: Int!) {
      pages {
        delete(id: $id) {
          responseResult {
            succeeded
            message
            errorCode
          }
        }
      }
    }
  `, { id: existing.id });

  const result = data.pages.delete;

  if (!result.responseResult.succeeded) {
    throw new Error(result.responseResult.message ?? 'Wiki.js page delete failed');
  }

  return true;
};

export type TUpsertWikiMode = 'append' | 'create' | 'replace';

export const ensureWikiPageAncestors = async (pagePath: string): Promise<void> => {
  for (const ancestorPath of buildWikiAncestorPaths(pagePath)) {
    const existing = await getWikiPageByPath(ancestorPath);

    if (existing) {
      continue;
    }

    await createWikiPage({
      content: `# ${pageTitleFromPath(ancestorPath)}\n`,
      pagePath: ancestorPath,
    });
  }
};

export const upsertWikiPage = async (input: {
  content: string;
  mode?: TUpsertWikiMode;
  pagePath: string;
  title?: string;
}): Promise<TPageRecord> => {
  const mode = input.mode ?? 'replace';
  const existing = await getWikiPageByPath(input.pagePath);

  if (!existing) {
    await ensureWikiPageAncestors(input.pagePath);

    return createWikiPage({
      content: input.content,
      pagePath: input.pagePath,
      title: input.title,
    });
  }

  const content = mode === 'append'
    ? `${existing.content.trim()}\n\n${input.content.trim()}`.trim()
    : input.content;

  return updateWikiPage({
    content,
    id: existing.id,
    title: input.title ?? existing.title,
  });
};

export { wikiConfigured };
