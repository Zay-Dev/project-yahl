import { parseUrlSignals } from './topic-slug.js';
import { registerTopic, resolveCanonicalTopic } from './topic-registry.js';

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
