import fs from 'node:fs/promises';

import YAML from 'yaml';

import { validateNixeryDef } from './validate-def';

import type { TNixeryDef } from './types';

export const loadNixeryDefFromFile = async (filePath: string): Promise<TNixeryDef> => {
  const raw = YAML.parse(await fs.readFile(filePath, 'utf8'));

  return validateNixeryDef(raw);
};

export const loadNixeryDefFromText = (text: string): TNixeryDef =>
  validateNixeryDef(YAML.parse(text));
