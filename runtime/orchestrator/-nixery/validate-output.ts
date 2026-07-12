import fs from 'node:fs/promises';
import path from 'node:path';

import { isContainerRunning } from './run-container';

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

const hasPresentPayload = (envelope: Record<string, unknown>): boolean => {
  if ('extracted' in envelope) {
    return typeof envelope.extracted === 'object' && envelope.extracted !== null;
  }

  const payloadKeys = Object.keys(envelope).filter(
    (key) => key !== 'absent' && key !== 'extractedAt',
  );

  return payloadKeys.length > 0;
};

export const isValidNixeryEnvelope = (parsed: unknown): boolean => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false;
  }

  const envelope = parsed as Record<string, unknown>;

  if (typeof envelope.absent !== 'boolean') {
    return false;
  }

  if (envelope.absent) {
    return typeof envelope.absentReason === 'string' && envelope.absentReason.trim().length > 0;
  }

  return hasPresentPayload(envelope);
};

export const validateNixeryOutputFile = async (filePath: string): Promise<boolean> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');

    if (raw.length < 10) {
      return false;
    }

    const parsed = JSON.parse(raw) as unknown;

    return isValidNixeryEnvelope(parsed);
  } catch {
    return false;
  }
};

export const waitForNixeryOutput = async (params: {
  containerName: string;
  outputHint?: string;
  pollMs?: number;
  sessionDir: string;
}): Promise<void> => {
  const outputFile = params.outputHint?.trim()
    ? path.join(params.sessionDir, params.outputHint.trim())
    : null;
  const pollMs = params.pollMs ?? 2000;

  while (true) {
    if (outputFile && await validateNixeryOutputFile(outputFile)) {
      return;
    }

    const running = await isContainerRunning(params.containerName);

    if (!running) {
      if (!outputFile) {
        return;
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (await validateNixeryOutputFile(outputFile)) {
          return;
        }

        await sleep(500);
      }

      throw new Error(`[nixery] container exited but output invalid: ${outputFile}`);
    }

    await sleep(pollMs);
  }
};
