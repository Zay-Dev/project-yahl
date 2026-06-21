import { spawn } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const CONTAINER_WORKSPACE = '/omniflex';
const CONTAINER_RUNTIME = `/omniflex/${process.env.OMNIFLEX_APP_DIR?.trim() || 'project-yahl'}/runtime`;
const RUNTIME_FILTER = '@project-yahl/runtime';

const _orchestrateCliArgs = (sessionId: string, args: string[]) => [
  'orchestrator/index.ts',
  'run',
  '--session-id',
  sessionId,
  ...args,
];

const _orchestrateBuiltCliArgs = (sessionId: string, args: string[]) => [
  'run',
  '--session-id',
  sessionId,
  ...args,
];

const _findProjectYahlRoot = (startDir: string) => {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 10; depth += 1) {
    const runtimePkg = path.join(current, 'runtime', 'package.json');

    if (fs.existsSync(runtimePkg)) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return startDir;
};

const _findPnpmWorkspaceRoot = (startDir: string) => {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 10; depth += 1) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return _findProjectYahlRoot(startDir);
};

const _resolveRuntimeDir = () => {
  const runtimeRoot = process.env.RUNTIME_REPO_ROOT?.trim()
    || process.env.YAHL_REPO_ROOT?.trim();

  if (runtimeRoot && fs.existsSync(path.join(path.resolve(runtimeRoot), 'package.json'))) {
    return path.resolve(runtimeRoot);
  }

  if (fs.existsSync(path.join(CONTAINER_RUNTIME, 'package.json'))) {
    return CONTAINER_RUNTIME;
  }

  return path.join(_findProjectYahlRoot(process.cwd()), 'runtime');
};

const _resolveWorkspaceRoot = () => {
  if (fs.existsSync(path.join(CONTAINER_WORKSPACE, 'pnpm-workspace.yaml'))) {
    return CONTAINER_WORKSPACE;
  }

  return _findPnpmWorkspaceRoot(_resolveRuntimeDir());
};

type TSpawnSpec = {
  args: string[];
  cmd: string;
  cwd: string;
  label: string;
};

const _resolveBuiltOrchestratorSpawn = (
  runtimeDir: string,
  sessionId: string,
  args: string[],
): TSpawnSpec | null => {
  const entry = path.join(runtimeDir, 'dist/orchestrator/index.js');

  if (!fs.existsSync(entry)) {
    return null;
  }

  return {
    args: [entry, ..._orchestrateBuiltCliArgs(sessionId, args)],
    cmd: process.execPath,
    cwd: runtimeDir,
    label: `node+built@${runtimeDir}`,
  };
};

const _resolveNodeTsxSpawn = (
  runtimeDir: string,
  sessionId: string,
  args: string[],
): TSpawnSpec | null => {
  const cli = path.join(runtimeDir, 'node_modules/tsx/dist/cli.mjs');

  if (!fs.existsSync(cli)) {
    return null;
  }

  return {
    args: [cli, ..._orchestrateCliArgs(sessionId, args)],
    cmd: process.execPath,
    cwd: runtimeDir,
    label: `node+tsx@${runtimeDir}`,
  };
};

const _resolvePnpmExecSpawn = (
  workspaceRoot: string,
  sessionId: string,
  args: string[],
): TSpawnSpec => ({
  args: [
    '--filter',
    RUNTIME_FILTER,
    'exec',
    'tsx',
    ..._orchestrateCliArgs(sessionId, args),
  ],
  cmd: 'pnpm',
  cwd: workspaceRoot,
  label: `pnpm-exec@${workspaceRoot}`,
});

export const resolveRepoRoot = () => path.dirname(_resolveRuntimeDir());

export const resolvePnpmWorkspaceRoot = () => _resolveWorkspaceRoot();

