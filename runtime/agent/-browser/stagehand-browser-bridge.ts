import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

import type { BrowserToolArguments } from "@/shared/stage-tools";
import { parseBrowserToolArguments } from "@/shared/stage-tools";

import config from "../config";
import { buildBrowserProxyBrief } from "./browser-proxy-brief";
import { runBrowserCommand } from "./stagehand-session";

type TBridgeState = {
  port: number;
  queue: Promise<void>;
  server: Server;
};

let bridgeState: TBridgeState | null = null;
let startPromise: Promise<TBridgeState> | null = null;

export const BROWSER_BRIDGE_URL_ENV = "YAHL_BROWSER_BRIDGE_URL";
export const BROWSER_BRIDGE_META_FILE = ".yahl-browser-bridge.json";

export const browserBridgeMetaPath = () => {
  const home = process.env.HOME?.trim() || process.env.AGENT_SESSION_HOME?.trim() || "";

  if (!home) {
    return path.join("/tmp", BROWSER_BRIDGE_META_FILE);
  }

  return path.join(home, BROWSER_BRIDGE_META_FILE);
};

const readJsonBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw) as unknown;
};

const writeJson = (res: ServerResponse, status: number, body: unknown) => {
  const payload = JSON.stringify(body);

  res.writeHead(status, {
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json",
  });
  res.end(payload);
};

const enqueue = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (!bridgeState) {
    throw new Error("yahl browser bridge is not running");
  }

  const previous = bridgeState.queue;
  let release!: () => void;

  bridgeState.queue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await fn();
  } finally {
    release();
  }
};

export const parseBridgeBrowserBody = (body: unknown): BrowserToolArguments | null => {
  if (typeof body === "string") {
    return parseBrowserToolArguments(body);
  }

  return parseBrowserToolArguments(JSON.stringify(body ?? {}));
};

const handleBrowserCommand = async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const body = await readJsonBody(req);
    const args = parseBridgeBrowserBody(body);

    if (!args) {
      writeJson(res, 400, {
        error: "browser bridge: invalid body — need { mode, instruction, url?, schema? }",
        ok: false,
      });

      return;
    }

    const result = await enqueue(() => runBrowserCommand(args, {
      proxyBrief: buildBrowserProxyBrief({ args }),
      sessionId: config.cliOptions.sessionId,
    }));

    writeJson(res, result.ok ? 200 : 422, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[yahl-browser-bridge] error: ${message}\n`);
    writeJson(res, 500, { error: message, ok: false });
  }
};

const persistBridgeMeta = async (port: number) => {
  const baseURL = `http://127.0.0.1:${port}`;

  process.env[BROWSER_BRIDGE_URL_ENV] = baseURL;

  const metaPath = browserBridgeMetaPath();

  try {
    await fs.mkdir(path.dirname(metaPath), { recursive: true });
    await fs.writeFile(
      metaPath,
      `${JSON.stringify({ baseURL, port, pid: process.pid }, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[yahl-browser-bridge] failed to write meta ${metaPath}: ${message}\n`);
  }
};

const clearBridgeMeta = async () => {
  delete process.env[BROWSER_BRIDGE_URL_ENV];

  try {
    await fs.unlink(browserBridgeMetaPath());
  } catch {
    // absent
  }
};

const startBridgeServer = async (): Promise<TBridgeState> =>
  new Promise((resolve, reject) => {
    const preferredPort = Number(process.env.YAHL_BROWSER_BRIDGE_PORT?.trim() || "0") || 0;
    const server = createServer((req, res) => {
      const url = req.url || "/";
      const route = url.split("?")[0];

      if (req.method === "GET" && (route === "/health" || route === "/v1/health")) {
        writeJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && (route === "/v1/browser" || route === "/browser")) {
        void handleBrowserCommand(req, res);
        return;
      }

      writeJson(res, 404, { error: `not found: ${req.method} ${route}`, ok: false });
    });

    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("yahl browser bridge failed to bind"));
        return;
      }

      console.log(`[yahl-browser-bridge] listening on 127.0.0.1:${address.port}\n`);
      resolve({
        port: address.port,
        queue: Promise.resolve(),
        server,
      });
    });
  });

export const getStagehandBrowserBridgeBaseUrl = () => {
  if (!bridgeState) {
    throw new Error("yahl browser bridge is not running");
  }

  return `http://127.0.0.1:${bridgeState.port}`;
};

export const ensureStagehandBrowserBridge = async (): Promise<{ baseURL: string; port: number }> => {
  if (bridgeState) {
    return { baseURL: getStagehandBrowserBridgeBaseUrl(), port: bridgeState.port };
  }

  if (startPromise) {
    const state = await startPromise;

    return { baseURL: `http://127.0.0.1:${state.port}`, port: state.port };
  }

  startPromise = startBridgeServer();

  try {
    bridgeState = await startPromise;
    await persistBridgeMeta(bridgeState.port);

    return { baseURL: getStagehandBrowserBridgeBaseUrl(), port: bridgeState.port };
  } finally {
    startPromise = null;
  }
};

export const stopStagehandBrowserBridge = async () => {
  const current = bridgeState;

  bridgeState = null;
  startPromise = null;

  await clearBridgeMeta();

  if (!current) {
    return;
  }

  await new Promise<void>((resolve) => {
    current.server.close(() => resolve());
  });
};
