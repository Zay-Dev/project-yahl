import {
  measurePersistPayloadBytes,
  shouldPersistAsMarkdown,
} from './knowledge-format.js';

export const PERSIST_KNOWLEDGE_MAX_VALUE_BYTES = 256 * 1024;

const normalizeClaimFingerprint = (claim: string, sourceUrl: string) =>
  `${claim.trim().toLowerCase()}|${sourceUrl.trim().toLowerCase()}`;

export const normalizePersistKnowledgeValue = (key: string, value: unknown): unknown => {
  if (key !== 'facts' || !value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as { items?: unknown[] };
  const items = Array.isArray(record.items) ? record.items : null;

  if (!items) {
    return value;
  }

  const seen = new Set<string>();
  const deduped: unknown[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const claim = String((item as { claim?: string }).claim ?? '');
    const sourceUrl = String((item as { sourceUrl?: string }).sourceUrl ?? '');
    const fingerprint = normalizeClaimFingerprint(claim, sourceUrl);

    if (!claim.trim() || seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    deduped.push(item);
  }

  return {
    ...record,
    items: deduped,
  };
};

export const validatePersistKnowledgeValue = (key: string, value: unknown): string | null => {
  if (key === 'sources') {
    if (!Array.isArray(value)) {
      return 'upsert-knowledge-page sources must be an array';
    }

    const studyKeys = new Set<string>();

    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return 'upsert-knowledge-page sources items must be objects';
      }

      const studyKey = (item as { studyKey?: string }).studyKey?.trim();

      if (!studyKey) {
        return 'upsert-knowledge-page sources items require studyKey';
      }

      if (studyKeys.has(studyKey)) {
        return `upsert-knowledge-page duplicate studyKey: ${studyKey}`;
      }

      studyKeys.add(studyKey);
    }
  }

  if (key === 'facts') {
    const items = value
      && typeof value === 'object'
      && !Array.isArray(value)
      && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : null;

    if (!items) {
      return 'upsert-knowledge-page facts must be an object with items array';
    }
  }

  return null;
};

export const validatePersistPayloadSize = (key: string, value: unknown): string | null => {
  const payloadBytes = measurePersistPayloadBytes(
    key,
    value,
    shouldPersistAsMarkdown(key, value) ? '.md' : '.json',
  );

  if (payloadBytes > PERSIST_KNOWLEDGE_MAX_VALUE_BYTES) {
    return 'value too large; persist summary chunks under separate pages (e.g. studies/{slug}, facts)';
  }

  return null;
};

export const hasPathArgs = (args: Record<string, unknown>) =>
  typeof args.source === 'string'
  || typeof args.file === 'string'
  || typeof args.path === 'string';
