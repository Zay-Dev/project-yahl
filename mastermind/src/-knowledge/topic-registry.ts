import fs from 'fs/promises';
import path from 'path';

import { paths } from '../config.js';

import {
  normalizeTopicText,
  parseUrlSignals,
  sanitizeSegment,
  slugifyTopicText,
  urlSignalsOverlap,
} from './topic-slug.js';

const REGISTRY_DIR = path.join(paths.knowledges, '_index');
const REGISTRY_PATH = path.join(REGISTRY_DIR, 'topics.json');
const RESERVED_DIRS = new Set(['_index', '_archive']);

export type TTopicSignals = {
  seedUrlHosts: string[];
  seedUrlPaths: string[];
  topicTexts: string[];
};

export type TRefreshInterval = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export type TRefreshRunStatus = 'success' | 'failed' | 'skipped';

export type TTopicRefreshScope = 'studies' | 'facts' | 'synthesis' | 'summary';

export type TTopicRefreshPolicy = {
  enabled: boolean;
  interval: TRefreshInterval | null;
  lastRunAt: string | null;
  lastRunSessionId: string | null;
  lastRunStatus: TRefreshRunStatus | null;
  scopes: TTopicRefreshScope[];
};

export type TTopicRegistryEntry = {
  aliases: string[];
  canonical: string;
  createdAt: string;
  maxAgeDays: number | null;
  refresh: TTopicRefreshPolicy | null;
  signals: TTopicSignals;
  updatedAt: string;
};

export type TTopicRegistry = {
  topics: TTopicRegistryEntry[];
};

export type TTopicFolderSummary = {
  fileCount: number;
  learningContractTopic?: string;
  seedUrls: string[];
  slug: string;
  studyKeyCount: number;
  updatedAt?: string;
};

export type TResolveTopicInput = {
  seedUrls?: string[];
  slug?: string;
  topicText?: string;
};

export type TResolveTopicResult = {
  aliases: string[];
  canonical: string;
  matchedBy: 'new' | 'slug' | 'text' | 'url';
  suggestMerge?: string[];
};

const emptyRegistry = (): TTopicRegistry => ({ topics: [] });

const nowIso = () => new Date().toISOString();

const readJsonFile = async (filePath: string): Promise<Record<string, unknown> | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');

    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const unwrapKeyedValue = <T>(parsed: Record<string, unknown>, key: string): T | undefined => {
  const nested = parsed[key];

  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as T;
  }

  return parsed as T;
};

export const loadRegistry = async (): Promise<TTopicRegistry> => {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as TTopicRegistry;

    return {
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    };
  } catch {
    return emptyRegistry();
  }
};

export const saveRegistry = async (registry: TTopicRegistry): Promise<void> => {
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
  const tempPath = `${REGISTRY_PATH}.${process.pid}.${Date.now()}.tmp`;

  await fs.writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, REGISTRY_PATH);
};

const findEntryBySlug = (registry: TTopicRegistry, slug: string): TTopicRegistryEntry | null => {
  const normalized = sanitizeSegment(slug);

  for (const entry of registry.topics) {
    if (entry.canonical === normalized || entry.aliases.includes(normalized)) {
      return entry;
    }
  }

  return null;
};

const collectStudyUrls = async (topicDir: string): Promise<string[]> => {
  const urls = new Set<string>();

  try {
    const entries = await fs.readdir(topicDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith('study_') || !entry.name.endsWith('.json')) {
        continue;
      }

      const parsed = await readJsonFile(path.join(topicDir, entry.name));
      const studyKey = path.basename(entry.name, '.json');
      const study = parsed ? unwrapKeyedValue<{ url?: string }>(parsed, studyKey) : undefined;

      if (typeof study?.url === 'string' && study.url.trim()) {
        urls.add(study.url.trim());
      }
    }
  } catch {
    // skip unreadable topic dir
  }

  return [...urls];
};

export const listTopicFolderSummaries = async (): Promise<TTopicFolderSummary[]> => {
  const summaries: TTopicFolderSummary[] = [];

  let entries;

  try {
    entries = await fs.readdir(paths.knowledges, { withFileTypes: true });
  } catch {
    return summaries;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || RESERVED_DIRS.has(entry.name)) {
      continue;
    }

    const topicDir = path.join(paths.knowledges, entry.name);
    let fileCount = 0;

    try {
      const files = await fs.readdir(topicDir);

      fileCount = files.filter((name) => name.endsWith('.json') || name.endsWith('.md')).length;
    } catch {
      // skip
    }

    const learningContract = await readJsonFile(path.join(topicDir, 'learning_contract.json'));
    const contract = learningContract
      ? unwrapKeyedValue<{ seedUrls?: string[]; topic?: string }>(learningContract, 'learning_contract')
      : undefined;
    const meta = await readJsonFile(path.join(topicDir, 'meta.json'));
    const metaValue = meta ? unwrapKeyedValue<{ updated_at?: string }>(meta, 'meta') : undefined;
    const seedUrls = [
      ...(Array.isArray(contract?.seedUrls) ? contract.seedUrls.filter((url) => typeof url === 'string') : []),
      ...(await collectStudyUrls(topicDir)),
    ];

    summaries.push({
      fileCount,
      learningContractTopic: typeof contract?.topic === 'string' ? contract.topic : undefined,
      seedUrls: [...new Set(seedUrls)],
      slug: entry.name,
      studyKeyCount: (await fs.readdir(topicDir).catch(() => []))
        .filter((name) => name.startsWith('study_') && name.endsWith('.json')).length,
      updatedAt: typeof metaValue?.updated_at === 'string' ? metaValue.updated_at : undefined,
    });
  }

  return summaries.sort((left, right) => left.slug.localeCompare(right.slug));
};

