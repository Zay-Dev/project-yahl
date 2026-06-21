import fs from 'fs/promises';
import path from 'path';

import { paths } from '../config.js';

const KNOWLEDGE_EXTENSIONS = new Set(['.json', '.md', '.yaml', '.yml']);

const sanitizeSegment = (segment: string) =>
  segment.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'default';

const resolveUnderKnowledges = (relativePath: string): string | null => {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolute = path.join(paths.knowledges, normalized);
  const relative = path.relative(paths.knowledges, absolute);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return absolute;
};

export const listKnowledgeFiles = async (): Promise<string[]> => {
  const results: string[] = [];

  const walk = async (dir: string) => {
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

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();

      if (!KNOWLEDGE_EXTENSIONS.has(ext)) {
        continue;
      }

      results.push(fullPath);
    }
  };

  await walk(paths.knowledges);

  return results.sort();
};

export const readKnowledgeCorpus = async (
  maxBytes = 64_000,
  topic?: string,
): Promise<string> => {
  const files = await listKnowledgeFiles();
  const topicSegment = topic ? sanitizeSegment(topic) : '';
  const prioritized = topicSegment
    ? [
      ...files.filter((file) => path.relative(paths.knowledges, file).startsWith(`${topicSegment}/`)
        || path.relative(paths.knowledges, file).startsWith(`${topicSegment}.`)),
      ...files.filter((file) => !path.relative(paths.knowledges, file).startsWith(`${topicSegment}/`)
        && !path.relative(paths.knowledges, file).startsWith(`${topicSegment}.`)),
    ]
    : files;

  const parts: string[] = [];
  let total = 0;

  for (const file of prioritized) {
    const relative = path.relative(paths.knowledges, file);

    try {
      const content = await fs.readFile(file, 'utf8');
      const header = `--- ${relative} ---\n`;
      const chunk = header + content;

      if (total + chunk.length > maxBytes) {
        const remaining = maxBytes - total;

        if (remaining > header.length) {
          parts.push(chunk.slice(0, remaining));
        }

        break;
      }

      parts.push(chunk);
      total += chunk.length;
    } catch {
      // skip unreadable
    }
  }

  return parts.join('\n\n');
};

export const findKnowledgeFileForKey = async (
  key: string,
  topic?: string,
): Promise<string | null> => {
  const sanitizedKey = sanitizeSegment(key);
  const topicSegment = topic ? sanitizeSegment(topic) : '';
  const candidates = await listKnowledgeFiles();
  const keyPattern = new RegExp(`["']?${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?`, 'i');

  const scoped = topicSegment
    ? candidates.filter((file) => {
      const relative = path.relative(paths.knowledges, file);

      return relative.startsWith(`${topicSegment}/`) || relative.startsWith(`${topicSegment}.`);
    })
    : candidates;

  for (const file of scoped) {
    const basename = path.basename(file, path.extname(file));

    if (basename === sanitizedKey || basename === key) {
      return file;
    }

    try {
      const content = await fs.readFile(file, 'utf8');

      if (keyPattern.test(content)) {
        return file;
      }
    } catch {
      // skip
    }
  }

  return null;
};

export const resolveKnowledgeWritePath = async (
  key: string,
  topic?: string,
): Promise<{ absolute: string; relative: string }> => {
  const existing = await findKnowledgeFileForKey(key, topic);

  if (existing) {
    return {
      absolute: existing,
      relative: path.relative(paths.knowledges, existing),
    };
  }

  const sanitizedKey = sanitizeSegment(key);
  const topicSegment = topic ? sanitizeSegment(topic) : 'general';
  const relative = path.join(topicSegment, `${sanitizedKey}.json`);
  const absolute = resolveUnderKnowledges(relative);

  if (!absolute) {
    throw new Error('invalid knowledge write path');
  }

  return { absolute, relative };
};

export const hasPathArgs = (args: Record<string, unknown>) =>
  typeof args.source === 'string'
  || typeof args.file === 'string'
  || typeof args.path === 'string';
