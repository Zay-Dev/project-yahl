import { existsSync, readFileSync } from 'node:fs';

import {
  logOneCliTransportStartup,
  remapOneCliTransportValue,
  shouldApplyOneCliTransportValue,
} from './onecli-transport.js';

const transportCandidates = [
  process.env.ONECLI_TRANSPORT_ENV_FILE?.trim(),
  '/onecli/transport-env.json',
].filter((value): value is string => Boolean(value));

const caFiles = [
  '/onecli/combined-ca.pem',
  '/onecli/proxy-ca.pem',
] as const;

const firstExistingCaFile = (candidates: Array<string | undefined>) => {
  for (const file of candidates) {
    if (file?.trim() && existsSync(file)) return file;
  }

  return undefined;
};

export const readOneCliCaPem = (): Buffer | undefined => {
  const file = firstExistingCaFile([
    process.env.SSL_CERT_FILE,
    process.env.NODE_EXTRA_CA_CERTS,
    process.env.DENO_CERT,
    ...caFiles,
  ]);

  return file ? readFileSync(file) : undefined;
};

const applyOneCliCaEnv = () => {
  const file = firstExistingCaFile([
    process.env.SSL_CERT_FILE,
    process.env.NODE_EXTRA_CA_CERTS,
    process.env.DENO_CERT,
    ...caFiles,
  ]);

  if (!file) return;

  for (const key of ['SSL_CERT_FILE', 'NODE_EXTRA_CA_CERTS', 'DENO_CERT'] as const) {
    const current = process.env[key]?.trim();

    if (!current || !existsSync(current)) {
      process.env[key] = file;
    }
  }
};

export const applyOneCliTransportEnv = () => {
  for (const file of transportCandidates) {
    if (!existsSync(file)) continue;

    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== 'string' || !value.trim()) continue;

        const remapped = remapOneCliTransportValue(value);
        const current = process.env[key]?.trim() ?? '';

        if (!shouldApplyOneCliTransportValue(key, current, value)) {
          continue;
        }

        process.env[key] = remapped;
      }

      applyOneCliCaEnv();
      console.log(`[llm-proxy] loaded OneCLI transport env from ${file}`);
      logOneCliTransportStartup();
      return;
    } catch (error) {
      console.warn(`[llm-proxy] failed to load OneCLI transport env from ${file}: ${String(error)}`);
    }
  }

  applyOneCliCaEnv();
  logOneCliTransportStartup();
};

applyOneCliTransportEnv();
