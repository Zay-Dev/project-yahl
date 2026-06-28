import {
  listTopicFolderSummaries,
  loadRegistry,
  saveRegistry,
  type TRefreshInterval,
  type TRefreshRunStatus,
  type TTopicFolderSummary,
  type TTopicRefreshPolicy,
  type TTopicRefreshScope,
  type TTopicRegistry,
  type TTopicRegistryEntry,
} from './topic-registry.js';
import { sanitizeSegment } from './topic-slug.js';

export type {
  TRefreshInterval,
  TRefreshRunStatus,
  TTopicRefreshPolicy,
  TTopicRefreshScope,
} from './topic-registry.js';

export const DEFAULT_REFRESH_SCOPES: TTopicRefreshScope[] = [
  'studies',
  'facts',
  'synthesis',
  'summary',
];

const INTERVAL_MS: Record<TRefreshInterval, number> = {
  biweekly: 14 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const nowIso = () => new Date().toISOString();

const findEntryBySlug = (registry: TTopicRegistry, slug: string): TTopicRegistryEntry | null => {
  const normalized = sanitizeSegment(slug);

  for (const entry of registry.topics) {
    if (entry.canonical === normalized || entry.aliases.includes(normalized)) {
      return entry;
    }
  }

  return null;
};

export const intervalToMs = (interval: TRefreshInterval): number => INTERVAL_MS[interval];

export const normalizeRefreshPolicy = (
  refresh: Partial<TTopicRefreshPolicy> | null | undefined,
): TTopicRefreshPolicy | null => {
  if (!refresh || typeof refresh !== 'object') {
    return null;
  }

  const interval = refresh.interval === 'daily'
    || refresh.interval === 'weekly'
    || refresh.interval === 'biweekly'
    || refresh.interval === 'monthly'
    ? refresh.interval
    : null;

  const scopes = Array.isArray(refresh.scopes)
    ? refresh.scopes.filter((scope): scope is TTopicRefreshScope =>
      scope === 'studies'
      || scope === 'facts'
      || scope === 'synthesis'
      || scope === 'summary')
    : DEFAULT_REFRESH_SCOPES;

  return {
    enabled: refresh.enabled === true,
    interval,
    lastRunAt: typeof refresh.lastRunAt === 'string' ? refresh.lastRunAt : null,
    lastRunSessionId: typeof refresh.lastRunSessionId === 'string' ? refresh.lastRunSessionId : null,
    lastRunStatus: refresh.lastRunStatus === 'success'
      || refresh.lastRunStatus === 'failed'
      || refresh.lastRunStatus === 'skipped'
      ? refresh.lastRunStatus
      : null,
    scopes: scopes.length ? scopes : DEFAULT_REFRESH_SCOPES,
  };
};

export const normalizeRegistryEntry = (entry: TTopicRegistryEntry): TTopicRegistryEntry => ({
  ...entry,
  refresh: normalizeRefreshPolicy(entry.refresh),
});

export const loadNormalizedRegistry = async (): Promise<TTopicRegistry> => {
  const registry = await loadRegistry();

  return {
    topics: registry.topics.map(normalizeRegistryEntry),
  };
};

export type TTopicPolicyRow = {
  canonical: string;
  fileCount: number;
  learningContractTopic?: string;
  refresh: TTopicRefreshPolicy | null;
  seedUrlCount: number;
  studyKeyCount: number;
  updatedAt?: string;
};

export const listTopicPolicies = async (): Promise<TTopicPolicyRow[]> => {
  const registry = await loadNormalizedRegistry();
  const summaries = await listTopicFolderSummaries();
  const summaryBySlug = new Map(summaries.map((summary) => [summary.slug, summary]));
  const seen = new Set<string>();
  const rows: TTopicPolicyRow[] = [];

  const pushRow = (canonical: string, entry?: TTopicRegistryEntry, folder?: TTopicFolderSummary) => {
    if (seen.has(canonical)) {
      return;
    }

    seen.add(canonical);

    rows.push({
      canonical,
      fileCount: folder?.fileCount ?? 0,
      learningContractTopic: folder?.learningContractTopic,
      refresh: normalizeRefreshPolicy(entry?.refresh),
      seedUrlCount: folder?.seedUrls.length ?? 0,
      studyKeyCount: folder?.studyKeyCount ?? 0,
      updatedAt: folder?.updatedAt,
    });
  };

  for (const entry of registry.topics) {
    const folder = summaryBySlug.get(entry.canonical)
      ?? entry.aliases.map((alias) => summaryBySlug.get(alias)).find(Boolean);

    pushRow(entry.canonical, entry, folder);
  }

  for (const summary of summaries) {
    pushRow(summary.slug, findEntryBySlug(registry, summary.slug) ?? undefined, summary);
  }

  return rows.sort((left, right) => left.canonical.localeCompare(right.canonical));
};

export type TPatchTopicPolicyInput = {
  enabled?: boolean;
  interval?: TRefreshInterval | null;
  lastRunAt?: string | null;
  lastRunSessionId?: string | null;
  lastRunStatus?: TRefreshRunStatus | null;
  scopes?: TTopicRefreshScope[];
};

export const patchTopicPolicy = async (
  slug: string,
  patch: TPatchTopicPolicyInput,
): Promise<TTopicPolicyRow> => {
  const canonical = sanitizeSegment(slug);

  if (!canonical) {
    throw new Error('patch-topic-policy requires canonical slug');
  }

  const registry = await loadNormalizedRegistry();
  let entry = registry.topics.find((topic) =>
    topic.canonical === canonical || topic.aliases.includes(canonical));

  if (!entry) {
    const timestamp = nowIso();

    entry = {
      aliases: [],
      canonical,
      createdAt: timestamp,
      maxAgeDays: null,
      refresh: null,
      signals: {
        seedUrlHosts: [],
        seedUrlPaths: [],
        topicTexts: [],
      },
      updatedAt: timestamp,
    };
    registry.topics.push(entry);
  }

  const current = normalizeRefreshPolicy(entry.refresh) ?? {
    enabled: false,
    interval: null,
    lastRunAt: null,
    lastRunSessionId: null,
    lastRunStatus: null,
    scopes: DEFAULT_REFRESH_SCOPES,
  };

  entry.refresh = {
    ...current,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.interval !== undefined ? { interval: patch.interval } : {}),
    ...(patch.lastRunAt !== undefined ? { lastRunAt: patch.lastRunAt } : {}),
    ...(patch.lastRunSessionId !== undefined ? { lastRunSessionId: patch.lastRunSessionId } : {}),
    ...(patch.lastRunStatus !== undefined ? { lastRunStatus: patch.lastRunStatus } : {}),
    ...(patch.scopes !== undefined ? { scopes: patch.scopes } : {}),
  };
  entry.updatedAt = nowIso();

  registry.topics.sort((left, right) => left.canonical.localeCompare(right.canonical));
  await saveRegistry(registry);

  const rows = await listTopicPolicies();
  const row = rows.find((item) => item.canonical === entry!.canonical);

  if (!row) {
    throw new Error('patch-topic-policy failed to read back row');
  }

  return row;
};

