import { spawn } from "child_process";
import { promises as fs } from "fs";

import {
  formatOneCliComposeOverride,
  loadOneCliSnapshot,
  persistOneCliSnapshot,
} from "./onecli-snapshot";

import type { ComposeDownOptions, ComposeUpOptions } from '@/orchestrator/-utils/yahl/types';
import {
  agentSessionComposeOverrideFile,
  agentSessionRuntimePath,
  composeFile,
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

const yamlQuote = (value: string) => JSON.stringify(value);

const sharedOneCliOverrideReady = async () => {
  try {
    const content = await fs.readFile(onecliSharedComposeOverrideFile, 'utf-8');

    return content.trim().length > 0;
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

  try {
    const snapshot = await loadOneCliSnapshot();

    if (!snapshot) {
      return undefined;
    }

    await persistOneCliSnapshot(snapshot);
    await fs.writeFile(
      onecliSharedComposeOverrideFile,
      formatOneCliComposeOverride(snapshot),
      "utf-8",
    );

    return onecliSharedComposeOverrideFile;
  } catch (error) {
    if (await sharedOneCliOverrideReady()) {
      process.stdout.write(
        `[OneCLI] fetch failed (${String(error)}), using cached shared override\n`,
      );

      return onecliSharedComposeOverrideFile;
    }

    throw error;
  }
};

export type TAgentSessionOverrideOptions = {
  publishVnc?: boolean;
  sessionId: string;
};

export const writeAgentSessionOverride = async (opts: TAgentSessionOverrideOptions) => {
  const sessionHome = `/workspace/sessions/${opts.sessionId}`;
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
