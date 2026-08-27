import type { ComposeDownOptions, ComposeUpOptions } from '@/orchestrator/-utils/yahl/types';

import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

import { AGENT_YAHL_CONTAINER_DIR } from '@project-yahl/shared/nixery/ensure-plugin-links';

import {
  agentSessionComposeOverrideFile,
  agentSessionRuntimePath,
  composeFile,
  onecliSharedComposeOverrideFile,
  repoRoot,
  resolveDockerHostWorkspacePath,
} from './paths';

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
    stdio: 'inherit',
  });

  child.on('error', reject);

  child.on('close', (code) => {
    if (code === 0 || options?.ignoreFailure) {
      resolve();
      return;
    }

    reject(new Error(`${command} ${args.join(' ')} failed with code ${code || -1}`));
  });
});

const runComposeCommand = async (
  args: string[],
  options?: {
    cwd?: string;
    ignoreFailure?: boolean;
  },
) => {
  await runCommand('docker', ['compose', ...args], options);
};

const yamlQuote = (value: string) => JSON.stringify(value);

export type TAgentSessionOverrideOptions = {
  browserCdpUrl?: string;
  publishVnc?: boolean;
  sessionId: string;
  taskId: string;
};

export const writeAgentSessionOverride = async (opts: TAgentSessionOverrideOptions) => {
  const sessionHome = `/workspace/sessions/${opts.sessionId}`;
  const hostTaskData = path.join(
    resolveDockerHostWorkspacePath(),
    'tasks',
    opts.taskId.trim(),
  );
  const containerTaskData = `/workspace/sessions/${opts.sessionId}/data`;

  const lines = [
    'services:',
    '  agent:',
    '    environment:',
    `      AGENT_SESSION_HOME: ${yamlQuote(sessionHome)}`,
    `      AGENT_YAHL_DIR: ${yamlQuote(AGENT_YAHL_CONTAINER_DIR)}`,
  ];

  if (opts.browserCdpUrl?.trim()) {
    const browserCdpUrl = opts.browserCdpUrl.trim();
    const browserHost = `browser-${opts.sessionId}`;
    let cdpHost = '';

    try {
      cdpHost = new URL(browserCdpUrl).hostname;
    } catch {
      // ignore invalid URL — CDP env still set below
    }

    const noProxyHosts = [
      'localhost',
      '127.0.0.1',
      '::1',
      'redis',
      'server',
      'mongo',
      'onecli',
      'worker',
      'llm-proxy',
      'host.docker.internal',
      browserHost,
      ...(cdpHost && cdpHost !== browserHost ? [cdpHost] : []),
    ];

    const noProxy = noProxyHosts.join(',');

    lines.push(`      YAHL_BROWSER_CDP_URL: ${yamlQuote(browserCdpUrl)}`);
    lines.push(`      NO_PROXY: ${yamlQuote(noProxy)}`);
    lines.push(`      no_proxy: ${yamlQuote(noProxy)}`);
  }

  lines.push(
    '    volumes:',
    `      - ${yamlQuote(`${hostTaskData}:${containerTaskData}:rw`)}`,
  );

  if (opts.publishVnc) {
    lines.push('    ports:');
    lines.push(`      - ${yamlQuote('0:5900')}`);
  }

  lines.push('');

  const dir = agentSessionRuntimePath(opts.sessionId);
  await fs.mkdir(dir, { recursive: true });

  const filePath = agentSessionComposeOverrideFile(opts.sessionId);
  await fs.writeFile(filePath, lines.join('\n'), 'utf-8');

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
    '-f',
    composeFile,
    ...overrideFiles.flatMap((filePath) => ['-f', filePath]),
    '-p',
    opts.composeProjectName,
    'up',
    '-d',
    '--force-recreate',
    'agent',
  ];
};

export const buildComposeDownArgs = (opts: ComposeDownOptions) => {
  const overrideFiles = opts.composeOverrideFilePaths ?? [];

  return [
    '-f',
    composeFile,
    ...overrideFiles.flatMap((filePath) => ['-f', filePath]),
    '-p',
    opts.composeProjectName,
    'down',
    '--remove-orphans',
  ];
};

export const composeUp = async (opts: ComposeUpOptions) => {
  process.env.AGENT_IMAGE = process.env.AGENT_IMAGE || 'project-yahl-agent:latest';

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
