import fs from 'fs/promises';
import path from 'path';

import {
  formatObservationApplyBody,
  validateApplyPlan,
  type TApplyPlan,
  type TApplyPlanOp,
} from './apply-plan.js';
import { readKnowledgeWikiConfig } from './config.js';
import { WIKI_OBSERVATIONS_PREFIX } from './content-model.js';
import { applyDedupAction } from './dedup.js';
import {
  listExportTopicFiles,
  stripYamlFrontmatter,
} from './read-export-corpus.js';
import {
  listTopicFolderSummaries,
  loadRegistry,
} from './topic-registry.js';
import { runUpsertKnowledgePage } from './upsert.js';
import {
  getWikiPageByPath,
  listWikiPagesUnderPrefix,
  upsertWikiPage,
  wikiConfigured,
} from './wiki-client.js';
import { resolveTopicWikiPrefix } from './wiki-paths.js';

export type TManagerDepth = 'focus' | 'light';

export type TPendingObservation = {
  claim: string;
  confidence: string;
  content: string;
  cue: string;
  example?: string;
  evidence?: Record<string, unknown>;
  id: string;
  needsValidation: boolean;
  pagePath: string;
  quote?: string;
  status?: string;
  tags: string[];
  topicHint: string;
  validationReasons: string[];
};

export type TTopicReviewRecord = {
  depth: TManagerDepth;
  honeApplied: number;
  honeSkipped: number;
  opsApplied: number;
  opsDiscarded: number;
  quizTodoAdded: boolean;
  topic: string;
  transfersProposed: number;
};

export type TKnowledgeManagerReport = {
  approvedTransfersApplied: number;
  instructionPreview: string;
  reviewedAt: string;
  reviews: TTopicReviewRecord[];
  topicCount: number;
};

export type TManagerTopicRow = {
  depth: TManagerDepth;
  topic: string;
};

export type TTopicGroup = {
  id: string;
  rationale: string;
  topics: string[];
};

export type TTopicIntake = {
  depth: TManagerDepth;
  excerpts: {
    howto?: string;
    place?: string;
    qa?: string;
  };
  needsValidation: TPendingObservation[];
  observations: TPendingObservation[];
  placePage: string;
  topic: string;
};

export type TCompleteApplyPlan = (params: {
  depth: TManagerDepth;
  instruction: string;
  observations: TPendingObservation[];
  topic: string;
}) => Promise<unknown>;

const sessionApiBase = () =>
  (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, '');

const mastermindApiBase = () =>
  (process.env.MASTERMIND_API_URL?.trim() || 'http://mastermind:4100').replace(/\/+$/, '');

export const readInstructionFile = async (): Promise<string> => {
  const registryPath = readKnowledgeWikiConfig().topicsRegistryPath;
  const filePath = path.join(path.dirname(registryPath), 'knowledge-manager-instruction.md');

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
};

export const resolveManagerDepth = (topic: string, instruction: string): TManagerDepth => {
  const focusBlock = instruction.match(/Focus:\s*([\s\S]*?)(?:\n\s*\n|$)/i)?.[1] ?? instruction;
  const slug = topic.trim().toLowerCase();

  if (!slug) {
    return 'light';
  }

  if (focusBlock.toLowerCase().includes(slug)) {
    return 'focus';
  }

  const compact = slug.replace(/-/g, ' ');

  if (compact.length >= 4 && focusBlock.toLowerCase().includes(compact)) {
    return 'focus';
  }

  return 'light';
};

export const listManagerTopics = async (): Promise<string[]> => {
  const summaries = await listTopicFolderSummaries();
  const registry = await loadRegistry();
  const slugs = [
    ...summaries.map((row) => row.slug),
    ...registry.topics.map((row) => row.canonical),
  ];

  return [...new Set(slugs)].filter(Boolean).sort((left, right) => left.localeCompare(right));
};

