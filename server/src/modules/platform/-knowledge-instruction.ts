import fs from 'fs/promises';
import path from 'path';

import config from '@/config';

const instructionFileName = 'knowledge-manager-instruction.md';

export const resolveKnowledgeManagerInstructionPath = (): string =>
  path.join(config.knowledgeDataRoot, instructionFileName);

export const readKnowledgeManagerInstructionText = async (): Promise<string> => {
  const filePath = resolveKnowledgeManagerInstructionPath();

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
};

export const writeKnowledgeManagerInstructionText = async (text: string): Promise<string> => {
  const filePath = resolveKnowledgeManagerInstructionPath();

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${String(text ?? '').trim()}\n`, 'utf8');

  return filePath;
};

export const assertPlatformApprovalToken = (headerValue: string | string[] | undefined): void => {
  const expected = process.env.PLATFORM_APPROVAL_TOKEN?.trim() ?? '';
  const provided = typeof headerValue === 'string' ? headerValue.trim() : '';

  if (!expected || provided !== expected) {
    throw errors.custom('invalid approval token', 401);
  }
};
