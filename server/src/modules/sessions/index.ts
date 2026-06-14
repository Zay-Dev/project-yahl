import { exposedRoute } from '@/servers';

import './-inject';

import { getForkSession } from './use-cases/fork-session-read';
import { createForkSession } from './use-cases/fork-session-write';
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
import { createToolCall } from './use-cases/tool-call-write';
import { patchSession, registerSession } from './use-cases/write';
import {
  getAskUserQuestion,
  listAskUserQuestions,
} from './use-cases/ask-user-read';
import {
  answerAskUserQuestion,
  createAskUserQuestion,
} from './use-cases/ask-user-write';

exposedRoute('/api/fork-sessions')
  .get('/:forkSessionId', getForkSession);

exposedRoute('/api/sessions')
  .get('/', getSessions)
  .post('/:sessionId/register', registerSession)
  .patch('/:sessionId', patchSession)
  .get('/:sessionId', getSession)
  .delete('/:sessionId', deleteSession)
  .get('/:sessionId/events/stream', getSessionEventsStream)
  .get('/:sessionId/stages/replay', getSessionStagesReplay)
  .get('/:sessionId/stages', getSessionStages)
  .post('/:sessionId/fork-sessions', createForkSession)
  .post('/:sessionId/stages', createStage)
  .get('/:sessionId/stages/:requestId', getSessionStage)
  .patch('/:sessionId/stages/:requestId', patchStage)
  .post('/:sessionId/stages/:requestId/model-responses', createModelResponse)
  .post('/:sessionId/stages/:requestId/tool-calls', createToolCall)
  .get('/:sessionId/ask-user/questions', listAskUserQuestions)
  .post('/:sessionId/ask-user/questions', createAskUserQuestion)
  .get('/:sessionId/ask-user/questions/:questionId', getAskUserQuestion)
  .post('/:sessionId/ask-user/questions/:questionId/answer', answerAskUserQuestion);
