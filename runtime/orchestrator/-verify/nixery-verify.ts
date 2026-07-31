import fs from 'node:fs/promises';
import path from 'node:path';

import type { TVerifyResponse } from '@project-yahl/shared/verify/types';

import { runNixeryDef, resolveSessionNixeryDir } from '@/orchestrator/-nixery';

const readVerifyResult = async (
  sessionId: string,
  defId: string,
): Promise<TVerifyResponse> => {
  const resultPath = path.join(resolveSessionNixeryDir(sessionId, defId), 'result.json');
  const raw = await fs.readFile(resultPath, 'utf8');
  const parsed = JSON.parse(raw) as TVerifyResponse;

  if (typeof parsed.pass !== 'boolean' || typeof parsed.score !== 'number') {
    throw new Error(`invalid verify result at ${resultPath}`);
  }

  return {
    feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
    pass: parsed.pass,
    score: parsed.score,
    ...(typeof parsed.askUserRef === 'string' ? { askUserRef: parsed.askUserRef } : {}),
    ...(Array.isArray(parsed.failedChecks) && parsed.failedChecks.length > 0
      ? { failedChecks: parsed.failedChecks }
      : {}),
    ...(parsed.resumeAction ? { resumeAction: parsed.resumeAction } : {}),
    ...(parsed.unavailable === true ? { unavailable: true } : {}),
  };
};

export const runNixeryVerifyImpl = async (params: {
  defId: string;
  input: Record<string, unknown>;
  sessionId: string;
}): Promise<TVerifyResponse> => {
  try {
    await runNixeryDef({
      defId: params.defId,
      input: params.input,
      sessionId: params.sessionId,
    });

    return await readVerifyResult(params.sessionId, params.defId);
  } catch (error) {
    const feedback = error instanceof Error ? error.message : String(error);

    try {
      const existing = await readVerifyResult(params.sessionId, params.defId);

      if (existing.unavailable) {
        return existing;
      }
    } catch {
      // no readable result
    }

    return {
      feedback,
      pass: false,
      score: 0,
      unavailable: true,
    };
  }
};

export const nixeryVerifyApi = {
  run: runNixeryVerifyImpl,
};
