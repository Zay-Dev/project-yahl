import config from "../config";

import { jsonSchemaToZod, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

import type { BrowserToolArguments } from "@/shared/stage-tools";

const DEFAULT_AGENT_MAX_STEPS = 15;

const AGENT_TIMEOUT_MS = 300_000;
const BROWSER_TIMEOUT_MS = 120_000;

type TBrowserResult =
  | { data: unknown; ok: true }
  | { error: string; ok: false };

let stagehand: Stagehand | null = null;
let initPromise: Promise<Stagehand> | null = null;

const stagehandModel = () => config.stagehandModel;

const resolveStagehand = async (): Promise<Stagehand> => {
  if (stagehand) return stagehand;
  if (initPromise) return initPromise;

  const sessionId = config.cliOptions.sessionId;

  if (!sessionId) {
    throw new Error("browser: AGENT_SESSION_ID is required");
  }

  initPromise = (async () => {
    const instance = new Stagehand({
      disablePino: true,
      env: "LOCAL",
      localBrowserLaunchOptions: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        chromiumSandbox: false,
        headless: true,
      },
      model: {
        apiKey: config.apiKey,
        baseURL: config.apiBaseUrl,
        modelName: stagehandModel(),
      },
      sessionId,
      verbose: 0,
    });

    await instance.init();
    stagehand = instance;

    return instance;
  })();

  return initPromise;
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

export const closeStagehandSession = async () => {
  const current = stagehand;

  stagehand = null;
  initPromise = null;

  if (!current) return;

  await current.close();
};

export const runBrowserCommand = async (
  args: BrowserToolArguments,
): Promise<TBrowserResult> => {
  try {
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

      await withTimeout(page.goto(args.url), BROWSER_TIMEOUT_MS, "browser.goto");

      return {
        data: { mode, url: args.url },
        ok: true,
      };
    }

    if (args.url?.trim()) {
      await withTimeout(page.goto(args.url), BROWSER_TIMEOUT_MS, "browser.goto");
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

    if (mode === "agent") {
      const maxSteps = args.maxSteps ?? DEFAULT_AGENT_MAX_STEPS;
      const agent = sh.agent();
      const result = await withTimeout(
        agent.execute({ instruction: args.instruction, maxSteps }),
        AGENT_TIMEOUT_MS,
        "browser.agent",
      );

      return { data: result, ok: true };
    }

    return { error: `browser: unsupported mode ${mode}`, ok: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { error: message, ok: false };
  }
};
