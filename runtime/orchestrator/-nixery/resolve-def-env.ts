import {
  agentNoProxy,
  loadOneCliSnapshot,
  readOneCliComposeOverride,
  writeSharedOneCliOverride,
} from '@/orchestrator/-docker/onecli-snapshot';

const PLACEHOLDER_KEYS = new Set(['', 'placeholder', 'sk-no-auth-required']);

const isEnvSentinel = (value: string) => PLACEHOLDER_KEYS.has(value.trim().toLowerCase());

export const resolveDefEnv = (defEnv?: Record<string, string>) => {
  const resolved: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(defEnv ?? {})) {
    const literal = rawValue.trim();

    if (literal && !isEnvSentinel(literal)) {
      resolved[key] = literal;
      continue;
    }

    const hostValue = process.env[key]?.trim();

    if (hostValue && !isEnvSentinel(hostValue)) {
      resolved[key] = hostValue;
    }
  }

  return resolved;
};

const oneCliConfigured = () => {
  const apiKey = process.env.ONECLI_API_KEY?.trim() ?? '';
  const dashboardUrl = (
    process.env.ONECLI_DASHBOARD_URL
    || process.env.ONECLI_URL
    || ''
  ).trim();

  return Boolean(apiKey && dashboardUrl);
};

const ensureOneCliOverride = async () => {
  if (!oneCliConfigured()) {
    return undefined;
  }

  let override = await readOneCliComposeOverride();

  if (override) {
    return override;
  }

  await writeSharedOneCliOverride();
  override = await readOneCliComposeOverride();

  if (!override) {
    throw new Error(
      '[OneCLI] runtime/.onecli/docker-compose.onecli.override.yml is required when OneCLI is configured',
    );
  }

  return override;
};

export const resolveNixeryEnv = async (defEnv?: Record<string, string>) => {
  const override = await ensureOneCliOverride();
  const snapshot = override
    ? {
      transportEnv: override.transportEnv,
      volumeMounts: override.volumeMounts,
      sslCertFile: override.transportEnv.SSL_CERT_FILE
        || override.transportEnv.DENO_CERT
        || undefined,
    }
    : await loadOneCliSnapshot();

  const env: Record<string, string> = {
    ...(snapshot?.transportEnv ?? {}),
    ...resolveDefEnv(defEnv),
  };

  const proxyToken = process.env.LLM_PROXY_TOKEN?.trim() ?? '';

  if (proxyToken) {
    env.LLM_PROXY_TOKEN = proxyToken;
  }

  if (snapshot) {
    env.NO_PROXY = agentNoProxy;
    env.no_proxy = agentNoProxy;

    if (snapshot.sslCertFile) {
      env.SSL_CERT_FILE = snapshot.sslCertFile;
      env.DENO_CERT = snapshot.sslCertFile;
    }
  }

  return {
    env,
    volumeMounts: snapshot?.volumeMounts ?? [],
  };
};
