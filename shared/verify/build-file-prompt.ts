import type { TVerifyStageSnapshot } from './types.js';

export const buildVerifyFilePrompt = (params: {
  classifyResume: boolean;
  minScore: number;
}): string => {
  const resumeFields = params.classifyResume
    ? ',"resumeAction":"rerun"|"edit_answer"|"reask"|"follow_up","askUserRef":"<id when edit_answer, reask, or follow_up>"'
    : '';
  const resumeGuidance = params.classifyResume
    ? [
      'When pass is false, also set resumeAction in result.json:',
      '- rerun: stage output failed verify but ask-user answers are valid',
      '- edit_answer: question/options valid but the user answer is invalid for the rubric',
      '- reask: the ask-user question or options are invalid or unusable',
      '- follow_up: profile/output is incomplete — need a follow-up ask_user batch (often 1 question)',
      'Set askUserRef when resumeAction is edit_answer, reask, or follow_up.',
    ].join('\n')
    : '';

  const parts = [
    'You are a YAHL stage output verifier.',
    `Read context.json, rubric.md, and meta.json in this directory${params.classifyResume ? ' (and stage-snapshot.json if present)' : ''}.`,
    `Write result.json with JSON only: {"score":0-1,"pass":boolean,"feedback":"..."${resumeFields}}`,
    `Minimum score to pass: ${params.minScore}`,
    'Do not modify files other than result.json.',
  ];

  if (resumeGuidance) {
    parts.push(resumeGuidance);
  }

  return parts.join('\n\n');
};

export const resolveClassifyResume = (
  verifyResume: boolean | undefined,
  stageSnapshot?: TVerifyStageSnapshot,
): boolean => verifyResume !== false && Boolean(stageSnapshot?.askUser?.length);
