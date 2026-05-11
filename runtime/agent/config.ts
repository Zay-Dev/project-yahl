import "dotenv/config";

import url from "url";
import path from "path";

const __dirname = (() => {
  const value = process.cwd() ||
    path.dirname(url.fileURLToPath(import.meta.url));

    if (value.endsWith("/runtime")) return value;
    if (value.endsWith('/agent')) return value.slice(0, -6);

    throw new Error(`Failed to determine module directory from ${value}`);
})();

const normalizeBaseUrl = (value: string) =>
  value
    .replace(/\/+$/, "")
    .replace(/\/v1\/chat\/completions$/, "")
    .replace(/\/chat\/completions$/, "");

const rawBaseUrl = process.env.LLM_BASE_URL || "https://api.deepseek.com";

const cliOptions = (() => {
  const args = process.argv.slice(2);
  const pairs = args.reduce((acc, value, index) => {
    if (!value.startsWith("--")) return acc;
    const key = value.replace(/^--/, "");
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      acc[key] = "true";
      return acc;
    }
    acc[key] = next;
    return acc;
  }, {} as Record<string, string>);

  const defaultAgentMdPath = path.resolve(__dirname, 'agent', "Agent.md");
  const defaultYahlDirPath = path.resolve(__dirname, 'orchestrator', "YAHL");

  const sessionId = pairs["session-id"] || process.env.AGENT_SESSION_ID || "";

  if (!sessionId) {
    throw new Error("Session ID is required");
  }

  return {
    sessionId,

    agentMdPath: pairs["agent-md"] || process.env.AGENT_MD_PATH || defaultAgentMdPath,
    daemon: pairs["daemon"] === "true" || process.env.AGENT_DAEMON === "1",
    nonInteractive: pairs["non-interactive"] === "true" || process.env.AGENT_NON_INTERACTIVE === "1",
    yahlDirPath: pairs["yahl-dir"] || process.env.AGENT_YAHL_DIR || defaultYahlDirPath,
  };
})();

export const config = {
  cliOptions,
  
  debug: true,
  runtimeRoot: __dirname,

  apiBaseUrl: normalizeBaseUrl(rawBaseUrl),
  apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.API_KEY || "",
  model: process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  redisUrl: process.env.AGENT_REDIS_URL || "redis://127.0.0.1:6379",
  thinkingMode: (process.env.LLM_THINKING_MODE || process.env.DEEPSEEK_THINKING_MODE || "disabled")
    .trim()
    .toLowerCase() === "enabled",
};

export default config;