export const BROWSER_TOOL_CONTENT_MAX_CHARS = 32_000;

export const clipToolContent = (
  content: string,
  maxChars = BROWSER_TOOL_CONTENT_MAX_CHARS,
): string => {
  if (content.length <= maxChars) {
    return content;
  }

  const previewBudget = Math.max(0, maxChars - 160);
  const preview = content.slice(0, previewBudget);

  return JSON.stringify({
    error: `tool result truncated (${content.length} chars > ${maxChars})`,
    ok: false,
    truncatedPreview: preview,
  });
};