const _loadRootEnv = () => {
  const rootEnvPath = path.join(resolveRepoRoot(), '.env');

  if (!fs.existsSync(rootEnvPath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(rootEnvPath));
};

const resolveSessionApiBaseUrl = () => {
  const explicit = process.env.SESSION_API_BASE_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const port = process.env.PORT?.trim() || '4000';

  return `http://127.0.0.1:${port}`;
};

const _logSpawnDiagnostics = (
  sessionId: string,
  runtimeDir: string,
  workspaceRoot: string,
  spawnSpec: TSpawnSpec,
  logPath: string,
) => {
  const tsxBin = path.join(runtimeDir, 'node_modules/.bin/tsx');
  const tsxCli = path.join(runtimeDir, 'node_modules/tsx/dist/cli.mjs');
  const builtEntry = path.join(runtimeDir, 'dist/orchestrator/index.js');
  const line = [
    '[spawn-orchestrate]',
    `sessionId=${sessionId}`,
    `via=${spawnSpec.label}`,
    `cmd=${spawnSpec.cmd}`,
    `cwd=${spawnSpec.cwd}`,
    `log=${logPath}`,
    `builtEntry=${fs.existsSync(builtEntry)}`,
    `tsxBin=${fs.existsSync(tsxBin)}`,
    `tsxCli=${fs.existsSync(tsxCli)}`,
    `runtimePkg=${fs.existsSync(path.join(runtimeDir, 'package.json'))}`,
  ].join(' ');

  console.log(line);
  logger.info(line);
};

export const spawnOrchestrate = (
  sessionId: string,
  args: string[],
) => {
  const runtimeDir = _resolveRuntimeDir();
  const workspaceRoot = _resolveWorkspaceRoot();
  const sessionApiBaseUrl = resolveSessionApiBaseUrl();
  const preferSource = process.env.NODE_ENV !== 'production';
  const spawnSpec = (preferSource
    ? _resolveNodeTsxSpawn(runtimeDir, sessionId, args)
      ?? _resolveBuiltOrchestratorSpawn(runtimeDir, sessionId, args)
    : _resolveBuiltOrchestratorSpawn(runtimeDir, sessionId, args)
      ?? _resolveNodeTsxSpawn(runtimeDir, sessionId, args))
    ?? _resolvePnpmExecSpawn(workspaceRoot, sessionId, args);

  const logPath = path.join('/tmp', `yahl-orchestrator-${sessionId}.log`);
  const logFd = fs.openSync(logPath, 'a');

  fs.appendFileSync(
    logPath,
    `\n--- spawn ${new Date().toISOString()} ${spawnSpec.label} ---\n`,
  );

  _logSpawnDiagnostics(sessionId, runtimeDir, workspaceRoot, spawnSpec, logPath);

  const redisUrl = process.env.REDIS_URL?.trim() || 'redis://redis:6379';
  const rootParsed = _loadRootEnv();

  const child = spawn(spawnSpec.cmd, spawnSpec.args, {
    cwd: spawnSpec.cwd,
    detached: true,
    env: {
      ...rootParsed,
      ...process.env,
      REDIS_URL: redisUrl,
      SESSION_API_BASE_URL: sessionApiBaseUrl,
    },
    stdio: ['ignore', logFd, logFd],
  });

  child.unref();

  try {
    fs.closeSync(logFd);
  } catch {
    // log fd may stay open on child; ignore close errors
  }

  child.on('error', (error) => {
    const message = `failed to spawn orchestrator for session ${sessionId}: ${error.message}`;

    console.error(message);
    logger.error(message, { error });
  });

  child.on('exit', (code, signal) => {
    if (code === 0) {
      console.log(`[spawn-orchestrate] orchestrator finished sessionId=${sessionId}`);
      return;
    }

    const message = `orchestrator exited sessionId=${sessionId} code=${code ?? 'null'} signal=${signal ?? 'null'} log=${logPath}`;

    console.error(message);
    logger.error(message);
  });

  return child;
};
