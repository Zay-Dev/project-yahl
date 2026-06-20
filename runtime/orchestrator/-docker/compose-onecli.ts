import { spawn } from "child_process";
import { promises as fs } from "fs";

import { createOneCliDashboardClient } from "./clients/api";

import type { ComposeDownOptions, ComposeUpOptions } from '@/orchestrator/-utils/yahl/types';
import {
  agentSessionComposeOverrideFile,
  agentSessionRuntimePath,
  composeFile,
  onecliRuntimePath,
  onecliSharedCaFile,
  onecliSharedCombinedCaFile,
  onecliSharedComposeOverrideFile,
  repoRoot,
} from "./paths";

const runCommand = (
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    ignoreFailure?: boolean;
  },
) => new Promise<void>((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: options?.cwd,
    stdio: "inherit",
  });

  child.on("error", reject);

  child.on("close", (code) => {
    if (code === 0 || options?.ignoreFailure) {
      resolve();
      return;
    }

    reject(new Error(`${command} ${args.join(" ")} failed with code ${code || -1}`));
  });
});

const runComposeCommand = async (
  args: string[],
  options?: {
    cwd?: string;
    ignoreFailure?: boolean;
  },
) => {
  await runCommand('docker', ["compose", ...args], options);
};

const readFirstExistingFile = async (candidates: string[]) => {
  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate, "utf-8");
      if (content.trim()) return content;
    } catch { }
  }

  return null;
};

const yamlQuote = (value: string) => JSON.stringify(value);

const agentNoProxy = 'localhost,127.0.0.1,::1,mastermind,redis,server,mongo,onecli,host.docker.internal';

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

export const writeSharedOneCliOverride = async () => {
  const onecliApiKey = process.env.ONECLI_API_KEY || "";
  const onecliDashboardUrl = process.env.ONECLI_DASHBOARD_URL || process.env.ONECLI_URL || "";

  if (!onecliApiKey || !onecliDashboardUrl) {
    process.stdout.write("[OneCLI] ONECLI_API_KEY or ONECLI_DASHBOARD_URL missing, skip shared override\n");
    return undefined;
  }

  if (await sharedOneCliOverrideReady()) {
    process.stdout.write("[OneCLI] shared override already present, skip rewrite\n");
    return onecliSharedComposeOverrideFile;
  }

  const client = createOneCliDashboardClient({
    apiKey: onecliApiKey,
    url: onecliDashboardUrl,
  });

  let config: Awaited<ReturnType<typeof client.getContainerConfig>>;

  try {
    config = await client.getContainerConfig();
  } catch (error) {
    if (await sharedOneCliOverrideReady()) {
      process.stdout.write(
        `[OneCLI] fetch failed (${String(error)}), using cached shared override\n`,
      );

      return onecliSharedComposeOverrideFile;
    }

    throw error;
  }

  const configEnv = config?.env && typeof config.env === "object" ? config.env : {};
  const caCertificate = typeof config?.caCertificate === "string" ? config.caCertificate : "";
  const caContainerPath = typeof config?.caCertificateContainerPath === "string"
    ? config.caCertificateContainerPath
    : "";

  if (!caCertificate || !caContainerPath) {
    throw new Error("[OneCLI] Missing CA certificate fields from container config");
  }

  await fs.mkdir(onecliRuntimePath, { recursive: true });
  await fs.writeFile(onecliSharedCaFile, caCertificate, "utf-8");

  const baseCa = await readFirstExistingFile([
    "/etc/ssl/cert.pem",
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
  ]);

  const hasCombinedBundle = !!baseCa;
  if (hasCombinedBundle) {
    const combined = `${baseCa!.trimEnd()}\n${caCertificate.trimEnd()}\n`;
    await fs.writeFile(onecliSharedCombinedCaFile, combined, "utf-8");
  }

  const envLines = Object.entries(configEnv).map(([key, value]) =>
    `      ${key}: ${yamlQuote(String(value))}`);
  envLines.push(`      NO_PROXY: ${yamlQuote(agentNoProxy)}`);
  envLines.push(`      no_proxy: ${yamlQuote(agentNoProxy)}`);
  if (hasCombinedBundle) {
    envLines.push(`      SSL_CERT_FILE: ${yamlQuote("/tmp/onecli-combined-ca.pem")}`);
    envLines.push(`      DENO_CERT: ${yamlQuote("/tmp/onecli-combined-ca.pem")}`);
  }

  const volumeLines = [
    `      - ${yamlQuote(`${onecliSharedCaFile}:${caContainerPath}:ro`)}`,
    ...(hasCombinedBundle
      ? [`      - ${yamlQuote(`${onecliSharedCombinedCaFile}:/tmp/onecli-combined-ca.pem:ro`)}`]
      : []),
  ];

  const composeOverride = [
    "services:",
    "  agent:",
    "    environment:",
    ...envLines,
    "    volumes:",
    ...volumeLines,
    "",
  ].join("\n");

  await fs.writeFile(onecliSharedComposeOverrideFile, composeOverride, "utf-8");

  return onecliSharedComposeOverrideFile;
};

