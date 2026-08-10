import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveModelResponseTags } from "./model-response-tags.ts";
import { parseBrowserToolArguments } from "./stage-tools.ts";

describe("parseBrowserToolArguments", () => {
  it("rejects agent mode", () => {
    assert.equal(parseBrowserToolArguments(JSON.stringify({
      instruction: "Search for baby bottles",
      mode: "agent",
      maxSteps: 10,
    })), null);
  });

  it("parses act mode without url", () => {
    const result = parseBrowserToolArguments(JSON.stringify({
      instruction: "Click the submit button",
      mode: "act",
    }));

    assert.deepEqual(result, {
      instruction: "Click the submit button",
      mode: "act",
    });
  });

  it("rejects url on act extract and observe", () => {
    for (const mode of ["act", "extract", "observe"] as const) {
      assert.equal(parseBrowserToolArguments(JSON.stringify({
        instruction: "do something",
        mode,
        url: "https://example.com",
      })), null);
    }
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

  it("returns tool and platform skill tag for platform calls", () => {
    assert.deepEqual(
      deriveModelResponseTags({
        content: null,
        tool_calls: [{
          function: {
            arguments: JSON.stringify({ args: { taskId: 'x' }, skill: 'dispatch-task-run' }),
            name: 'platform',
          },
        }],
      }),
      ["tool", "platform:dispatch-task-run"],
    );
  });
});
