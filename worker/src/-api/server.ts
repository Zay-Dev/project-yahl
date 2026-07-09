import http from 'http';

import {
  requestStatusQuerySchema,
  verifyRequestSchema,
} from '@project-yahl/shared/verify/schemas';
import { knowledgeQaReviewRequestSchema } from '@project-yahl/shared/knowledge-qa/schemas';

import { isWorkerReady, resolveWorkerReady } from '../-health/server.js';
import { runKnowledgeQaReview } from '../-knowledge-qa/handlers.js';
import { isAgentCliReady } from '../-verify/agent-cli.js';
import { runVerify } from '../-verify/handlers.js';
import {
  buildRequestStatusPayload,
  getRequestActivity,
  setVerifyQueueDepth,
} from '../-verify/request-activity.js';
import { getVerifyQueueDepth } from '../-verify/verify-queue.js';

import { config } from '../config.js';

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

export const startApiServer = () => {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const { pathname } = url;

      if (req.method === 'GET' && pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          service: 'worker',
          verifyReady: resolveWorkerReady({
            agentCliReady: isAgentCliReady(),
            apiKey: config.apiKey,
            pollFresh: true,
          }),
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/ready') {
        const ready = resolveWorkerReady({
          agentCliReady: isAgentCliReady(),
          apiKey: config.apiKey,
          pollFresh: isWorkerReady(),
        });
        sendJson(res, ready ? 200 : 503, { ok: ready, service: 'worker' });
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

        setVerifyQueueDepth(getVerifyQueueDepth());

        const request = getRequestActivity(
          parsed.data.sessionId,
          parsed.data.requestId,
          parsed.data.invocationId,
        );
        const payload = buildRequestStatusPayload({
          ready: Boolean(config.apiKey),
          request,
        });

        sendJson(res, 200, payload);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/verify') {
        const parsed = verifyRequestSchema.safeParse(await readJsonBody(req));

        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }

        const result = await runVerify(parsed.data);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/knowledge-qa-review') {
        const parsed = knowledgeQaReviewRequestSchema.safeParse(await readJsonBody(req));

        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }

        const result = await runKnowledgeQaReview(parsed.data);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: 'not found' });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'internal error',
      });
    }
  });

  server.listen(config.healthPort, () => {
    console.log(`[worker] api listening on :${config.healthPort}`);
  });

  return server;
};
