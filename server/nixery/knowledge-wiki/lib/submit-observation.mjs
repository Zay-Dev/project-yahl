import {
  formatObservationMarkdown,
  observationPagePath,
  runUpsertKnowledgePage,
  validateKnowledgeObservation,
} from '/opt/nixery/plugin/lib/dist/index.js';

import { createSubmitKnowledgeObservation } from './submit-observation-core.mjs';

export const submitKnowledgeObservation = createSubmitKnowledgeObservation({
  formatObservationMarkdown,
  observationPagePath,
  runUpsertKnowledgePage,
  validateKnowledgeObservation,
});
