import config from "../config";

import { jsonSchemaToZod, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

import type { BrowserToolArguments } from "@/shared/stage-tools";
import type { TModelResponse } from "@/shared/transports/-types";
import type { YahlStagehandConfig } from "@/shared/yahl-stage";

import {
  clearStagehandProxyBrief,
  clearStagehandProxyLlmOverrides,
  clearStagehandProxyReporter,
  ensureStagehandLlmProxy,
  setStagehandProxyBrief,
  setStagehandProxyLlmOverrides,
  setStagehandProxyReporter,
  stopStagehandLlmProxy,
} from "./stagehand-llm-proxy";
import { resolveChromiumExecutablePath } from "./chromium-executable";

const STAGEHAND_CLOSE_TIMEOUT_MS = 30_000;

const BROWSER_TIMEOUT_MS = 120_000;

const CONSECUTIVE_FAILURES_BEFORE_RESET = 2;

const GOTO_OPTIONS = {
  timeoutMs: BROWSER_TIMEOUT_MS,
  waitUntil: "domcontentloaded" as const,
};

type TBrowserResult =
  | { data: unknown; ok: true }
  | { error: string; ok: false };

export type TRunBrowserCommandOptions = {
  onModelResponse?: (response: TModelResponse) => Promise<void>;
  proxyBrief?: string;
  stagehand?: YahlStagehandConfig;
};

let stagehand: Stagehand | null = null;
let initPromise: Promise<Stagehand> | null = null;
let consecutiveBrowserFailures = 0;

const chromiumArgs = () => {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
  ];

  if (config.stagehandLiveview) {
    args.push("--ozone-platform=x11", "--disable-gpu");
  }

  return args;
};

