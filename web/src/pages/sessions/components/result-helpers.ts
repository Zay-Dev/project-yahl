export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const looksLikeMarkdown = (value: string) => {
  return /^#{1,6}\s|^\*\*|^-\s|\n#{1,6}\s|\n\*\*/m.test(value);
};

export const pickMarkdownField = (record: Record<string, unknown>) => {
  const keys = ["executive_summary_md", "brief_markdown", "body_md", "summary_md"];

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return { body: value, key };
    }
  }

  return null;
};

export const pickTitle = (record: Record<string, unknown>) => {
  const title = record.title;

  return typeof title === "string" ? title : undefined;
};
