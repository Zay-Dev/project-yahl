import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const GRACEFUL_WAIT_MS = 60_000;
const STOP_TIMEOUT_SEC = 60;

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

export const resolveNixeryContainerName = (sessionId: string, defId: string) => {
  const raw = `nixery-${sessionId}-${defId}`;

  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || 'nixery';
};

const runDocker = (
  args: string[],
  options?: { ignoreFailure?: boolean; stdio?: 'inherit' | 'pipe' },
) => new Promise<void>((resolve, reject) => {
  const child = spawn('docker', args, {
    stdio: options?.stdio ?? 'inherit',
  });

  child.on('error', reject);

  child.on('close', (code) => {
    if (code === 0 || options?.ignoreFailure) {
      resolve();
      return;
    }

    reject(new Error(`docker ${args.join(' ')} failed with code ${code ?? -1}`));
  });
});

const runDockerCapture = (args: string[]) => new Promise<string>((resolve, reject) => {
  const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', reject);

  child.on('close', (code) => {
    if (code === 0) {
      resolve(stdout.trim());
      return;
    }

    reject(new Error(`docker ${args.join(' ')} failed: ${stderr.trim() || String(code)}`));
  });
});

export const isContainerRunning = async (containerName: string): Promise<boolean> => {
  try {
    const state = await runDockerCapture([
      'inspect',
      '-f',
      '{{.State.Running}}',
      containerName,
    ]);

    return state === 'true';
  } catch {
    return false;
  }
};

export const confirmNixeryContainerStopped = async (
  containerName: string,
  log?: (message: string) => void,
): Promise<void> => {
  const write = log ?? ((message: string) => console.log(message));

  if (!(await isContainerRunning(containerName))) {
    write(`[nixery] teardown skip container=${containerName} already stopped`);

    return;
  }

  write(`[nixery] teardown wait natural exit container=${containerName} up_to_ms=${GRACEFUL_WAIT_MS}`);
  const deadline = Date.now() + GRACEFUL_WAIT_MS;

  while (Date.now() < deadline) {
    if (!(await isContainerRunning(containerName))) {
      write(`[nixery] teardown natural exit container=${containerName}`);

      return;
    }

    await sleep(2000);
  }

  if (await isContainerRunning(containerName)) {
    write(`[nixery] teardown docker stop -t ${STOP_TIMEOUT_SEC} container=${containerName}`);
    await runDocker(['stop', '-t', String(STOP_TIMEOUT_SEC), containerName], {
      ignoreFailure: true,
    });
  }

  if (await isContainerRunning(containerName)) {
    write(`[nixery] teardown docker rm -f container=${containerName}`);
    await runDocker(['rm', '-f', containerName], { ignoreFailure: true });
  }
};

export const startNixeryLogStream = (
  containerName: string,
  logPath: string,
): (() => void) => {
  const logFd = fs.openSync(logPath, 'a');
  const child = spawn('docker', ['logs', '-f', containerName], {
    stdio: ['ignore', logFd, logFd],
  });

  return () => {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }

    try {
      fs.closeSync(logFd);
    } catch {
      // ignore
    }
  };
};

export const resolveNixeryRegistry = () =>
  process.env.NIXERY_REGISTRY?.trim() || 'nixery.dev';

export const dedupePackages = (packages: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const pkg of packages) {
    if (seen.has(pkg)) {
      continue;
    }

    seen.add(pkg);
    result.push(pkg);
  }

  return result;
};

export const resolveNixeryImage = (registry: string, packages: string[]) => {
  const deduped = dedupePackages(packages);

  return `${registry}/${deduped.join('/')}`;
};

export const resolveCustomNixeryImageTag = (defId: string, dockerfileBytes: string | Buffer) => {
  const hash = createHash('md5').update(dockerfileBytes).digest('hex');

  return `custom-nixery-${defId}:v${hash}`;
};

const prefetchNixeryPackages = async (packages: string[]) => {
  const registry = resolveNixeryRegistry();
  const deduped = dedupePackages(packages);
  const composedImage = resolveNixeryImage(registry, deduped);
  const singletonRefs = [...new Set(deduped.map((pkg) => `${registry}/${pkg}`))];

  await Promise.all(singletonRefs.map((ref) => runDocker(['pull', ref])));

  if (!singletonRefs.includes(composedImage)) {
    await runDocker(['pull', composedImage]);
  }

  return composedImage;
};

export const prepareNixeryImage = async (params: {
  defId: string;
  dockerfile?: string;
  nixeryRoot: string;
  packages: string[];
}) => {
  const composedImage = await prefetchNixeryPackages(params.packages);
  const dockerfileName = params.dockerfile?.trim();

  if (!dockerfileName) {
    return {
      cleanup: () => runDocker(['rmi', composedImage], { ignoreFailure: true }),
      image: composedImage,
    };
  }

  const dockerfilePath = path.join(params.nixeryRoot, params.defId, dockerfileName);
  const dockerfileBytes = fs.readFileSync(dockerfilePath);
  const tag = resolveCustomNixeryImageTag(params.defId, dockerfileBytes);

  await runDocker([
    'build',
    '-t',
    tag,
    '--build-arg',
    `NIXERY_BASE=${composedImage}`,
    '-f',
    dockerfilePath,
    params.nixeryRoot,
  ]);

  return {
    cleanup: async () => undefined,
    image: tag,
  };
};

export const runNixeryContainerDetached = async (params: {
  containerName: string;
  entry: string[];
  env: Record<string, string>;
  image: string;
  volumeMounts: { containerPath: string; hostPath: string; mode: 'ro' | 'rw' }[];
}): Promise<void> => {
  await runDocker(['rm', '-f', params.containerName], { ignoreFailure: true });

  const args = [
    'run',
    '-d',
    '--rm',
    '--name',
    params.containerName,
    '--network',
    process.env.RUNTIME_SHARED_NETWORK?.trim() || 'yahl_shared',
  ];

  for (const [key, value] of Object.entries(params.env)) {
    args.push('-e', `${key}=${value}`);
  }

  for (const mount of params.volumeMounts) {
    args.push('-v', `${mount.hostPath}:${mount.containerPath}:${mount.mode}`);
  }

  args.push(params.image, ...params.entry);

  const containerId = await runDockerCapture(args);

  if (!containerId) {
    throw new Error(`[nixery] docker run -d returned empty id for ${params.containerName}`);
  }
};
