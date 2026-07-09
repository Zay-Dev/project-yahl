import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import type { TKnowledgeQaReviewRequest, TKnowledgeQaReviewResponse } from '@project-yahl/shared/knowledge-qa/types';

import { parseKnowledgeQaReviewResponse } from '@project-yahl/shared/knowledge-qa/parse-response';
import { isVerifyInfraError } from '@project-yahl/shared/verify/verify-infra';

import { config } from '../config.js';
import { enqueueVerify } from '../-verify/verify-queue.js';

import { resolveKnowledgeQaJobDir, writeKnowledgeQaJobFiles } from './job-files.js';
import { runKnowledgeQaCli } from './run-knowledge-qa-cli.js';

const formatShortError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const runKnowledgeQaReview = async (
  body: TKnowledgeQaReviewRequest,
): Promise<TKnowledgeQaReviewResponse & { unavailable?: boolean }> => {
  const startedAt = Date.now();
  const invocationId = body.invocationId?.trim() || randomUUID();

  console.log(
    `[worker] knowledge-qa start sessionId=${body.sessionId} requestId=${body.requestId} topic=${body.topic} invocationId=${invocationId}`,
  );

  if (!config.apiKey) {
    console.log(`[worker] knowledge-qa done unavailable durationMs=${Date.now() - startedAt}`);

    return {
      checks: [],
      summary: 'worker unavailable: CURSOR_API_KEY missing',
      todos: [],
      topic: body.topic,
      unavailable: true,
    };
  }

  return enqueueVerify(async () => {
    const jobDir = resolveKnowledgeQaJobDir(config.workspaceRoot, body.sessionId, invocationId);
    let prompt = '';

    try {
      const prepared = await writeKnowledgeQaJobFiles({
        body,
        checklistRoot: config.knowledgeQaChecklistRoot,
        invocationId,
        jobDir,
      });

      prompt = prepared.prompt;

      const stdout = await runKnowledgeQaCli(jobDir, prompt);
      const text = stdout.trim();
      const resultPath = path.join(jobDir, 'result.json');

      try {
        const resultOnDisk = await fs.readFile(resultPath, 'utf8');

        if (resultOnDisk.trim()) {
          const parsed = parseKnowledgeQaReviewResponse(resultOnDisk.trim());

          console.log(
            `[worker] knowledge-qa done checks=${parsed.checks.length} todos=${parsed.todos.length} durationMs=${Date.now() - startedAt}`,
          );

          return parsed;
        }
      } catch {
        // fall through to stdout parse
      }

      const parsed = parseKnowledgeQaReviewResponse(text);

      await fs.writeFile(resultPath, JSON.stringify(parsed, null, 2), 'utf8');

      console.log(
        `[worker] knowledge-qa done checks=${parsed.checks.length} todos=${parsed.todos.length} durationMs=${Date.now() - startedAt}`,
      );

      return parsed;
    } catch (error) {
      const feedback = formatShortError(error);
      const unavailable = feedback === 'empty cli response' || isVerifyInfraError(feedback);

      console.log(
        `[worker] knowledge-qa failed feedback=${feedback} unavailable=${unavailable} durationMs=${Date.now() - startedAt}`,
      );

      return {
        checks: [],
        summary: feedback === 'empty cli response' ? 'knowledge-qa returned empty response' : feedback,
        todos: [],
        topic: body.topic,
        unavailable,
      };
    }
  });
};
