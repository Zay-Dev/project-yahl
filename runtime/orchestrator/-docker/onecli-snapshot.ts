import { promises as fs } from 'fs';
import path from 'path';

import YAML from 'yaml';

import { createOneCliDashboardClient } from './clients/api';
import {
  onecliRuntimePath,
  onecliSharedCaFile,
  onecliSharedCombinedCaFile,
  onecliSharedComposeOverrideFile,
} from './paths';

const LEGACY_ONECLI_PROXY_HOST = 'host.docker.internal:10255';
const ONECLI_PROXY_HOST = 'onecli:10255';

export const remapOneCliProxyHost = (value: string) =>
  value.replaceAll(LEGACY_ONECLI_PROXY_HOST, ONECLI_PROXY_HOST);

const remapTransportEnvValue = (value: string) => {
  const remapped = remapOneCliProxyHost(value);

  if (remapped === '/tmp/onecli-gateway-ca.pem') {
    return '/onecli/proxy-ca.pem';
  }

  if (remapped === '/tmp/onecli-combined-ca.pem') {
    return '/onecli/combined-ca.pem';
  }

  return remapped;
};

const remapTransportEnv = (env: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, remapTransportEnvValue(value)]),
  );

export const agentNoProxy = 'localhost,127.0.0.1,::1,redis,server,mongo,onecli,worker,llm-proxy,host.docker.internal';

export type TOneCliVolumeMount = {
  containerPath: string;
  hostPath: string;
  mode: 'ro' | 'rw';
};

export type TOneCliSnapshot = {
  transportEnv: Record<string, string>;
  volumeMounts: TOneCliVolumeMount[];
  sslCertFile?: string;
};

export type TOneCliComposeOverride = {
  transportEnv: Record<string, string>;
  volumeMounts: TOneCliVolumeMount[];
};

const parseVolumeEntry = (entry: string): TOneCliVolumeMount | undefined => {
  const trimmed = entry.trim().replace(/^['"]|['"]$/g, '');
  const parts = trimmed.split(':');

  if (parts.length < 2) {
    return undefined;
  }

  const hostPath = parts[0]!.trim();
  const containerPath = parts[1]!.trim();
  const mode = parts[2]?.trim() === 'rw' ? 'rw' : 'ro';

  return {
    containerPath,
    hostPath,
    mode,
  };
};

const toStringEnvRecord = (env: unknown) => {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value == null) {
      continue;
    }

    result[key] = String(value);
  }

  return result;
};

export const readOneCliComposeOverride = async (): Promise<TOneCliComposeOverride | undefined> => {
  try {
    const raw = await fs.readFile(onecliSharedComposeOverrideFile, 'utf-8');

    if (!raw.trim()) {
      return undefined;
    }

    const parsed = YAML.parse(raw) as {
      services?: {
        agent?: {
          environment?: Record<string, unknown>;
          volumes?: string[];
        };
      };
    };

    const agent = parsed?.services?.agent;

    if (!agent) {
      return undefined;
    }

    const volumeMounts = (agent.volumes ?? [])
      .map((entry) => parseVolumeEntry(entry))
      .filter((mount): mount is TOneCliVolumeMount => Boolean(mount));

    return {
      transportEnv: toStringEnvRecord(agent.environment),
      volumeMounts,
    };
  } catch {
    return undefined;
  }
};

const readFirstExistingFile = async (candidates: string[]) => {
  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate, 'utf-8');

      if (content.trim()) {
        return content;
      }
    } catch { }
  }

  return null;
};

const toStringEnv = (env: Record<string, unknown>) => {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value == null) {
      continue;
    }

    result[key] = String(value);
  }

  return result;
};

const sharedOneCliOverrideReady = async () => {
  try {
    const [override, ca] = await Promise.all([
      fs.readFile(onecliSharedComposeOverrideFile, 'utf-8'),
      fs.readFile(onecliSharedCaFile, 'utf-8'),
    ]);

    return override.trim().length > 0 && ca.trim().length > 0;
  } catch {
    return false;
  }
};

const buildSnapshotFromConfig = async (config: {
  caCertificate?: string;
  caCertificateContainerPath?: string;
  env?: Record<string, unknown>;
}) => {
  const configEnv = config?.env && typeof config.env === 'object' ? config.env : {};
  const caCertificate = typeof config?.caCertificate === 'string' ? config.caCertificate : '';
  const caContainerPath = typeof config?.caCertificateContainerPath === 'string'
    ? config.caCertificateContainerPath
    : '';

  if (!caCertificate || !caContainerPath) {
    throw new Error('[OneCLI] Missing CA certificate fields from container config');
  }

  await fs.mkdir(onecliRuntimePath, { recursive: true });
  await fs.writeFile(onecliSharedCaFile, caCertificate, 'utf-8');

  const baseCa = await readFirstExistingFile([
    '/etc/ssl/cert.pem',
    '/etc/ssl/certs/ca-certificates.crt',
    '/etc/pki/tls/certs/ca-bundle.crt',
  ]);

  const hasCombinedBundle = !!baseCa;

  if (hasCombinedBundle) {
    const combined = `${baseCa!.trimEnd()}\n${caCertificate.trimEnd()}\n`;
    await fs.writeFile(onecliSharedCombinedCaFile, combined, 'utf-8');
  }

  const volumeMounts: TOneCliVolumeMount[] = [
    {
      containerPath: caContainerPath,
      hostPath: onecliSharedCaFile,
      mode: 'ro',
    },
    ...(hasCombinedBundle
      ? [{
        containerPath: '/tmp/onecli-combined-ca.pem',
        hostPath: onecliSharedCombinedCaFile,
        mode: 'ro' as const,
      }]
      : []),
  ];

  return {
    transportEnv: remapTransportEnv(toStringEnv(configEnv)),
    volumeMounts,
    sslCertFile: hasCombinedBundle ? '/tmp/onecli-combined-ca.pem' : undefined,
  } satisfies TOneCliSnapshot;
};

