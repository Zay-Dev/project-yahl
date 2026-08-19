export const parseJsonFenceFromContent = (content: string): unknown | null => {
  const trimmed = content.trim();
  const withoutTitle = trimmed.startsWith('#')
    ? trimmed.replace(/^#[^\n]*\n+/, '').trim()
    : trimmed;
  const match = withoutTitle.match(/^```json\s*([\s\S]*?)```\s*$/);

  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
};
