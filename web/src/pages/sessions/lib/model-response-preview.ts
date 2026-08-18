import type { TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";

import { parseToolSummaries } from "@/pages/sessions/lib/tool-call-parse";

type TChoiceMessage = {
  content?: unknown;
  reasoning_content?: unknown;
  tool_calls?: unknown;
};

export type TModelResponsePreview = {
  kind: "content" | "empty" | "reasoning";
  text: string;
};

const messageFromResponse = (response: TResponseStageModelResponseItem) => {
  const raw = response.response as
    | { choices?: Array<{ message?: TChoiceMessage }> }
    | undefined;

  return raw?.choices?.[0]?.message;
};

const textFromUnknown = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined || value === null) {
    return "";
  }

  return JSON.stringify(value);
};

export const previewFromModelResponse = (
  response: TResponseStageModelResponseItem,
): TModelResponsePreview => {
  const message = messageFromResponse(response);
  const content = textFromUnknown(message?.content).trim();

  if (content) {
    return { kind: "content", text: content };
  }

  const reasoning = textFromUnknown(message?.reasoning_content).trim();

  if (reasoning) {
    return { kind: "reasoning", text: reasoning };
  }

  const fallback = response.contentPreview.trim();

  if (fallback) {
    return { kind: "content", text: fallback };
  }

  return { kind: "empty", text: "" };
};

export const toolCallsFromModelResponse = (
  response: TResponseStageModelResponseItem,
) => {
  const toolCalls = messageFromResponse(response)?.tool_calls;

  if (!Array.isArray(toolCalls)) {
    return [];
  }

  return parseToolSummaries(toolCalls);
};