export const listManagerTopicRows = async (instruction?: string): Promise<TManagerTopicRow[]> => {
  const text = instruction ?? await readInstructionFile();
  const topics = await listManagerTopics();

  return topics.map((topic) => ({
    depth: resolveManagerDepth(topic, text),
    topic,
  }));
};

const parseTagsLine = (raw: string | undefined): string[] => {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseEvidenceBlock = (content: string): Record<string, unknown> | undefined => {
  const match = content.match(/## Evidence\s*\n+```json\s*([\s\S]*?)```/i);

  if (!match?.[1]?.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(match[1].trim()) as unknown;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const observationValidationReasons = (params: {
  claim: string;
  confidence: string;
  cue: string;
  example?: string;
  evidence?: Record<string, unknown>;
  quote?: string;
  tags: string[];
}): string[] => {
  const reasons: string[] = [];

  if (params.tags.some((tag) => tag.toUpperCase() === 'PLACE')) {
    reasons.push('place_tag');
  }

  if (params.confidence === 'inferred') {
    reasons.push('inferred_confidence');
  }

  const evidenceKeys = params.evidence ? Object.keys(params.evidence) : [];

  if (params.tags.some((tag) => tag.toUpperCase() === 'PLACE') && !evidenceKeys.includes('bound_poi') && !evidenceKeys.includes('claimed_place')) {
    reasons.push('weak_place_evidence');
  }

  if (params.tags.some((tag) => tag.toUpperCase() === 'SUMMARY') && evidenceKeys.length <= 2) {
    reasons.push('weak_summary_evidence');
  }

  return reasons;
};

const parseObservationMarkdown = (
  content: string,
  pagePath: string,
): TPendingObservation | null => {
  const idMatch = content.match(/^- id:\s*(.+)$/m);
  const topicMatch = content.match(/^- topic_hint:\s*(.+)$/m);
  const confidenceMatch = content.match(/^- confidence:\s*(.+)$/m);
  const cueMatch = content.match(/^- cue:\s*(.+)$/m);
  const tagsMatch = content.match(/^- tags:\s*(.+)$/m);
  const statusMatch = content.match(/^- status:\s*(.+)$/m);
  const claimMatch = content.match(/## Claim\s*\n+([\s\S]*?)(?=\n## |\n```|$)/);
  const exampleMatch = content.match(/## Example\s*\n+([\s\S]*?)(?=\n## |\n```|$)/);
  const quoteMatch = content.match(/## Quote\s*\n+([\s\S]*?)(?=\n## |\n```|$)/);

  const claim = claimMatch?.[1]?.trim();
  const cue = cueMatch?.[1]?.trim();
  const topicHint = topicMatch?.[1]?.trim();
  const status = statusMatch?.[1]?.trim().toLowerCase();

  if (!claim || !cue || !topicHint) {
    return null;
  }

  if (status === 'applied' || status === 'discarded' || status === 'consumed') {
    return null;
  }

  const tags = parseTagsLine(tagsMatch?.[1]);
  const evidence = parseEvidenceBlock(content);
  const confidence = confidenceMatch?.[1]?.trim() || 'observed';
  const example = exampleMatch?.[1]?.trim() || undefined;
  const quote = quoteMatch?.[1]?.trim() || undefined;
  const validationReasons = observationValidationReasons({
    claim,
    confidence,
    cue,
    example,
    evidence,
    quote,
    tags,
  });

  return {
    claim,
    confidence,
    content,
    cue,
    example,
    evidence,
    id: idMatch?.[1]?.trim() || path.basename(pagePath),
    needsValidation: validationReasons.length > 0,
    pagePath,
    quote,
    status,
    tags,
    topicHint,
    validationReasons,
  };
};

export const listPendingObservations = async (topic: string): Promise<TPendingObservation[]> => {
  const found: TPendingObservation[] = [];
  const prefix = `${resolveTopicWikiPrefix(topic)}/${WIKI_OBSERVATIONS_PREFIX}`;

  if (wikiConfigured()) {
    const pages = await listWikiPagesUnderPrefix(prefix);

    for (const page of pages) {
      if (!page.content?.trim()) {
        continue;
      }

      const parsed = parseObservationMarkdown(page.content, page.path);

      if (parsed) {
        found.push(parsed);
      }
    }
  }

  if (found.length === 0) {
    const files = await listExportTopicFiles(topic);
    const observationFiles = files.filter((file) =>
      file.relativePath.replace(/\\/g, '/').includes(`/${WIKI_OBSERVATIONS_PREFIX}/`)
      || file.relativePath.replace(/\\/g, '/').startsWith(`${WIKI_OBSERVATIONS_PREFIX}/`));

    for (const file of observationFiles) {
      const parsed = parseObservationMarkdown(stripYamlFrontmatter(file.content), file.relativePath);

      if (parsed) {
        found.push(parsed);
      }
    }
  }

  return found;
};

const extractSection = (content: string, heading: RegExp): string | undefined => {
  const match = content.match(new RegExp(`(^|\\n)##\\s+${heading.source}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i'));
  const body = match?.[2]?.trim();

  return body ? body.slice(0, 4000) : undefined;
};

export const resolvePlacePageForTopic = async (_topic: string): Promise<string> => 'facts';

export const loadTopicExcerpts = async (topic: string): Promise<TTopicIntake['excerpts']> => {
  const files = await listExportTopicFiles(topic);
  const joined = files.map((file) => file.content).join('\n\n');

  return {
    howto: extractSection(joined, /HOWTO/),
    place: extractSection(joined, /PLACE/),
    qa: extractSection(joined, /Q&A|QA/),
  };
};

export const buildTopicIntake = async (params: {
  instruction?: string;
  topic: string;
}): Promise<TTopicIntake> => {
  const instruction = params.instruction ?? await readInstructionFile();
  const depth = resolveManagerDepth(params.topic, instruction);
  const observations = await listPendingObservations(params.topic);
  const excerpts = await loadTopicExcerpts(params.topic);
  const placePage = await resolvePlacePageForTopic(params.topic);

  const needsValidation = observations.filter((row) => row.needsValidation);

  return {
    depth,
    excerpts,
    needsValidation,
    observations,
    placePage,
    topic: params.topic,
  };
};

export const isHoneableWikiPagePath = (pagePath: string, topic?: string): boolean => {
  const normalized = pagePath.replace(/^\/+/, '').replace(/^en\//, '');

  if (!/^topics\/[^/]+\/.+/.test(normalized)) {
    return false;
  }

  if (normalized.includes(`/${WIKI_OBSERVATIONS_PREFIX}/`) || /\/raw\//.test(normalized)) {
    return false;
  }

  if (topic?.trim()) {
    const prefix = `topics/${topic.trim()}/`;

    if (!normalized.startsWith(prefix)) {
      return false;
    }
  }

  return true;
};

export const honeTopicPages = async (topic: string): Promise<{
  applied: number;
  skipped: number;
}> => {
  if (!wikiConfigured()) {
    return { applied: 0, skipped: 0 };
  }

  const pages = await listWikiPagesUnderPrefix(resolveTopicWikiPrefix(topic));
  let applied = 0;
  let skipped = 0;

  for (const page of pages) {
    const pagePath = page.path.replace(/^en\//, '');

    if (!isHoneableWikiPagePath(pagePath, topic)) {
      skipped += 1;
      continue;
    }

    try {
      const result = await applyDedupAction({
        action: 'collapse_all_sections',
        pagePath,
      });

      if (result.status === 'applied') {
        applied += 1;
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  return { applied, skipped };
};

const primaryTag = (tags: string[]): string | undefined => {
  const upper = tags.map((tag) => tag.toUpperCase());

  for (const candidate of ['PLACE', 'HOWTO', 'Q&A', 'QA', 'TRICK', 'SUMMARY']) {
    if (upper.includes(candidate)) {
      return candidate === 'QA' ? 'Q&A' : candidate;
    }
  }

  return tags[0]?.toUpperCase();
};

export const HEURISTIC_APPLY_OBS_THRESHOLD = 15;
export const HEURISTIC_APPLY_PLACE_THRESHOLD = 3;

export const shouldUseHeuristicApplyPlan = (
  observations: TPendingObservation[],
): boolean => {
  if (observations.length >= HEURISTIC_APPLY_OBS_THRESHOLD) {
    return true;
  }

  const placeCount = observations.filter((observation) =>
    (observation.tags ?? []).some((tag) => tag.toUpperCase() === 'PLACE'),
  ).length;

  return placeCount >= HEURISTIC_APPLY_PLACE_THRESHOLD;
};

export const buildHeuristicApplyPlan = (
  topic: string,
  observations: TPendingObservation[],
  options?: { placePage?: string },
): TApplyPlan => {
  const ops: TApplyPlanOp[] = [];
  const placePage = options?.placePage?.trim() || 'facts';

  for (const observation of observations) {
    if (observation.confidence === 'inferred') {
      ops.push({
        content: formatObservationApplyBody({
          claim: observation.claim,
          cue: observation.cue,
          example: observation.example,
          quote: observation.quote,
        }),
        mode: 'append',
        observationIds: [observation.id],
        op: 'todo',
        page: 'todo',
        rationale: 'inferred confidence → todo',
      });
      continue;
    }

    const tag = primaryTag(observation.tags ?? []);
    const section = observation.cue.slice(0, 80);

    if (tag === 'SUMMARY') {
      ops.push({
        content: formatObservationApplyBody({
          claim: observation.claim,
          cue: observation.cue,
          example: observation.example,
          quote: observation.quote,
        }),
        mode: 'append',
        observationIds: [observation.id],
        op: 'append_raw',
        page: `raw/manager-${observation.id}`,
        rationale: 'SUMMARY → append_raw only',
      });
      continue;
    }

    if (tag === 'PLACE') {
      ops.push({
        content: formatObservationApplyBody({
          claim: observation.claim,
          cue: observation.cue,
          example: observation.example,
          quote: observation.quote,
        }),
        mode: 'append',
        observationIds: [observation.id],
        op: 'merge',
        page: placePage,
        rationale: `promote PLACE ${observation.confidence}`,
        section: 'PLACE',
      });
      continue;
    }

    if (tag === 'HOWTO' || tag === 'TRICK' || tag === 'Q&A') {
      ops.push({
        content: formatObservationApplyBody({
          claim: observation.claim,
          cue: observation.cue,
          example: observation.example,
          quote: observation.quote,
        }),
        mode: 'append',
        observationIds: [observation.id],
        op: 'merge',
        page: placePage,
        rationale: `promote ${tag} ${observation.confidence}`,
        section: tag === 'TRICK' ? 'ops-log' : tag,
      });
      continue;
    }

    ops.push({
      content: formatObservationApplyBody({
        claim: observation.claim,
        cue: observation.cue,
        example: observation.example,
        quote: observation.quote,
      }),
      mode: 'append',
      observationIds: [observation.id],
      op: 'merge',
      page: 'facts',
      rationale: `promote ${observation.confidence} observation`,
      section,
    });
  }

  return { ops, topic };
};

const mapOpToUpsert = async (topic: string, op: TApplyPlanOp): Promise<'applied' | 'discarded' | 'skipped'> => {
  if (op.op === 'discard') {
    return 'discarded';
  }

  if (op.op === 'transfer') {
    return 'skipped';
  }

  const content = op.content?.trim();

  if (!content && op.op !== 'todo') {
    return 'skipped';
  }

  const page = op.page
    ?? (op.op === 'todo' ? 'todo' : op.op === 'append_raw' ? `raw/manager-${Date.now()}` : 'facts');

  if (op.op === 'append_raw' && !page.startsWith('raw/')) {
    return 'skipped';
  }

  const mode = op.mode
    ?? (op.op === 'replace_section' ? 'replace' : 'append');

  const result = await runUpsertKnowledgePage({
    content: content
      ?? formatObservationApplyBody({ claim: op.claim ?? 'todo', cue: op.section }),
    mode: op.op === 'replace_section' ? 'replace' : mode,
    page,
    section: op.section,
    topic,
  });

  return result.ok ? 'applied' : 'skipped';
};

const proposeTransfer = async (params: {
  op: TApplyPlanOp;
  sessionId?: string;
  sourceTopic: string;
}): Promise<boolean> => {
  const body = {
    args: {
      claim: params.op.claim,
      example: params.op.example,
      evidence: params.op.evidence,
      observationIds: params.op.observationIds,
      rationale: params.op.rationale,
      sourceTopic: params.sourceTopic,
      targetTopic: params.op.targetTopic,
    },
    caller: 'stage-agent',
    sessionId: params.sessionId,
  };

  try {
    const res = await fetch(`${mastermindApiBase()}/v1/skills/propose-knowledge-transfer`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    return res.ok;
  } catch {
    return false;
  }
};

const formatTransferBody = (payload: Record<string, unknown>): string => {
  const claim = typeof payload.claim === 'string' ? payload.claim : '';
  const example = typeof payload.example === 'string' ? payload.example : '';
  const rationale = typeof payload.rationale === 'string' ? payload.rationale : '';
  const sourceTopic = typeof payload.sourceTopic === 'string' ? payload.sourceTopic : '';

  return formatObservationApplyBody({
    claim: claim || rationale || 'approved knowledge transfer',
    cue: sourceTopic ? `from ${sourceTopic}` : 'transfer',
    example: example || undefined,
  });
};

export const applyApprovedTransfers = async (): Promise<number> => {
  let items: Array<{ id: string; kind: string; payload: Record<string, unknown> }> = [];

  try {
    const res = await fetch(`${sessionApiBase()}/api/platform/work/pending`);
    const data = await res.json() as { items?: typeof items };

    if (!res.ok || !Array.isArray(data.items)) {
      return 0;
    }

    items = data.items.filter((item) => item.kind === 'knowledge_transfer');
  } catch {
    return 0;
  }

  let applied = 0;

  for (const item of items) {
    const targetTopic = typeof item.payload.targetTopic === 'string'
      ? item.payload.targetTopic
      : '';

    if (!targetTopic) {
      continue;
    }

    const page = typeof item.payload.page === 'string' ? item.payload.page : 'facts';
    const section = typeof item.payload.section === 'string' ? item.payload.section : undefined;
    const content = typeof item.payload.content === 'string' && item.payload.content.trim()
      ? item.payload.content
      : formatTransferBody(item.payload);
    const mode = item.payload.mode === 'replace' || item.payload.mode === 'create'
      ? item.payload.mode
      : 'append';

    const result = await runUpsertKnowledgePage({
      content,
      mode,
      page,
      section,
      topic: targetTopic,
    });

    if (!result.ok) {
      continue;
    }

    try {
      await fetch(`${sessionApiBase()}/api/platform/work/knowledge-transfer/${encodeURIComponent(item.id)}/done`, {
        method: 'POST',
      });
      applied += 1;
    } catch {
      applied += 1;
    }
  }

  return applied;
};

const maybeAddQuizTodo = async (params: {
  depth: TManagerDepth;
  topic: string;
}): Promise<boolean> => {
  if (params.depth !== 'focus') {
    return false;
  }

  const files = await listExportTopicFiles(params.topic);
  const hasQa = files.some((file) => /##\s*Q&A/i.test(file.content));

  if (hasQa) {
    return false;
  }

  const result = await runUpsertKnowledgePage({
    content: `- [${new Date().toISOString().slice(0, 10)}] Retrieval audit: add Q&A cues with worked answers for ${params.topic}\n`,
    mode: 'append',
    page: 'todo',
    topic: params.topic,
  });

  return result.ok;
};

export const applyPlanOps = async (params: {
  plan: TApplyPlan;
  sessionId?: string;
}): Promise<{
  discarded: number;
  opsApplied: number;
  transfersProposed: number;
  observationIds: string[];
}> => {
  let opsApplied = 0;
  let discarded = 0;
  let transfersProposed = 0;
  const observationIds: string[] = [];

  for (const op of params.plan.ops) {
    if (op.observationIds?.length) {
      observationIds.push(...op.observationIds);
    }

    if (op.op === 'transfer') {
      const ok = await proposeTransfer({
        op,
        sessionId: params.sessionId,
        sourceTopic: params.plan.topic,
      });

      if (ok) {
        transfersProposed += 1;
      }

      continue;
    }

    const status = await mapOpToUpsert(params.plan.topic, op);

    if (status === 'applied') {
      opsApplied += 1;
    } else if (status === 'discarded') {
      discarded += 1;
    }
  }

  return { discarded, observationIds: [...new Set(observationIds)], opsApplied, transfersProposed };
};

const markObservationStatus = async (params: {
  observation: TPendingObservation;
  status: 'applied' | 'discarded';
  topic: string;
}): Promise<boolean> => {
  if (!params.observation.pagePath) {
    return false;
  }

  const stamped = params.observation.content.includes('- status:')
    ? params.observation.content.replace(/^- status:\s*.+$/m, `- status: ${params.status}`)
    : params.observation.content.replace(
      /^- cue:\s*.+$/m,
      (line) => `${line}\n- status: ${params.status}`,
    );

  if (wikiConfigured()) {
    const wikiPath = params.observation.pagePath.startsWith('topics/')
      ? params.observation.pagePath
      : `${resolveTopicWikiPrefix(params.topic)}/${params.observation.pagePath.replace(/^\/+/, '')}`;

    try {
      const existing = await getWikiPageByPath(wikiPath);

      if (existing) {
        await upsertWikiPage({
          content: stamped,
          mode: 'replace',
          pagePath: wikiPath,
        });

        return true;
      }
    } catch {
      // fall through
    }
  }

  const page = params.observation.pagePath.includes(WIKI_OBSERVATIONS_PREFIX)
    ? params.observation.pagePath
      .replace(/^topics\/[^/]+\//, '')
      .replace(/\.md$/, '')
    : `${WIKI_OBSERVATIONS_PREFIX}/${params.observation.id}`;

  const result = await runUpsertKnowledgePage({
    content: stamped,
    mode: 'replace',
    page,
    topic: params.topic,
  });

  return result.ok;
};

export const consumeObservations = async (params: {
  observations: TPendingObservation[];
  plan: TApplyPlan;
  topic: string;
}): Promise<number> => {
  const discardedIds = new Set(
    params.plan.ops.filter((op) => op.op === 'discard').flatMap((op) => op.observationIds ?? []),
  );
  const appliedIds = new Set(
    params.plan.ops
      .filter((op) => op.op !== 'discard' && op.op !== 'transfer')
      .flatMap((op) => op.observationIds ?? []),
  );

  let consumed = 0;

  for (const observation of params.observations) {
    if (discardedIds.has(observation.id)) {
      if (await markObservationStatus({ observation, status: 'discarded', topic: params.topic })) {
        consumed += 1;
      }
      continue;
    }

    if (appliedIds.has(observation.id)) {
      if (await markObservationStatus({ observation, status: 'applied', topic: params.topic })) {
        consumed += 1;
      }
    }
  }

  return consumed;
};

export const applyManagerTopic = async (options: {
  completeApplyPlan?: TCompleteApplyPlan;
  dryRun?: boolean;
  instruction?: string;
  sessionId?: string;
  topic: string;
}): Promise<TTopicReviewRecord & { consumed: number }> => {
  const instruction = options.instruction ?? await readInstructionFile();
  const topic = options.topic.trim();
  const depth = resolveManagerDepth(topic, instruction);
  const placePage = await resolvePlacePageForTopic(topic);
  const hone = options.dryRun
    ? { applied: 0, skipped: 0 }
    : await honeTopicPages(topic);
  const observations = await listPendingObservations(topic);

  let plan: TApplyPlan = { ops: [], topic };

  if (observations.length > 0) {
    const useLlm = Boolean(options.completeApplyPlan)
      && !shouldUseHeuristicApplyPlan(observations);

    if (useLlm && options.completeApplyPlan) {
      try {
        const raw = await options.completeApplyPlan({
          depth,
          instruction,
          observations,
          topic,
        });
        const validated = validateApplyPlan(raw, topic);

        plan = validated.ok
          ? validated.plan
          : buildHeuristicApplyPlan(topic, observations, { placePage });
      } catch {
        plan = buildHeuristicApplyPlan(topic, observations, { placePage });
      }
    } else {
      plan = buildHeuristicApplyPlan(topic, observations, { placePage });
    }
  }

  const applied = options.dryRun
    ? { discarded: 0, observationIds: [], opsApplied: 0, transfersProposed: 0 }
    : await applyPlanOps({ plan, sessionId: options.sessionId });

  const consumed = options.dryRun
    ? 0
    : await consumeObservations({ observations, plan, topic });

  const quizTodoAdded = options.dryRun
    ? false
    : await maybeAddQuizTodo({ depth, topic });

  return {
    consumed,
    depth,
    honeApplied: hone.applied,
    honeSkipped: hone.skipped,
    opsApplied: applied.opsApplied,
    opsDiscarded: applied.discarded,
    quizTodoAdded,
    topic,
    transfersProposed: applied.transfersProposed,
  };
};

const slugPrefixToken = (topic: string): string => {
  const slug = topic.trim().toLowerCase();
  const dash = slug.indexOf('-');

  return dash > 0 ? slug.slice(0, dash) : slug;
};

export const groupManagerTopics = (topics: string[]): TTopicGroup[] => {
  const byPrefix = new Map<string, string[]>();

  for (const topic of topics) {
    const prefix = slugPrefixToken(topic);

    if (!prefix) {
      continue;
    }

    const bucket = byPrefix.get(prefix) ?? [];
    bucket.push(topic);
    byPrefix.set(prefix, bucket);
  }

  const groups: TTopicGroup[] = [];

  for (const [prefix, members] of [...byPrefix.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    const sorted = [...members].sort((left, right) => left.localeCompare(right));

    if (sorted.length >= 2) {
      groups.push({
        id: `prefix-${prefix}`,
        rationale: `Shared slug prefix "${prefix}"`,
        topics: sorted,
      });
      continue;
    }

    for (const topic of sorted) {
      groups.push({
        id: `solo-${topic}`,
        rationale: 'Singleton — no shared slug prefix cluster',
        topics: [topic],
      });
    }
  }

  return groups;
};

export const runKnowledgeManager = async (options?: {
  completeApplyPlan?: TCompleteApplyPlan;
  dryRun?: boolean;
  sessionId?: string;
  topics?: string[];
}): Promise<TKnowledgeManagerReport> => {
  const instruction = await readInstructionFile();
  const topics = options?.topics?.length
    ? options.topics
    : await listManagerTopics();
  const reviews: TTopicReviewRecord[] = [];

  for (const topic of topics) {
    const review = await applyManagerTopic({
      completeApplyPlan: options?.completeApplyPlan,
      dryRun: options?.dryRun,
      instruction,
      sessionId: options?.sessionId,
      topic,
    });

    reviews.push({
      depth: review.depth,
      honeApplied: review.honeApplied,
      honeSkipped: review.honeSkipped,
      opsApplied: review.opsApplied,
      opsDiscarded: review.opsDiscarded,
      quizTodoAdded: review.quizTodoAdded,
      topic: review.topic,
      transfersProposed: review.transfersProposed,
    });
  }

  const approvedTransfersApplied = options?.dryRun
    ? 0
    : await applyApprovedTransfers();

  return {
    approvedTransfersApplied,
    instructionPreview: instruction.slice(0, 240),
    reviewedAt: new Date().toISOString(),
    reviews,
    topicCount: topics.length,
  };
};