const matchByTopicText = (
  registry: TTopicRegistry,
  topicText: string,
): TTopicRegistryEntry | null => {
  const normalized = normalizeTopicText(topicText);

  if (!normalized) {
    return null;
  }

  for (const entry of registry.topics) {
    if (entry.signals.topicTexts.some((text) => normalizeTopicText(text) === normalized)) {
      return entry;
    }
  }

  return null;
};

const matchByUrls = (
  registry: TTopicRegistry,
  seedUrls: string[],
): TTopicRegistryEntry | null => {
  const inputSignals = parseUrlSignals(seedUrls);

  if (!inputSignals.hosts.length) {
    return null;
  }

  for (const entry of registry.topics) {
    const entrySignals = {
      hosts: entry.signals.seedUrlHosts,
      paths: entry.signals.seedUrlPaths,
    };

    if (urlSignalsOverlap(inputSignals, entrySignals)) {
      return entry;
    }
  }

  return null;
};

const matchFolderByTopicText = (
  summaries: TTopicFolderSummary[],
  topicText: string,
): TTopicFolderSummary | null => {
  const normalized = normalizeTopicText(topicText);

  if (!normalized) {
    return null;
  }

  return summaries.find((summary) =>
    summary.learningContractTopic
    && normalizeTopicText(summary.learningContractTopic) === normalized) ?? null;
};

const matchFolderByUrls = (
  summaries: TTopicFolderSummary[],
  seedUrls: string[],
): TTopicFolderSummary | null => {
  const inputSignals = parseUrlSignals(seedUrls);

  if (!inputSignals.hosts.length) {
    return null;
  }

  for (const summary of summaries) {
    const folderSignals = parseUrlSignals(summary.seedUrls);

    if (urlSignalsOverlap(inputSignals, folderSignals)) {
      return summary;
    }
  }

  return null;
};

const suggestMergeSlugs = (
  proposed: string,
  summaries: TTopicFolderSummary[],
): string[] => {
  const normalized = sanitizeSegment(proposed);
  const suggestions = new Set<string>();

  for (const summary of summaries) {
    if (summary.slug === normalized) {
      continue;
    }

    if (summary.slug.includes(normalized) || normalized.includes(summary.slug)) {
      suggestions.add(summary.slug);
    }
  }

  return [...suggestions].sort();
};

export const expandTopicSlugs = async (topic?: string): Promise<string[]> => {
  if (!topic?.trim()) {
    return [];
  }

  const registry = await loadRegistry();
  const entry = findEntryBySlug(registry, topic);

  if (!entry) {
    return [sanitizeSegment(topic)];
  }

  return [...new Set([entry.canonical, ...entry.aliases])];
};

export const resolveCanonicalTopic = async (
  input: TResolveTopicInput,
): Promise<TResolveTopicResult> => {
  const registry = await loadRegistry();
  const summaries = await listTopicFolderSummaries();
  const slugHint = input.slug?.trim() ? sanitizeSegment(input.slug) : '';
  const topicText = input.topicText?.trim() ?? '';
  const seedUrls = Array.isArray(input.seedUrls)
    ? input.seedUrls.filter((url) => typeof url === 'string' && url.trim())
    : [];

  if (slugHint) {
    const bySlug = findEntryBySlug(registry, slugHint);

    if (bySlug) {
      return {
        aliases: bySlug.aliases,
        canonical: bySlug.canonical,
        matchedBy: 'slug',
      };
    }

    const folderMatch = summaries.find((summary) => summary.slug === slugHint);

    if (folderMatch) {
      return {
        aliases: [],
        canonical: folderMatch.slug,
        matchedBy: 'slug',
        suggestMerge: suggestMergeSlugs(slugHint, summaries),
      };
    }
  }

  if (topicText) {
    const byText = matchByTopicText(registry, topicText);

    if (byText) {
      return {
        aliases: byText.aliases,
        canonical: byText.canonical,
        matchedBy: 'text',
      };
    }

    const folderMatch = matchFolderByTopicText(summaries, topicText);

    if (folderMatch) {
      return {
        aliases: [],
        canonical: folderMatch.slug,
        matchedBy: 'text',
        suggestMerge: suggestMergeSlugs(folderMatch.slug, summaries),
      };
    }
  }

  if (seedUrls.length) {
    const byUrl = matchByUrls(registry, seedUrls);

    if (byUrl) {
      return {
        aliases: byUrl.aliases,
        canonical: byUrl.canonical,
        matchedBy: 'url',
      };
    }

    const folderMatch = matchFolderByUrls(summaries, seedUrls);

    if (folderMatch) {
      return {
        aliases: [],
        canonical: folderMatch.slug,
        matchedBy: 'url',
        suggestMerge: suggestMergeSlugs(folderMatch.slug, summaries),
      };
    }
  }

  const canonical = slugHint
    || (topicText ? slugifyTopicText(topicText) : seedUrls.length ? slugifyTopicText(parseUrlSignals(seedUrls).paths[0] ?? 'topic') : 'general');

  return {
    aliases: [],
    canonical,
    matchedBy: 'new',
    suggestMerge: suggestMergeSlugs(canonical, summaries),
  };
};

