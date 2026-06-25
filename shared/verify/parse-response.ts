import type { TVerifyResumeAction } from './types.js';

export type TParseVerifyResponseInput = {
  classifyResume: boolean;
  minScore: number;
  text: string;
};

export type TParseVerifyResponseResult = {
  askUserRef?: string;
  feedback: string;
  pass: boolean;
  resumeAction?: TVerifyResumeAction;
  score: number;
};

export const parseVerifyResponse = (
  input: TParseVerifyResponseInput,
): TParseVerifyResponseResult => {
  const { classifyResume, minScore, text } = input;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? text) as {
    askUserRef?: string;
    feedback?: string;
    pass?: boolean;
    resumeAction?: string;
    score?: number;
  };

  const score = typeof parsed.score === 'number'
    ? Math.min(1, Math.max(0, parsed.score))
    : 0;

  const pass = typeof parsed.pass === 'boolean' ? parsed.pass : score >= minScore;
  const resumeAction = !pass && classifyResume
    ? (parsed.resumeAction === 'edit_answer'
      || parsed.resumeAction === 'reask'
      || parsed.resumeAction === 'follow_up'
      || parsed.resumeAction === 'rerun'
      ? parsed.resumeAction
      : 'rerun')
    : undefined;
  const askUserRef = resumeAction === 'edit_answer'
    || resumeAction === 'reask'
    || resumeAction === 'follow_up'
    ? (typeof parsed.askUserRef === 'string' ? parsed.askUserRef.trim() : undefined)
    : undefined;

  return {
    ...(askUserRef ? { askUserRef } : {}),
    feedback: parsed.feedback ?? text,
    pass,
    ...(resumeAction ? { resumeAction } : {}),
    score,
  };
};
