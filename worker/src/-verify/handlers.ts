import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import type { TVerifyRequest, TVerifyResponse } from '@project-yahl/shared/verify/types';

import { isVerifyInfraError } from '@project-yahl/shared/verify/verify-infra';
import { parseVerifyResponse } from '@project-yahl/shared/verify/parse-response';
import { resolveClassifyResume } from '@project-yahl/shared/verify/build-file-prompt';

import { config } from '../config.js';

import { resolveVerifyJobDir, writeVerifyJobFiles } from './job-files.js';
import {
  markRequestActivityRunning,
  markRequestActivitySucceeded,
  registerRequestActivity,
  setRequestActivityFailed,
} from './request-activity.js';
import { runVerifyCli } from './run-verify-cli.js';
import { enqueueVerify } from './verify-queue.js';

const formatShortError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const runVerify = async (body: TVerifyRequest): Promise<TVerifyResponse> => {
  const startedAt = Date.now();
  const invocationId = body.invocationId?.trim() || randomUUID();
  const activity = {
    invocationId,
    requestId: body.requestId,
    sessionId: body.sessionId,
  };

  console.log(
    `[worker] verify start sessionId=${body.sessionId} requestId=${body.requestId} stageIndex=${body.stageIndex} invocationId=${invocationId}`,
  );

  const logDone = (pass: boolean, score: number) => {
    console.log(
      `[worker] verify done pass=${pass} score=${score} durationMs=${Date.now() - startedAt}`,
    );
  };

  if (!config.apiKey) {
    logDone(false, 0);

    setRequestActivityFailed({
      error: 'worker unavailable: CURSOR_API_KEY missing',
      ...activity,
      unavailable: true,
    });

    return {
      feedback: 'worker unavailable: CURSOR_API_KEY missing',
      pass: false,
      score: 0,
      unavailable: true,
    };
  }

  return enqueueVerify(async () => {
    registerRequestActivity(activity);
    markRequestActivityRunning(activity.sessionId, activity.requestId, activity.invocationId);

    const jobDir = resolveVerifyJobDir(config.workspaceRoot, body.sessionId, invocationId);
    const classifyResume = resolveClassifyResume(body.verifyResume, body.stageSnapshot);

    let minScore = body.minScore ?? 0.75;
    let prompt = '';

    try {
      const prepared = await writeVerifyJobFiles({
        body,
        invocationId,
        jobDir,
        rulesRoot: config.verifyRulesRoot,
      });

      minScore = prepared.minScore;
      prompt = prepared.prompt;

      const stdout = await runVerifyCli(jobDir, prompt);
      const text = stdout.trim();

      const resultPath = path.join(jobDir, 'result.json');

      try {
        const resultOnDisk = await fs.readFile(resultPath, 'utf8');

        if (resultOnDisk.trim()) {
          const parsed = parseVerifyResponse({
            classifyResume,
            minScore,
            text: resultOnDisk.trim(),
          });

          logDone(parsed.pass, parsed.score);
          markRequestActivitySucceeded(
            activity.sessionId,
            activity.requestId,
            activity.invocationId,
            JSON.stringify(parsed),
          );

          return parsed;
        }
      } catch {
        // fall through to stdout parse
      }

      const parsed = parseVerifyResponse({
        classifyResume,
        minScore,
        text,
      });

      await fs.writeFile(resultPath, JSON.stringify(parsed, null, 2), 'utf8');

      logDone(parsed.pass, parsed.score);
      markRequestActivitySucceeded(
        activity.sessionId,
        activity.requestId,
        activity.invocationId,
        JSON.stringify(parsed),
      );

      return parsed;
    } catch (error) {
      logDone(false, 0);

      const feedback = formatShortError(error);
      const unavailable = feedback === 'empty cli response'
        || isVerifyInfraError(feedback);

      console.log(
        `[worker] verify failed feedback=${feedback === 'empty cli response' ? 'verify returned empty response' : feedback} unavailable=${unavailable}`,
      );

      setRequestActivityFailed({
        error: feedback === 'empty cli response' ? 'verify returned empty response' : feedback,
        ...activity,
        unavailable,
      });

      return {
        feedback: feedback === 'empty cli response' ? 'verify returned empty response' : feedback,
        pass: false,
        score: 0,
        unavailable,
      };
    }
  });
};
