import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ChatAssistantMessage } from "@/shared/stage-tools";

import { parseStageSessionInput, runStageSession } from "./stage-session";

const assistant = (content: string | null, toolCalls?: ChatAssistantMessage["tool_calls"]): ChatAssistantMessage => ({
  content,
  response: {} as ChatAssistantMessage["response"],
  role: "assistant",
  tool_calls: toolCalls,
});

const emptyContext = () => ({
  context: new Map<string, unknown>(),
  types: new Map<string, unknown>(),
});

describe("runStageSession", () => {
  it("forwards temperature to chatWithTools when set", async () => {
    let received: { temperature?: number } | undefined;

    await runStageSession(
      {
        context: emptyContext(),
        stage: { logic: "noop" },
        temperature: 0.25,
      },
      [],
      {
        chatWithTools: async (_messages, opts) => {
          received = opts;
          return [assistant(JSON.stringify({ output: "ok", type: "result" }))];
        },
        runCommand: async () => "",
      },
      { maxTurns: 2 },
    );

    assert.deepEqual(received, { temperature: 0.25 });
  });

  it("parseStageSessionInput preserves numeric temperature", () => {
    const json = JSON.stringify({
      context: { context: {} },
      stage: { logic: "x" },
      temperature: 0.7,
    });
    const parsed = parseStageSessionInput(json);

    assert.equal(parsed?.temperature, 0.7);
    assert.equal(parsed?.stage.logic, "x");
  });

  it("returns result envelope when assistant responds without tool calls", async () => {
    const envelope = await runStageSession(
      {
        context: emptyContext(),
        stage: { logic: "noop" },
      },
      [],
      {
        chatWithTools: async () => [assistant(JSON.stringify({ output: "done", type: "result" }))],
        runCommand: async () => "",
      },
      { maxTurns: 2 },
    );

    assert.equal(envelope.type, "result");
    assert.match(envelope.output, /done/);
  });

  it("continues after orchestrator-handled nixery tool message is present", async () => {
    let turn = 0;
    const nixeryPayload = JSON.stringify({ data: { ok: true }, ok: true });
    const nixeryToolCall = {
      function: {
        arguments: JSON.stringify({ args: { topic: 'hk-weather' }, defId: 'upsert-knowledge-page' }),
        name: 'nixery',
      },
      id: 'tool-nixery-1',
      type: 'function' as const,
    };

    const envelope = await runStageSession(
      {
        context: emptyContext(),
        stage: { logic: 'persist region' },
      },
      [],
      {
        chatWithTools: async (messages) => {
          turn += 1;

          if (turn === 1) {
            return [
              assistant(null, [nixeryToolCall]),
              {
                content: nixeryPayload,
                role: 'tool',
                tool_call_id: 'tool-nixery-1',
              },
            ];
          }

          const last = messages.at(-1);
          assert.equal(last?.role, 'tool');
          assert.equal((last as { tool_call_id: string }).tool_call_id, 'tool-nixery-1');

          return [assistant(JSON.stringify({ output: 'saved', type: 'result' }))];
        },
        runCommand: async () => '',
      },
      { maxTurns: 3 },
    );

    assert.equal(turn, 2);
    assert.equal(envelope.type, 'result');
    assert.match(envelope.output, /saved/);
  });

  it("returns a failure envelope when chatWithTools hits context length", async () => {
    const envelope = await runStageSession(
      {
        context: emptyContext(),
        stage: { logic: "noop" },
      },
      [],
      {
        chatWithTools: async () => {
          throw new Error(
            "This model's maximum context length is 1048576 tokens. However, you requested 1257163 tokens",
          );
        },
        runCommand: async () => "",
      },
      { maxTurns: 2 },
    );

    assert.equal(envelope.type, "result");
    assert.match(envelope.output, /context length exceeded/);
  });

  it('places the warmup note and prefix before Input', async () => {
    let firstMessages: { role: string; content?: string | null }[] | undefined;
    const prefix = [assistant('warmup already did binds')];

    await runStageSession(
      {
        context: emptyContext(),
        stage: { logic: 'poll' },
      },
      [{ content: 'system', role: 'system' }],
      {
        chatWithTools: async (messages) => {
          firstMessages = messages.map((message) => ({
            content: 'content' in message ? message.content : null,
            role: message.role,
          }));
          return [assistant(JSON.stringify({ output: 'ok', type: 'result' }))];
        },
        runCommand: async () => '',
      },
      {
        maxTurns: 2,
        prefixMessages: prefix,
      },
    );

    assert.equal(firstMessages?.[0]?.role, 'system');
    assert.equal(firstMessages?.[1]?.role, 'user');
    assert.match(String(firstMessages?.[1]?.content ?? ''), /Warm-up already ran/);
    assert.equal(firstMessages?.[2]?.role, 'assistant');
    assert.equal(firstMessages?.[3]?.role, 'user');
    assert.match(String(firstMessages?.[3]?.content ?? ''), /Input:/);
  });

  it('does not add the warmup note for a user-only prefix', async () => {
    let firstMessages: { role: string }[] | undefined;

    await runStageSession(
      {
        context: emptyContext(),
        stage: { logic: 'poll' },
      },
      [{ content: 'system', role: 'system' }],
      {
        chatWithTools: async (messages) => {
          firstMessages = messages.map((message) => ({ role: message.role }));
          return [assistant(JSON.stringify({ output: 'ok', type: 'result' }))];
        },
        runCommand: async () => '',
      },
      {
        maxTurns: 2,
        prefixMessages: [{
          content: 'user-only prefix',
          role: 'user',
        }],
      },
    );

    assert.deepEqual(firstMessages?.map((message) => message.role), ['system', 'user', 'user']);
  });
});