export const registerTopic = async (
  canonical: string,
  signals: Partial<TTopicSignals>,
): Promise<TTopicRegistryEntry> => {
  const registry = await loadRegistry();
  const slug = sanitizeSegment(canonical);
  const existing = findEntryBySlug(registry, slug);
  const timestamp = nowIso();
  const normalizedSignals: TTopicSignals = {
    seedUrlHosts: signals.seedUrlHosts ?? [],
    seedUrlPaths: signals.seedUrlPaths ?? [],
    topicTexts: signals.topicTexts ?? [],
  };
  const urlSignals = parseUrlSignals(
    normalizedSignals.seedUrlHosts.flatMap((host) =>
      normalizedSignals.seedUrlPaths.map((segment) => `https://${host}${segment}`)),
  );

  normalizedSignals.seedUrlHosts = [...new Set([
    ...normalizedSignals.seedUrlHosts,
    ...urlSignals.hosts,
  ])].sort();
  normalizedSignals.seedUrlPaths = [...new Set([
    ...normalizedSignals.seedUrlPaths,
    ...urlSignals.paths,
  ])].sort();

  if (existing) {
    existing.signals.topicTexts = [...new Set([
      ...existing.signals.topicTexts,
      ...normalizedSignals.topicTexts,
    ])];
    existing.signals.seedUrlHosts = [...new Set([
      ...existing.signals.seedUrlHosts,
      ...normalizedSignals.seedUrlHosts,
    ])].sort();
    existing.signals.seedUrlPaths = [...new Set([
      ...existing.signals.seedUrlPaths,
      ...normalizedSignals.seedUrlPaths,
    ])].sort();
    existing.updatedAt = timestamp;
    await saveRegistry(registry);

    return existing;
  }

  const entry: TTopicRegistryEntry = {
    aliases: [],
    canonical: slug,
    createdAt: timestamp,
    maxAgeDays: null,
    refresh: null,
    signals: normalizedSignals,
    updatedAt: timestamp,
  };

  registry.topics.push(entry);
  registry.topics.sort((left, right) => left.canonical.localeCompare(right.canonical));
  await saveRegistry(registry);

  return entry;
};

export const addAlias = async (canonical: string, alias: string): Promise<void> => {
  const registry = await loadRegistry();
  const canonicalSlug = sanitizeSegment(canonical);
  const aliasSlug = sanitizeSegment(alias);

  if (!canonicalSlug || !aliasSlug || canonicalSlug === aliasSlug) {
    return;
  }

  let entry = registry.topics.find((topic) => topic.canonical === canonicalSlug);

  if (!entry) {
    entry = {
      aliases: [],
      canonical: canonicalSlug,
      createdAt: nowIso(),
      maxAgeDays: null,
      refresh: null,
      signals: {
        seedUrlHosts: [],
        seedUrlPaths: [],
        topicTexts: [],
      },
      updatedAt: nowIso(),
    };
    registry.topics.push(entry);
  }

  const conflicting = findEntryBySlug(registry, aliasSlug);

  if (conflicting && conflicting.canonical !== canonicalSlug) {
    for (const otherAlias of conflicting.aliases) {
      if (!entry.aliases.includes(otherAlias)) {
        entry.aliases.push(otherAlias);
      }
    }

    if (!entry.aliases.includes(conflicting.canonical)) {
      entry.aliases.push(conflicting.canonical);
    }

    registry.topics = registry.topics.filter((topic) => topic.canonical !== conflicting.canonical);
  }

  if (!entry.aliases.includes(aliasSlug)) {
    entry.aliases.push(aliasSlug);
  }

  entry.aliases = [...new Set(entry.aliases.filter((slug) => slug !== canonicalSlug))].sort();
  entry.updatedAt = nowIso();
  registry.topics.sort((left, right) => left.canonical.localeCompare(right.canonical));
  await saveRegistry(registry);
};

export const listRegistryTopics = async (): Promise<Array<TTopicRegistryEntry & {
  folder?: TTopicFolderSummary;
}>> => {
  const registry = await loadRegistry();
  const summaries = await listTopicFolderSummaries();
  const summaryBySlug = new Map(summaries.map((summary) => [summary.slug, summary]));

  return registry.topics.map((entry) => ({
    ...entry,
    folder: summaryBySlug.get(entry.canonical)
      ?? entry.aliases.map((alias) => summaryBySlug.get(alias)).find(Boolean),
  }));
};
