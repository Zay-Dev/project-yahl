import fs from 'fs/promises';
import path from 'path';

import { config } from '../config.js';

import { sanitizeSegment } from './topic-slug.js';

export type TSessionKnowledgeExtract = {
  absent: boolean;
  extracted: string | null;
  extractedAt: string;
  need: string;
  topic?: string;
};

export type TSessionKnowledgeWritePath = {
  absolute: string;
  agentPath: string;
  key: string;
};

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const validateSessionId = (sessionId: string): string | null => {
  const trimmed = sessionId.trim();

  if (!trimmed) {
    return 'sessionId required';
  }

  if (!SESSION_ID_PATTERN.test(trimmed)) {
    return 'invalid sessionId';
  }

  return null;
};

const deriveBaseKey = (need: string): string => {
  const slug = sanitizeSegment(need).slice(0, 64);

  return slug || 'extract';
};

export const resolveUniqueSessionKnowledgeKey = async (
  sessionId: string,
  need: string,
): Promise<string> => {
  const baseKey = deriveBaseKey(need);
  const knowledgeDir = path.join(config.workspaceRoot, 'sessions', sessionId, 'knowledge');
  let candidate = baseKey;
  let suffix = 2;

  while (await fs.stat(path.join(knowledgeDir, `${candidate}.json`)).then(() => true).catch(() => false)) {
    candidate = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

export const resolveSessionKnowledgeWritePath = (
  sessionId: string,
  key: string,
): TSessionKnowledgeWritePath => {
  const sessionError = validateSessionId(sessionId);

  if (sessionError) {
    throw new Error(sessionError);
  }

  const sanitizedKey = sanitizeSegment(key);

  if (!sanitizedKey) {
    throw new Error('invalid knowledge extract key');
  }

  const absolute = path.join(
    config.workspaceRoot,
    'sessions',
    sessionId,
    'knowledge',
    `${sanitizedKey}.json`,
  );

  return {
    absolute,
    agentPath: `~/knowledge/${sanitizedKey}.json`,
    key: sanitizedKey,
  };
};

export const writeSessionKnowledgeExtract = async (input: {
  absent: boolean;
  extracted: string | null;
  key: string;
  need: string;
  sessionId: string;
  topic?: string;
}): Promise<TSessionKnowledgeWritePath> => {
  const { absolute, agentPath, key } = resolveSessionKnowledgeWritePath(input.sessionId, input.key);
  const payload: TSessionKnowledgeExtract = {
    absent: input.absent,
    extracted: input.absent ? null : input.extracted,
    extractedAt: new Date().toISOString(),
    need: input.need,
    ...(input.topic?.trim() ? { topic: input.topic.trim() } : {}),
  };

  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return { absolute, agentPath, key };
};

export const isExtractAbsent = (text: string): boolean =>
  text.trim() === '<none>';
