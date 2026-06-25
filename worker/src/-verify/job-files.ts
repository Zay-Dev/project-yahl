import fs from 'fs/promises';
import path from 'path';

import type { TVerifyRequest } from '@project-yahl/shared/verify/types';

import { buildVerifyFilePrompt, resolveClassifyResume } from '@project-yahl/shared/verify/build-file-prompt';
import { loadVerifyRubric } from '@project-yahl/shared/verify/load-rubric';

export const resolveVerifyJobDir = (
  workspaceRoot: string,
  sessionId: string,
  invocationId: string,
) => path.join(workspaceRoot, 'sessions', sessionId, 'verify', invocationId);

export const writeVerifyJobFiles = async (params: {
  body: TVerifyRequest;
  invocationId: string;
  jobDir: string;
  rulesRoot: string;
}): Promise<{ minScore: number; prompt: string }> => {
  const { body, invocationId, jobDir, rulesRoot } = params;
  const minScore = body.minScore ?? 0.75;
  const classifyResume = resolveClassifyResume(body.verifyResume, body.stageSnapshot);
  const rubricText = await loadVerifyRubric(body.rubric, rulesRoot);

  await fs.mkdir(jobDir, { recursive: true });

  await Promise.all([
    fs.writeFile(
      path.join(jobDir, 'context.json'),
      JSON.stringify(body.contextSnapshot, null, 2),
      'utf8',
    ),
    fs.writeFile(path.join(jobDir, 'rubric.md'), rubricText, 'utf8'),
    fs.writeFile(
      path.join(jobDir, 'meta.json'),
      JSON.stringify({
        invocationId,
        minScore,
        requestId: body.requestId,
        sessionId: body.sessionId,
        stageIndex: body.stageIndex,
      }, null, 2),
      'utf8',
    ),
    body.stageSnapshot
      ? fs.writeFile(
        path.join(jobDir, 'stage-snapshot.json'),
        JSON.stringify(body.stageSnapshot, null, 2),
        'utf8',
      )
      : Promise.resolve(),
  ]);

  const prompt = buildVerifyFilePrompt({ classifyResume, minScore });

  await fs.writeFile(path.join(jobDir, 'prompt.md'), prompt, 'utf8');

  return { minScore, prompt };
};
