import { exposedRoute } from '@/servers';

import './-inject';

import { getForkSession } from './use-cases/fork-session-read';
import { createForkSession } from './use-cases/fork-session-write';
import { createRepairSession } from './use-cases/repair-session-write';
import { createModelResponse } from './use-cases/model-response-write';
import { getSessionEventsStream } from './use-cases/session-events-stream';
import { deleteSession } from './use-cases/delete-session';
import { getSession, getSessions } from './use-cases/read';
import {
  getSessionStage,
  getSessionStages,
  getSessionStagesReplay,
} from './use-cases/stage-read';
import { createStage, patchStage } from './use-cases/stage-write';
import { createToolCall, createToolCallResults } from './use-cases/tool-call-write';
import { patchSession, registerSession } from './use-cases/write';
import {
  getAskUserQuestion,
  listAskUserQuestions,
  listPendingAskUserQuestions,
} from './use-cases/ask-user-read';
import {
  answerAskUserBatch,
  createAskUserBatch,
} from './use-cases/ask-user-write';
import {
  createVerifyCheckpoint,
  editVerifyCheckpointAnswer,
  getVerifyCheckpoint,
  listVerifyCheckpoints,
  resolveVerifyPass,
  resolveVerifyStart,
  resumeVerifyCheckpoint,
} from './use-cases/verify-write';
import { getUsageSummary } from './use-cases/usage-summary-read';
import { getQuotaStatus } from './use-cases/quota-status-read';
import { patchQuota } from './use-cases/quota-write';
import { stopSession } from './use-cases/stop-session-write';
import {
  createUserPauseCheckpoint,
  getUserPauseCheckpoint,
  listUserPauseCheckpoints,
  requestSessionPauseRun,
  resumeUserPauseCheckpoint,
} from './use-cases/user-pause-write';

exposedRoute('/api/fork-sessions')
  .get('/:forkSessionId', getForkSession);

exposedRoute('/api/sessions')
  .get('/', getSessions)
  .get('/ask-user/pending', listPendingAskUserQuestions)
  .post('/:sessionId/register', registerSession)
  .patch('/:sessionId', patchSession)
  .get('/:sessionId', getSession)
  .delete('/:sessionId', deleteSession)
  .post('/:sessionId/stop', stopSession)
  .post('/:sessionId/pause', requestSessionPauseRun)
  .get('/:sessionId/events/stream', getSessionEventsStream)
  .get('/:sessionId/stages/replay', getSessionStagesReplay)
  .get('/:sessionId/stages', getSessionStages)
  .post('/:sessionId/fork-sessions', createForkSession)
  .post('/:sessionId/repair-sessions', createRepairSession)
  .post('/:sessionId/stages', createStage)
  .get('/:sessionId/stages/:requestId', getSessionStage)
  .patch('/:sessionId/stages/:requestId', patchStage)
  .post('/:sessionId/stages/:requestId/model-responses', createModelResponse)
  .post('/:sessionId/stages/:requestId/tool-calls', createToolCall)
  .post('/:sessionId/stages/:requestId/tool-call-results', createToolCallResults)
  .get('/:sessionId/ask-user/questions', listAskUserQuestions)
  .post('/:sessionId/ask-user/batches', createAskUserBatch)
  .post('/:sessionId/ask-user/batches/:batchId/answer', answerAskUserBatch)
  .get('/:sessionId/ask-user/questions/:questionId', getAskUserQuestion)
  .post('/:sessionId/stages/:requestId/verify-pass', resolveVerifyPass)
  .post('/:sessionId/stages/:requestId/verify-start', resolveVerifyStart)
  .post('/:sessionId/verify-checkpoints', createVerifyCheckpoint)
  .get('/:sessionId/verify-checkpoints', listVerifyCheckpoints)
  .get('/:sessionId/verify-checkpoints/:verifyId', getVerifyCheckpoint)
  .post('/:sessionId/verify-checkpoints/:verifyId/resume', resumeVerifyCheckpoint)
  .post('/:sessionId/verify-checkpoints/:verifyId/edit-answer', editVerifyCheckpointAnswer)
  .post('/:sessionId/user-pause-checkpoints', createUserPauseCheckpoint)
  .get('/:sessionId/user-pause-checkpoints', listUserPauseCheckpoints)
  .get('/:sessionId/user-pause-checkpoints/:pauseId', getUserPauseCheckpoint)
  .post('/:sessionId/user-pause-checkpoints/:pauseId/resume', resumeUserPauseCheckpoint);

exposedRoute('/api/quota')
  .get('/status', getQuotaStatus);

exposedRoute('/api/internal')
  .get('/usage/summary', getUsageSummary)
  .post('/quota', patchQuota);
