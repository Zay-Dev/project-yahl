import fs from 'fs/promises';
import path from 'path';

import type { TKnowledgeQaReviewRequest } from '@project-yahl/shared/knowledge-qa/types';

import { buildKnowledgeQaFilePrompt } from '@project-yahl/shared/knowledge-qa/build-knowledge-qa-prompt';
import { loadKnowledgeQaChecklist } from '@project-yahl/shared/knowledge-qa/load-checklist';

export const resolveKnowledgeQaJobDir = (
  workspaceRoot: string,
  sessionId: string,
  invocationId: string,
) => path.join(workspaceRoot, 'sessions', sessionId, 'knowledge-qa', invocationId);

export const writeKnowledgeQaJobFiles = async (params: {
  body: TKnowledgeQaReviewRequest;
  checklistRoot: string;
  invocationId: string;
  jobDir: string;
}): Promise<{ prompt: string }> => {
  const { body, checklistRoot, invocationId, jobDir } = params;
  const checklistText = await loadKnowledgeQaChecklist(checklistRoot);

  await fs.mkdir(jobDir, { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(jobDir, 'corpus.md'), body.corpusMd, 'utf8'),
    fs.writeFile(path.join(jobDir, 'checklist.md'), checklistText, 'utf8'),
    fs.writeFile(
      path.join(jobDir, 'audit.json'),
      JSON.stringify({ issues: body.auditIssues ?? [] }, null, 2),
      'utf8',
    ),
    fs.writeFile(
      path.join(jobDir, 'meta.json'),
      JSON.stringify({
        invocationId,
        requestId: body.requestId,
        sessionId: body.sessionId,
        topic: body.topic,
      }, null, 2),
      'utf8',
    ),
  ]);

  const prompt = buildKnowledgeQaFilePrompt();

  await fs.writeFile(path.join(jobDir, 'prompt.md'), prompt, 'utf8');

  return { prompt };
};
