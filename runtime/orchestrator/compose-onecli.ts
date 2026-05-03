import { spawn } from "child_process";
import { promises as fs } from "fs";

import { createOneCliDashboardClient } from "./clients/api";

import type { ComposeUpOptions } from "./orchestrator-types";
import {
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

export const writeSharedOneCliOverride = async () => {
  const onecliApiKey = process.env.ONECLI_API_KEY || "";
  const onecliDashboardUrl = process.env.ONECLI_DASHBOARD_URL || process.env.ONECLI_URL || "";

  if (!onecliApiKey || !onecliDashboardUrl) {
    process.stdout.write("[OneCLI] ONECLI_API_KEY or ONECLI_DASHBOARD_URL missing, skip shared override\n");
    return undefined;
  }

  const client = createOneCliDashboardClient({
    apiKey: onecliApiKey,
    url: onecliDashboardUrl,
  });

  const config = await client.getContainerConfig();
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

export const composeUp = async (opts: ComposeUpOptions) => {
  const composeArgs = [
    "-f",
    composeFile,
    ...(opts.onecliOverrideFilePath ? ["-f", opts.onecliOverrideFilePath] : []),
    "-p",
    opts.composeProjectName,
    "up",
    "-d",
    "agent",
  ];

  await runComposeCommand([
    ...composeArgs,
  ], {
    cwd: repoRoot,
    ignoreFailure: false,
  });
};

export const composeDown = async (composeProjectName: string) => {
  await runComposeCommand([
    "-f",
    composeFile,
    "-p",
    composeProjectName,
    "down",
    "--remove-orphans",
  ], {
    cwd: repoRoot,
    ignoreFailure: true,
  });
};
