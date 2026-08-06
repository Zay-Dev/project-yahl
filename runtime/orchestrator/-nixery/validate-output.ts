import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveNixeryOutputHint } from '@project-yahl/shared/nixery/output-contract';

import { loadNixeryDef } from './load-def';
import { isContainerRunning } from './run-container';
import { runNixeryValidationContainer } from './run-validation-container';

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

const readSessionInput = async (sessionDir: string) => {
  try {
    const raw = await fs.readFile(path.join(sessionDir, 'input.json'), 'utf8');

    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const outputFileExists = async (outputPath: string) => {
  try {
    await fs.access(outputPath);

    return true;
  } catch {
    return false;
  }
};

export const clearStaleNixeryOutput = async (params: {
  outputHint?: string;
  sessionDir: string;
  defDefault?: string;
}): Promise<string> => {
  const outputName = params.outputHint?.trim()
    || params.defDefault?.trim()
    || 'result.json';
  const outputPath = path.join(params.sessionDir, outputName);

  try {
    await fs.unlink(outputPath);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

    if (code !== 'ENOENT') {
      throw error;
    }
  }

  return outputName;
};

export const validateNixeryOutputFile = async (params: {
  defId: string;
  input: Record<string, unknown>;
  outputName: string;
  sessionDir: string;
}): Promise<{ ok: boolean; reason?: string }> => {
  const outputPath = path.join(params.sessionDir, params.outputName);

  if (!(await outputFileExists(outputPath))) {
    return { ok: false, reason: 'output file missing' };
  }

  try {
    return await runNixeryValidationContainer({
      defId: params.defId,
      input: params.input,
      outputName: params.outputName,
      sessionDir: params.sessionDir,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return { ok: false, reason };
  }
};

export const waitForNixeryOutput = async (params: {
  containerName: string;
  defId: string;
  outputHint?: string;
  pollMs?: number;
  sessionDir: string;
}): Promise<void> => {
  const def = await loadNixeryDef(params.defId);
  const input = await readSessionInput(params.sessionDir);
  const outputName = params.outputHint?.trim() || resolveNixeryOutputHint(def, input);
  const outputFile = path.join(params.sessionDir, outputName);
  const pollMs = params.pollMs ?? 2000;
  let lastReason = 'output validation failed';

  while (true) {
    const result = await validateNixeryOutputFile({
      defId: params.defId,
      input,
      outputName,
      sessionDir: params.sessionDir,
    });

    if (result.ok) {
      return;
    }

    if (result.reason) {
      lastReason = result.reason;
    }

    const running = await isContainerRunning(params.containerName);

    if (!running) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const retry = await validateNixeryOutputFile({
          defId: params.defId,
          input,
          outputName,
          sessionDir: params.sessionDir,
        });

        if (retry.ok) {
          return;
        }

        if (retry.reason) {
          lastReason = retry.reason;
        }

        await sleep(500);
      }

      throw new Error(
        `[nixery] container exited but output invalid: ${outputFile} (${lastReason})`,
      );
    }

    await sleep(pollMs);
  }
};
