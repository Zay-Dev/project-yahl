import "dotenv/config";

import url from "url";
import path from "path";

const _moduleDir = path.dirname(url.fileURLToPath(import.meta.url));

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