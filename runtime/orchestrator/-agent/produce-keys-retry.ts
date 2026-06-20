import fs from 'fs/promises';
import path from 'path';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TStorage } from '@/shared/transports/-types';

import { shutdownAgent } from '@/orchestrator/-docker';
import { toParsedStageSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';

import {
  produceKeysDiagnosticAgentPath,
  produceKeysDiagnosticPath,
} from '@/orchestrator/-utils/workspace-paths';

import { postVerifyCheckpoint } from '@/orchestrator/-verify/session-api';
import { ProduceKeysFailedError } from '@/orchestrator/-verify/errors';

export const produceKeysMaxRetries = () => {
  const raw = process.env.PRODUCE_KEYS_MAX_RETRIES?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 3;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
};

export const missingProduceKeys = (
  stage: ParsedStage,
  storage: TStorage,
) =>
  stage.spec.produceContextKeys?.filter(
    (key) => storage.context.get(key) == null,
  ) ?? [];

const _serializeStorage = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  types: Object.fromEntries(storage.types.entries()),
});

const _serializeContextSnapshot = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  stage: {},
  types: Object.fromEntries(storage.types.entries()),
});

const buildDiagnosticBody = (params: {
  attempt: number;
  logicPreview: string;
  missingKeys: string[];
  requestId: string;
  storage: TStorage;
}) => {
  const contextSnapshot = Object.fromEntries(params.storage.context.entries());

  return [
    '# Produce-keys diagnostic',
    '',
    '## Missing keys',
    ...params.missingKeys.map((key) => `- \`${key}\``),
    '',
    '## Context',
    `- **requestId**: ${params.requestId}`,
    `- **attempt**: ${params.attempt}`,
    `- **context keys present**: ${Object.keys(contextSnapshot).join(', ') || '(none)'}`,
    '',
    '## Stage logic (preview)',
    '```',
    params.logicPreview,
    '```',
    '',
    '## Context snapshot',
    '```json',
    JSON.stringify(contextSnapshot, null, 2),
    '```',
    '',
  ].join('\n');
};

export const writeProduceKeysDiagnostic = async (params: {
  attempt: number;
  requestId: string;
  sessionId: string;
  stage: ParsedStage;
  storage: TStorage;
}) => {
  const absolute = produceKeysDiagnosticPath(params.sessionId, params.requestId, params.attempt);
  const logicPreview = params.stage.lines.trim().slice(0, 2_000);
  const missingKeys = missingProduceKeys(params.stage, params.storage);
  const body = buildDiagnosticBody({
    attempt: params.attempt,
    logicPreview,
    missingKeys,
    requestId: params.requestId,
    storage: params.storage,
  });

  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, body, 'utf8');

  return {
    agentPath: produceKeysDiagnosticAgentPath(params.requestId, params.attempt),
    absolute,
    missingKeys,
  };
};

export const buildProduceKeysSystemAppend = (params: {
  agentPath: string;
  missingKeys: string[];
}) => [
  'The previous stage run did not produce required context keys.',
  `Missing keys: ${params.missingKeys.join(', ')}.`,
  `Read the diagnostic report at ${params.agentPath} and fix the stage output.`,
  'Use set_context to write every missing produceContextKeys value before finishing.',
].join('\n');

export const pauseForProduceKeys = async (params: {
  agentName: string;
  diagnosticPath: string;
  missingKeys: string[];
  pipelineStageIndex: number;
  requestId: string;
  sessionId: string;
  stage: ParsedStage;
  storage: TStorage;
}) => {
  const feedback = [
    `Missing produceContextKeys: ${params.missingKeys.join(', ')}`,
    `Diagnostic: ${params.diagnosticPath}`,
  ].join('\n');

  await globalThis.sessionTracker?.flush?.();

  const { verifyId } = await postVerifyCheckpoint(params.sessionId, {
    contextSnapshot: _serializeContextSnapshot(params.storage),
    feedback,
    kind: 'produce_keys',
    parsedStageSnapshot: toParsedStageSnapshot(params.stage),
    requestId: params.requestId,
    score: 0,
    stage: params.stage.spec,
    stageIndex: params.pipelineStageIndex,
    storageSnapshot: _serializeStorage(params.storage),
  });

  await globalThis.sessionTracker?.flush?.();

  await shutdownAgent(params.agentName, params.sessionId);

  throw new ProduceKeysFailedError({
    feedback,
    missingKeys: params.missingKeys,
    requestId: params.requestId,
    stageIndex: params.pipelineStageIndex,
    verifyId,
  });
};
