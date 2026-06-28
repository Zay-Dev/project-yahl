import fs from 'fs/promises';
import path from 'path';

import { paths } from '../config.js';

import {
  expandTopicSlugs,
  registerTopic,
  resolveCanonicalTopic,
} from './topic-registry.js';
import {
  resolveKnowledgeFileExtension,
  type TKnowledgeFileExtension,
} from './knowledge-format.js';
import { parseUrlSignals, sanitizeSegment, slugifyTopicText } from './topic-slug.js';

const KNOWLEDGE_EXTENSIONS = new Set(['.json', '.md', '.yaml', '.yml']);
const RESERVED_KNOWLEDGE_DIRS = new Set(['_index', '_archive']);

export { sanitizeSegment, slugifyTopicText } from './topic-slug.js';
export {
  addAlias,
  expandTopicSlugs,
  listRegistryTopics,
  listTopicFolderSummaries,
  loadRegistry,
  registerTopic,
  resolveCanonicalTopic,
  type TResolveTopicInput,
  type TResolveTopicResult,
  type TTopicRegistry,
  type TTopicRegistryEntry,
  type TTopicRefreshPolicy,
  type TTopicRefreshScope,
  type TRefreshInterval,
  type TRefreshRunStatus,
} from './topic-registry.js';
export {
  evaluateKnowledgeRefresh,
  listTopicPolicies,
  patchTopicPolicy,
  type TPatchTopicPolicyInput,
  type TStaleTopic,
  type TTopicPolicyRow,
  type TTopicRefreshPolicy,
  type TTopicRefreshScope,
  type TRefreshInterval,
  type TRefreshRunStatus,
} from './topic-refresh.js';
export {
  detectDuplicateGroups,
  runTidyKnowledge,
  type TTidyDuplicateGroup,
  type TTidyKnowledgeReport,
} from './tidy-knowledge.js';
export {
  measurePersistPayloadBytes,
  resolveKnowledgeFileExtension,
  serializeMarkdownBody,
  shouldPersistAsMarkdown,
  type TKnowledgeFileExtension,
} from './knowledge-format.js';

const resolveUnderKnowledges = (relativePath: string): string | null => {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolute = path.join(paths.knowledges, normalized);
  const relative = path.relative(paths.knowledges, absolute);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return absolute;
};