const transportEnvCacheFile = path.join(onecliRuntimePath, 'transport-env.json');
const snapshotMetaFile = path.join(onecliRuntimePath, 'snapshot-meta.json');

export const persistOneCliSnapshot = async (snapshot: TOneCliSnapshot) => {
  await fs.mkdir(onecliRuntimePath, { recursive: true });
  await fs.writeFile(
    transportEnvCacheFile,
    JSON.stringify(remapTransportEnv(snapshot.transportEnv)),
    'utf-8',
  );
  await fs.writeFile(snapshotMetaFile, JSON.stringify({
    caContainerPath: snapshot.volumeMounts[0]?.containerPath,
    sslCertFile: snapshot.sslCertFile,
  }), 'utf-8');
};

const readCachedSnapshotMeta = async () => {
  try {
    const raw = await fs.readFile(snapshotMetaFile, 'utf-8');
    const parsed = JSON.parse(raw) as {
      caContainerPath?: string;
      sslCertFile?: string;
    };

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const readCachedTransportEnv = async () => {
  try {
    const raw = await fs.readFile(transportEnvCacheFile, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, string>;

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const fetchOneCliContainerConfig = async () => {
  const onecliApiKey = process.env.ONECLI_API_KEY || '';
  const onecliDashboardUrl = process.env.ONECLI_DASHBOARD_URL || process.env.ONECLI_URL || '';

  if (!onecliApiKey || !onecliDashboardUrl) {
    return undefined;
  }

  const client = createOneCliDashboardClient({
    apiKey: onecliApiKey,
    url: onecliDashboardUrl,
  });

  try {
    return await client.getContainerConfig();
  } catch (error) {
    if (await sharedOneCliOverrideReady()) {
      process.stdout.write(
        `[OneCLI] fetch failed (${String(error)}), using cached shared override files\n`,
      );

      return undefined;
    }

    throw error;
  }
};

const snapshotFromComposeOverride = (override: TOneCliComposeOverride): TOneCliSnapshot => ({
  transportEnv: remapTransportEnv(override.transportEnv),
  volumeMounts: override.volumeMounts,
  sslCertFile: override.transportEnv.SSL_CERT_FILE
    || override.transportEnv.DENO_CERT
    || undefined,
});

export const loadOneCliSnapshot = async (): Promise<TOneCliSnapshot | undefined> => {
  const config = await fetchOneCliContainerConfig();

  if (config) {
    const snapshot = await buildSnapshotFromConfig(config);
    await persistOneCliSnapshot(snapshot);

    return snapshot;
  }

  const override = await readOneCliComposeOverride();

  if (override) {
    const snapshot = snapshotFromComposeOverride(override);
    await persistOneCliSnapshot(snapshot);

    return snapshot;
  }

  if (!(await sharedOneCliOverrideReady())) {
    return undefined;
  }

  const hasCombinedBundle = await fs.access(onecliSharedCombinedCaFile).then(() => true).catch(() => false);
  const meta = await readCachedSnapshotMeta();
  const caContainerPath = meta.caContainerPath || '/etc/ssl/certs/onecli-proxy-ca.pem';

  const volumeMounts: TOneCliVolumeMount[] = [
    {
      containerPath: caContainerPath,
      hostPath: onecliSharedCaFile,
      mode: 'ro',
    },
    ...(hasCombinedBundle
      ? [{
        containerPath: '/tmp/onecli-combined-ca.pem',
        hostPath: onecliSharedCombinedCaFile,
        mode: 'ro' as const,
      }]
      : []),
  ];

  const cachedTransportEnv = await readCachedTransportEnv();

  return {
    transportEnv: Object.keys(cachedTransportEnv).length > 0
      ? remapTransportEnv(cachedTransportEnv)
      : {},
    volumeMounts,
    sslCertFile: meta.sslCertFile ?? (hasCombinedBundle ? '/tmp/onecli-combined-ca.pem' : undefined),
  };
};

export const yamlQuote = (value: string) => JSON.stringify(value);

export const formatOneCliComposeOverride = (snapshot: TOneCliSnapshot) => {
  const envLines = Object.entries(snapshot.transportEnv).map(([key, value]) =>
    `      ${key}: ${yamlQuote(value)}`);
  envLines.push(`      NO_PROXY: ${yamlQuote(agentNoProxy)}`);
  envLines.push(`      no_proxy: ${yamlQuote(agentNoProxy)}`);

  if (snapshot.sslCertFile) {
    envLines.push(`      SSL_CERT_FILE: ${yamlQuote(snapshot.sslCertFile)}`);
    envLines.push(`      DENO_CERT: ${yamlQuote(snapshot.sslCertFile)}`);
  }

  const volumeLines = snapshot.volumeMounts.map((mount) =>
    `      - ${yamlQuote(`${mount.hostPath}:${mount.containerPath}:ro`)}`);

  return [
    'services:',
    '  agent:',
    '    environment:',
    ...envLines,
    '    volumes:',
    ...volumeLines,
    '',
  ].join('\n');
};
