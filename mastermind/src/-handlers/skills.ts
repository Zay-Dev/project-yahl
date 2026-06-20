import fs from 'fs/promises';
import path from 'path';

import {
  notificationProposalSchema,
  resolveWorkspacePath,
  type TSkillName,
  type TSkillRequest,
  type TSkillResponse,
  type TVerifyRequest,
  type TVerifyResponse,
} from '../../contract/index.js';

import {
  findKnowledgeFileForKey,
  hasPathArgs,
  readKnowledgeCorpus,
  resolveKnowledgeWritePath,
} from '../-knowledge/index.js';
import { formatShortError, writeAndAnalyzeCrash } from '../-crash-reports/index.js';
import { config, paths } from '../config.js';
import type { TMastermindAgent } from '../-sdk/agent.js';

const readKnowledgeSnippet = async (source?: string): Promise<string> => {
  if (!source) {
    return '';
  }

  const resolved = resolveWorkspacePath(source);
  const candidates = [
    resolved,
    path.join(paths.knowledges, source.replace(/^~\//, '')),
    path.join(paths.docs, source.replace(/^~\//, '')),
  ];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);

      if (stat.isFile()) {
        const content = await fs.readFile(candidate, 'utf8');

        return content.slice(0, 32_000);
      }
    } catch {
      // try next
    }
  }

  return '';
};

const buildSkillPrompt = async (
  name: TSkillName,
  args: Record<string, unknown>,
): Promise<string> => {
  const topic = String(args.topic ?? args.goal ?? args.file ?? args.source ?? '');
  const sourceContent = await readKnowledgeSnippet(
    typeof args.source === 'string' ? args.source : typeof args.file === 'string' ? args.file : undefined,
  );

  switch (name) {
    case 'research':
      return [
        'You are the YAHL mastermind research helper.',
        `Topic: ${topic}`,
        sourceContent ? `Reference:\n${sourceContent}` : '',
        'Return a concise structured summary as plain text.',
      ].filter(Boolean).join('\n\n');

    case 'extract-info':
      return [
        'You are the YAHL mastermind extract-info helper.',
        `Need: ${JSON.stringify(args.need ?? args.lookingFor ?? 'key facts')}`,
        sourceContent ? `Source:\n${sourceContent}` : `Source path: ${String(args.source ?? args.file ?? '')}`,
        'Extract only what was requested. Return plain text or JSON.',
      ].filter(Boolean).join('\n\n');

    case 'extract-knowledge': {
      const need = args.need ?? args.lookingFor ?? 'key facts';
      const knowledgeTopic = typeof args.topic === 'string' ? args.topic : undefined;
      const corpus = await readKnowledgeCorpus(64_000, knowledgeTopic);

      return [
        'You are the YAHL mastermind extract-knowledge helper.',
        'Read only from the knowledge corpus below.',
        `Need: ${JSON.stringify(need)}`,
        knowledgeTopic ? `Topic filter: ${knowledgeTopic}` : '',
        corpus ? `Knowledge corpus:\n${corpus}` : 'Knowledge corpus: (empty)',
        'Extract only what was requested. Return plain text or JSON.',
        'If the requested information is not present in the corpus, return exactly: <none>',
      ].filter(Boolean).join('\n\n');
    }

    case 'media-to-text':
      return [
        'You are the YAHL mastermind media-to-text helper.',
        `File: ${String(args.file ?? args.source ?? '')}`,
        sourceContent ? `Content preview:\n${sourceContent.slice(0, 8000)}` : '',
        'Transcribe or summarize the media content as plain text.',
      ].filter(Boolean).join('\n\n');

    case 'plan': {
      const goal = String(args.goal ?? args.topic ?? args.stageLogic ?? '');
      const stageLogic = typeof args.stageLogic === 'string' ? args.stageLogic.trim() : '';
      const contextJson = args.context && typeof args.context === 'object' && !Array.isArray(args.context)
        ? JSON.stringify(args.context, null, 2).slice(0, 8_000)
        : '';

      return [
        'You are the YAHL mastermind planning helper.',
        'Design a step-by-step execution plan for a stage agent.',
        'Do NOT execute changes, run tools, or write files.',
        'Your entire reply must be markdown only — no preamble, no status lines, no "I found…" narration.',
        '',
        'Use exactly this structure:',
        '# Plan',
        '## Goal',
        '## Context',
        '## Steps',
        '1. ...',
        '## Success criteria',
        '',
        `Goal: ${goal}`,
        stageLogic ? `Stage logic:\n${stageLogic.slice(0, 2_000)}` : '',
        contextJson ? `Available context:\n${contextJson}` : '',
      ].filter(Boolean).join('\n\n');
    }

    default:
      return `Unknown skill ${name}`;
  }
};

const runProposeNotification = async (
  args: Record<string, unknown>,
  sessionId?: string,
): Promise<TSkillResponse> => {
  const parsed = notificationProposalSchema.safeParse({
    ...args,
    sessionId: typeof args.sessionId === 'string' ? args.sessionId : sessionId,
  });

  if (!parsed.success) {
    return { error: parsed.error.message, ok: false };
  }

  const posted = await postProposal('notifications', parsed.data);

  if (!posted.ok) {
    return { error: posted.error ?? 'proposal failed', ok: false };
  }

  return {
    data: { proposalId: posted.id },
    ok: true,
  };
};

const runPersistKnowledge = async (
  args: Record<string, unknown>,
): Promise<TSkillResponse> => {
  if (hasPathArgs(args)) {
    return { ok: false, error: 'persist-knowledge does not accept file paths' };
  }

  const key = typeof args.key === 'string' ? args.key.trim() : '';

  if (!key) {
    return { ok: false, error: 'persist-knowledge requires key' };
  }

  if (args.value === undefined) {
    return { ok: false, error: 'persist-knowledge requires value' };
  }

  const topic = typeof args.topic === 'string' ? args.topic.trim() : undefined;

  try {
    const { absolute, relative } = await resolveKnowledgeWritePath(key, topic);
    const existing = await findKnowledgeFileForKey(key, topic);
    let payload: Record<string, unknown>;

    if (existing && path.extname(existing).toLowerCase() === '.json') {
      try {
        const raw = await fs.readFile(existing, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        payload = { ...parsed, [key]: args.value };
      } catch {
        payload = { [key]: args.value };
      }
    } else {
      payload = { [key]: args.value };
    }

    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    return {
      data: { path: relative },
      ok: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'persist-knowledge failed',
      ok: false,
    };
  }
};

export const runSkill = async (
  agent: TMastermindAgent,
  name: TSkillName,
  body: TSkillRequest,
): Promise<TSkillResponse> => {
  if (body.caller !== 'stage-agent') {
    return { ok: false, error: 'skills require caller stage-agent' };
  }

  if (name === 'extract-knowledge' && hasPathArgs(body.args)) {
    return { ok: false, error: 'extract-knowledge does not accept file paths' };
  }

  if (name === 'persist-knowledge') {
    return runPersistKnowledge(body.args);
  }

  if (name === 'propose-notification') {
    return runProposeNotification(body.args, body.sessionId);
  }

  if (agent.status !== 'ready') {
    return { ok: false, error: 'mastermind unavailable' };
  }

  const prompt = await buildSkillPrompt(name, body.args);
  const mode = 'agent' as const;
  const startedAt = Date.now();

  console.log(
    `[mastermind] skill=${name} start sessionId=${body.sessionId ?? '-'} caller=${body.caller}`,
  );

  try {
    const { result } = await agent.prompt(prompt, { mode });
    const text = typeof result === 'string' ? result.trim() : '';
    const durationMs = Date.now() - startedAt;

    console.log(
      `[mastermind] skill=${name} done ok=true durationMs=${durationMs} chars=${text.length}`,
    );

    return {
      data: text,
      ok: true,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    console.log(
      `[mastermind] skill=${name} done ok=false durationMs=${durationMs} error=${formatShortError(error)}`,
    );
    void writeAndAnalyzeCrash({
      args: body.args,
      caller: body.caller,
      error,
      mode,
      promptPreview: prompt,
      sessionId: body.sessionId,
      skill: name,
    }).catch((reportError) => {
      console.error('[mastermind] crash report failed', reportError);
    });

    return {
      error: formatShortError(error),
      ok: false,
    };
  }
};

const loadRubric = async (rubric?: string): Promise<string> => {
  if (!rubric) {
    return 'Score completeness, correctness, and adherence to produceContextKeys.';
  }

  const rubricPath = path.join(paths.rules, 'verify', `${rubric}.md`);

  try {
    return await fs.readFile(rubricPath, 'utf8');
  } catch {
    return rubric;
  }
};

export const runVerify = async (
  agent: TMastermindAgent,
  body: TVerifyRequest,
): Promise<TVerifyResponse> => {
  if (agent.status !== 'ready') {
    return {
      feedback: 'mastermind unavailable',
      pass: false,
      score: 0,
    };
  }

  const rubricText = await loadRubric(body.rubric);
  const minScore = body.minScore ?? 0.75;

  const prompt = [
    'You are a YAHL stage output verifier. Return JSON only: {"score":0-1,"pass":boolean,"feedback":"..."}',
    `Rubric:\n${rubricText}`,
    `Minimum score to pass: ${minScore}`,
    `Context snapshot:\n${JSON.stringify(body.contextSnapshot, null, 2).slice(0, 24_000)}`,
  ].join('\n\n');

  let text: string;

  try {
    const { result } = await agent.prompt(prompt);

    text = (result ?? '').trim();
  } catch (error) {
    void writeAndAnalyzeCrash({
      args: {
        contextSnapshot: body.contextSnapshot,
        minScore: body.minScore,
        rubric: body.rubric,
        stageIndex: body.stageIndex,
      },
      caller: 'orchestrator',
      error,
      promptPreview: prompt,
      sessionId: body.sessionId,
      skill: 'verify',
    }).catch((reportError) => {
      console.error('[mastermind] crash report failed', reportError);
    });

    return {
      feedback: formatShortError(error),
      pass: false,
      score: 0,
    };
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? text) as {
      feedback?: string;
      pass?: boolean;
      score?: number;
    };

    const score = typeof parsed.score === 'number'
      ? Math.min(1, Math.max(0, parsed.score))
      : 0;

    const pass = typeof parsed.pass === 'boolean' ? parsed.pass : score >= minScore;

    return {
      feedback: parsed.feedback ?? text,
      pass,
      score,
    };
  } catch {
    return {
      feedback: text || 'verify parse failed',
      pass: false,
      score: 0,
    };
  }
};

export const postProposal = async (
  kind: 'notifications' | 'settings',
  payload: Record<string, unknown>,
): Promise<{ error?: string; id?: string; ok: boolean }> => {
  const url = `${config.sessionApiBaseUrl}/api/platform/proposals/${kind}`;

  try {
    const res = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const data = await res.json() as { error?: string; id?: string };

    if (!res.ok) {
      return { error: data.error ?? res.statusText, ok: false };
    }

    return { id: data.id, ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'proposal failed',
      ok: false,
    };
  }
};
