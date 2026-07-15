import fs from 'fs/promises';
import path from 'path';

import {
  notificationProposalSchema,
  resolveWorkspacePath,
  type TSkillName,
  type TSkillRequest,
  type TSkillResponse,
} from '../../contract/index.js';

import {
  evaluateKnowledgeRefresh,
  listTopicPolicies,
  patchTopicPolicy,
  resolveTopicPolicy,
  type TPatchTopicPolicyInput,
  type TRefreshInterval,
  type TRefreshRunStatus,
  type TTopicRefreshScope,
} from '../-knowledge/index.js';
import { formatShortError, writeAndAnalyzeCrash } from '../-crash-reports/index.js';
import { config, paths } from '../config.js';
import type { TMastermindAgent } from '../-sdk/agent.js';
import {
  failRequestActivity,
  resolveRequestActivityRef,
  wrapPromptWithRequestActivity,
} from '../-sdk/request-activity-track.js';
import { promptWithActiveRunRetry } from '../-sdk/prompt-with-retry.js';
import {
  markRequestActivityFailed,
  markRequestActivitySucceeded,
  registerRequestActivity,
} from '../-sdk/request-activity.js';
import { isVerifyInfraError } from '../-sdk/verify-infra.js';

const readKnowledgeSnippet = async (source?: string, sessionId?: string): Promise<string> => {
  if (!source) {
    return '';
  }

  const resolved = resolveWorkspacePath(source, sessionId);
  const candidates = [
    resolved,
    ...(sessionId
      ? [resolveWorkspacePath(source)]
      : []),
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
  sessionId?: string,
): Promise<string> => {
  const sourceContent = await readKnowledgeSnippet(
    typeof args.source === 'string' ? args.source : typeof args.file === 'string' ? args.file : undefined,
    sessionId,
  );

  switch (name) {
    case 'media-to-text':
      return [
        'You are the YAHL mastermind media-to-text helper.',
        `File: ${String(args.file ?? args.source ?? '')}`,
        sourceContent ? `Content preview:\n${sourceContent.slice(0, 8000)}` : '',
        'Transcribe or summarize the media content as plain text.',
      ].filter(Boolean).join('\n\n');

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

const parseRefreshInterval = (value: unknown): TRefreshInterval | null | undefined => {
  if (value === null) {
    return null;
  }

  if (value === 'daily' || value === 'weekly' || value === 'biweekly' || value === 'monthly') {
    return value;
  }

  return undefined;
};

const parseRefreshStatus = (value: unknown): TRefreshRunStatus | null | undefined => {
  if (value === null) {
    return null;
  }

  if (value === 'success' || value === 'failed' || value === 'skipped') {
    return value;
  }

  return undefined;
};

const parseRefreshScopes = (value: unknown): TTopicRefreshScope[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const scopes = value.filter((scope): scope is TTopicRefreshScope =>
    scope === 'studies'
    || scope === 'facts'
    || scope === 'synthesis'
    || scope === 'summary');

  return scopes.length ? scopes : undefined;
};

export const runListTopicPolicies = async (): Promise<TSkillResponse> => {
  try {
    const items = await listTopicPolicies();

    return { data: { items }, ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'list-topic-policies failed',
      ok: false,
    };
  }
};

export const runResolveTopicPolicy = async (
  args: Record<string, unknown>,
): Promise<TSkillResponse> => {
  const topic = typeof args.topic === 'string'
    ? args.topic.trim()
    : typeof args.slug === 'string'
      ? args.slug.trim()
      : '';

  if (!topic) {
    return { error: 'resolve-topic-policy requires topic', ok: false };
  }

  try {
    const resolved = await resolveTopicPolicy(topic);

    return { data: resolved, ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'resolve-topic-policy failed',
      ok: false,
    };
  }
};

export const runPatchTopicPolicy = async (
  args: Record<string, unknown>,
): Promise<TSkillResponse> => {
  const slug = typeof args.slug === 'string'
    ? args.slug.trim()
    : typeof args.topic === 'string'
      ? args.topic.trim()
      : '';

  if (!slug) {
    return { ok: false, error: 'patch-topic-policy requires slug or topic' };
  }

  const patch: TPatchTopicPolicyInput = {};

  if (typeof args.enabled === 'boolean') {
    patch.enabled = args.enabled;
  }

  const interval = parseRefreshInterval(args.interval);

  if (interval !== undefined) {
    patch.interval = interval;
  }

  const lastRunStatus = parseRefreshStatus(args.lastRunStatus);

  if (lastRunStatus !== undefined) {
    patch.lastRunStatus = lastRunStatus;
  }

  if (args.lastRunAt === null || typeof args.lastRunAt === 'string') {
    patch.lastRunAt = args.lastRunAt;
  }

  if (args.lastRunSessionId === null || typeof args.lastRunSessionId === 'string') {
    patch.lastRunSessionId = args.lastRunSessionId;
  }

  const scopes = parseRefreshScopes(args.scopes);

  if (scopes) {
    patch.scopes = scopes;
  }

  try {
    const row = await patchTopicPolicy(slug, patch);

    return { data: row, ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'patch-topic-policy failed',
      ok: false,
    };
  }
};

const runEvaluateKnowledgeRefresh = async (): Promise<TSkillResponse> => {
  try {
    const report = await evaluateKnowledgeRefresh();

    return { data: report, ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'evaluate-knowledge-refresh failed',
      ok: false,
    };
  }
};

const runDispatchTaskRun = async (
  args: Record<string, unknown>,
): Promise<TSkillResponse> => {
  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : '';

  if (!taskId) {
    return { ok: false, error: 'dispatch-task-run requires taskId' };
  }

  const runInput = args.runInput && typeof args.runInput === 'object' && !Array.isArray(args.runInput)
    ? args.runInput as Record<string, unknown>
    : undefined;

  const body: Record<string, unknown> = { taskId };

  if (runInput && Object.keys(runInput).length > 0) {
    body.runInput = runInput;
  }

  try {
    const res = await fetch(`${config.sessionApiBaseUrl}/api/runs`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const payload = await res.json() as { sessionId?: string; taskId?: string; error?: string };

    if (!res.ok) {
      return {
        error: payload.error ?? `dispatch-task-run failed (${res.status})`,
        ok: false,
      };
    }

    return {
      data: {
        sessionId: payload.sessionId,
        taskId: payload.taskId ?? taskId,
      },
      ok: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'dispatch-task-run failed',
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

  if (name === 'list-topic-policies') {
    return runListTopicPolicies();
  }

  if (name === 'resolve-topic-policy') {
    return runResolveTopicPolicy(body.args);
  }

  if (name === 'patch-topic-policy') {
    return runPatchTopicPolicy(body.args);
  }

  if (name === 'evaluate-knowledge-refresh') {
    return runEvaluateKnowledgeRefresh();
  }

  if (name === 'dispatch-task-run') {
    return runDispatchTaskRun(body.args);
  }

  if (name === 'propose-notification') {
    return runProposeNotification(body.args, body.sessionId);
  }

  if (agent.status !== 'ready') {
    const activity = resolveRequestActivityRef(body.sessionId, body.requestId, body.invocationId);

    failRequestActivity(activity, {
      error: 'mastermind unavailable',
      kind: 'skill',
      skill: name,
      unavailable: true,
    });

    return { ok: false, error: 'mastermind unavailable' };
  }

  const prompt = await buildSkillPrompt(name, body.args, body.sessionId);
  const mode = 'agent' as const;
  const startedAt = Date.now();
  const activity = resolveRequestActivityRef(body.sessionId, body.requestId, body.invocationId);

  console.log(
    `[mastermind] skill=${name} start sessionId=${body.sessionId ?? '-'} caller=${body.caller}`,
  );

  if (activity) {
    registerRequestActivity({
      invocationId: activity.invocationId,
      kind: 'skill',
      requestId: activity.requestId,
      sessionId: activity.sessionId,
      skill: name,
    });
  }

  try {
    const { result } = await promptWithActiveRunRetry(
      wrapPromptWithRequestActivity(agent, activity),
      prompt,
      { mode },
    );
    const text = typeof result === 'string' ? result.trim() : '';
    const durationMs = Date.now() - startedAt;

    console.log(
      `[mastermind] skill=${name} done ok=true durationMs=${durationMs} chars=${text.length}`,
    );

    if (activity) {
      markRequestActivitySucceeded(
        activity.sessionId,
        activity.requestId,
        activity.invocationId,
        text,
      );
    }

    return {
      data: text,
      ok: true,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const shortError = formatShortError(error);

    console.log(
      `[mastermind] skill=${name} done ok=false durationMs=${durationMs} error=${shortError}`,
    );

    if (activity) {
      markRequestActivityFailed(
        activity.sessionId,
        activity.requestId,
        shortError,
        isVerifyInfraError(shortError),
        activity.invocationId,
      );
    }
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
