const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isAssignmentAt = (text: string, tokenEnd: number) => {
  const remainder = text.slice(tokenEnd);
  const match = remainder.match(/^\s*=/);

  return !!match;
};

const hasReadUsage = (stageText: string, key: string) => {
  const escaped = escapeRegExp(key);
  const matcher = new RegExp(`\\b${escaped}\\b`, "g");
  const matches = stageText.matchAll(matcher);

  for (const match of matches) {
    if (typeof match.index !== "number") continue;

    const tokenEnd = match.index + match[0].length;
    if (isAssignmentAt(stageText, tokenEnd)) continue;

    return true;
  }

  return false;
};

export const filterContextByReadUsage = (
  stageText: string,
  records: Record<string, unknown>,
) =>
  Object.keys(records)
    .filter((key) => hasReadUsage(stageText, key))
    .reduce((acc, key) => {
      acc[key] = records[key];
      return acc;
    }, {} as Record<string, unknown>);
