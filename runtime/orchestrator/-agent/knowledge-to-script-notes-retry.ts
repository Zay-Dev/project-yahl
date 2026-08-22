import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TStorage } from '@/shared/transports/-types';

import {
  KNOWLEDGE_TO_SCRIPT_NOTES_KEY,
  isKnowledgeToScriptNotesSatisfied,
  seedKnowledgeToScriptNotes,
} from '@project-yahl/shared/yahl/knowledge-to-script';

import {
  pauseForProduceKeys,
  produceKeysMaxRetries,
  writeProduceKeysDiagnostic,
} from './produce-keys-retry';

export const knowledgeToScriptNotesMaxRetries = produceKeysMaxRetries;

export const isKnowledgeToScriptNotesMissing = (storage: TStorage): boolean =>
  !isKnowledgeToScriptNotesSatisfied(storage.context.get(KNOWLEDGE_TO_SCRIPT_NOTES_KEY));

export const resetKnowledgeToScriptNotes = (storage: TStorage): void => {
  seedKnowledgeToScriptNotes(storage);
};

export const buildKnowledgeToScriptNotesSystemAppend = () => [
  'The previous stage run did not set a truthy __knowledge-to-script__notes value.',
  `Use set_context with key "${KNOWLEDGE_TO_SCRIPT_NOTES_KEY}" before finishing.`,
  'Notes must review ad-hoc free-flow / one-off bash that should become a script (or say none), and whether you created/grew one or why no new script after consideration.',
  'Do not list scripts you already ran — that is not notes content.',
  'The literal "reviewed" is allowed only when free-flow was checked and there is nothing further.',
  'Empty / null / false is not allowed and will force another retry.',
].join('\n');

const NOTES_RETRY_MARKER = 'did not set a truthy __knowledge-to-script__notes';

export const isKnowledgeToScriptNotesRetryAppend = (part: string) =>
  part.includes(NOTES_RETRY_MARKER);

export const pauseForKnowledgeToScriptNotes = async (params: {
  agentName: string;
  requestId: string;
  pipelineStageIndex: number;
  sessionId: string;
  stage: ParsedStage;
  storage: TStorage;
  attempt: number;
}) => {
  const diagnostic = await writeProduceKeysDiagnostic({
    attempt: params.attempt,
    requestId: params.requestId,
    sessionId: params.sessionId,
    stage: params.stage,
    storage: params.storage,
  });

  await pauseForProduceKeys({
    agentName: params.agentName,
    diagnosticPath: diagnostic.agentPath,
    missingKeys: [KNOWLEDGE_TO_SCRIPT_NOTES_KEY],
    pipelineStageIndex: params.pipelineStageIndex,
    requestId: params.requestId,
    sessionId: params.sessionId,
    stage: params.stage,
    storage: params.storage,
  });
};
