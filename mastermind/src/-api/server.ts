import http from 'http';

import {
  notificationProposalSchema,
  settingProposalSchema,
  skillNames,
  skillRequestSchema,
  verifyRequestSchema,
} from '../../contract/index.js';

import { config } from '../config.js';
import type { TMastermindAgent } from '../-sdk/agent.js';
import { postProposal, runSkill, runVerify } from '../-handlers/skills.js';

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
        sendJson(res, 200, { agent: agent.status, ok: true, service: 'mastermind' });
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

        const result = await runSkill(agent, name, parsed.data);
        sendJson(res, result.ok ? 200 : 500, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/verify') {
        const parsed = verifyRequestSchema.safeParse(await readJsonBody(req));

        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }

        const result = await runVerify(agent, parsed.data);
        sendJson(res, 200, result);
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
