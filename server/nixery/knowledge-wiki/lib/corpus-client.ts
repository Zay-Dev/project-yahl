import fs from 'fs/promises';
import path from 'path';

import { readKnowledgeWikiConfig } from './config.js';

import { stripYamlFrontmatter } from './read-export-corpus.js';
import { pageTitleFromPath, WIKI_LOCALE } from './wiki-paths.js';

export type TPageRecord = {
  content: string;
  id: number;
  path: string;
  title: string;
  updatedAt?: string;
};

export type TUpsertWikiMode = 'append' | 'create' | 'replace';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

const exportRoot = (): string => path.resolve(readKnowledgeWikiConfig().knowledgeExportRoot);

const corpusWriteError = (root: string, error: unknown): Error => {
  const detail = error instanceof Error ? error.message : String(error);

  return new Error(
    `knowledge corpus not writable at ${root} (check nixery mount mode and host data/knowledge_export): ${detail}`,
  );
};

const ensureExportRoot = async (): Promise<void> => {
  const root = exportRoot();

  try {
    await fs.mkdir(root, { recursive: true });
  } catch (error) {
    throw corpusWriteError(root, error);
  }
};

export const corpusConfigured = (): boolean =>
  Boolean(readKnowledgeWikiConfig().knowledgeExportRoot.trim());

export const wikiConfigured = corpusConfigured;

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

const normalizeLogicalPath = (pagePath: string): string =>
  pagePath.replace(/^\/+/, '').replace(/\/+$/, '').trim();

const logicalPathFromRelative = (relativePath: string): string => {
  let normalized = relativePath.replace(/\\/g, '/');

  if (MARKDOWN_EXTENSIONS.has(path.extname(normalized).toLowerCase())) {
    normalized = normalized.slice(0, -path.extname(normalized).length);
  }

  if (normalized.startsWith(`${WIKI_LOCALE}/`)) {
    normalized = normalized.slice(`${WIKI_LOCALE}/`.length);
  }

  return normalized;
};

const writeRelativePath = (logicalPath: string): string => {
  const normalized = normalizeLogicalPath(logicalPath);

  return `${WIKI_LOCALE}/${normalized}.md`;
};

const readCandidateRelatives = (logicalPath: string): string[] => {
  const normalized = normalizeLogicalPath(logicalPath);
  const withExt = normalized.endsWith('.md') ? normalized : `${normalized}.md`;
  const candidates = new Set<string>();

  candidates.add(writeRelativePath(normalized));
  candidates.add(withExt);

  if (!withExt.startsWith(`${WIKI_LOCALE}/`)) {
    candidates.add(`${WIKI_LOCALE}/${withExt}`);
  }

  return [...candidates];
};

const resolveAbsolute = (relativePath: string): string | null => {
  const root = exportRoot();
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolute = path.join(root, normalized);
  const rel = path.relative(root, absolute);

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }

  return absolute;
};

const walkMarkdownRelatives = async (
  dir: string,
  baseDir: string,
  results: string[],
): Promise<void> => {
  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walkMarkdownRelatives(absolute, baseDir, results);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();

    if (!MARKDOWN_EXTENSIONS.has(ext)) {
      continue;
    }

    results.push(path.relative(baseDir, absolute));
  }
};

const mapPageRecord = (input: {
  absolute: string;
  content: string;
  logicalPath: string;
}): TPageRecord => ({
  content: input.content,
  id: 0,
  path: input.logicalPath,
  title: pageTitleFromPath(input.logicalPath),
});

export const getWikiPageByPath = async (pagePath: string): Promise<TPageRecord | null> => {
  for (const relative of readCandidateRelatives(pagePath)) {
    const absolute = resolveAbsolute(relative);

    if (!absolute) {
      continue;
    }

    try {
      const raw = await fs.readFile(absolute, 'utf8');
      const logical = logicalPathFromRelative(relative);
      const stat = await fs.stat(absolute);

      return {
        ...mapPageRecord({
          absolute,
          content: stripYamlFrontmatter(raw),
          logicalPath: logical,
        }),
        updatedAt: stat.mtime.toISOString(),
      };
    } catch {
      // try next candidate
    }
  }

  return null;
};

