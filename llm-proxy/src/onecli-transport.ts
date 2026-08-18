import { existsSync } from 'node:fs';

export const LEGACY_ONECLI_PROXY_HOST = 'host.docker.internal:10255';

export const ONECLI_PROXY_HOST = 'onecli:10255';

export const ONECLI_PROXY_KEYS = [
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'https_proxy',
  'http_proxy',
] as const;

export type TOneCliProxyKey = typeof ONECLI_PROXY_KEYS[number];

export const remapOneCliProxyHost = (value: string) =>
  value.replaceAll(LEGACY_ONECLI_PROXY_HOST, ONECLI_PROXY_HOST);

export const remapOneCliTransportValue = (value: string) => {
  const remapped = remapOneCliProxyHost(value);

  if (remapped === '/tmp/onecli-gateway-ca.pem' && existsSync('/onecli/proxy-ca.pem')) {
    return '/onecli/proxy-ca.pem';
  }

  if (remapped === '/tmp/onecli-combined-ca.pem' && existsSync('/onecli/combined-ca.pem')) {
    return '/onecli/combined-ca.pem';
  }

  return remapped;
};

export const remapOneCliTransportEnv = (env: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, remapOneCliTransportValue(value)]),
  );

export const containsLegacyOneCliProxyHost = (value: string) =>
  value.includes('host.docker.internal');

export const isOneCliProxyKey = (key: string): key is TOneCliProxyKey =>
  (ONECLI_PROXY_KEYS as readonly string[]).includes(key);

export const shouldApplyOneCliTransportValue = (
  key: string,
  currentEnv: string,
  jsonValue: string,
) => {
  if (!currentEnv.trim()) {
    return true;
  }

  if (!isOneCliProxyKey(key)) {
    return false;
  }

  return containsLegacyOneCliProxyHost(currentEnv)
    || containsLegacyOneCliProxyHost(jsonValue);
};

export const resolveHttpsProxyUrl = () =>
  (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '').trim();

export const redactProxyUrl = (url: string) => {
  if (!url.trim()) {
    return 'direct';
  }

  try {
    const parsed = new URL(url);
    const port = parsed.port
      || (parsed.protocol === 'https:' ? '443' : '80');

    return `${parsed.protocol}//${parsed.hostname}:${port}`;
  } catch {
    return url.replace(/\/\/[^@/]+@/, '//***@');
  }
};

export const logOneCliTransportStartup = () => {
  const proxy = redactProxyUrl(resolveHttpsProxyUrl());
  const ca = process.env.NODE_EXTRA_CA_CERTS?.trim()
    || process.env.SSL_CERT_FILE?.trim()
    || '-';

  console.log(`[llm-proxy] upstream proxy=${proxy} ca=${ca}`);
};
