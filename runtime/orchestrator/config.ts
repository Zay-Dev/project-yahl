import "dotenv/config";

import url from "url";
import path from "path";

const __dirname = (() => {
  const value = process.cwd() ||
    path.dirname(url.fileURLToPath(import.meta.url));

    if (value.endsWith("/runtime")) return value;
    if (value.endsWith('/agent')) return value.slice(0, -6);
    if (value.endsWith('/orchestrator')) return value.slice(0, -11);

    throw new Error(`Failed to determine module directory from ${value}`);
})();


export const config = {
  __dirname,
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

export default config;