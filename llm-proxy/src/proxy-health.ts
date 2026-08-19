import net from 'node:net';

import { ONECLI_PROXY_HOST, resolveHttpsProxyUrl } from './onecli-transport.js';

const parseProxyHostPort = (proxyUrl: string) => {
  try {
    const parsed = new URL(proxyUrl);
    const host = parsed.hostname;
    const port = Number(parsed.port || '10255');

    if (!host || !Number.isFinite(port)) {
      return undefined;
    }

    return { host, port };
  } catch {
    return undefined;
  }
};

export const probeOneCliProxyTcp = async (
  host = ONECLI_PROXY_HOST.split(':')[0]!,
  port = Number(ONECLI_PROXY_HOST.split(':')[1] || '10255'),
  timeoutMs = 5_000,
) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port });

    const finish = (ok: boolean) => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });

export const probeConfiguredOneCliProxy = async () => {
  const proxyUrl = resolveHttpsProxyUrl();

  if (!proxyUrl) {
    return { ok: false, reason: 'no-proxy-configured' as const };
  }

  const target = parseProxyHostPort(proxyUrl);

  if (!target) {
    return { ok: false, reason: 'invalid-proxy-url' as const };
  }

  const ok = await probeOneCliProxyTcp(target.host, target.port);

  return ok
    ? { ok: true as const, host: target.host, port: target.port }
    : { ok: false as const, reason: 'tcp-connect-failed' as const, host: target.host, port: target.port };
};

export const logOneCliProxyProbe = async () => {
  const result = await probeConfiguredOneCliProxy();

  if (result.ok) {
    console.log(`[llm-proxy] onecli proxy probe ok host=${result.host} port=${result.port}`);
    return true;
  }

  if (result.reason === 'no-proxy-configured') {
    console.warn('[llm-proxy] onecli proxy probe skipped reason=no-proxy-configured');
    return false;
  }

  const host = 'host' in result ? result.host : ONECLI_PROXY_HOST.split(':')[0];
  const port = 'port' in result ? result.port : Number(ONECLI_PROXY_HOST.split(':')[1] || '10255');

  console.warn(
    `[llm-proxy] onecli proxy probe failed reason=${result.reason} host=${host} port=${port}`,
  );

  return false;
};
