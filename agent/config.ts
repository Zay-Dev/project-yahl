import "dotenv/config";

import url from "url";
import path from "path";

export default {
  debug: true,
  moduleDir: path.dirname(url.fileURLToPath(import.meta.url)),

  apiKey: process.env.DEEPSEEK_API_KEY || process.env.API_KEY || "",
  apiUrl: (process.env.DEEPSEEK_URL || "https://api.deepseek.com").replace(/\/+$/, ""),
  model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  thinkingMode: (process.env.DEEPSEEK_THINKING_MODE || "disabled").trim().toLowerCase() === 'enabled',
};