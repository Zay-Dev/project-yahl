import fs from 'node:fs/promises';
import path from 'node:path';

import { paths } from '../config.js';

const instructionFileName = 'knowledge-manager-instruction.md';

export const resolveKnowledgeManagerInstructionPath = (): string =>
  path.join(path.dirname(paths.topicsRegistry), instructionFileName);

export const readKnowledgeManagerInstruction = async (): Promise<string> => {
  const filePath = resolveKnowledgeManagerInstructionPath();

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
};

export const writeKnowledgeManagerInstruction = async (text: string): Promise<string> => {
  const filePath = resolveKnowledgeManagerInstructionPath();

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${String(text ?? '').trim()}\n`, 'utf8');

  return filePath;
};