export type TAgentSessionOverrideOptions = {
  publishVnc?: boolean;
  sessionId: string;
};

export const writeAgentSessionOverride = async (opts: TAgentSessionOverrideOptions) => {
  const sessionHome = `/root/sessions/${opts.sessionId}`;
  const lines = [
    "services:",
    "  agent:",
    "    environment:",
    `      AGENT_SESSION_HOME: ${yamlQuote(sessionHome)}`,
  ];

  if (opts.publishVnc) {
    lines.push("    ports:");
    lines.push(`      - ${yamlQuote("0:5900")}`);
  }

  lines.push("");

  const dir = agentSessionRuntimePath(opts.sessionId);
  await fs.mkdir(dir, { recursive: true });

  const filePath = agentSessionComposeOverrideFile(opts.sessionId);
  await fs.writeFile(filePath, lines.join("\n"), "utf-8");

  return filePath;
};

export const removeAgentSessionOverride = async (sessionId: string) => {
  await fs.rm(agentSessionRuntimePath(sessionId), { force: true, recursive: true });
};

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);

    return true;
  } catch {
    return false;
  }
};

export const resolveAgentComposeOverrideFiles = async (sessionId: string) => {
  const paths: string[] = [];
  const sessionOverride = agentSessionComposeOverrideFile(sessionId);

  if (await fileExists(sessionOverride)) {
    paths.push(sessionOverride);
  }

  if (await fileExists(onecliSharedComposeOverrideFile)) {
    paths.push(onecliSharedComposeOverrideFile);
  }

  return paths;
};

export const buildComposeUpArgs = (opts: ComposeUpOptions) => {
  const overrideFiles = opts.composeOverrideFilePaths ?? [];

  return [
    "-f",
    composeFile,
    ...overrideFiles.flatMap((filePath) => ["-f", filePath]),
    "-p",
    opts.composeProjectName,
    "up",
    "-d",
    "--force-recreate",
    "agent",
  ];
};

export const buildComposeDownArgs = (opts: ComposeDownOptions) => {
  const overrideFiles = opts.composeOverrideFilePaths ?? [];

  return [
    "-f",
    composeFile,
    ...overrideFiles.flatMap((filePath) => ["-f", filePath]),
    "-p",
    opts.composeProjectName,
    "down",
    "--remove-orphans",
  ];
};

export const composeUp = async (opts: ComposeUpOptions) => {
  process.env.AGENT_IMAGE = process.env.AGENT_IMAGE || "project-yahl-agent:latest";

  await runComposeCommand(buildComposeUpArgs(opts), {
    cwd: repoRoot,
    ignoreFailure: false,
  });
};

export const composeDown = async (opts: ComposeDownOptions) => {
  await runComposeCommand(buildComposeDownArgs(opts), {
    cwd: repoRoot,
    ignoreFailure: true,
  });

  if (opts.sessionId) {
    await runCommand('docker', ['rm', '-f', opts.composeProjectName], { ignoreFailure: true });
    await removeAgentSessionOverride(opts.sessionId);
  }
};
