export const STUB_TOOL_RESULT_JSON = JSON.stringify({ ok: true });

export const isStubToolResultContent = (content: string) => {
  const trimmed = content.trim();

  if (!trimmed) {
    return true;
  }

  if (trimmed === 'OK') {
    return true;
  }

  if (trimmed === STUB_TOOL_RESULT_JSON) {
    return true;
  }

  return false;
};
