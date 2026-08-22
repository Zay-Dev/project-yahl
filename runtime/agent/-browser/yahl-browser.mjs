#!/usr/bin/env node
/**
 * CLI for agent-authored ~/data/scripts that drive Stagehand without the YAHL stage agent.
 *
 * Usage:
 *   echo '{"mode":"goto","url":"https://…","instruction":"open driving search"}' | yahl-browser
 *   echo '{"mode":"act","instruction":"Type … into From"}' | node …/yahl-browser.mjs
 *
 * Resolves bridge URL from YAHL_BROWSER_BRIDGE_URL or $HOME/.yahl-browser-bridge.json
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const META_FILE = ".yahl-browser-bridge.json";
const ENV_URL = "YAHL_BROWSER_BRIDGE_URL";

const readStdin = async () => {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
};

const resolveBaseUrl = () => {
  const fromEnv = process.env[ENV_URL]?.trim();

  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  const home = process.env.HOME?.trim() || process.env.AGENT_SESSION_HOME?.trim() || "";
  const candidates = [
    home ? path.join(home, META_FILE) : "",
    path.join("/tmp", META_FILE),
  ].filter(Boolean);

  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);

      if (typeof parsed.baseURL === "string" && parsed.baseURL.trim()) {
        return parsed.baseURL.trim().replace(/\/+$/, "");
      }
    } catch {
      // try next
    }
  }

  throw new Error(
    `yahl-browser: bridge not found — set ${ENV_URL} or create $HOME/${META_FILE} (agent must be running)`,
  );
};

const main = async () => {
  const raw = (await readStdin()).trim();

  if (!raw) {
    process.stderr.write("yahl-browser: expected JSON browser command on stdin\n");
    process.exit(2);
  }

  let body;

  try {
    body = JSON.parse(raw);
  } catch {
    process.stderr.write("yahl-browser: stdin must be JSON\n");
    process.exit(2);
  }

  const baseURL = resolveBaseUrl();
  const response = await fetch(`${baseURL}/v1/browser`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  const text = await response.text();

  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);

  let ok = response.ok;

  try {
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === "object" && "ok" in parsed) {
      ok = Boolean(parsed.ok);
    }
  } catch {
    // keep HTTP status
  }

  process.exit(ok ? 0 : 1);
};

main().catch((error) => {
  process.stderr.write(`yahl-browser: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
