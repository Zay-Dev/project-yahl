import fs from 'fs/promises';
import path from 'path';

import { paths } from '../../config.js';
import { sanitizeSegment } from '../topic-slug.js';

import { upsertLegacyKnowledgeKey } from './index.js';

const SKIP_ARCHIVE_KEYS = new Set([
  'corpus-assessment',
  'knowledge_paths',
]);

export type TRestoreTopicArchiveReport = {
  canonical: string;
  dryRun: boolean;
  restoredKeys: string[];
  sourceDir: string | null;
};

const parseArchiveValue = (key: string, ext: string, raw: string): unknown => {
  if (ext === '.json') {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (parsed[key] !== undefined) {
      return parsed[key];
    }

    return parsed;
  }

  const content = raw.trim();

  if (key.endsWith('_md') || key === 'background_summary') {
    return { content };
  }

  return { content };
};

const findArchiveTopicDir = async (canonical: string): Promise<string | null> => {
  const archiveRoot = path.join(paths.knowledges, '_archive');
  let stampDirs: string[] = [];

  try {
    const entries = await fs.readdir(archiveRoot, { withFileTypes: true });

    stampDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    return null;
  }

  for (const stamp of stampDirs) {
    const candidate = path.join(archiveRoot, stamp, canonical);

    try {
      const stat = await fs.stat(candidate);

      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      // try next stamp
    }
  }

  const activeDir = path.join(paths.knowledges, canonical);

  try {
    const stat = await fs.stat(activeDir);

    if (stat.isDirectory()) {
      return activeDir;
    }
  } catch {
    // no active dir
  }

  return null;
};

export const restoreTopicFromArchive = async (
  topic: string,
  options?: { dryRun?: boolean },
): Promise<TRestoreTopicArchiveReport> => {
  const canonical = sanitizeSegment(topic);
  const dryRun = options?.dryRun === true;
  const sourceDir = await findArchiveTopicDir(canonical);
  const restoredKeys: string[] = [];

  if (!sourceDir) {
    return { canonical, dryRun, restoredKeys, sourceDir: null };
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();

    if (ext !== '.json' && ext !== '.md') {
      continue;
    }

    const key = path.basename(entry.name, ext);

    if (SKIP_ARCHIVE_KEYS.has(key)) {
      continue;
    }

    const raw = await fs.readFile(path.join(sourceDir, entry.name), 'utf8');
    const value = parseArchiveValue(key, ext, raw);

    if (dryRun) {
      restoredKeys.push(key);
      continue;
    }

    await upsertLegacyKnowledgeKey({ canonical, key, value });
    restoredKeys.push(key);
  }

  restoredKeys.sort();

  return { canonical, dryRun, restoredKeys, sourceDir };
};
