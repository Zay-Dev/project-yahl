import { auditTopicWiki } from './wiki/audit-topic.js';
import {
  loadRegistry,
  listTopicFolderSummaries,
  type TTopicRegistryEntry,
} from './topic-registry.js';

export type { TTopicWikiAudit, TTopicWikiIssue } from './wiki/audit-topic.js';

export type TTidyKnowledgeReport = {
  applied: boolean;
  dryRun: boolean;
  topicCount: number;
  topics: Awaited<ReturnType<typeof auditTopicWiki>>[];
};

const resolveWikiAuditSlugs = (
  summaries: { slug: string }[],
  registryTopics: TTopicRegistryEntry[],
  options?: { topic?: string },
): string[] => {
  if (options?.topic?.trim()) {
    return [options.topic.trim()];
  }

  const summarySlugs = summaries.map((summary) => summary.slug);
  const registrySlugs = registryTopics.map((entry) => entry.canonical);

  return [...new Set([...summarySlugs, ...registrySlugs])].filter(Boolean);
};

export const runTidyKnowledge = async (options?: {
  dryRun?: boolean;
  topic?: string;
}): Promise<TTidyKnowledgeReport> => {
  const dryRun = options?.dryRun !== false;
  const summaries = await listTopicFolderSummaries();
  const registry = await loadRegistry();
  const slugs = resolveWikiAuditSlugs(summaries, registry.topics, options);
  const topics = await Promise.all(slugs.map((slug) => auditTopicWiki(slug)));

  return {
    applied: !dryRun,
    dryRun,
    topicCount: topics.length,
    topics,
  };
};
