import './load-onecli-env.js';

import { createServer } from 'node:http';

import { config } from './config.js';
import { handleChatCompletions } from './handle-chat.js';
import { resolveHttpsProxyUrl } from './onecli-transport.js';
import { logOneCliProxyProbe, probeConfiguredOneCliProxy } from './proxy-health.js';

const isChatCompletionsPath = (pathname: string) =>
  pathname === '/v1/chat/completions' || pathname === '/chat/completions';

let proxyProbeOk = !resolveHttpsProxyUrl();

const server = createServer((req, res) => {
  const host = req.headers.host || `127.0.0.1:${config.port}`;
  const url = new URL(req.url || '/', `http://${host}`);

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/__/ping')) {
    const ok = !resolveHttpsProxyUrl() || proxyProbeOk;

    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok,
      proxyConfigured: Boolean(resolveHttpsProxyUrl()),
      proxyProbeOk,
    }));
    return;
  }

  if (req.method === 'POST' && isChatCompletionsPath(url.pathname)) {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const headers = new Headers();

      for (const [key, value] of Object.entries(req.headers)) {
        if (value == null) continue;

        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, item);
          continue;
        }

        headers.set(key, value);
      }

      const request = new Request(url, {
        body: body.length ? body : undefined,
        headers,
        method: 'POST',
      });

      void handleChatCompletions(request).then(async (response) => {
        const responseBody = Buffer.from(await response.arrayBuffer());
        const responseHeaders: Record<string, string> = {};

        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        res.writeHead(response.status, responseHeaders);
        res.end(responseBody);
      });
    });

    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: { message: `not found: ${req.method} ${url.pathname}` } }));
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[llm-proxy] listening on 0.0.0.0:${config.port}`);

  void logOneCliProxyProbe().then((ok) => {
    proxyProbeOk = ok || !resolveHttpsProxyUrl();
  });
});

export const refreshProxyProbeForTests = async () => {
  proxyProbeOk = await logOneCliProxyProbe() || !resolveHttpsProxyUrl();
  return proxyProbeOk;
};

export const readProxyProbeStateForTests = () => ({
  proxyConfigured: Boolean(resolveHttpsProxyUrl()),
  proxyProbeOk,
});

export { probeConfiguredOneCliProxy };
