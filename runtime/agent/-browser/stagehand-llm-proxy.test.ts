import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type OpenAI from "openai";

import type { TStagehandProxyCompletionInput } from "../-utils/llm-client";

import { buildBrowserProxyBrief } from "./browser-proxy-brief";
import {
  clearStagehandProxyBrief,
  clearStagehandProxyLlmOverrides,
  clearStagehandProxySessionContext,
  ensureStagehandLlmProxy,
  mergeStagehandProxyMessages,
  setStagehandProxyBrief,
  setStagehandProxyCompletionFnForTests,
  setStagehandProxyLlmOverrides,
  setStagehandProxySessionContext,
  stopStagehandLlmProxy,
} from "./stagehand-llm-proxy";

describe("browser-proxy-brief", () => {
  it("builds a capped brief from mode/url and optional extraBrief", () => {
    const brief = buildBrowserProxyBrief({
      args: {
        instruction: "Click the submit button",
        mode: "act",
        url: "https://example.com/form",
      },
      extraBrief: "Prefer the primary CTA in the main landmark.",
    });

    assert.match(brief, /Stagehand tools only/);
    assert.match(brief, /mode: act/);
    assert.match(brief, /https:\/\/example\.com\/form/);
    assert.match(brief, /primary CTA/);
    assert.doesNotMatch(brief, /origin_resolved|traffic_source|source_ops_md|howto_excerpt/);
    assert.doesNotMatch(brief, /run_bash\(|Prior tool result|Tool calls:/);
    assert.ok(brief.length <= 4_000);
  });

  it("omits extraBrief when not provided", () => {
    const brief = buildBrowserProxyBrief({
      args: {
        instruction: "goto only",
        mode: "goto",
        url: "https://example.com",
      },
    });

    assert.match(brief, /mode: goto/);
    assert.match(brief, /https:\/\/example\.com/);
    assert.equal(brief.includes("\n\n\n"), false);
  });
});

describe("stagehand-llm-proxy", () => {
  after(async () => {
    clearStagehandProxyBrief();
    clearStagehandProxyLlmOverrides();
    clearStagehandProxySessionContext();
    setStagehandProxyCompletionFnForTests(null);
    await stopStagehandLlmProxy();
  });

  it("merges optional brief before Stagehand messages", () => {
    const merged = mergeStagehandProxyMessages(
      "mode: agent\norigin: Alpha",
      [{ content: "Click the matching list option", role: "user" }],
    );

    assert.equal(merged.length, 3);
    assert.equal(merged[0]?.role, "system");
    assert.match(String((merged[0] as { content: string }).content), /Stagehand browser-automation/);
    assert.equal(merged[1]?.role, "system");
    assert.match(String((merged[1] as { content: string }).content), /origin: Alpha/);
    assert.equal(merged[2]?.role, "user");
    assert.match(String((merged[2] as { content: string }).content), /matching list option/);
  });

  it("omits brief message when brief is empty", () => {
    const merged = mergeStagehandProxyMessages("", [
      { content: "observe", role: "user" },
    ]);

    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.role, "user");
  });

  it("listens on 127.0.0.1 and injects brief into nested completion input", async () => {
    process.env.STAGEHAND_LLM_PROXY_PORT = "0";

    let nestedInput: TStagehandProxyCompletionInput | null = null;

    setStagehandProxyCompletionFnForTests(async (input) => {
      nestedInput = input;

      const completion: OpenAI.Chat.Completions.ChatCompletion = {
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            logprobs: null,
            message: {
              content: "ok",
              role: "assistant",
              refusal: null,
            },
          },
        ],
        created: Math.floor(Date.now() / 1000),
        id: "chatcmpl-test",
        model: "deepseek-v4-flash",
        object: "chat.completion",
      };

      return completion;
    });

    const { baseURL, port } = await ensureStagehandLlmProxy();

    assert.match(baseURL, /^http:\/\/127\.0\.0\.1:\d+\/v1$/);
    assert.ok(port > 0);

    setStagehandProxyBrief("mode: agent\norigin: Alpha Site");

    const health = await fetch(`http://127.0.0.1:${port}/health`);

    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      body: JSON.stringify({
        messages: [{ content: "observe available click targets", role: "user" }],
        model: "openai/deepseek-v4-flash",
        tools: [
          {
            function: {
              description: "click",
              name: "click",
              parameters: { type: "object" },
            },
            type: "function",
          },
        ],
        tool_choice: "required",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    assert.equal(res.status, 200);

    const payload = await res.json() as OpenAI.Chat.Completions.ChatCompletion;

    assert.equal(payload.choices[0]?.message?.content, "ok");
    assert.ok(nestedInput);
    assert.equal(nestedInput.tool_choice, "required");
    assert.ok(Array.isArray(nestedInput.tools));
    assert.equal(nestedInput.model, "openai/deepseek-v4-flash");
    assert.ok(
      nestedInput.messages.some(
        (message) =>
          message.role === "system"
          && String((message as { content?: string }).content || "").includes("Alpha Site"),
      ),
    );
    assert.ok(
      nestedInput.messages.some(
        (message) =>
          message.role === "user"
          && String((message as { content?: string }).content || "").includes("observe available click targets"),
      ),
    );
    assert.ok(
      !nestedInput.messages.some(
        (message) =>
          String((message as { content?: string }).content || "").includes("run_bash")
          || String((message as { content?: string }).content || "").includes("Prior tool result"),
      ),
    );
  });

  it("forwards stagehand model override into nested completion input", async () => {
    process.env.STAGEHAND_LLM_PROXY_PORT = "0";

    let nestedInput: TStagehandProxyCompletionInput | null = null;

    setStagehandProxyCompletionFnForTests(async (input) => {
      nestedInput = input;

      return {
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            logprobs: null,
            message: {
              content: "ok",
              role: "assistant",
              refusal: null,
            },
          },
        ],
        created: Math.floor(Date.now() / 1000),
        id: "chatcmpl-override",
        model: "custom-model",
        object: "chat.completion",
      };
    });

    const { port } = await ensureStagehandLlmProxy();

    setStagehandProxyLlmOverrides({
      apiBaseUrl: "https://api.example.com/v1",
      model: "custom-model",
    });

    const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      body: JSON.stringify({
        messages: [{ content: "hi", role: "user" }],
        model: "openai/deepseek-v4-flash",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    assert.equal(res.status, 200);
    assert.ok(nestedInput);
    assert.equal(nestedInput.modelOverride, "custom-model");
    assert.equal(nestedInput.apiBaseUrl, undefined);

    clearStagehandProxyLlmOverrides();
  });

  it("accepts session context without local usage reporter", async () => {
    process.env.STAGEHAND_LLM_PROXY_PORT = "0";

    setStagehandProxyCompletionFnForTests(async () => {
      const completion: OpenAI.Chat.Completions.ChatCompletion = {
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            logprobs: null,
            message: {
              content: "ok",
              role: "assistant",
              refusal: null,
            },
          },
        ],
        created: Math.floor(Date.now() / 1000),
        id: "chatcmpl-usage",
        model: "deepseek-v4-flash",
        object: "chat.completion",
        usage: {
          completion_tokens: 3,
          prompt_tokens: 42,
          total_tokens: 45,
        },
      };

      return completion;
    });

    const { port } = await ensureStagehandLlmProxy();

    setStagehandProxySessionContext({
      requestId: "req-1",
      sessionId: "sess-1",
    });

    const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      body: JSON.stringify({
        messages: [{ content: "act", role: "user" }],
        model: "openai/deepseek-v4-flash",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    assert.equal(res.status, 200);

    const payload = await res.json() as OpenAI.Chat.Completions.ChatCompletion;

    assert.equal(payload.choices[0]?.message?.content, "ok");

    clearStagehandProxySessionContext();
  });
});

