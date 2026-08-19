import fs from 'node:fs/promises';

const PURPOSE_INCLUDE_RAW_RE = /\bincludeRaw\s*:\s*true\b|search\s+raw\s+observations|\braw\/observations\b/i;

const sanitizeSlug = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const readRegistryFallback = async (slug) => {
  const registryPath = process.env.TOPICS_REGISTRY_PATH?.trim()
    || '/data/mastermind/topics.json';

  try {
    const raw = await fs.readFile(registryPath, 'utf8');
    const parsed = JSON.parse(raw);
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
    const entry = topics.find((topic) => (
      topic?.canonical === slug || (Array.isArray(topic?.aliases) && topic.aliases.includes(slug))
    ));

    if (!entry?.canonical) {
      return null;
    }

    return {
      aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
      canonical: entry.canonical,
      matchedBy: 'slug',
    };
  } catch {
    return null;
  }
};

export const purposeIncludesRaw = (purpose) => PURPOSE_INCLUDE_RAW_RE.test(String(purpose ?? ''));

export const resolveTopicScopeValues = async (topic, purpose = '') => {
  const requested = String(topic ?? '').trim();
  const includeRaw = purposeIncludesRaw(purpose) ? 'true' : 'false';

  if (!requested) {
    return {
      aliasTopics: '',
      canonicalTopic: '',
      includeRaw,
      topic: '',
    };
  }

  const slug = sanitizeSlug(requested);
  let resolved = null;

  try {
    const { resolveCanonicalTopic } = await import('/opt/nixery/plugin/lib/dist/topic-registry.js');
    resolved = await resolveCanonicalTopic({ slug: requested });
  } catch {
    resolved = await readRegistryFallback(slug);
  }

  const canonical = resolved?.canonical || slug;
  const aliases = [...new Set([
    ...(Array.isArray(resolved?.aliases) ? resolved.aliases : []),
  ].filter((alias) => alias && alias !== canonical))];

  return {
    aliasTopics: aliases.length ? aliases.join(', ') : '(none)',
    canonicalTopic: canonical,
    includeRaw,
    topic: requested,
  };
};
