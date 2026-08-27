import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

import {
  resolveDockerHostWorkspacePath,
  repoRoot,
  runtimeRoot,
} from './paths';

const BROWSER_COMPOSE_FILE = path.join(repoRoot, 'docker-compose.browser.yml');
const BROWSER_IDLE_TTL_MS = 86_400_000;
export const BROWSER_CDP_ENV = 'YAHL_BROWSER_CDP_URL';
export const BROWSER_ACTIVE_MARKER = '.yahl-browser-active';

export const resolveBrowserContainerName = (sessionId: string) => `browser-${sessionId}`;

export const browserSessionRuntimePath = (sessionId: string) =>
  path.join(runtimeRoot, '.browsers', sessionId);

/** DNS form (ops / docs). Chrome CDP Host checks require the IP form from resolveBrowserCdpHttpUrl. */
export const browserCdpUrl = (sessionId: string) =>
  `http://${resolveBrowserContainerName(sessionId)}:9222`;

export const resolveBrowserContainerIp = async (containerName: string) => {
  const output = await runCommandCapture('docker', [
    'inspect',
    '-f',
    '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
    containerName,
  ]);
  const ip = output.trim().split(/\s+/)[0]?.trim();

  if (!ip) {
    throw new Error(`browser container has no IP: ${containerName}`);
  }

  return ip;
};

/** Chrome rejects Host: <docker-dns-name>; CDP peers must use the container IP. */
export const resolveBrowserCdpHttpUrl = async (sessionId: string) => {
  const ip = await resolveBrowserContainerIp(resolveBrowserContainerName(sessionId));
  return `http://${ip}:9222`;
};

export const browserActiveMarkerPath = (sessionId: string) =>
  path.join(
    resolveDockerHostWorkspacePath(),
    'sessions',
    sessionId,
    BROWSER_ACTIVE_MARKER,
  );

export const browserProfilePath = (sessionId: string) =>
  path.join(
    resolveDockerHostWorkspacePath(),
    'sessions',
    sessionId,
    'chrome-profile',
  );

const runCommand = (
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    ignoreFailure?: boolean;
  },
) => new Promise<void>((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: options?.cwd,
    env: options?.env,
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

const runCommandCapture = (
  command: string,
  args: string[],
) => new Promise<string>((resolve, reject) => {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8');
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });

  child.on('error', reject);

  child.on('close', (code) => {
    if (code === 0) {
      resolve(stdout);
      return;
    }

    reject(new Error(`${command} ${args.join(' ')} failed: ${stderr || code}`));
  });
});

export const touchBrowserActivity = async (sessionId: string) => {
  const marker = browserActiveMarkerPath(sessionId);
  await fs.mkdir(path.dirname(marker), { recursive: true });
  const now = new Date();
  await fs.writeFile(marker, `${now.toISOString()}\n`, 'utf8');
  await fs.utimes(marker, now, now);
};

const isBrowserContainerRunning = async (containerName: string) => {
  try {
    const output = await runCommandCapture('docker', [
      'ps',
      '--filter',
      `name=^/${containerName}$`,
      '--filter',
      'status=running',
      '--format',
      '{{.Names}}',
    ]);

    return output.trim() === containerName;
  } catch {
    return false;
  }
};

const waitForBrowserCdp = async (cdpHttpUrl: string) => {
  const network = process.env.SHARED_DOCKER_NETWORK?.trim() || 'yahl_shared';
  const endpoint = `${cdpHttpUrl.replace(/\/+$/, '')}/json/version`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await runCommandCapture('docker', [
        'run',
        '--rm',
        '--network',
        network,
        'curlimages/curl:8.5.0',
        '-sf',
        '--max-time',
        '2',
        endpoint,
      ]);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    `browser CDP not ready endpoint=${endpoint}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
};

export const ensureBrowser = async (sessionId: string) => {
  const trimmed = sessionId.trim();

  if (!trimmed) {
    throw new Error('ensureBrowser: sessionId required');
  }

  const containerName = resolveBrowserContainerName(trimmed);
  const profileDir = browserProfilePath(trimmed);

  await fs.mkdir(profileDir, { recursive: true });
  await fs.mkdir(browserSessionRuntimePath(trimmed), { recursive: true });

  process.env.BROWSER_CONTAINER_NAME = containerName;
  process.env.BROWSER_SESSION_ID = trimmed;
  process.env.HOST_REPO_ROOT = process.env.HOST_REPO_ROOT || repoRoot;

  if (!(await isBrowserContainerRunning(containerName))) {
    await runCommand(
      'docker',
      [
        'compose',
        '-f',
        BROWSER_COMPOSE_FILE,
        '-p',
        containerName,
        'up',
        '-d',
        'browser',
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          BROWSER_CONTAINER_NAME: containerName,
          BROWSER_SESSION_ID: trimmed,
          HOST_REPO_ROOT: process.env.HOST_REPO_ROOT || repoRoot,
        },
      },
    );
  }

  const cdpUrl = await resolveBrowserCdpHttpUrl(trimmed);
  await waitForBrowserCdp(cdpUrl);
  await touchBrowserActivity(trimmed);

  return {
    cdpUrl,
    containerName,
  };
};

export const shutdownBrowser = async (sessionId: string) => {
  const trimmed = sessionId.trim();

  if (!trimmed) {
    return;
  }

  const containerName = resolveBrowserContainerName(trimmed);

  await runCommand(
    'docker',
    [
      'compose',
      '-f',
      BROWSER_COMPOSE_FILE,
      '-p',
      containerName,
      'down',
      '--remove-orphans',
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        BROWSER_CONTAINER_NAME: containerName,
        BROWSER_SESSION_ID: trimmed,
        HOST_REPO_ROOT: process.env.HOST_REPO_ROOT || repoRoot,
      },
      ignoreFailure: true,
    },
  );

  await runCommand('docker', ['rm', '-f', containerName], { ignoreFailure: true });
  await fs.rm(browserSessionRuntimePath(trimmed), { force: true, recursive: true });
};

const listBrowserContainers = async () => {
  try {
    const output = await runCommandCapture('docker', [
      'ps',
      '-a',
      '--filter',
      'label=yahl.browser=1',
      '--format',
      '{{.Names}}\t{{.Label "yahl.sessionId"}}\t{{.CreatedAt}}',
    ]);

    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = '', sessionId = ''] = line.split('\t');
        return { name, sessionId: sessionId.trim() };
      })
      .filter((row) => row.sessionId);
  } catch {
    return [];
  }
};

export const isBrowserIdle = async (sessionId: string) => {
  const marker = browserActiveMarkerPath(sessionId);

  try {
    const stat = await fs.stat(marker);
    return Date.now() - stat.mtimeMs > BROWSER_IDLE_TTL_MS;
  } catch {
    return true;
  }
};

export type TPruneIdleBrowsersResult = {
  abandoned: string[];
};

export const pruneIdleBrowsers = async (
  abandon?: (sessionId: string) => Promise<void>,
): Promise<TPruneIdleBrowsersResult> => {
  const containers = await listBrowserContainers();
  const abandoned: string[] = [];

  for (const row of containers) {
    if (!(await isBrowserIdle(row.sessionId))) {
      continue;
    }

    if (abandon) {
      await abandon(row.sessionId);
    } else {
      await shutdownBrowser(row.sessionId);
    }

    abandoned.push(row.sessionId);
  }

  return { abandoned };
};
