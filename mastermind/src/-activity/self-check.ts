import fs from 'fs/promises';

import { paths } from '../config.js';

export type TSelfCheckResult = {
  checks: {
    dataDirs: 'failed' | 'ok';
  };
  error?: string;
  ok: boolean;
};

const dataDirPaths = [
  paths.crashReports,
  paths.docs,
  paths.knowledges,
  paths.rules,
  paths.store,
];

export const checkDataDirsWritable = async (): Promise<'failed' | 'ok'> => {
  try {
    await Promise.all(
      dataDirPaths.map(async (dirPath) => {
        await fs.access(dirPath, fs.constants.W_OK);
      }),
    );

    return 'ok';
  } catch {
    return 'failed';
  }
};

export const runSelfCheck = async (): Promise<TSelfCheckResult> => {
  const dataDirs = await checkDataDirsWritable();

  if (dataDirs === 'failed') {
    return {
      checks: { dataDirs },
      error: 'data directories not writable',
      ok: false,
    };
  }

  return {
    checks: { dataDirs },
    ok: true,
  };
};

export const assertBootReady = async (): Promise<void> => {
  const result = await runSelfCheck();

  if (result.ok) {
    return;
  }

  console.error('[mastermind] startup self-check failed', JSON.stringify(result));
  throw new Error(result.error ?? 'startup self-check failed');
};
