import {
  notificationProposalSchema,
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
import { config } from '../config.js';

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

  return { ok: false, error: `unknown skill: ${name}` };
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
