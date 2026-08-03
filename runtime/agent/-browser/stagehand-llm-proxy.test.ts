import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type OpenAI from "openai";

import type { TStagehandProxyCompletionInput } from "../-utils/llm-client";

import {
  ensureStagehandLlmProxy,
  mergeStagehandProxyMessages,
  sanitizeStageHistoryForProxy,
  setStagehandProxyCompletionFnForTests,
  setStagehandProxyHistory,
  stopStagehandLlmProxy,
} from "./stagehand-llm-proxy";

describe("stagehand-llm-proxy", () => {
  after(async () => {
    setStagehandProxyCompletionFnForTests(null);
    await stopStagehandLlmProxy();
  });

  it("sanitizes stage history tool turns into plain context messages", () => {
    const sanitized = sanitizeStageHistoryForProxy([
      { content: "You are the stage agent.", role: "system" },
      { content: "Use stage context notes when choosing the next browser step.", role: "user" },
      {
        content: null,
        role: "assistant",
        tool_calls: [
          {
            function: {
              arguments: JSON.stringify({ mode: "goto", url: "https://example.com" }),
              name: "browser",
            },
            id: "call_1",
            type: "function",
          },
        ],
      },
      {
        content: JSON.stringify({ ok: true, data: { mode: "goto" } }),
        role: "tool",
        tool_call_id: "call_1",
      },
    ]);

    assert.equal(sanitized[0]?.role, "system");
    assert.equal(sanitized[1]?.role, "user");
    assert.match(String((sanitized[2] as { content: string }).content), /browser\(/);
    assert.equal(sanitized[3]?.role, "user");
    assert.match(String((sanitized[3] as { content: string }).content), /Prior tool result/);
  });

  it("merges stage history before Stagehand messages with separators", () => {
    const merged = mergeStagehandProxyMessages(
      [{ content: "stage context note: prefer the listed option", role: "user" }],
      [{ content: "Click the matching list option", role: "user" }],
    );

    assert.equal(merged.length, 4);
    assert.equal(merged[0]?.role, "system");
    assert.match(String((merged[0] as { content: string }).content), /Stagehand browser-automation/);
    assert.equal(merged[1]?.role, "user");
    assert.match(String((merged[1] as { content: string }).content), /stage context note/);
    assert.equal(merged[2]?.role, "system");
    assert.match(String((merged[2] as { content: string }).content), /Stagehand request begins/);
    assert.equal(merged[3]?.role, "user");
    assert.match(String((merged[3] as { content: string }).content), /matching list option/);
  });

  it("listens on 127.0.0.1 and merges history into nested completion input", async () => {
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

    setStagehandProxyHistory([
      { content: "Prior stage context: target label Alpha Site", role: "user" },
    ]);

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
          message.role === "user"
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
});
