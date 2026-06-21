import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveModelResponseTags } from "./model-response-tags.ts";
import { parseBrowserToolArguments } from "./stage-tools.ts";

describe("parseBrowserToolArguments", () => {
  it("parses agent mode with instruction", () => {
    const result = parseBrowserToolArguments(JSON.stringify({
      instruction: "Search for baby bottles",
      mode: "agent",
      maxSteps: 10,
    }));

    assert.deepEqual(result, {
      instruction: "Search for baby bottles",
      maxSteps: 10,
      mode: "agent",
    });
  });

  it("requires url for goto mode", () => {
    assert.equal(parseBrowserToolArguments(JSON.stringify({
      instruction: "navigate",
      mode: "goto",
    })), null);
  });

  it("parses goto with url", () => {
    const result = parseBrowserToolArguments(JSON.stringify({
      instruction: "navigate",
      mode: "goto",
      url: "https://example.com",
    }));

    assert.deepEqual(result, {
      instruction: "navigate",
      mode: "goto",
      url: "https://example.com",
    });
  });

  it("parses extract with schema", () => {
    const result = parseBrowserToolArguments(JSON.stringify({
      instruction: "Extract titles",
      mode: "extract",
      schema: { type: "object" },
    }));

    assert.equal(result?.mode, "extract");
    assert.deepEqual(result?.schema, { type: "object" });
  });
});

describe("deriveModelResponseTags", () => {
  it("returns chat for content-only replies", () => {
    assert.deepEqual(
      deriveModelResponseTags({ content: "done", tool_calls: [] }),
      ["chat"],
    );
  });

  it("returns browse for browser tool calls", () => {
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [{ function: { name: "browser" } }],
      }),
      ["browse"],
    );
  });

  it("returns multiple tags without collapsing", () => {
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [
          { function: { name: "browser" } },
          { function: { name: "set_context" } },
        ],
      }),
      ["browse", "tool"],
    );
  });

  it("returns unknown for empty content and no tools", () => {
    assert.deepEqual(deriveModelResponseTags({ content: "", tool_calls: [] }), ["unknown"]);
  });

  it("returns tool and mastermind skill tag for mastermind calls", () => {
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [{
          function: {
            arguments: JSON.stringify({ args: { topic: 'x' }, skill: 'research' }),
            name: 'mastermind',
          },
        }],
      }),
      ["tool", "mastermind:research"],
    );
  });
});
