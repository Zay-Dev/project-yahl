import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseStageSessionInput, runStageSession } from "./stage-session";
import type { ChatAssistantMessage } from "@/shared/stage-tools";

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
});
