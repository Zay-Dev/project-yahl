import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import url from "url";

const _moduleDir = path.dirname(url.fileURLToPath(import.meta.url));

dotenv.config();

const hasEnvFiles = (root: string) =>
  fs.existsSync(path.join(root, '.env'))
  || fs.existsSync(path.join(root, '.env.nixery'));

export const resolveRepoRootForEnv = (options?: { moduleDir?: string }) => {
  const moduleDir = options?.moduleDir ?? _moduleDir;
  const moduleRelative = path.resolve(moduleDir, '../..');

  const runtimeRepoRoot = process.env.RUNTIME_REPO_ROOT?.trim();

  if (runtimeRepoRoot) {
    const candidate = path.dirname(path.resolve(runtimeRepoRoot));

    if (hasEnvFiles(candidate)) {
      return candidate;
    }
  }

  if (hasEnvFiles(moduleRelative)) {
    return moduleRelative;
  }

  const hostRepoRoot = process.env.HOST_REPO_ROOT?.trim();

  if (hostRepoRoot) {
    return path.resolve(hostRepoRoot);
  }

  return moduleRelative;
};

const _expandEnvValue = (raw: string, env: NodeJS.ProcessEnv) =>
  raw.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => {
    const value = env[name];

    return value === undefined ? match : value;
  });

const _loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const parsed = dotenv.parse(fs.readFileSync(filePath));

  for (const [key, raw] of Object.entries(parsed)) {
    if (process.env[key] !== undefined) {
      continue;
    }

    const expanded = _expandEnvValue(raw, process.env).trim();

    if (!expanded) {
      continue;
    }

    process.env[key] = expanded;
  }
};

const _repoRoot = resolveRepoRootForEnv();

_loadEnvFile(path.join(_repoRoot, ".env"));
_loadEnvFile(path.join(_repoRoot, ".env.nixery"));

const __dirname = (() => {
  const value = process.cwd() || _moduleDir;

  if (value.endsWith('/runtime')) {
    return value;
  }

  if (value.endsWith('/agent')) {
    return value.slice(0, -6);
  }

  if (value.endsWith('/orchestrator')) {
    return value.slice(0, -11);
  }

  const nestedRuntime = path.join(value, 'runtime');

  if (nestedRuntime === _moduleDir || value.endsWith('project-yahl')) {
    return _moduleDir;
  }

  return _moduleDir;
})();


export const config = {
  __dirname,
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

export default config;
