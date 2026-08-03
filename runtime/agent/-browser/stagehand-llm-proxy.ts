import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";

import type OpenAI from "openai";

import type { TModelResponse } from "@/shared/transports/-types";

import {
  chatCompletionForStagehandProxy,
  type TStagehandProxyCompletionInput,
} from "../-utils/llm-client";
import config from "../config";

const CONTEXT_PREAMBLE =
  "You are answering a Stagehand browser-automation LLM request. A short YAHL browse brief may appear first. Complete the Stagehand task using only the tools Stagehand provided — do not invent bash, mastermind, set_context, or nixery.";

type TProxyState = {
  brief: string | null;
  port: number;
  server: Server;
};

type TCompletionFn = (
  input: TStagehandProxyCompletionInput,
) => Promise<OpenAI.Chat.Completions.ChatCompletion>;

export type TStagehandProxyReporter = {
  onModelResponse: (response: TModelResponse) => Promise<void>;
};

let proxyState: TProxyState | null = null;
let startPromise: Promise<TProxyState> | null = null;
let completionFn: TCompletionFn = chatCompletionForStagehandProxy;
let proxyReporter: TStagehandProxyReporter | null = null;

export const setStagehandProxyCompletionFnForTests = (fn: TCompletionFn | null) => {
  completionFn = fn ?? chatCompletionForStagehandProxy;
};

export const setStagehandProxyReporter = (reporter: TStagehandProxyReporter | null) => {
  proxyReporter = reporter;
};

export const clearStagehandProxyReporter = () => {
  proxyReporter = null;
};

export const mergeStagehandProxyMessages = (
  brief: string | null | undefined,
  stagehandMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { content: CONTEXT_PREAMBLE, role: "system" },
  ];
  const trimmed = typeof brief === "string" ? brief.trim() : "";

  if (trimmed) {
    messages.push({ content: trimmed, role: "system" });
  }

  messages.push(...stagehandMessages);

  return messages;
};

export const setStagehandProxyBrief = (brief: string | null | undefined) => {
  if (!proxyState) return;

  const trimmed = typeof brief === "string" ? brief.trim() : "";

  proxyState.brief = trimmed || null;
};

export const clearStagehandProxyBrief = () => {
  if (!proxyState) return;

  proxyState.brief = null;
};

export const getStagehandProxyBaseUrl = () => {
  if (!proxyState) {
    throw new Error("stagehand llm proxy is not running");
  }

  return `http://127.0.0.1:${proxyState.port}/v1`;
};

export const ensureStagehandLlmProxy = async (): Promise<{ baseURL: string; port: number }> => {
  if (proxyState) {
    return { baseURL: getStagehandProxyBaseUrl(), port: proxyState.port };
  }

  if (startPromise) {
    const state = await startPromise;

    return { baseURL: `http://127.0.0.1:${state.port}/v1`, port: state.port };
  }

  startPromise = startProxyServer();

  try {
    proxyState = await startPromise;

    return { baseURL: getStagehandProxyBaseUrl(), port: proxyState.port };
  } finally {
    startPromise = null;
  }
};

export const stopStagehandLlmProxy = async () => {
  const current = proxyState;

  proxyState = null;
  startPromise = null;

  if (!current) return;

  await new Promise<void>((resolve) => {
    current.server.close(() => resolve());
  });
};

const readJsonBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw.trim()) return {};

  return JSON.parse(raw) as Record<string, unknown>;
};

const writeJson = (res: ServerResponse, status: number, body: unknown) => {
  const payload = JSON.stringify(body);

  res.writeHead(status, {
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json",
  });
  res.end(payload);
};

const handleChatCompletions = async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const body = await readJsonBody(req);
    const stagehandMessages = Array.isArray(body.messages)
      ? (body.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[])
      : [];
    const tools = Array.isArray(body.tools)
      ? (body.tools as OpenAI.Chat.Completions.ChatCompletionTool[])
      : undefined;
    const tool_choice = body.tool_choice as
      | OpenAI.Chat.Completions.ChatCompletionToolChoiceOption
      | undefined;
    const temperature = typeof body.temperature === "number" ? body.temperature : undefined;
    const model = typeof body.model === "string" ? body.model : undefined;
    const brief = proxyState?.brief ?? null;
    const messages = mergeStagehandProxyMessages(brief, stagehandMessages);

    if (config.debug) {
      console.log(
        `[stagehand-llm-proxy] chat/completions briefChars=${brief?.length ?? 0} stagehand=${stagehandMessages.length} tools=${tools?.length ?? 0}\n`,
      );
    }

    const startedAt = Date.now();
    const completion = await completionFn({
      messages,
      model,
      temperature,
      tool_choice,
      tools,
    });
    const durationMs = Date.now() - startedAt;

    if (proxyReporter) {
      try {
        await proxyReporter.onModelResponse({
          ...completion,
          durationMs,
          tags: ["stagehand"],
          thinkingMode: false,
        });
      } catch (reportError) {
        const reportMessage =
          reportError instanceof Error ? reportError.message : String(reportError);

        console.error(`[stagehand-llm-proxy] onModelResponse failed: ${reportMessage}\n`);
      }
    }

    writeJson(res, 200, completion);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[stagehand-llm-proxy] error: ${message}\n`);
    writeJson(res, 500, {
      error: {
        message,
        type: "stagehand_llm_proxy_error",
      },
    });
  }
};

const startProxyServer = async (): Promise<TProxyState> =>
  new Promise((resolve, reject) => {
    const preferredPort = Number(process.env.STAGEHAND_LLM_PROXY_PORT?.trim() || "0") || 0;
    const server = createServer((req, res) => {
      const url = req.url || "/";
      const path = url.split("?")[0];

      if (req.method === "GET" && (path === "/health" || path === "/v1/health")) {
        writeJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && (path === "/v1/chat/completions" || path === "/chat/completions")) {
        void handleChatCompletions(req, res);
        return;
      }

      writeJson(res, 404, { error: { message: `not found: ${req.method} ${path}` } });
    });

    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("stagehand llm proxy failed to bind"));
        return;
      }

      console.log(`[stagehand-llm-proxy] listening on 127.0.0.1:${address.port}\n`);
      resolve({
        brief: null,
        port: address.port,
        server,
      });
    });
  });