describe("chatCompletionForStagehandProxy nesting", () => {
  it("forces thinking disabled and strips openai/ model prefix", async () => {
    const {
      buildStagehandProxyLlmCreateParams,
      resolveNestedModelForStagehandProxy,
    } = await import("../-utils/llm-client/index.ts");

    assert.equal(
      resolveNestedModelForStagehandProxy("openai/deepseek-v4-flash"),
      "deepseek-v4-flash",
    );

    const params = buildStagehandProxyLlmCreateParams({
      messages: [{ content: "hi", role: "user" }],
      model: "openai/deepseek-v4-flash",
      tool_choice: "required",
      tools: [
        {
          function: {
            name: "click",
            parameters: { type: "object" },
          },
          type: "function",
        },
      ],
    });

    assert.deepEqual(params.thinking, { type: "disabled" });
    assert.equal(params.model, "deepseek-v4-flash");
    assert.equal(params.stream, false);
    assert.equal(params.tool_choice, "required");
  });

  it("prefers modelOverride over Stagehand requested model", async () => {
    const {
      buildStagehandProxyLlmCreateParams,
      resolveNestedModelForStagehandProxy,
    } = await import("../-utils/llm-client/index.ts");

    assert.equal(
      resolveNestedModelForStagehandProxy("openai/deepseek-v4-flash", "openai/gpt-4o-mini"),
      "gpt-4o-mini",
    );

    const params = buildStagehandProxyLlmCreateParams({
      messages: [{ content: "hi", role: "user" }],
      model: "openai/deepseek-v4-flash",
      modelOverride: "custom-model",
    });

    assert.equal(params.model, "custom-model");
  });
});
