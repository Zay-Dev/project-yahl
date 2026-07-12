import { spawn } from 'node:child_process';

const runDocker = (
  args: string[],
  options?: { ignoreFailure?: boolean },
) => new Promise<void>((resolve, reject) => {
  const child = spawn('docker', args, { stdio: 'inherit' });

  child.on('error', reject);

  child.on('close', (code) => {
    if (code === 0 || options?.ignoreFailure) {
      resolve();
      return;
    }

    reject(new Error(`docker ${args.join(' ')} failed with code ${code ?? -1}`));
  });
});

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

export const prepareNixeryImage = async (packages: string[]) => {
  const registry = resolveNixeryRegistry();
  const deduped = dedupePackages(packages);
  const composedImage = resolveNixeryImage(registry, deduped);
  const singletonRefs = [...new Set(deduped.map((pkg) => `${registry}/${pkg}`))];

  await Promise.all(singletonRefs.map((ref) => runDocker(['pull', ref])));

  if (!singletonRefs.includes(composedImage)) {
    await runDocker(['pull', composedImage]);
  }

  return {
    cleanup: () => runDocker(['rmi', composedImage], { ignoreFailure: true }),
    image: composedImage,
  };
};

export const runNixeryContainer = async (params: {
  entry: string[];
  env: Record<string, string>;
  image: string;
  volumeMounts: { containerPath: string; hostPath: string; mode: 'ro' | 'rw' }[];
}) => {
  const args = [
    'run',
    '--rm',
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

  await runDocker(args);
};
