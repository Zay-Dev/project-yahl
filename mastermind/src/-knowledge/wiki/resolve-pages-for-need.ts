import { WIKI_RAW_PREFIX } from './content-model.js';
import { resolveReadPathsForKey } from './knowledge-key-map.js';
import { resolveTopicWikiPrefix } from './wiki-paths.js';

const BROAD_NEED_PATTERNS = [
  /^all\b/i,
  /\ball stage keys\b/i,
  /\bstudy keys\b/i,
  /\beverything\b/i,
  /\bfull corpus\b/i,
];

const tokenizeNeed = (need: string): string[] => {
  const trimmed = need.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/[,;]+/)
    .flatMap((part) => part.split(/\band\b/i))
    .map((token) => token.trim())
    .filter(Boolean);
};

const isBroadNeed = (need: string, tokens: string[]): boolean => {
  if (tokens.length === 0) {
    return true;
  }

  if (tokens.length >= 6) {
    return true;
  }

  return BROAD_NEED_PATTERNS.some((pattern) => pattern.test(need));
};

const normalizeLookupKey = (token: string): string =>
  token
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_*]/g, '');

const KNOWN_NEED_ALIASES: Record<string, string[]> = {
  all_stage_keys: [
    'identity',
    'background_summary',
    'goals',
    'priorities',
    'preferences',
    'constraints',
    'communication_style',
    'open_questions',
    'open_questions_qa',
    'user_profile_summary',
    'onboarding_completed_at',
  ],
  communication: ['communication_style'],
  key_facts_md: ['facts', 'key_facts_md'],
  qa_logs: ['open_questions_qa'],
  study_keys: [],
  todo: ['todo'],
  user_profile: ['user_profile_summary'],
};

export const resolvePagesForNeed = (
  need: string,
  canonical: string,
): { broad: boolean; pagePaths: string[] } => {
  const tokens = tokenizeNeed(need);
  const broad = isBroadNeed(need, tokens);
  const topicPrefix = resolveTopicWikiPrefix(canonical);

  if (broad) {
    return {
      broad: true,
      pagePaths: [topicPrefix],
    };
  }

  const pagePaths = new Set<string>();

  for (const token of tokens) {
    const normalized = normalizeLookupKey(token);
    const aliasKeys = KNOWN_NEED_ALIASES[normalized];

    if (aliasKeys) {
      if (normalized === 'study_keys') {
        pagePaths.add(`${topicPrefix}/studies`);
        pagePaths.add(`${topicPrefix}/${WIKI_RAW_PREFIX}`);
        continue;
      }

      for (const aliasKey of aliasKeys) {
        for (const path of resolveReadPathsForKey(aliasKey, canonical)) {
          pagePaths.add(path);
        }
      }

      continue;
    }

    const lookupKey = normalized.includes('study_') || normalized.startsWith('study')
      ? normalized.startsWith('study_') ? normalized : `study_${normalized.replace(/^study_?/, '')}`
      : normalized;

    try {
      for (const path of resolveReadPathsForKey(lookupKey, canonical)) {
        pagePaths.add(path);
      }
    } catch {
      // unknown token — skip; fall back to broad if nothing matched
    }
  }

  if (pagePaths.size === 0) {
    return {
      broad: true,
      pagePaths: [topicPrefix],
    };
  }

  return {
    broad: false,
    pagePaths: [...pagePaths],
  };
};
