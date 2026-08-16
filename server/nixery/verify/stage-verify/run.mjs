import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { runSingleLlmCompletion } from '../lib/llm-completion.mjs';
import {
  appendNixeryRetryUserMessage,
  readNixeryRetryFeedback,
} from '../lib/nixery-retry-feedback.mjs';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

const DEFAULT_RUBRIC =
  'Score completeness, correctness, and adherence to produceContextKeys.';

const RESUME_ACTIONS = new Set(['rerun', 'edit_answer', 'reask', 'follow_up']);
const MAX_REBUTTALS = 2;
const MAX_PARSE_ATTEMPTS = 3;

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const parseMaybeJson = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const resolveRubricText = async (rubric) => {
  if (typeof rubric !== 'string' || !rubric.trim()) {
    return DEFAULT_RUBRIC;
  }

  const trimmed = rubric.trim();
  const namedPath = path.join('/data/verify', `${trimmed}.md`);

  try {
    return await fs.readFile(namedPath, 'utf8');
  } catch {
    return trimmed;
  }
};

export const resolveClassifyResume = (verifyResume, stageSnapshot) => {
  if (verifyResume === false || verifyResume === 'false') {
    return false;
  }

  const snapshot = typeof stageSnapshot === 'object' && stageSnapshot
    ? stageSnapshot
    : parseMaybeJson(stageSnapshot);

  return Boolean(snapshot?.askUser?.length);
};

export const buildSystemPrompt = (params) => {
  const resumeFields = params.classifyResume
    ? ',"resumeAction":"rerun"|"edit_answer"|"reask"|"follow_up","askUserRef":"<id when edit_answer, reask, or follow_up>"'
    : '';
  const resumeGuidance = params.classifyResume
    ? [
      'When pass is false, also set resumeAction:',
      '- rerun: stage output failed verify but ask-user answers are valid',
      '- edit_answer: question/options valid but the user answer is invalid for the rubric',
      '- reask: the ask-user question or options are invalid or unusable',
      '- follow_up: profile/output is incomplete — need a follow-up ask_user batch',
      'Set askUserRef when resumeAction is edit_answer, reask, or follow_up.',
    ].join('\n')
    : '';

  return [
    'You are a YAHL stage output verifier.',
    'Return a single compact JSON object only. No markdown fences, no prose outside JSON.',
    `Schema: {"score":0-1,"pass":boolean,"feedback":"...","failedChecks":[{"id":"<short-id>","reason":"..."}]${resumeFields}}`,
    'Keep feedback <= 200 characters. Prefer short failedChecks reasons.',
    `Minimum score to pass: ${params.minScore}`,
    'When pass is false, failedChecks must list each failed rubric item with a stable id and reason.',
    'When pass is true, omit failedChecks or use [].',
    'If context includes verify_rebuttal and prior verify_failed_checks, reconsider those checks when the rebuttal supplies concrete evidence.',
    `Allow at most ${MAX_REBUTTALS} rebuttal reconsiderations per stage (see verify_rebuttal_count). Do not invent evidence.`,
    resumeGuidance,
  ].filter(Boolean).join('\n\n');
};

const parseFailedChecks = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const checks = value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const reason = typeof item.reason === 'string' ? item.reason.trim() : '';

    if (!id || !reason) {
      return [];
    }

    return [{ id, reason }];
  });

  return checks.length > 0 ? checks : undefined;
};

export const parseVerifyContent = (params) => {
  const text = typeof params.text === 'string' ? params.text.trim() : '';

  if (!text) {
    throw new Error('stage-verify: empty LLM content');
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? text);
  const score = typeof parsed.score === 'number'
    ? Math.min(1, Math.max(0, parsed.score))
    : 0;
  const pass = typeof parsed.pass === 'boolean' ? parsed.pass : score >= params.minScore;
  const resumeAction = !pass && params.classifyResume && RESUME_ACTIONS.has(parsed.resumeAction)
    ? parsed.resumeAction
    : !pass && params.classifyResume
      ? 'rerun'
      : undefined;
  const askUserRef = resumeAction === 'edit_answer'
    || resumeAction === 'reask'
    || resumeAction === 'follow_up'
    ? (typeof parsed.askUserRef === 'string' ? parsed.askUserRef.trim() : undefined)
    : undefined;
  const failedChecks = !pass ? parseFailedChecks(parsed.failedChecks) : undefined;
  const feedback = typeof parsed.feedback === 'string' ? parsed.feedback : text;

  return {
    ...(askUserRef ? { askUserRef } : {}),
    ...(failedChecks ? { failedChecks } : {}),
    feedback: feedback.length > 200 ? `${feedback.slice(0, 197)}...` : feedback,
    pass,
    ...(resumeAction ? { resumeAction } : {}),
    score,
  };
};

