import { OneCLI } from "@onecli-sh/sdk";

import type { OneCliContainerConfig, OneCliDashboardClient } from "./api-types";

const toContainerConfig = (config: unknown): OneCliContainerConfig | null | undefined => {
  if (config === undefined || config === null) return config;
  if (!config || typeof config !== "object" || Array.isArray(config)) return undefined;

  const c = config as Record<string, unknown>;
  const rawEnv = c.env;
  const configEnv = rawEnv && typeof rawEnv === "object" && !Array.isArray(rawEnv)
    ? (rawEnv as Record<string, unknown>)
    : {};

  return {
    caCertificate: typeof c.caCertificate === "string" ? c.caCertificate : undefined,
    caCertificateContainerPath: typeof c.caCertificateContainerPath === "string"
      ? c.caCertificateContainerPath
      : undefined,
    env: configEnv,
  };
};

export const resolveOneCliDashboardUrl = (raw: string) => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.hostname === 'onecli') {
      parsed.hostname = '127.0.0.1';
    }

    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
};

export const createOneCliDashboardClient = (opts: { apiKey: string; url: string }): OneCliDashboardClient => {
  const onecli = new OneCLI({
    apiKey: opts.apiKey,
    url: resolveOneCliDashboardUrl(opts.url),
  });

  return {
    getContainerConfig: async () => {
      const config = await onecli.getContainerConfig();
      return toContainerConfig(config);
    },
  };
};

export type { OneCliContainerConfig, OneCliDashboardClient } from "./api-types";
