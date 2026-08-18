import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";

import {
  previewFromModelResponse,
  toolCallsFromModelResponse,
} from "./model-response-preview";

const response = (
  overrides: Partial<TResponseStageModelResponseItem>,
): TResponseStageModelResponseItem => ({
  _id: "1",
  contentPreview: "",
  createdAt: "2026-08-19T01:00:00.000Z",
  usage: null,
  ...overrides,
});

describe("previewFromModelResponse", () => {
  it("prefers message content over reasoning", () => {
    const preview = previewFromModelResponse(response({
      response: {
        choices: [{
          message: {
            content: "call nixery",
            reasoning_content: "thinking",
          },
        }],
      },
    }));

    assert.deepEqual(preview, { kind: "content", text: "call nixery" });
  });

  it("falls back to reasoning when content is empty", () => {
    const preview = previewFromModelResponse(response({
      response: {
        choices: [{
          message: {
            content: "",
            reasoning_content: "search the corpus",
          },
        }],
      },
    }));

    assert.deepEqual(preview, { kind: "reasoning", text: "search the corpus" });
  });
});

describe("toolCallsFromModelResponse", () => {
  it("parses nested shell and write_workspace_file calls", () => {
    const tools = toolCallsFromModelResponse(response({
      response: {
        choices: [{
          message: {
            content: "",
            tool_calls: [
              {
                function: {
                  arguments: '{"command":"cat /data/knowledge_export/a.md"}',
                  name: "shell",
                },
                id: "call_shell",
              },
              {
                function: {
                  arguments: '{"path":"lookup-result.json","content":"{}"}',
                  name: "write_workspace_file",
                },
                id: "call_write",
              },
            ],
          },
        }],
      },
    }));

    assert.deepEqual(
      tools.map((tool) => [tool.id, tool.name]),
      [
        ["call_shell", "shell"],
        ["call_write", "write_workspace_file"],
      ],
    );
    assert.equal(
      (tools[0]?.arguments as { command?: string } | null)?.command,
      "cat /data/knowledge_export/a.md",
    );
  });
});
