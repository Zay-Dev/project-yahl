import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import url from "url";

const _moduleDir = path.dirname(url.fileURLToPath(import.meta.url));

dotenv.config();

const _resolveRepoRootForEnv = () => {
  const hostRepoRoot = process.env.HOST_REPO_ROOT?.trim();

  if (hostRepoRoot) {
    return path.resolve(hostRepoRoot);
  }

  return path.resolve(_moduleDir, '../..');
};

const _rootEnvFile = path.join(_resolveRepoRootForEnv(), ".env");

if (fs.existsSync(_rootEnvFile)) {
  dotenv.config({ path: _rootEnvFile });
}

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
