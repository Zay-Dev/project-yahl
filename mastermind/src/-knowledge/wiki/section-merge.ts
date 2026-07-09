const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const mergeWikiSection = (
  existingContent: string,
  sectionTitle: string,
  sectionBody: string,
): string => {
  const heading = `## ${sectionTitle}`;
  const trimmedBody = sectionBody.trim();
  const sectionBlock = `${heading}\n\n${trimmedBody}`.trim();
  const content = existingContent.trim();

  if (!content) {
    return `${sectionBlock}\n`;
  }

  const sectionPattern = new RegExp(
    `^${escapeRegExp(heading)}\\s*\\n[\\s\\S]*?(?=^## |\\z)`,
    'm',
  );
  const match = content.match(sectionPattern);

  if (match) {
    return `${content.replace(sectionPattern, sectionBlock).trim()}\n`;
  }

  return `${content}\n\n${sectionBlock}\n`;
};

export const parseWikiPageRef = (
  pageRef: string,
): { page: string; section?: string } => {
  const hashIndex = pageRef.indexOf('#');

  if (hashIndex === -1) {
    return { page: pageRef };
  }

  return {
    page: pageRef.slice(0, hashIndex),
    section: pageRef.slice(hashIndex + 1),
  };
};

export const isJsonFenceOnlyContent = (content: string): boolean => {
  const trimmed = content.trim();

  if (!trimmed.startsWith('#')) {
    return /^```json\s*[\s\S]*```\s*$/.test(trimmed);
  }

  const withoutTitle = trimmed.replace(/^#[^\n]*\n+/, '').trim();

  return /^```json\s*[\s\S]*```\s*$/.test(withoutTitle);
};
