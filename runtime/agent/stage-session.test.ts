import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runStageSession } from "./stage-session";
import type { ChatApiMessage, ChatAssistantMessage } from "../shared/stage-tools";

const assistant = (content: string | null, toolCalls?: ChatAssistantMessage["tool_calls"]): ChatAssistantMessage => ({
  content,
  response: {} as ChatAssistantMessage["response"],
  role: "assistant",
  tool_calls: toolCalls,
});

describe("runStageSession", () => {
  it("stops after repeated invalid render_a2ui_plan calls", async () => {
    let turns = 0;
    const result = await runStageSession(
      {
        context: { context: {}, stage: {}, types: {} },
        currentStage: "/a2ui(result)",
      },
      [],
      {
        chatWithTools: async () => {
          turns += 1;
          return assistant(null, [
            {
              function: {
                arguments: JSON.stringify({
                  dataRef: { key: "result", scope: "global" },
                  plan: {
                    bindings: { rows: "/raw_intel" },
                    surfaceId: "s1",
                    ui_kind: "table",
                    version: "a2uiPlan.v1",
                  },
                  version: "renderA2uiPlan.v1",
                }),
                name: "render_a2ui_plan",
              },
              id: `tool-${turns}`,
              type: "function",
            },
          ]);
        },
        runCommand: async () => "",
      },
      { maxTurns: 10 },
    );

    assert.equal(result.type, "result");
    assert.match(result.output, /repeated invalid arguments/);
  });

  it("injects translator guidance messages for a2ui stage", async () => {
    let observed: ChatApiMessage[] = [];

    const result = await runStageSession(
      {
        context: {
          context: { result: { brief_markdown: "# brief", raw_intel: [{ title: "t" }] } },
          stage: {},
          types: {},
        },
        currentStage: "/a2ui(result)",
      },
      [],
      {
        chatWithTools: async (messages) => {
          observed = messages;
          return assistant(JSON.stringify({ output: "ok", type: "result" }));
        },
        runCommand: async () => "",
      },
      { maxTurns: 2 },
    );

    assert.equal(result.type, "result");
    const hasTranslatorPrompt = observed.some(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.includes("compact UI-plan translator"),
    );
    assert.equal(hasTranslatorPrompt, true);
  });
});
