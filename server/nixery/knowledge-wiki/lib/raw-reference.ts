export const rawReferenceToMarkdown = (key: string, value: unknown): string => [
  `# ${key}`,
  '',
  '```json',
  JSON.stringify(value, null, 2),
  '```',
  '',
].join('\n');
