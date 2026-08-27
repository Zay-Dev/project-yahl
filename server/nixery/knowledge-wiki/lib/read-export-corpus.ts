import fs from 'fs/promises';
import path from 'path';

import { readKnowledgeWikiConfig } from './config.js';

import {
  resolveTopicExportPrefix,
  WIKI_TOPICS_ROOT,
} from './wiki-paths.js';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

export type TExportCorpusFile = {
  content: string;
  relativePath: string;
};

export type TExportCorpusStats = {
  fileCount: number;
  totalBytes: number;
};

export const stripYamlFrontmatter = (content: string): string => {
  if (!content.startsWith('---\n')) {
    return content;
  }

  const end = content.indexOf('\n---\n', 4);

  if (end === -1) {
    return content;
  }

  return content.slice(end + 5).trimStart();
};

const resolveUnderExportRoot = (relativePath: string): string | null => {
  const root = path.resolve(readKnowledgeWikiConfig().knowledgeExportRoot);
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolute = path.join(root, normalized);
  const rel = path.relative(root, absolute);

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }

  return absolute;
};

const walkMarkdownFiles = async (dir: string, baseDir: string, results: TExportCorpusFile[]): Promise<void> => {
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
      await walkMarkdownFiles(absolute, baseDir, results);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();

    if (!MARKDOWN_EXTENSIONS.has(ext)) {
      continue;
    }

    try {
      const raw = await fs.readFile(absolute, 'utf8');
      const relativePath = path.relative(baseDir, absolute);

      results.push({
        content: stripYamlFrontmatter(raw),
        relativePath,
      });
    } catch {
      // skip unreadable
    }
  }
};

export const resolveExportTopicDirPrefixes = (canonical: string): string[] => {
  const slug = canonical.trim();

  return [
    resolveTopicExportPrefix(slug),
    `${WIKI_TOPICS_ROOT}/${slug}`,
  ];
};

const listExportTopicFilesFromPrefix = async (
  topicPrefix: string,
  baseDir: string,
): Promise<TExportCorpusFile[]> => {
  const topicDir = resolveUnderExportRoot(topicPrefix);

  if (!topicDir) {
    return [];
  }

  const results: TExportCorpusFile[] = [];

  await walkMarkdownFiles(topicDir, baseDir, results);

  return results;
};

export const listExportTopicFiles = async (canonical: string): Promise<TExportCorpusFile[]> => {
  const baseDir = resolveUnderExportRoot('') ?? readKnowledgeWikiConfig().knowledgeExportRoot;
  const merged = new Map<string, TExportCorpusFile>();

  for (const topicPrefix of resolveExportTopicDirPrefixes(canonical)) {
    const files = await listExportTopicFilesFromPrefix(topicPrefix, baseDir);

    for (const file of files) {
      merged.set(file.relativePath, file);
    }
  }

  return [...merged.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};

export const getExportTopicStats = async (canonical: string): Promise<TExportCorpusStats> => {
  const files = await listExportTopicFiles(canonical);

  return {
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + Buffer.byteLength(file.content, 'utf8'), 0),
  };
};

export const readExportTopicCorpus = async (
  canonical: string,
  maxBytes = 512_000,
): Promise<string> => {
  const files = await listExportTopicFiles(canonical);
  const parts: string[] = [];
  let total = 0;

  for (const file of files) {
    const header = `--- ${file.relativePath} ---\n`;
    const chunk = header + file.content;

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

export const readExportPageByPath = async (pagePath: string): Promise<string | null> => {
  const normalized = pagePath.replace(/^\/+/, '').trim();

  if (!normalized) {
    return null;
  }

  const candidates = normalized.endsWith('.md')
    ? [normalized]
    : [
      `en/${normalized}.md`,
      `${normalized}.md`,
      normalized,
    ];

  for (const candidate of candidates) {
    const absolute = resolveUnderExportRoot(candidate);

    if (!absolute) {
      continue;
    }

    try {
      const content = await fs.readFile(absolute, 'utf8');

      return stripYamlFrontmatter(content);
    } catch {
      // try next candidate
    }
  }

  return null;
};

export const shouldUseExportCorpus = (
  stats: TExportCorpusStats,
  pageCountThreshold = readKnowledgeWikiConfig().wikiExportPageThreshold,
  bytesThreshold = readKnowledgeWikiConfig().wikiExportBytesThreshold,
): boolean =>
  stats.fileCount > pageCountThreshold || stats.totalBytes > bytesThreshold;