export type TStaleTopic = {
  canonical: string;
  interval: TRefreshInterval;
  reason: string;
  scopes: TTopicRefreshScope[];
};

const referenceTimestamp = (
  entry: TTopicRegistryEntry,
  folder?: TTopicFolderSummary,
): string => {
  const refresh = normalizeRefreshPolicy(entry.refresh);

  if (refresh?.lastRunAt) {
    return refresh.lastRunAt;
  }

  if (folder?.updatedAt) {
    return folder.updatedAt;
  }

  return entry.createdAt;
};

export const isTopicRefreshDue = (
  entry: TTopicRegistryEntry,
  folder: TTopicFolderSummary | undefined,
  now = Date.now(),
): { due: boolean; interval?: TRefreshInterval; reason?: string; scopes?: TTopicRefreshScope[] } => {
  const refresh = normalizeRefreshPolicy(entry.refresh);

  if (!refresh?.enabled || !refresh.interval) {
    return { due: false };
  }

  const elapsed = now - Date.parse(referenceTimestamp(entry, folder));

  if (Number.isNaN(elapsed) || elapsed < intervalToMs(refresh.interval)) {
    return { due: false };
  }

  return {
    due: true,
    interval: refresh.interval,
    reason: `elapsed >= ${refresh.interval}`,
    scopes: refresh.scopes,
  };
};

export const evaluateKnowledgeRefresh = async (): Promise<{
  checkedAt: string;
  staleTopics: TStaleTopic[];
}> => {
  const registry = await loadNormalizedRegistry();
  const summaries = await listTopicFolderSummaries();
  const summaryBySlug = new Map(summaries.map((summary) => [summary.slug, summary]));
  const staleTopics: TStaleTopic[] = [];
  const seen = new Set<string>();

  for (const entry of registry.topics) {
    const folder = summaryBySlug.get(entry.canonical)
      ?? entry.aliases.map((alias) => summaryBySlug.get(alias)).find(Boolean);
    const due = isTopicRefreshDue(entry, folder);

    if (!due.due || !due.interval || seen.has(entry.canonical)) {
      continue;
    }

    seen.add(entry.canonical);
    staleTopics.push({
      canonical: entry.canonical,
      interval: due.interval,
      reason: due.reason ?? 'due',
      scopes: due.scopes ?? DEFAULT_REFRESH_SCOPES,
    });
  }

  return {
    checkedAt: nowIso(),
    staleTopics: staleTopics.sort((left, right) => left.canonical.localeCompare(right.canonical)),
  };
};
