import "dotenv/config";

import url from "url";
import path from "path";

const normalizeBaseUrl = (value: string) =>
  value
    .replace(/\/+$/, "")
    .replace(/\/v1\/chat\/completions$/, "")
    .replace(/\/chat\/completions$/, "");

const rawBaseUrl = process.env.LLM_BASE_URL || process.env.DEEPSEEK_URL || "https://api.deepseek.com";

export default {
  debug: true,
  moduleDir: path.dirname(url.fileURLToPath(import.meta.url)),

  apiBaseUrl: normalizeBaseUrl(rawBaseUrl),
  apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.API_KEY || "",
  model: process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  thinkingMode: (process.env.LLM_THINKING_MODE || process.env.DEEPSEEK_THINKING_MODE || "disabled")
    .trim()
    .toLowerCase() === "enabled",
};