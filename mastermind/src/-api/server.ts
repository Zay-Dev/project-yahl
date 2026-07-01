import http from 'http';

import {
  notificationProposalSchema,
  requestStatusQuerySchema,
  settingProposalSchema,
  skillNames,
  skillRequestSchema,
} from '../../contract/index.js';

import { isInternalRequest } from './internal-auth.js';

import { config } from '../config.js';
import type { TMastermindAgent } from '../-sdk/agent.js';
import { buildRequestStatusPayload, getActiveSkillActivity, getRequestActivity } from '../-sdk/request-activity.js';
import { runSelfCheck } from '../-sdk/self-check.js';
import { postProposal, runSkill, runListTopicPolicies, runPatchTopicPolicy } from '../-handlers/skills.js';
import { rebuildPersistedPathsFromTopic } from '../-knowledge/index.js';

const readJsonBody = async (req: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw) as unknown;
};

const sendJson = (res: http.ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

export const createApiServer = (agent: TMastermindAgent) => {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const { pathname } = url;

      if (req.method === 'GET' && pathname === '/health') {
        const ready = agent.status === 'ready';
        sendJson(res, ready ? 200 : 503, {
          agent: agent.status,
          ok: ready,
          service: 'mastermind',
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/v1/internal/self-check') {
        if (!isInternalRequest(req)) {
          sendJson(res, 403, { error: 'forbidden' });
          return;
        }

        const ping = url.searchParams.get('ping') === '1';
        const result = await runSelfCheck(agent, { ping });
        sendJson(res, result.ok ? 200 : 503, { ...result, service: 'mastermind' });
        return;
      }

      if (req.method === 'GET' && pathname === '/v1/request-status') {
        const parsed = requestStatusQuerySchema.safeParse({
          invocationId: url.searchParams.get('invocationId') ?? undefined,
          requestId: url.searchParams.get('requestId') ?? undefined,
          sessionId: url.searchParams.get('sessionId') ?? undefined,
        });

        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }

        const request = getRequestActivity(
          parsed.data.sessionId,
          parsed.data.requestId,
          parsed.data.invocationId,
        );
        const payload = buildRequestStatusPayload({
          agent: agent.status,
          request,
        });

        sendJson(res, 200, payload);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/internal/knowledges/persisted-index') {
        if (!isInternalRequest(req)) {
          sendJson(res, 403, { error: 'forbidden' });
          return;
        }

        const body = await readJsonBody(req) as { topic?: string };
        const topic = typeof body.topic === 'string' ? body.topic.trim() : '';

        if (!topic) {
          sendJson(res, 400, { error: 'topic required' });
          return;
        }

        const persisted = await rebuildPersistedPathsFromTopic(topic);
        sendJson(res, 200, { ok: true, persisted });
        return;
      }

      if (req.method === 'GET' && pathname === '/v1/internal/knowledges/topic-policies') {
        if (!isInternalRequest(req)) {
          sendJson(res, 403, { error: 'forbidden' });
          return;
        }

        const result = await runListTopicPolicies();

        sendJson(res, result.ok ? 200 : 500, result);
        return;
      }

      if (req.method === 'PATCH' && pathname.startsWith('/v1/internal/knowledges/topic-policies/')) {
        if (!isInternalRequest(req)) {
          sendJson(res, 403, { error: 'forbidden' });
          return;
        }

        const slug = decodeURIComponent(pathname.slice('/v1/internal/knowledges/topic-policies/'.length));
        const body = await readJsonBody(req) as Record<string, unknown>;
        const result = await runPatchTopicPolicy({ ...body, slug });

        sendJson(res, result.ok ? 200 : 500, result);
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/v1/skills/')) {
        const name = pathname.slice('/v1/skills/'.length) as typeof skillNames[number];

        if (!skillNames.includes(name)) {
          sendJson(res, 404, { error: `unknown skill: ${name}` });
          return;
        }

        const parsed = skillRequestSchema.safeParse(await readJsonBody(req));

        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }

        if (parsed.data.caller !== 'stage-agent') {
          sendJson(res, 400, { error: 'skills require caller stage-agent' });
          return;
        }

        const sessionId = parsed.data.sessionId?.trim();
        const requestId = parsed.data.requestId?.trim();

        if (sessionId && requestId) {
          const active = getActiveSkillActivity(sessionId, requestId);

          if (
            active
            && active.invocationId
            && active.invocationId !== parsed.data.invocationId?.trim()
          ) {
            sendJson(res, 409, buildRequestStatusPayload({
              agent: agent.status,
              request: active,
            }));
            return;
          }
        }

        const result = await runSkill(agent, name, parsed.data);
        sendJson(res, result.ok ? 200 : 500, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/proposals/notifications') {
        const parsed = notificationProposalSchema.safeParse(await readJsonBody(req));

        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }

        const posted = await postProposal('notifications', parsed.data);
        sendJson(res, posted.ok ? 201 : 500, posted);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/proposals/settings') {
        const parsed = settingProposalSchema.safeParse(await readJsonBody(req));

        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }

        const posted = await postProposal('settings', parsed.data);
        sendJson(res, posted.ok ? 201 : 500, posted);
        return;
      }

      sendJson(res, 404, { error: 'not found' });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'internal error',
      });
    }
  });

  server.listen(config.port, () => {
    console.log(`[mastermind] listening on :${config.port}`);
  });

  return server;
};
