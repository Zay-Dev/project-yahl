import { exposedRoute } from '@/servers';

import './-inject';

import { createModelResponse } from './use-cases/model-response-write';
import { getSession } from './use-cases/read';
import { createStage, patchStage } from './use-cases/stage-write';
import { createToolCall } from './use-cases/tool-call-write';
import { patchSession, registerSession } from './use-cases/write';

exposedRoute('/api/sessions')
  .post('/:sessionId/register', registerSession)
  .patch('/:sessionId', patchSession)
  .get('/:sessionId', getSession)
  .post('/:sessionId/stages', createStage)
  .patch('/:sessionId/stages/:requestId', patchStage)
  .post('/:sessionId/stages/:requestId/model-responses', createModelResponse)
  .post('/:sessionId/stages/:requestId/tool-calls', createToolCall);
