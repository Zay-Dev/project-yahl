import {
  registerTopic,
  resolveCanonicalTopic,
} from './topic-registry.js';
import { parseUrlSignals, sanitizeSegment, slugifyTopicText } from './topic-slug.js';

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
  resolveTopicPolicy,
  type TPatchTopicPolicyInput,
  type TStaleTopic,
  type TTopicPolicyRow,
} from './topic-refresh.js';

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
