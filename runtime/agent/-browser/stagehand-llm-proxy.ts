import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";

import type OpenAI from "openai";

import type { ChatApiMessage } from "@/shared/stage-tools";

import {
  chatCompletionForStagehandProxy,
  type TStagehandProxyCompletionInput,
} from "../-utils/llm-client";
import config from "../config";

const HISTORY_SEPARATOR =
  "--- Stagehand request begins. Follow the Stagehand messages and tools below; use YAHL stage history above only as context. ---";

const CONTEXT_PREAMBLE =
  "You are answering a Stagehand browser-automation LLM request. YAHL stage conversation history appears first for context. Then complete the Stagehand task using only the tools Stagehand provided.";

type TProxyState = {
  history: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  port: number;
  server: Server;
};

type TCompletionFn = (
  input: TStagehandProxyCompletionInput,
) => Promise<OpenAI.Chat.Completions.ChatCompletion>;

let proxyState: TProxyState | null = null;
let startPromise: Promise<TProxyState> | null = null;
let completionFn: TCompletionFn = chatCompletionForStagehandProxy;

export const setStagehandProxyCompletionFnForTests = (fn: TCompletionFn | null) => {
  completionFn = fn ?? chatCompletionForStagehandProxy;
};

export const mergeStagehandProxyMessages = (
  stageHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  stagehandMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => [
  { content: CONTEXT_PREAMBLE, role: "system" },
  ...stageHistory,
  { content: HISTORY_SEPARATOR, role: "system" },
  ...stagehandMessages,
];

export const sanitizeStageHistoryForProxy = (
  messages: ChatApiMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  for (const message of messages) {
    if (message.role === "system" || message.role === "user") {
      const content = typeof message.content === "string" ? message.content : "";

      if (!content.trim()) continue;

      out.push({ content, role: message.role });
      continue;
    }

    if (message.role === "tool") {
      const content = typeof message.content === "string" ? message.content : "";
      const clipped = clipText(content, 4_000);

      out.push({
        content: `Prior tool result (${message.tool_call_id}): ${clipped}`,
        role: "user",
      });
      continue;
    }

    if (message.role === "assistant") {
      const parts: string[] = [];
      const content = typeof message.content === "string" ? message.content.trim() : "";

      if (content) parts.push(content);

      const toolCalls = "tool_calls" in message ? message.tool_calls : undefined;

      if (toolCalls?.length) {
        const calls = toolCalls.map((call) => {
          const args = clipText(call.function.arguments, 800);

          return `${call.function.name}(${args})`;
        });

        parts.push(`Tool calls: ${calls.join("; ")}`);
      }

      const reasoning =
        "reasoning_content" in message && typeof message.reasoning_content === "string"
          ? message.reasoning_content.trim()
          : "";

      if (reasoning) {
        parts.push(`Reasoning: ${clipText(reasoning, 1_200)}`);
      }

      if (!parts.length) continue;

      out.push({ content: parts.join("\n"), role: "assistant" });
    }
  }

  return out;
};

export const setStagehandProxyHistory = (messages: ChatApiMessage[]) => {
  if (!proxyState) return;

  proxyState.history = sanitizeStageHistoryForProxy(messages);
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

const clipText = (value: string, max: number) => {
  if (value.length <= max) return value;

  return `${value.slice(0, max)}…`;
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
    const history = proxyState?.history ?? [];
    const messages = mergeStagehandProxyMessages(history, stagehandMessages);

    if (config.debug) {
      console.log(
        `[stagehand-llm-proxy] chat/completions history=${history.length} stagehand=${stagehandMessages.length} tools=${tools?.length ?? 0}\n`,
      );
    }

    const completion = await completionFn({
      messages,
      model,
      temperature,
      tool_choice,
      tools,
    });

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
        history: [],
        port: address.port,
        server,
      });
    });
  });