const resolveStagehand = async (): Promise<Stagehand> => {
  if (stagehand) return stagehand;
  if (initPromise) return initPromise;

  const sessionId = config.cliOptions.sessionId;

  if (!sessionId) {
    throw new Error("browser: AGENT_SESSION_ID is required");
  }

  initPromise = (async () => {
    const chromePath = resolveChromiumExecutablePath();
    process.env.CHROME_PATH = chromePath;

    const proxy = await ensureStagehandLlmProxy();

    if (config.debug) {
      console.log(`[stagehand] CHROME_PATH=${chromePath}\n`);
      console.log(`[stagehand] llm proxy baseURL=${proxy.baseURL}\n`);
    }

    const instance = new Stagehand({
      disablePino: true,
      env: "LOCAL",
      localBrowserLaunchOptions: {
        args: chromiumArgs(),
        chromiumSandbox: false,
        connectTimeoutMs: 60_000,
        executablePath: resolveChromiumExecutablePath(),
        headless: !config.stagehandLiveview,
      },
      model: {
        apiKey: "stagehand-proxy",
        baseURL: proxy.baseURL,
        modelName: config.stagehandModel,
      },
      sessionId,
      verbose: 0,
    });

    await instance.init();
    stagehand = instance;

    return instance;
  })();

  try {
    return await initPromise;
  } catch (error) {
    initPromise = null;
    stagehand = null;
    throw error;
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label}: timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const schemaFromJson = (schema: Record<string, unknown>) => {
  try {
    return jsonSchemaToZod(schema as unknown as Parameters<typeof jsonSchemaToZod>[0]);
  } catch {
    return z.record(z.string(), z.unknown());
  }
};

const isTimeoutError = (message: string) =>
  /timed out/i.test(message) || /TimeoutError/i.test(message);

const navigate = async (
  page: { goto: (url: string, options?: typeof GOTO_OPTIONS) => Promise<unknown> },
  url: string,
) => {
  await withTimeout(
    page.goto(url, GOTO_OPTIONS),
    BROWSER_TIMEOUT_MS,
    "browser.goto",
  );
};

export const closeStagehandSession = async () => {
  const current = stagehand;

  stagehand = null;
  initPromise = null;
  consecutiveBrowserFailures = 0;

  await stopStagehandLlmProxy();

  if (!current) return;

  try {
    await withTimeout(
      current.close(),
      STAGEHAND_CLOSE_TIMEOUT_MS,
      'stagehand.close',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[stagehand] close failed: ${message}\n`);
  }
};

const executeBrowserCommand = async (
  args: BrowserToolArguments,
): Promise<TBrowserResult> => {
  const sh = await resolveStagehand();
  const page = sh.context.pages()[0];

  if (!page) {
    return { error: "browser: no page available", ok: false };
  }

  const mode = args.mode;

  if (mode === "goto") {
    if (!args.url?.trim()) {
      return { error: "browser: url is required for goto mode", ok: false };
    }

    await navigate(page, args.url);

    return {
      data: { mode, url: args.url },
      ok: true,
    };
  }

  if (mode === "act") {
    const result = await withTimeout(
      sh.act(args.instruction),
      BROWSER_TIMEOUT_MS,
      "browser.act",
    );

    return { data: result, ok: true };
  }

  if (mode === "extract") {
    const extractPromise = args.schema
      ? sh.extract(args.instruction, schemaFromJson(args.schema))
      : sh.extract(args.instruction);

    const result = await withTimeout(extractPromise, BROWSER_TIMEOUT_MS, "browser.extract");

    return { data: result, ok: true };
  }

  if (mode === "observe") {
    const result = await withTimeout(
      sh.observe(args.instruction),
      BROWSER_TIMEOUT_MS,
      "browser.observe",
    );

    return { data: result, ok: true };
  }

  return { error: `browser: unsupported mode ${mode}`, ok: false };
};

const shouldResetBrowser = (_args: BrowserToolArguments, error: string) => {
  if (isTimeoutError(error)) {
    return true;
  }

  return consecutiveBrowserFailures >= CONSECUTIVE_FAILURES_BEFORE_RESET;
};

const applyBrowserProxyOptions = (options?: TRunBrowserCommandOptions) => {
  if (options?.onModelResponse) {
    setStagehandProxyReporter({ onModelResponse: options.onModelResponse });
  }

  if (options?.proxyBrief !== undefined) {
    setStagehandProxyBrief(options.proxyBrief);
  }

  const stagehand = options?.stagehand;

  if (stagehand?.model || stagehand?.apiBaseUrl) {
    setStagehandProxyLlmOverrides({
      ...(stagehand.apiBaseUrl ? { apiBaseUrl: stagehand.apiBaseUrl } : {}),
      ...(stagehand.model ? { model: stagehand.model } : {}),
    });
  } else {
    clearStagehandProxyLlmOverrides();
  }
};

export const runBrowserCommand = async (
  args: BrowserToolArguments,
  options?: TRunBrowserCommandOptions,
): Promise<TBrowserResult> => {
  await ensureStagehandLlmProxy();
  applyBrowserProxyOptions(options);

  try {
    let result: TBrowserResult;

    try {
      result = await executeBrowserCommand(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      result = { error: message, ok: false };
    }

    if (result.ok) {
      consecutiveBrowserFailures = 0;

      return result;
    }

    consecutiveBrowserFailures += 1;

    if (!shouldResetBrowser(args, result.error)) {
      return result;
    }

    console.error(
      `[stagehand] resetting browser after failure (mode=${args.mode}, consecutive=${consecutiveBrowserFailures}): ${result.error}\n`,
    );

    await closeStagehandSession();

    await ensureStagehandLlmProxy();
    applyBrowserProxyOptions(options);

    try {
      result = await executeBrowserCommand(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      result = { error: message, ok: false };
    }

    if (result.ok) {
      consecutiveBrowserFailures = 0;
    } else {
      consecutiveBrowserFailures += 1;
    }

    return result;
  } finally {
    clearStagehandProxyBrief();
    clearStagehandProxyLlmOverrides();
    clearStagehandProxyReporter();
  }
};
