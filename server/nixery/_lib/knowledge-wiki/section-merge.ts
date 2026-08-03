const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sectionBlockPattern = (heading: string, flags = ''): RegExp =>
  // Do not use /m with $ — $ would match end-of-line and truncate multi-line bodies.
  new RegExp(
    `(^|\\n)${escapeRegExp(heading)}\\r?\\n[\\s\\S]*?(?=\\n## |$)`,
    flags,
  );

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

  const sectionPattern = sectionBlockPattern(heading);
  const match = content.match(sectionPattern);

  if (match) {
    const lead = match[1] ?? '';
    const replaced = content.replace(sectionPattern, `${lead}${sectionBlock}`);

    return `${replaced.trim()}\n`;
  }

  return `${content}\n\n${sectionBlock}\n`;
};

export const appendWikiSection = (
  existingContent: string,
  sectionTitle: string,
  sectionBody: string,
): string => {
  const heading = `## ${sectionTitle}`;
  const trimmedBody = sectionBody.trim();
  const content = existingContent.trim();

  if (!trimmedBody) {
    return content ? `${content}\n` : '';
  }

  if (!content) {
    return `${heading}\n\n${trimmedBody}\n`;
  }

  const sectionPattern = sectionBlockPattern(heading);
  const match = content.match(sectionPattern);

  if (!match) {
    return `${content}\n\n${heading}\n\n${trimmedBody}\n`;
  }

  const matchedBlock = match[0];
  const lead = match[1] ?? '';
  const existingBlock = matchedBlock.startsWith('\n')
    ? matchedBlock.slice(1)
    : matchedBlock;
  const existingBody = existingBlock
    .replace(new RegExp(`^${escapeRegExp(heading)}\\r?\\n?`), '')
    .trim();
  const nextBody = existingBody
    ? `${existingBody}\n\n${trimmedBody}`
    : trimmedBody;
  const sectionBlock = `${heading}\n\n${nextBody}`.trim();
  const replaced = content.replace(sectionPattern, `${lead}${sectionBlock}`);

  return `${replaced.trim()}\n`;
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
  const sectionPattern = sectionBlockPattern(heading, 'g');
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