export const listWikiPagesUnderPrefix = async (prefix: string): Promise<TPageRecord[]> => {
  const normalizedPrefix = normalizeLogicalPath(prefix);
  const root = exportRoot();
  const relatives: string[] = [];

  await walkMarkdownRelatives(root, root, relatives);

  const pages: TPageRecord[] = [];

  for (const relative of relatives) {
    const logical = logicalPathFromRelative(relative);

    if (logical !== normalizedPrefix && !logical.startsWith(`${normalizedPrefix}/`)) {
      continue;
    }

    const page = await getWikiPageByPath(logical);

    if (page) {
      pages.push(page);
    }
  }

  return pages.sort((left, right) => left.path.localeCompare(right.path));
};

export const searchWikiPages = async (query: string): Promise<TPageRecord[]> => {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return [];
  }

  const pages = await listWikiPagesUnderPrefix('');

  return pages.filter((page) =>
    page.path.toLowerCase().includes(needle)
    || page.title.toLowerCase().includes(needle)
    || page.content.toLowerCase().includes(needle));
};

const writePageFile = async (
  logicalPath: string,
  content: string,
  title?: string,
): Promise<TPageRecord> => {
  const relative = writeRelativePath(logicalPath);
  const absolute = resolveAbsolute(relative);

  if (!absolute) {
    throw new Error(`invalid knowledge page path: ${logicalPath}`);
  }

  await ensureExportRoot();

  try {
    await fs.mkdir(path.dirname(absolute), { recursive: true });
  } catch (error) {
    throw corpusWriteError(exportRoot(), error);
  }

  await fs.writeFile(absolute, content, 'utf8');

  const stat = await fs.stat(absolute);
  const logical = logicalPathFromRelative(relative);

  return {
    content,
    id: 0,
    path: logical,
    title: title ?? pageTitleFromPath(logical),
    updatedAt: stat.mtime.toISOString(),
  };
};

export const createWikiPage = async (input: {
  content: string;
  pagePath: string;
  title?: string;
}): Promise<TPageRecord> => {
  const existing = await getWikiPageByPath(input.pagePath);

  if (existing) {
    throw new Error(`knowledge page already exists: ${input.pagePath}`);
  }

  return writePageFile(input.pagePath, input.content, input.title);
};

export const updateWikiPage = async (input: {
  content: string;
  id: number;
  pagePath: string;
  title?: string;
}): Promise<TPageRecord> =>
  writePageFile(input.pagePath, input.content, input.title);

export const deleteWikiPage = async (pagePath: string): Promise<boolean> => {
  const existing = await getWikiPageByPath(pagePath);

  if (!existing) {
    return false;
  }

  for (const relative of readCandidateRelatives(pagePath)) {
    const absolute = resolveAbsolute(relative);

    if (!absolute) {
      continue;
    }

    try {
      await fs.unlink(absolute);
      await pruneEmptyParents(path.dirname(absolute), exportRoot());

      return true;
    } catch {
      // try next candidate
    }
  }

  return false;
};

const pruneEmptyParents = async (dir: string, root: string): Promise<void> => {
  const resolvedRoot = path.resolve(root);
  let current = path.resolve(dir);

  while (current.startsWith(resolvedRoot) && current !== resolvedRoot) {
    let entries;

    try {
      entries = await fs.readdir(current);
    } catch {
      break;
    }

    if (entries.length > 0) {
      break;
    }

    const parent = path.dirname(current);

    try {
      await fs.rmdir(current);
    } catch {
      break;
    }

    current = parent;
  }
};

export const ensureWikiPageAncestors = async (pagePath: string): Promise<void> => {
  const relative = writeRelativePath(pagePath);
  const absolute = resolveAbsolute(relative);

  if (!absolute) {
    throw new Error(`invalid knowledge page path: ${pagePath}`);
  }

  await ensureExportRoot();

  try {
    await fs.mkdir(path.dirname(absolute), { recursive: true });
  } catch (error) {
    throw corpusWriteError(exportRoot(), error);
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
    if (mode === 'create') {
      await ensureWikiPageAncestors(input.pagePath);
    } else {
      await ensureWikiPageAncestors(input.pagePath);
    }

    return createWikiPage({
      content: input.content,
      pagePath: input.pagePath,
      title: input.title,
    });
  }

  if (mode === 'create') {
    throw new Error(`knowledge page already exists: ${input.pagePath}`);
  }

  const content = mode === 'append'
    ? `${existing.content.trim()}\n\n${input.content.trim()}`.trim()
    : input.content;

  return updateWikiPage({
    content,
    id: existing.id,
    pagePath: existing.path,
    title: input.title ?? existing.title,
  });
};