const buildRebuttalSection = (contextSnapshot) => {
  const ctx = contextSnapshot?.context && typeof contextSnapshot.context === 'object'
    ? contextSnapshot.context
    : {};
  const rebuttal = ctx.verify_rebuttal;
  const priorChecks = ctx.verify_failed_checks;
  const count = Number(ctx.verify_rebuttal_count ?? 0);

  if (!rebuttal && !(Array.isArray(priorChecks) && priorChecks.length)) {
    return '';
  }

  return [
    '\n## Prior verify fail / agent rebuttal\n',
    `verify_rebuttal_count: ${Number.isFinite(count) ? count : 0} (max ${MAX_REBUTTALS})`,
    priorChecks ? `\nprior verify_failed_checks:\n${JSON.stringify(priorChecks, null, 2)}` : '',
    rebuttal ? `\nverify_rebuttal:\n${JSON.stringify(rebuttal, null, 2)}` : '',
  ].join('\n');
};

export const runVerifyWithParseRetries = async (params) => {
  const messages = [...params.messages];
  let lastError = 'stage-verify: empty LLM content';

  for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS; attempt += 1) {
    const content = await runSingleLlmCompletion({
      defId: params.defId,
      messages,
      round: attempt,
    });

    try {
      return parseVerifyContent({
        classifyResume: params.classifyResume,
        minScore: params.minScore,
        text: content,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      logProgress(
        params.defId,
        `parse retry attempt=${attempt + 1}/${MAX_PARSE_ATTEMPTS} error=${lastError}`,
      );

      if (attempt + 1 >= MAX_PARSE_ATTEMPTS) {
        break;
      }

      messages.push({
        content: [
          'Previous reply was not valid compact JSON for the verify schema.',
          `Parse error: ${lastError}`,
          'Reply again with a single JSON object only (no markdown). Keep feedback <= 200 characters.',
        ].join('\n'),
        role: 'user',
      });
    }
  }

  throw new Error(lastError);
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const outputName = typeof input.output === 'string' && input.output.trim()
    ? input.output.trim()
    : 'result.json';
  const outputPath = path.join(workspace, outputName);

  const writeResult = async (result) => {
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  };

  const minScoreRaw = Number(input.minScore);
  const minScore = Number.isFinite(minScoreRaw) ? minScoreRaw : 0.75;
  const contextSnapshot = parseMaybeJson(input.contextSnapshot) ?? input.contextSnapshot;
  const stageSnapshot = parseMaybeJson(input.stageSnapshot);
  const classifyResume = resolveClassifyResume(input.verifyResume, stageSnapshot);

  logProgress(defId, `start minScore=${minScore} classifyResume=${classifyResume}`);

  try {
    if (!contextSnapshot || typeof contextSnapshot !== 'object') {
      await writeResult({
        feedback: 'stage-verify: contextSnapshot required',
        pass: false,
        score: 0,
        unavailable: true,
      });
      process.exit(1);
    }

    const rubricText = await resolveRubricText(
      typeof input.rubric === 'string' ? input.rubric : undefined,
    );

    const messages = [
      { content: buildSystemPrompt({ classifyResume, minScore }), role: 'system' },
      {
        content: [
          '## Rubric\n',
          rubricText,
          '\n## Context snapshot\n',
          JSON.stringify(contextSnapshot, null, 2),
          stageSnapshot
            ? `\n## Stage snapshot\n${JSON.stringify(stageSnapshot, null, 2)}`
            : '',
          buildRebuttalSection(contextSnapshot),
        ].join('\n'),
        role: 'user',
      },
    ];

    appendNixeryRetryUserMessage(messages, readNixeryRetryFeedback(input));

    const parsed = await runVerifyWithParseRetries({
      classifyResume,
      defId,
      messages,
      minScore,
    });

    await writeResult(parsed);
    logProgress(defId, `done pass=${parsed.pass} score=${parsed.score}`);
  } catch (error) {
    const feedback = error instanceof Error ? error.message : 'stage-verify failed';

    await writeResult({
      feedback,
      pass: false,
      score: 0,
      unavailable: true,
    });
    logProgress(defId, `done unavailable error=${feedback}`);
    process.exit(1);
  }
};

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
}
