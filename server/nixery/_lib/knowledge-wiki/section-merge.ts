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
    `^${escapeRegExp(heading)}\\s*\\n[\\s\\S]*?(?=^## |$)`,
    'm',
  );
  const match = content.match(sectionPattern);

  if (match) {
    return `${content.replace(sectionPattern, sectionBlock).trim()}\n`;
  }

  return `${content}\n\n${sectionBlock}\n`;
};

const collapseLegacyKeyFactsBlocks = (content: string): string => {
  const blocks = content.split(/(?=^# [^\n]+\n)/m).filter((block) => block.trim());

  if (blocks.length <= 1) {
    return content;
  }

  const keyFactsBlocks = blocks.filter((block) => /^# .*(Key Facts|key facts)/m.test(block));

  if (keyFactsBlocks.length <= 1) {
    return content;
  }

  const keep = keyFactsBlocks[keyFactsBlocks.length - 1];
  const withoutDupes = blocks.filter((block) => !/^# .*(Key Facts|key facts)/m.test(block));

  return [...withoutDupes, keep].join('\n\n').trim();
};

export const collapseDuplicateWikiSections = (
  existingContent: string,
  sectionTitle?: string,
): string => {
  let content = collapseLegacyKeyFactsBlocks(existingContent.trim());

  if (!sectionTitle) {
    return content;
  }

  const heading = `## ${sectionTitle}`;
  const sectionPattern = new RegExp(
    `^${escapeRegExp(heading)}\\s*\\n[\\s\\S]*?(?=^## |$)`,
    'gm',
  );
  const matches = [...content.matchAll(sectionPattern)];

  if (matches.length <= 1) {
    return content;
  }

  const last = matches[matches.length - 1][0];

  return content.replace(sectionPattern, '').trim()
    ? `${content.replace(sectionPattern, '').trim()}\n\n${last.trim()}`.trim()
    : last.trim();
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