const fileMatchesTopicSlugs = (file: string, topicSlugs: string[]): boolean => {
  const relative = path.relative(paths.knowledges, file);

  return topicSlugs.some((slug) =>
    relative.startsWith(`${slug}/`) || relative.startsWith(`${slug}.`));
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
      if (entry.name.startsWith('.') || RESERVED_KNOWLEDGE_DIRS.has(entry.name)) {
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

const dedupeFilesByBasename = (files: string[], preferredSlug?: string): string[] => {
  const byBasename = new Map<string, string>();

  for (const file of files) {
    const basename = path.basename(file, path.extname(file));
    const relative = path.relative(paths.knowledges, file);
    const existing = byBasename.get(basename);

    if (!existing) {
      byBasename.set(basename, file);
      continue;
    }

    const existingRelative = path.relative(paths.knowledges, existing);
    const existingPreferred = preferredSlug && existingRelative.startsWith(`${preferredSlug}/`);
    const nextPreferred = preferredSlug && relative.startsWith(`${preferredSlug}/`);

    if (nextPreferred && !existingPreferred) {
      byBasename.set(basename, file);
    }
  }

  return [...byBasename.values()].sort();
};

export const readKnowledgeCorpus = async (
  maxBytes = 64_000,
  topic?: string,
): Promise<string> => {
  const files = await listKnowledgeFiles();
  const topicSlugs = topic ? await expandTopicSlugs(topic) : [];
  const preferredSlug = topicSlugs[0];
  const scoped = topicSlugs.length
    ? dedupeFilesByBasename(files.filter((file) => fileMatchesTopicSlugs(file, topicSlugs)), preferredSlug)
    : files;
  const prioritized = topicSlugs.length
    ? [
      ...scoped,
      ...files.filter((file) => !fileMatchesTopicSlugs(file, topicSlugs)),
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

export const findKnowledgeFileByBasename = async (
  key: string,
  topic?: string,
): Promise<string | null> => {
  const sanitizedKey = sanitizeSegment(key);
  const topicSlugs = topic ? await expandTopicSlugs(topic) : [];
  const preferredSlug = topicSlugs[0];
  const candidates = await listKnowledgeFiles();
  const scoped = topicSlugs.length
    ? dedupeFilesByBasename(
      candidates.filter((file) => fileMatchesTopicSlugs(file, topicSlugs)),
      preferredSlug,
    )
    : candidates;

  for (const file of scoped) {
    const basename = path.basename(file, path.extname(file));

    if (basename === sanitizedKey || basename === key) {
      return file;
    }
  }

  return null;
};

export const findKnowledgeFileForKey = async (
  key: string,
  topic?: string,
): Promise<string | null> => findKnowledgeFileByBasename(key, topic);

export const resolveKnowledgeWritePath = async (
  key: string,
  topic?: string,
  value?: unknown,
): Promise<{
  absolute: string;
  canonicalTopic: string;
  extension: TKnowledgeFileExtension;
  relative: string;
}> => {
  const resolved = await resolveCanonicalTopic({ slug: topic });
  const canonicalTopic = resolved.canonical;
  const existing = await findKnowledgeFileByBasename(key, canonicalTopic);

  if (existing) {
    const existingExtension = path.extname(existing).toLowerCase() as TKnowledgeFileExtension;

    return {
      absolute: existing,
      canonicalTopic,
      extension: existingExtension === '.md' ? '.md' : '.json',
      relative: path.relative(paths.knowledges, existing),
    };
  }

  const sanitizedKey = sanitizeSegment(key);
  const topicSegment = sanitizeSegment(canonicalTopic) || 'general';
  const extension = resolveKnowledgeFileExtension(key, value);
  const relative = path.join(topicSegment, `${sanitizedKey}${extension}`);
  const absolute = resolveUnderKnowledges(relative);

  if (!absolute) {
    throw new Error('invalid knowledge write path');
  }

  return { absolute, canonicalTopic, extension, relative };
};

export const resolveTopicForPersist = async (args: {
  seedUrls?: string[];
  topic?: string;
  topicText?: string;
}) => {
  const resolved = await resolveCanonicalTopic({
    seedUrls: args.seedUrls,
    slug: args.topic,
    topicText: args.topicText,
  });

  if (resolved.matchedBy === 'new') {
    const urlSignals = parseUrlSignals(args.seedUrls ?? []);

    await registerTopic(resolved.canonical, {
      seedUrlHosts: urlSignals.hosts,
      seedUrlPaths: urlSignals.paths,
      topicTexts: args.topicText?.trim() ? [args.topicText.trim()] : [],
    });
  }

  return resolved;
};

export const hasPathArgs = (args: Record<string, unknown>) =>
  typeof args.source === 'string'
  || typeof args.file === 'string'
  || typeof args.path === 'string';

export type TKnowledgePersistedIndexItem = {
  absolutePath: string;
  key: string;
  relativePath: string;
};

export type TSourceIndexItem = {
  fetchedAt: string;
  studyKey: string;
  title: string;
  trustTier: 'high' | 'low' | 'medium';
  url: string;
};

export const rebuildPersistedPathsFromTopic = async (
  topic: string,
): Promise<TKnowledgePersistedIndexItem[]> => {
  const topicSlugs = await expandTopicSlugs(topic);
  const preferredSlug = topicSlugs[0] ?? sanitizeSegment(topic);
  const candidates = await listKnowledgeFiles();
  const topicFiles = dedupeFilesByBasename(
    candidates.filter((file) => {
      const relative = path.relative(paths.knowledges, file);

      const ext = path.extname(file).toLowerCase();

      return topicSlugs.some((slug) => relative.startsWith(`${slug}/`))
        && (ext === '.json' || ext === '.md');
    }),
    preferredSlug,
  );

  const persisted: TKnowledgePersistedIndexItem[] = [];

  for (const file of topicFiles) {
    const relativePath = path.relative(paths.knowledges, file);
    const key = path.basename(file, path.extname(file));

    persisted.push({
      absolutePath: `~/knowledges/${relativePath}`,
      key,
      relativePath,
    });
  }

  return persisted.sort((left, right) => left.key.localeCompare(right.key));
};

export const rebuildSourcesIndexFromStudies = async (
  topic: string,
): Promise<TSourceIndexItem[]> => {
  const topicSlugs = await expandTopicSlugs(topic);
  const preferredSlug = topicSlugs[0] ?? sanitizeSegment(topic);
  const candidates = await listKnowledgeFiles();
  const studies = dedupeFilesByBasename(
    candidates.filter((file) => {
      const relative = path.relative(paths.knowledges, file);
      const basename = path.basename(file, path.extname(file));

      return topicSlugs.some((slug) => relative.startsWith(`${slug}/`))
        && basename.startsWith('study_')
        && path.extname(file).toLowerCase() === '.json';
    }),
    preferredSlug,
  );

  const sources: TSourceIndexItem[] = [];

  for (const file of studies) {
    const studyKey = path.basename(file, '.json');

    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const study = (parsed[studyKey] ?? parsed) as Record<string, unknown>;

      if (typeof study.url !== 'string' || typeof study.title !== 'string') {
        continue;
      }

      const trustTier = study.trustTier;

      sources.push({
        fetchedAt: typeof study.studiedAt === 'string'
          ? study.studiedAt
          : typeof study.fetchedAt === 'string'
            ? study.fetchedAt
            : new Date().toISOString(),
        studyKey,
        title: study.title,
        trustTier: trustTier === 'high' || trustTier === 'low' || trustTier === 'medium'
          ? trustTier
          : 'medium',
        url: study.url,
      });
    } catch {
      // skip unreadable study files
    }
  }

  return sources.sort((left, right) => left.studyKey.localeCompare(right.studyKey));
};
